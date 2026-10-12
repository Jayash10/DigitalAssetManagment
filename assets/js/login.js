document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);

    // If explicit logout requested via URL parameter, purge tokens immediately
    if (urlParams.get('logout') === 'true' || urlParams.get('logout') === '1') {
        localStorage.removeItem('dam_token');
        localStorage.removeItem('dam_user');
        sessionStorage.clear();
        console.log('[Auth] Logged out cleanly.');
    }

    // Check if already authenticated and redirect to dashboard
    if (localStorage.getItem('dam_token')) {
        window.location.href = '/';
        return;
    }

    const phoneInput = document.getElementById('phoneInput');
    const sendOtpBtn = document.getElementById('sendOtpBtn');
    const verifyOtpBtn = document.getElementById('verifyOtpBtn');
    const editPhoneBtn = document.getElementById('editPhoneBtn');
    const resendOtpBtn = document.getElementById('resendOtpBtn');
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const displayPhone = document.getElementById('displayPhone');
    const errorMsg1 = document.getElementById('errorMsg1');
    const errorMsg2 = document.getElementById('errorMsg2');
    const countdownEl = document.getElementById('countdown');
    const otpInputs = document.querySelectorAll('.otp-input');

    // Check for DigiLocker OAuth callback params
    const digiStatus = urlParams.get('digilocker');
    const digiToken = urlParams.get('token');
    const digiUserStr = urlParams.get('user');
    const digiReason = urlParams.get('reason');

    if (digiStatus === 'success' && digiToken) {
        let userData = {
            name: 'DigiLocker Verified Citizen',
            role: 'user',
            isDigilockerVerified: true
        };
        if (digiUserStr) {
            try {
                userData = JSON.parse(decodeURIComponent(digiUserStr));
            } catch (e) {
                console.warn('Could not parse digiUserStr:', e);
            }
        }
        localStorage.setItem('dam_token', digiToken);
        localStorage.setItem('dam_user', JSON.stringify(userData));
        window.location.href = '/';
        return;
    } else if (digiStatus === 'error' && digiReason) {
        const digiErr = document.getElementById('digilockerLoginError');
        if (digiErr) {
            digiErr.style.display = 'block';
            digiErr.textContent = 'DigiLocker: ' + decodeURIComponent(digiReason);
        }
    }

    const btnDigiLogin = document.getElementById('btnDigiLockerLogin');
    if (btnDigiLogin) {
        btnDigiLogin.addEventListener('click', () => {
            initiateDigiLockerFlow({
                buttonId: 'btnDigiLockerLogin',
                errorId: 'digilockerLoginError',
                customRedirectUrl: window.location.origin + '/api/digilocker/callback?flow=login'
            });
        });
    }

    let currentPhone = '';
    let resendTimer = null;
    let timeLeft = 30;

    // Helper for quick switch accounts buttons
    window.quickFillPhone = function(digits, label) {
        if (!phoneInput) return;
        phoneInput.value = digits;
        phoneInput.dispatchEvent(new Event('input'));
        setTimeout(() => {
            if (sendOtpBtn && !sendOtpBtn.disabled) {
                sendOtpBtn.click();
            }
        }, 100);
    };

    // --- Phone Number Input Logic ---
    if (phoneInput) {
        phoneInput.addEventListener('input', (e) => {
            let val = e.target.value.replace(/\D/g, '');
            if (val.length > 10) val = val.slice(0, 10);
            e.target.value = val;
            
            sendOtpBtn.disabled = val.length !== 10;
            if (errorMsg1) errorMsg1.textContent = '';
        });

        // Enter key to send OTP
        phoneInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !sendOtpBtn.disabled) {
                sendOtpBtn.click();
            }
        });
    }

    // Send OTP API Call
    if (sendOtpBtn) {
        sendOtpBtn.addEventListener('click', async () => {
            const num = phoneInput.value;
            if (num.length !== 10) return;
            
            currentPhone = `+91${num}`;
            
            setLoading(sendOtpBtn, true);
            if (errorMsg1) errorMsg1.textContent = '';

            try {
                const res = await fetch('/api/auth/send-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: currentPhone })
                });
                const data = await res.json();
                
                if (data.success) {
                    step1.classList.remove('active');
                    step2.classList.add('active');
                    if (displayPhone) displayPhone.textContent = currentPhone;
                    startResendTimer();

                    // Dev Mode banner if simulator active
                    if (data.devOtp) {
                        showDevOtpBanner(data.devOtp);
                    }

                    setTimeout(() => otpInputs[0]?.focus(), 100);
                } else {
                    if (errorMsg1) errorMsg1.textContent = data.message || 'Failed to send OTP.';
                }
            } catch (err) {
                if (errorMsg1) errorMsg1.textContent = 'Network error. Please try again.';
            } finally {
                setLoading(sendOtpBtn, false);
            }
        });
    }

    // --- OTP Input Logic ---
    otpInputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            const val = e.target.value;
            if (val.length > 1) {
                e.target.value = val.slice(0, 1);
            }
            if (e.target.value !== '' && index < otpInputs.length - 1) {
                otpInputs[index + 1].focus();
            }
            checkOtpComplete();
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && e.target.value === '' && index > 0) {
                otpInputs[index - 1].focus();
            } else if (e.key === 'Enter') {
                if (!verifyOtpBtn.disabled) verifyOtpBtn.click();
            }
        });

        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
            if (pasteData) {
                pasteData.split('').forEach((char, i) => {
                    if (i < otpInputs.length) {
                        otpInputs[i].value = char;
                    }
                });
                const focusIndex = Math.min(pasteData.length, otpInputs.length - 1);
                otpInputs[focusIndex]?.focus();
                checkOtpComplete();
            }
        });
    });

    function checkOtpComplete() {
        const otp = Array.from(otpInputs).map(i => i.value).join('');
        verifyOtpBtn.disabled = otp.length !== 6;
        if (errorMsg2) errorMsg2.textContent = '';
    }

    // Verify OTP API Call
    if (verifyOtpBtn) {
        verifyOtpBtn.addEventListener('click', async () => {
            const otp = Array.from(otpInputs).map(i => i.value).join('');
            if (otp.length !== 6) return;

            setLoading(verifyOtpBtn, true);
            if (errorMsg2) errorMsg2.textContent = '';

            try {
                const res = await fetch('/api/auth/verify-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: currentPhone, otp })
                });
                const data = await res.json();
                
                if (data.success) {
                    localStorage.setItem('dam_token', data.token);
                    localStorage.setItem('dam_user', JSON.stringify(data.user));
                    window.location.href = '/';
                } else {
                    if (errorMsg2) errorMsg2.textContent = data.message || 'Invalid OTP.';
                    otpInputs.forEach(i => i.value = '');
                    otpInputs[0]?.focus();
                    verifyOtpBtn.disabled = true;
                }
            } catch (err) {
                if (errorMsg2) errorMsg2.textContent = 'Network error. Please try again.';
            } finally {
                setLoading(verifyOtpBtn, false);
            }
        });
    }

    // --- Resend and Edit Logic ---
    if (editPhoneBtn) {
        editPhoneBtn.addEventListener('click', () => {
            step2.classList.remove('active');
            step1.classList.add('active');
            clearInterval(resendTimer);
            otpInputs.forEach(i => i.value = '');
            verifyOtpBtn.disabled = true;
            phoneInput?.focus();
        });
    }

    if (resendOtpBtn) {
        resendOtpBtn.addEventListener('click', async () => {
            if (timeLeft > 0) return;
            
            resendOtpBtn.disabled = true;
            if (errorMsg2) errorMsg2.textContent = '';

            try {
                const res = await fetch('/api/auth/send-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: currentPhone })
                });
                const data = await res.json();
                if (data.success) {
                    startResendTimer();
                    otpInputs.forEach(i => i.value = '');
                    otpInputs[0]?.focus();
                    verifyOtpBtn.disabled = true;
                    
                    if (errorMsg2) {
                        errorMsg2.style.color = '#4ade80';
                        errorMsg2.textContent = 'OTP Resent Successfully!';
                        setTimeout(() => { errorMsg2.textContent = ''; errorMsg2.style.color = '#ef4444'; }, 3000);
                    }
                    if (data.devOtp) {
                        showDevOtpBanner(data.devOtp);
                    }
                } else {
                    if (errorMsg2) errorMsg2.textContent = data.message || 'Failed to resend.';
                    resendOtpBtn.disabled = false;
                }
            } catch (err) {
                if (errorMsg2) errorMsg2.textContent = 'Network error.';
                resendOtpBtn.disabled = false;
            }
        });
    }

    function startResendTimer() {
        timeLeft = 30;
        if (resendOtpBtn) {
            resendOtpBtn.disabled = true;
            resendOtpBtn.style.display = 'none';
        }
        if (countdownEl) {
            countdownEl.style.display = 'inline';
            countdownEl.textContent = `Resend OTP in 00:${timeLeft.toString().padStart(2, '0')}`;
        }
        
        clearInterval(resendTimer);
        resendTimer = setInterval(() => {
            timeLeft--;
            if (countdownEl) {
                countdownEl.textContent = `Resend OTP in 00:${timeLeft.toString().padStart(2, '0')}`;
            }
            if (timeLeft <= 0) {
                clearInterval(resendTimer);
                if (countdownEl) countdownEl.style.display = 'none';
                if (resendOtpBtn) {
                    resendOtpBtn.style.display = 'inline';
                    resendOtpBtn.disabled = false;
                }
            }
        }, 1000);
    }

    function setLoading(btn, isLoading) {
        if (!btn) return;
        if (isLoading) {
            btn.classList.add('loading');
            btn.disabled = true;
        } else {
            btn.classList.remove('loading');
            btn.disabled = false;
        }
    }

    /**
     * Dev Mode: displays OTP in a styled card on-screen (auto-fills & auto-dismisses)
     */
    function showDevOtpBanner(otp) {
        const old = document.getElementById('dev-otp-banner');
        if (old) old.remove();

        const banner = document.createElement('div');
        banner.id = 'dev-otp-banner';
        banner.style.cssText = `
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            background: linear-gradient(135deg, #1e293b, #0f172a);
            border: 2px solid #6366f1;
            border-radius: 18px;
            padding: 16px 24px;
            z-index: 9999;
            box-shadow: 0 10px 40px rgba(99,102,241,0.4);
            text-align: center;
            min-width: 300px;
            font-family: inherit;
        `;
        banner.innerHTML = `
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#818cf8;font-weight:700;margin-bottom:6px;">
                🔑 Secure Session OTP
            </div>
            <div style="font-size:32px;font-weight:900;letter-spacing:8px;color:#f8fafc;
                        background:#0f172a;border-radius:10px;padding:8px 16px;display:inline-block;
                        border:1px solid #334155; margin-bottom: 10px;">
                ${otp}
            </div>
            <div>
                <button type="button" id="btnDevAutoVerify" style="background:#6366f1; color:white; border:none; padding:6px 16px; border-radius:8px; font-weight:700; font-size:12px; cursor:pointer;">
                    ⚡ Auto-Fill &amp; Verify Now
                </button>
            </div>
        `;
        document.body.appendChild(banner);

        function fillAndVerify() {
            const digits = String(otp).split('');
            otpInputs.forEach((inp, i) => {
                if (digits[i]) inp.value = digits[i];
            });
            checkOtpComplete();
            if (banner.parentNode) banner.remove();
            if (!verifyOtpBtn.disabled) {
                verifyOtpBtn.click();
            }
        }

        document.getElementById('btnDevAutoVerify')?.addEventListener('click', fillAndVerify);

        // Auto-fill and submit after 1.5 seconds automatically
        setTimeout(() => {
            if (document.getElementById('dev-otp-banner')) {
                fillAndVerify();
            }
        }, 1500);
    }
});
