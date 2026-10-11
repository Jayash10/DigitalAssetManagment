const express = require('express');
const router = express.Router();

/**
 * DigiLocker & Kwik.ID (Think360.ai) Integration Controller
 * Compliant with Indian Digital Public Infrastructure (DPI) & API Setu standards
 * Includes high-fidelity Sandbox Simulation fallback when KWIKID_AUTH_TOKEN is not configured
 */

const KWIKID_AUTH_TOKEN = process.env.KWIKID_AUTH_TOKEN || process.env.KWIKID_API_TOKEN;
const KWIKID_BASE_URL = process.env.KWIKID_BASE_URL || 'https://verify.getkwikid.com';
const DEFAULT_CALLBACK_URL = process.env.CLIENT_CALLBACK_URL || 'http://localhost:3000/api/digilocker/callback';
const REQUEST_TIMEOUT_MS = 15000;

// In-memory session store
const verificationSessions = new Map();

/**
 * 1. OAUTH 2.0 INITIATE FLOW
 * POST /api/digilocker/initiate
 * Generates the authorization consent URL for DigiLocker
 */
router.post('/initiate', async (req, res) => {
  try {
    const token = (KWIKID_AUTH_TOKEN || '').trim();
    const isSandbox = !token || token.toLowerCase() === 'sandbox' || token.toLowerCase() === 'mock';

    const redirectUrl = req.body?.redirect_url || DEFAULT_CALLBACK_URL;
    if (!redirectUrl) {
      return res.status(400).json({
        success: false,
        message: 'Missing redirect_url in request body or CLIENT_CALLBACK_URL in environment.'
      });
    }

    // -------------------------------------------------------------------------
    // Sandbox / Development Simulation Mode (Active when token is not provided)
    // -------------------------------------------------------------------------
    if (isSandbox) {
      console.log('🏛️  [DigiLocker] Initiating Sandbox Simulator session (KWIKID_AUTH_TOKEN not set)...');
      const transactionId = `sbx_txn_${Date.now()}`;
      verificationSessions.set(transactionId, {
        initiatedAt: new Date().toISOString(),
        status: 'INITIATED',
        isSandbox: true,
        redirectUrl
      });

      const sandboxUrl = `/api/digilocker/sandbox-consent?transaction_id=${transactionId}&redirect_url=${encodeURIComponent(redirectUrl)}`;

      return res.status(200).json({
        success: true,
        is_sandbox: true,
        transaction_id: transactionId,
        redirect_url: sandboxUrl,
        message: 'Initiated DigiLocker session in Sandbox Simulator mode.'
      });
    }

    // -------------------------------------------------------------------------
    // Production Kwik.ID API Integration
    // -------------------------------------------------------------------------
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
 * 2. SANDBOX CONSENT PAGE (High-Fidelity DPI Simulation)
 * GET /api/digilocker/sandbox-consent
 */
router.get('/sandbox-consent', (req, res) => {
  const { transaction_id, redirect_url } = req.query;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DigiLocker - National Digital Locker Gateway</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
    body { background: #f0f4f8; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .consent-card { background: #ffffff; width: 100%; max-width: 480px; border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.08); overflow: hidden; border: 1px solid #e2e8f0; }
    .card-header { background: linear-gradient(135deg, #003366, #0052cc); color: white; padding: 24px; text-align: center; }
    .emblem-pill { display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.15); padding: 6px 14px; border-radius: 50px; font-size: 12px; font-weight: 600; margin-bottom: 12px; letter-spacing: 0.5px; }
    .header-title { font-size: 20px; font-weight: 800; }
    .header-sub { font-size: 13px; opacity: 0.85; margin-top: 4px; }
    .sandbox-tag { display: inline-block; background: #fef08a; color: #854d0e; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; margin-top: 8px; }
    .card-body { padding: 28px 24px; }
    .app-info { display: flex; align-items: center; gap: 14px; padding: 14px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 20px; }
    .app-icon { width: 44px; height: 44px; border-radius: 10px; background: #eff6ff; color: #0052cc; display: flex; align-items: center; justify-content: center; font-size: 20px; }
    .app-title { font-size: 15px; font-weight: 700; color: #0f172a; }
    .app-desc { font-size: 12px; color: #64748b; }
    .scope-title { font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
    .scope-list { list-style: none; display: flex; flex-direction: column; gap: 10px; margin-bottom: 24px; }
    .scope-item { display: flex; align-items: center; gap: 10px; font-size: 13.5px; color: #1e293b; }
    .scope-item i { color: #10b981; font-size: 15px; }
    .actions { display: flex; gap: 12px; }
    .btn { flex: 1; padding: 13px; border-radius: 12px; font-size: 14px; font-weight: 700; border: none; cursor: pointer; transition: all 0.2s ease; text-align: center; text-decoration: none; }
    .btn-approve { background: #0052cc; color: white; box-shadow: 0 4px 14px rgba(0,82,204,0.3); }
    .btn-approve:hover { background: #0040a8; }
    .btn-deny { background: #f1f5f9; color: #475569; }
    .btn-deny:hover { background: #e2e8f0; }
    .footer-note { text-align: center; font-size: 11.5px; color: #94a3b8; margin-top: 18px; line-height: 1.4; }
  </style>
</head>
<body>
  <div class="consent-card">
    <div class="card-header">
      <div class="emblem-pill">
        <i class="fa-solid fa-landmark"></i> Digital India Initiative
      </div>
      <h1 class="header-title">DigiLocker Consent Gateway</h1>
      <p class="header-sub">Ministry of Electronics & Information Technology (MeitY)</p>
      <div class="sandbox-tag">DEVELOPMENT SANDBOX MODE</div>
    </div>
    <div class="card-body">
      <div class="app-info">
        <div class="app-icon">
          <i class="fa-solid fa-shapes"></i>
        </div>
        <div>
          <div class="app-title">DAM Studio System</div>
          <div class="app-desc">Verified Digital Asset Management Platform</div>
        </div>
      </div>

      <div class="scope-title">Permissions Requested:</div>
      <ul class="scope-list">
        <li class="scope-item"><i class="fa-solid fa-circle-check"></i> <span>Aadhaar e-KYC Identity Verification</span></li>
        <li class="scope-item"><i class="fa-solid fa-circle-check"></i> <span>Issued Credentials & Certificates Access</span></li>
        <li class="scope-item"><i class="fa-solid fa-circle-check"></i> <span>Verified Administrator Profile Status</span></li>
      </ul>

      <div class="actions">
        <a href="${redirect_url || DEFAULT_CALLBACK_URL}?status=denied&error=user_consent_not_given&transaction_id=${transaction_id}" class="btn btn-deny">
          Decline
        </a>
        <a href="${redirect_url || DEFAULT_CALLBACK_URL}?status=approved&code=DL_SANDBOX_AUTH_${Date.now()}&transaction_id=${transaction_id}" class="btn btn-approve">
          <i class="fa-solid fa-shield-check"></i> Grant Consent
        </a>
      </div>

      <p class="footer-note">
        🔒 Encrypted End-to-End. Compliant with IT Act 2000 & Digital Personal Data Protection (DPDP) Act.
      </p>
    </div>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

/**
 * 3. OAUTH 2.0 CALLBACK HANDLER
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

  const isLoginFlow = query.flow === 'login';

  let targetUrl;
  if (failureReason) {
    targetUrl = isLoginFlow
      ? `/login.html?digilocker=error&reason=${encodeURIComponent(failureReason)}`
      : `/?digilocker=error&reason=${encodeURIComponent(failureReason)}&page=profile`;
  } else {
    if (isLoginFlow) {
      const sessionToken = 'dam_session_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
      targetUrl = `/login.html?digilocker=success&token=${encodeURIComponent(sessionToken)}`;
    } else {
      targetUrl = `/?digilocker=success&code=${encodeURIComponent(code || 'OK')}&page=profile`;
    }
  }

  return res.redirect(targetUrl);
};

router.get('/callback', handleCallback);
router.post('/callback', handleCallback);

/**
 * 4. VERIFICATION STATUS CHECK
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
 * 5. FETCH VERIFIED DOCUMENTS (Aadhaar, PAN, DL)
 * POST /api/digilocker/fetch-documents
 */
router.post('/fetch-documents', async (req, res) => {
  try {
    const { transaction_id, document_type = 'AADHAAR' } = req.body;
    const token = (KWIKID_AUTH_TOKEN || '').trim();
    const isSandbox = !token || token.toLowerCase() === 'sandbox' || token.toLowerCase() === 'mock';

    // Sandbox Mock Document Provider
    if (isSandbox) {
      console.log(`📜 [DigiLocker Sandbox] Returning verified ${document_type} mock record...`);
      return res.json({
        success: true,
        is_sandbox: true,
        data: {
          document_type,
          issuer: 'Unique Identification Authority of India (UIDAI) / DigiLocker',
          verified: true,
          verified_at: new Date().toISOString(),
          record: {
            name: 'Jayash Kongare',
            role: 'Lead System Administrator',
            verification_status: 'AUTHENTICATED',
            aadhaar_last4: '8842',
            certificate_title: 'National Digital Asset System Authority Certified'
          }
        }
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
