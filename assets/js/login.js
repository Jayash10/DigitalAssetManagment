document.addEventListener('DOMContentLoaded', () => {
    // Check if already logged in
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
    const urlParams = new URLSearchParams(window.location.search);
    const digiStatus = urlParams.get('digilocker');
    const digiToken = urlParams.get('token');
    const digiReason = urlParams.get('reason');

    if (digiStatus === 'success' && digiToken) {
        localStorage.setItem('dam_token', digiToken);
        localStorage.setItem('dam_user', JSON.stringify({
            name: 'DigiLocker Verified User',
            role: 'Administrator',
            email: 'verified@digilocker.gov.in',
            isDigilockerVerified: true
        }));
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

    // --- Phone Number Input Logic ---
    phoneInput.addEventListener('input', (e) => {
        // Allow only numbers
        let val = e.target.value.replace(/\D/g, '');
        // Limit to 10 digits
        if (val.length > 10) val = val.slice(0, 10);
        e.target.value = val;
        
        // Enable button only if 10 digits
        sendOtpBtn.disabled = val.length !== 10;
        errorMsg1.textContent = '';
    });

    // Send OTP API Call
    sendOtpBtn.addEventListener('click', async () => {
        const num = phoneInput.value;
        if (num.length !== 10) return;
        
        currentPhone = `+91${num}`;
        
        setLoading(sendOtpBtn, true);
        errorMsg1.textContent = '';

        try {
            const res = await fetch('/api/auth/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: currentPhone })
            });
            const data = await res.json();
            
            if (data.success) {
                // Move to step 2
                step1.classList.remove('active');
                step2.classList.add('active');
                displayPhone.textContent = currentPhone;
                startResendTimer();

                // Dev Mode: If SMS not configured, show OTP in a styled info banner
                if (data.devOtp) {
                    showDevOtpBanner(data.devOtp);
                }

                // Focus first OTP input
                setTimeout(() => otpInputs[0].focus(), 100);
            } else {
                errorMsg1.textContent = data.message || 'Failed to send OTP.';
            }
        } catch (err) {
            errorMsg1.textContent = 'Network error. Please try again.';
        } finally {
            setLoading(sendOtpBtn, false);
        }
    });

    // --- OTP Input Logic ---
    otpInputs.forEach((input, index) => {
        // Focus next input on typing
        input.addEventListener('input', (e) => {
            const val = e.target.value;
            // Ensure only 1 digit
            if (val.length > 1) {
                e.target.value = val.slice(0, 1);
            }
            if (e.target.value !== '' && index < otpInputs.length - 1) {
                otpInputs[index + 1].focus();
            }
            checkOtpComplete();
        });

        // Handle backspace
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && e.target.value === '' && index > 0) {
                otpInputs[index - 1].focus();
            }
        });

        // Handle paste
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
                otpInputs[focusIndex].focus();
                checkOtpComplete();
            }
        });
    });

    function checkOtpComplete() {
        const otp = Array.from(otpInputs).map(i => i.value).join('');
        verifyOtpBtn.disabled = otp.length !== 6;
        errorMsg2.textContent = '';
    }

    // Verify OTP API Call
    verifyOtpBtn.addEventListener('click', async () => {
        const otp = Array.from(otpInputs).map(i => i.value).join('');
        if (otp.length !== 6) return;

        setLoading(verifyOtpBtn, true);
        errorMsg2.textContent = '';

        try {
            const res = await fetch('/api/auth/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: currentPhone, otp })
            });
            const data = await res.json();
            
            if (data.success) {
                // Save token and redirect
                localStorage.setItem('dam_token', data.token);
                localStorage.setItem('dam_user', JSON.stringify(data.user));
                window.location.href = '/';
            } else {
                errorMsg2.textContent = data.message || 'Invalid OTP.';
                // Clear OTP inputs on error
                otpInputs.forEach(i => i.value = '');
                otpInputs[0].focus();
                verifyOtpBtn.disabled = true;
            }
        } catch (err) {
            errorMsg2.textContent = 'Network error. Please try again.';
        } finally {
            setLoading(verifyOtpBtn, false);
        }
    });

    // --- Resend and Edit Logic ---
    editPhoneBtn.addEventListener('click', () => {
        step2.classList.remove('active');
        step1.classList.add('active');
        clearInterval(resendTimer);
        otpInputs.forEach(i => i.value = '');
        verifyOtpBtn.disabled = true;
        phoneInput.focus();
    });

    resendOtpBtn.addEventListener('click', async () => {
        if (timeLeft > 0) return;
        
        resendOtpBtn.disabled = true;
        errorMsg2.textContent = '';

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
                otpInputs[0].focus();
                verifyOtpBtn.disabled = true;
                
                // Show success toast or message temporarily
                errorMsg2.style.color = '#4ade80';
                errorMsg2.textContent = 'OTP Resent Successfully!';
                setTimeout(() => { errorMsg2.textContent = ''; errorMsg2.style.color = '#ef4444'; }, 3000);
            } else {
                errorMsg2.textContent = data.message || 'Failed to resend.';
                resendOtpBtn.disabled = false;
            }
        } catch (err) {
            errorMsg2.textContent = 'Network error.';
            resendOtpBtn.disabled = false;
        }
    });

    function startResendTimer() {
        timeLeft = 30;
        resendOtpBtn.disabled = true;
        resendOtpBtn.style.display = 'none';
        countdownEl.style.display = 'inline';
        countdownEl.textContent = `Resend OTP in 00:${timeLeft.toString().padStart(2, '0')}`;
        
        clearInterval(resendTimer);
        resendTimer = setInterval(() => {
            timeLeft--;
            countdownEl.textContent = `Resend OTP in 00:${timeLeft.toString().padStart(2, '0')}`;
            if (timeLeft <= 0) {
                clearInterval(resendTimer);
                countdownEl.style.display = 'none';
                resendOtpBtn.style.display = 'inline';
                resendOtpBtn.disabled = false;
            }
        }, 1000);
    }

    function setLoading(btn, isLoading) {
        if (isLoading) {
            btn.classList.add('loading');
            btn.disabled = true;
        } else {
            btn.classList.remove('loading');
            btn.disabled = false;
        }
    }

    /**
     * Dev Mode: displays OTP in a styled card on-screen (auto-fills & auto-dismisses in 30s)
     */
    function showDevOtpBanner(otp) {
        // Remove any existing banner
        const old = document.getElementById('dev-otp-banner');
        if (old) old.remove();

        const banner = document.createElement('div');
        banner.id = 'dev-otp-banner';
        banner.style.cssText = `
            position: fixed; top: 24px; left: 50%; transform: translateX(-50%);
            background: linear-gradient(135deg, #1e293b, #0f172a);
            border: 1.5px solid #6366f1;
            border-radius: 16px;
            padding: 18px 28px;
            z-index: 9999;
            box-shadow: 0 8px 32px rgba(99,102,241,0.35);
            text-align: center;
            min-width: 280px;
            font-family: inherit;
            animation: slideDown 0.4s cubic-bezier(.17,.67,.38,1.2);
        `;
        banner.innerHTML = `
            <style>
                @keyframes slideDown {
                    from { transform: translateX(-50%) translateY(-40px); opacity: 0; }
                    to   { transform: translateX(-50%) translateY(0);     opacity: 1; }
                }
            </style>
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#6366f1;font-weight:700;margin-bottom:8px;">
                🛠️ Dev Mode – No SMS Gateway
            </div>
            <div style="font-size:13px;color:#94a3b8;margin-bottom:10px;">
                Your OTP for this session:
            </div>
            <div style="font-size:36px;font-weight:900;letter-spacing:10px;color:#e2e8f0;
                        background:#0f172a;border-radius:10px;padding:10px 18px;display:inline-block;
                        border:1px solid #334155;">
                ${otp}
            </div>
            <div style="font-size:11px;color:#475569;margin-top:10px;">
                Auto-fills in 2 seconds • Dismissed in 30s
            </div>
        `;
        document.body.appendChild(banner);

        // Auto-fill OTP boxes after a short delay
        setTimeout(() => {
            const digits = String(otp).split('');
            otpInputs.forEach((inp, i) => {
                if (digits[i]) inp.value = digits[i];
            });
            // Trigger input event on last box so any validation fires
            otpInputs[otpInputs.length - 1].dispatchEvent(new Event('input'));
        }, 2000);

        // Remove banner after 30 seconds
        setTimeout(() => {
            if (banner.parentNode) banner.remove();
        }, 30000);
    }
});
