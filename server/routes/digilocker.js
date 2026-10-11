const express = require('express');
const router = express.Router();

/**
 * DigiLocker & Kwik.ID (Think360.ai) Integration Controller
 * Compliant with Indian Digital Public Infrastructure (DPI) & API Setu standards
 */

const KWIKID_AUTH_TOKEN = process.env.KWIKID_AUTH_TOKEN || process.env.KWIKID_API_TOKEN;
const KWIKID_BASE_URL = process.env.KWIKID_BASE_URL || 'https://verify.getkwikid.com';
const DEFAULT_CALLBACK_URL = process.env.CLIENT_CALLBACK_URL || 'http://localhost:3000/api/digilocker/callback';
const REQUEST_TIMEOUT_MS = 15000;

// In-memory session store (or integrate with SQLite / Supabase / Redis)
const verificationSessions = new Map();

/**
 * 1. OAUTH 2.0 INITIATE FLOW
 * POST /api/digilocker/initiate
 * Generates the authorization consent URL for DigiLocker
 */
router.post('/initiate', async (req, res) => {
  try {
    const token = (KWIKID_AUTH_TOKEN || '').trim();
    if (!token) {
      return res.status(500).json({
        success: false,
        message: 'Kwik.ID authorization token (KWIKID_AUTH_TOKEN) is not configured on the server.'
      });
    }

    const redirectUrl = req.body?.redirect_url || DEFAULT_CALLBACK_URL;
    if (!redirectUrl) {
      return res.status(400).json({
        success: false,
        message: 'Missing redirect_url in request body or CLIENT_CALLBACK_URL in environment.'
      });
    }

    const endpoint = `${KWIKID_BASE_URL}/verification/v2/digilocker/initiate`;
    const payload = { redirect_url: redirectUrl };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } catch (networkErr) {
      clearTimeout(timeoutId);
      if (networkErr.name === 'AbortError') {
        return res.status(504).json({
          success: false,
          message: 'DigiLocker service timed out. Upstream gateway did not respond within 15 seconds.'
        });
      }
      throw networkErr;
    }

    clearTimeout(timeoutId);

    const responseData = await response.json().catch(() => null);

    if (!response.ok) {
      const statusCode = response.status;
      console.error(`[Kwik.ID DigiLocker API Error] HTTP ${statusCode}:`, responseData);

      if (statusCode === 400) {
        return res.status(400).json({
          success: false,
          message: responseData?.message || 'Invalid request parameter or unauthorized callback schema.',
          details: responseData
        });
      }

      if (statusCode === 403) {
        return res.status(403).json({
          success: false,
          message: 'Access forbidden: Invalid or expired Kwik.ID API token.',
          details: responseData
        });
      }

      return res.status(statusCode >= 500 ? 502 : statusCode).json({
        success: false,
        message: responseData?.message || 'Upstream DigiLocker provider error.',
        details: responseData
      });
    }

    if (!responseData || !responseData.redirection_url) {
      return res.status(502).json({
        success: false,
        message: 'Invalid response from DigiLocker provider: missing redirection_url'
      });
    }

    // Cache session if transaction/request ID is returned
    const transactionId = responseData.request_id || responseData.transaction_id || `txn_${Date.now()}`;
    verificationSessions.set(transactionId, {
      initiatedAt: new Date().toISOString(),
      status: 'INITIATED',
      redirectionUrl: responseData.redirection_url
    });

    return res.status(200).json({
      success: true,
      transaction_id: transactionId,
      redirect_url: responseData.redirection_url
    });

  } catch (error) {
    console.error('[DigiLocker Controller Exception]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to initiate DigiLocker session due to an unexpected server error.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * 2. OAUTH 2.0 CALLBACK HANDLER
 * GET & POST /api/digilocker/callback
 * Handles redirection from DigiLocker / Kwik.ID post user consent
 */
const handleCallback = (req, res) => {
  const query = { ...req.query, ...req.body };
  const { status, code, state, error, error_description, transaction_id, request_id } = query;

  console.log('[DigiLocker Callback Received]:', query);

  // Diagnostic mapping for standard Indian DPI / DigiLocker errors
  let failureReason = null;
  if (error === 'user_consent_not_given' || status === 'denied') {
    failureReason = 'User declined DigiLocker consent.';
  } else if (error === 'aadhaar_not_linked') {
    failureReason = 'Aadhaar is not linked to the user DigiLocker account.';
  } else if (error === 'access_denied') {
    failureReason = 'Access was denied by the user or identity provider.';
  } else if (error) {
    failureReason = error_description || error;
  }

  const txnKey = transaction_id || request_id || state;
  if (txnKey && verificationSessions.has(txnKey)) {
    const session = verificationSessions.get(txnKey);
    session.status = failureReason ? 'FAILED' : 'SUCCESS';
    session.code = code;
    session.error = failureReason;
    session.completedAt = new Date().toISOString();
  }

  // Redirect user back to the application profile/settings page with status banner
  const targetUrl = failureReason
    ? `/pages/profile.html?digilocker=error&reason=${encodeURIComponent(failureReason)}`
    : `/pages/profile.html?digilocker=success&code=${encodeURIComponent(code || 'OK')}`;

  return res.redirect(targetUrl);
};

router.get('/callback', handleCallback);
router.post('/callback', handleCallback);

/**
 * 3. VERIFICATION STATUS CHECK
 * GET /api/digilocker/status/:transactionId
 */
router.get('/status/:transactionId', (req, res) => {
  const { transactionId } = req.params;
  const session = verificationSessions.get(transactionId);

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Transaction ID not found or expired.'
    });
  }

  return res.json({
    success: true,
    data: session
  });
});

/**
 * 4. FETCH VERIFIED DOCUMENTS (Aadhaar, PAN, DL)
 * POST /api/digilocker/fetch-documents
 */
router.post('/fetch-documents', async (req, res) => {
  try {
    const { transaction_id, document_type = 'AADHAAR' } = req.body;
    const token = (KWIKID_AUTH_TOKEN || '').trim();

    if (!token) {
      return res.status(500).json({
        success: false,
        message: 'Kwik.ID authorization token is not configured.'
      });
    }

    const endpoint = `${KWIKID_BASE_URL}/verification/v2/digilocker/fetch`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ transaction_id, document_type })
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: data?.message || 'Failed to fetch verified documents from DigiLocker provider.',
        details: data
      });
    }

    return res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('[DigiLocker Document Fetch Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Unexpected error fetching DigiLocker documents.',
      error: error.message
    });
  }
});

module.exports = router;
