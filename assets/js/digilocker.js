/**
 * DigiLocker Initiation Client Helper
 * Connects to /api/digilocker/initiate and redirects user to Kwik.ID consent screen
 */

/**
 * Initiates DigiLocker verification flow
 * @param {Object} [options]
 * @param {string} [options.buttonId] ID of button to handle loading state
 * @param {string} [options.errorId] ID of element to display error message
 * @param {string} [options.customRedirectUrl] Optional custom callback URL override
 * @param {Function} [options.onSuccess] Callback before redirect
 * @param {Function} [options.onError] Callback on error
 */
async function initiateDigiLockerFlow(options = {}) {
  const {
    buttonId = 'btnDigiLocker',
    errorId = 'digilockerError',
    customRedirectUrl = null,
    onSuccess,
    onError
  } = options;

  const btn = document.getElementById(buttonId);
  const errorEl = document.getElementById(errorId);
  let originalBtnContent = '';

  if (btn) {
    originalBtnContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `
      <span style="display:inline-block; animation: spin 1s linear infinite; margin-right: 6px;">⏳</span>
      <span>Connecting to DigiLocker...</span>
    `;
  }

  if (errorEl) {
    errorEl.style.display = 'none';
    errorEl.textContent = '';
  }

  try {
    const payload = customRedirectUrl ? { redirect_url: customRedirectUrl } : {};

    const response = await fetch('/api/digilocker/initiate', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok || !data.success || !data.redirect_url) {
      const errMsg = data.message || `DigiLocker initiation failed (Status ${response.status})`;
      throw new Error(errMsg);
    }

    if (typeof onSuccess === 'function') {
      onSuccess(data);
    }

    // Redirect user to DigiLocker consent page
    window.location.href = data.redirect_url;
  } catch (error) {
    console.error('[DigiLocker Client Error]:', error);

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalBtnContent;
    }

    if (errorEl) {
      errorEl.textContent = error.message || 'Unable to connect to DigiLocker. Please try again.';
      errorEl.style.display = 'block';
    }

    if (typeof onError === 'function') {
      onError(error);
    }
  }
}

// Export for module systems or attach to window
if (typeof window !== 'undefined') {
  window.initiateDigiLockerFlow = initiateDigiLockerFlow;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { initiateDigiLockerFlow };
}
