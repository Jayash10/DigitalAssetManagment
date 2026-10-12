const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { createToken, verifyToken } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

// Helper to get Twilio configuration from .env or twilio-credentials.json
function getTwilioConfig() {
    let sid = process.env.TWILIO_ACCOUNT_SID || '';
    let token = process.env.TWILIO_AUTH_TOKEN || '';
    let phone = process.env.TWILIO_PHONE_NUMBER || '';
    let verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID || 'VA56e42bc5838434229aa3683ec75e672d';

    // If not found in env, check twilio-credentials.json
    if (!sid || !token || !phone) {
        try {
            const credsPath = path.join(__dirname, '..', '..', 'twilio-credentials.json');
            if (fs.existsSync(credsPath)) {
                const json = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
                sid = sid || json.TWILIO_ACCOUNT_SID || '';
                token = token || json.TWILIO_AUTH_TOKEN || '';
                phone = phone || json.TWILIO_PHONE_NUMBER || '';
                verifyServiceSid = verifyServiceSid || json.TWILIO_VERIFY_SERVICE_SID || '';
            }
        } catch (err) {
            console.error('Error reading twilio-credentials.json:', err.message);
        }
    }

    return {
        accountSid: sid.trim(),
        authToken: token.trim(),
        fromPhone: phone.trim(),
        verifyServiceSid: verifyServiceSid.trim()
    };
}

// Helper to get Fast2SMS API Key
function getFast2SmsKey() {
    return (process.env.FAST2SMS_API_KEY || '').trim();
}

// Generate a random 6-digit OTP
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * POST /api/auth/send-otp
 * Generates OTP and sends REAL SMS directly to mobile phone via Twilio Verify API
 */
router.post('/send-otp', async (req, res) => {
    const { phone } = req.body;

    if (!phone || !/^\+91\d{10}$/.test(phone)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid phone number format. Must be +91 followed by 10 digits (e.g. +919876543210).'
        });
    }

    const raw10Digit = phone.replace('+91', '');
    const localOtp = generateOTP();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes expiry

    // Store in DB as fallback
    await db.run(
        'INSERT INTO otp_sessions (phone, otp, expires_at) VALUES (?, ?, ?) ON CONFLICT (phone) DO UPDATE SET otp = EXCLUDED.otp, expires_at = EXCLUDED.expires_at',
        [phone, localOtp, expiresAt]
    );

    console.log(`\n========================================================`);
    console.log(`📲 OTP DISPATCH REQUEST: Mobile: ${phone}`);
    console.log(`🔑 LOCAL OTP (Backup):   ${localOtp}`);
    console.log(`⏰ VALIDITY:             5 minutes`);
    console.log(`========================================================\n`);

    const twilio = getTwilioConfig();
    const fast2smsKey = getFast2SmsKey();

    let smsSent = false;
    let gatewayUsed = null;
    let smsError = null;

    // 1. PRIMARY: Twilio Verify V2 (Official Twilio OTP Service — sends real SMS to mobile)
    if (twilio.accountSid && twilio.authToken && twilio.verifyServiceSid) {
        try {
            console.log(`🚀 [Twilio Verify] Dispatching official OTP SMS to ${phone}...`);
            const verifyUrl = `https://verify.twilio.com/v2/Services/${twilio.verifyServiceSid}/Verifications`;
            const params = new URLSearchParams();
            params.append('To', phone);
            params.append('Channel', 'sms');

            const twilioRes = await fetch(verifyUrl, {
                method: 'POST',
                headers: {
                    'Authorization': 'Basic ' + Buffer.from(`${twilio.accountSid}:${twilio.authToken}`).toString('base64'),
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: params
            });

            const data = await twilioRes.json();
            if (twilioRes.ok && (data.status === 'pending' || data.status === 'approved')) {
                console.log(`✅ [Twilio Verify] Real OTP SMS sent to ${phone}! SID: ${data.sid}`);
                smsSent = true;
                gatewayUsed = 'Twilio Verify SMS';
            } else {
                console.warn(`⚠️ [Twilio Verify Warning]:`, data.message || data);
                smsError = data.message;
            }
        } catch (err) {
            console.error(`❌ [Twilio Verify Exception]:`, err.message);
            smsError = err.message;
        }
    }

    // 1b. Direct Twilio Programmable SMS (using Twilio Phone Number)
    if (!smsSent && twilio.accountSid && twilio.authToken && twilio.phoneNumber) {
        try {
            console.log(`🚀 [Twilio Direct SMS] Attempting direct message to ${phone}...`);
            const msgUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilio.accountSid}/Messages.json`;
            const msgParams = new URLSearchParams();
            msgParams.append('To', phone);
            msgParams.append('From', twilio.phoneNumber);
            msgParams.append('Body', `DAM Studio OTP: ${localOtp}. Valid for 5 minutes.`);

            let msgRes = await fetch(msgUrl, {
                method: 'POST',
                headers: {
                    'Authorization': 'Basic ' + Buffer.from(`${twilio.accountSid}:${twilio.authToken}`).toString('base64'),
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: msgParams
            });

            let msgData = await msgRes.json();
            // If trial template restriction (572006), retry with Twilio trial template
            if (!msgRes.ok && msgData.code === 572006) {
                console.log(`ℹ️ [Twilio Direct SMS] Retrying with approved Twilio trial template...`);
                const retryParams = new URLSearchParams();
                retryParams.append('To', phone);
                retryParams.append('From', twilio.phoneNumber);
                retryParams.append('Body', 'sms_appointment_reminders');

                msgRes = await fetch(msgUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Basic ' + Buffer.from(`${twilio.accountSid}:${twilio.authToken}`).toString('base64'),
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: retryParams
                });
                msgData = await msgRes.json();
            }

            if (msgRes.ok && (msgData.status === 'queued' || msgData.status === 'sent')) {
                console.log(`✅ [Twilio Direct SMS] Message successfully queued to ${phone}! SID: ${msgData.sid}`);
                smsSent = true;
                gatewayUsed = 'Twilio Programmable SMS';
            } else {
                console.warn(`⚠️ [Twilio Direct SMS Error]:`, msgData.message || msgData);
                if (!smsError) smsError = msgData.message;
            }
        } catch (dirErr) {
            console.error(`❌ [Twilio Direct SMS Exception]:`, dirErr.message);
        }
    }

    // 2. SECONDARY: Fast2SMS (Indian SMS Gateway)
    if (!smsSent && fast2smsKey) {
        try {
            console.log(`🚀 [Fast2SMS] Attempting dispatch for ${raw10Digit}...`);
            const fastRes = await fetch('https://www.fast2sms.com/dev/bulkV2', {
                method: 'POST',
                headers: {
                    'authorization': fast2smsKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    variables_values: localOtp,
                    route: 'otp',
                    numbers: raw10Digit
                })
            });

            const fastData = await fastRes.json();
            if (fastRes.ok && (fastData.return === true || fastData.status_code === 200)) {
                console.log(`✅ [Fast2SMS] SMS successfully sent to ${phone}!`);
                smsSent = true;
                gatewayUsed = 'Fast2SMS';
            } else {
                console.error(`❌ [Fast2SMS Error]:`, fastData);
                smsError = fastData.message || 'Fast2SMS delivery failed.';
            }
        } catch (err) {
            console.error(`❌ [Fast2SMS Exception]:`, err.message);
            smsError = err.message;
        }
    }

    // 3. TERTIARY: TextBelt (Free Fallback)
    if (!smsSent) {
        try {
            console.log('[TextBelt] Trying fallback SMS for', phone);
            const tbRes = await fetch('https://textbelt.com/text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: phone,
                    message: 'DAM Studio OTP: ' + localOtp + '. Valid 5 minutes.',
                    key: 'textbelt'
                })
            });
            const tbData = await tbRes.json();
            if (tbData.success) {
                console.log('[TextBelt] Delivered to', phone);
                smsSent = true;
                gatewayUsed = 'TextBelt';
            }
        } catch (e) {
            console.error('[TextBelt]', e.message);
        }
    }

    if (smsSent) {
        return res.json({
            success: true,
            message: `OTP has been sent to ${phone} via SMS. Please check your mobile messages.`,
            gateway: gatewayUsed
        });
    }

    // Fallback if SMS delivery failed
    console.warn(`\n⚠️  ============================================`);
    console.warn(`⚠️  SMS GATEWAYS FAILED for ${phone}`);
    console.warn(`🔑  OTP (Server Console Only): ${localOtp}`);
    console.warn(`📋  Reason: ${smsError || 'No SMS gateway responded'}`);
    console.warn(`⚠️  ============================================\n`);
    return res.json({
        success: true,
        message: `OTP generated for ${phone}. ${smsError ? 'SMS Notice: ' + smsError : ''}`,
        gateway: 'terminal',
        sms_error: smsError,
        devOtp: localOtp
    });
});

/**
 * POST /api/auth/verify-otp
 * Verifies 6-digit OTP code using Twilio Verify API + Local DB fallback
 */
router.post('/verify-otp', async (req, res) => {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
        return res.status(400).json({ success: false, message: 'Phone and OTP are required.' });
    }

    const twilio = getTwilioConfig();
    let isVerified = false;

    // 1. Check with Twilio Verify first
    if (twilio.accountSid && twilio.authToken && twilio.verifyServiceSid) {
        try {
            const checkUrl = `https://verify.twilio.com/v2/Services/${twilio.verifyServiceSid}/VerificationCheck`;
            const checkParams = new URLSearchParams();
            checkParams.append('To', phone);
            checkParams.append('Code', otp.trim());

            const checkRes = await fetch(checkUrl, {
                method: 'POST',
                headers: {
                    'Authorization': 'Basic ' + Buffer.from(`${twilio.accountSid}:${twilio.authToken}`).toString('base64'),
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: checkParams
            });

            const checkData = await checkRes.json();
            if (checkRes.ok && checkData.status === 'approved' && checkData.valid === true) {
                console.log(`✅ [Twilio Verify] Phone ${phone} verified successfully!`);
                isVerified = true;
            } else {
                console.log(`ℹ️ [Twilio Verify] Check status:`, checkData.status || checkData.message);
            }
        } catch (err) {
            console.error('❌ [Twilio Verify Check Exception]:', err.message);
        }
    }

    // 2. Fallback: check database OTP
    if (!isVerified) {
        const record = await db.get('SELECT * FROM otp_sessions WHERE phone = ?', [phone]);
        if (record) {
            const exp = typeof record.expires_at === 'string' ? parseInt(record.expires_at, 10) : Number(record.expires_at);
            if (Date.now() <= exp && record.otp === otp.trim()) {
                console.log(`✅ [Database] Phone ${phone} verified successfully with OTP!`);
                isVerified = true;
            }
        }
    }

    if (!isVerified) {
        return res.status(400).json({
            success: false,
            message: 'Invalid or expired OTP. Please check your SMS and try again.'
        });
    }

    // Clear OTP record from database
    await db.run('DELETE FROM otp_sessions WHERE phone = ?', [phone]);

    // Look up or create user in users table
    let user = await db.get('SELECT * FROM users WHERE phone = ?', [phone]);
    if (!user) {
        const result = await db.run(
            `INSERT INTO users (phone, name, role) VALUES (?, 'User', 'user')`,
            [phone]
        );
        const newId = Number(result.lastInsertRowid || 0);
        user = { id: newId, phone, name: 'User', role: 'user' };
        console.log(`✅ New user registered: ${phone} (id=${newId})`);
    } else {
        console.log(`✅ Existing user logged in: ${phone} (id=${user.id})`);
    }

    // Generate signed session token with userId embedded (24h expiry)
    const token = createToken({
        userId: user.id,
        phone: user.phone,
        role: user.role,
        name: user.name,
        exp: Date.now() + 24 * 60 * 60 * 1000
    });

    return res.json({
        success: true,
        message: 'Authentication successful! Welcome to DAM Studio.',
        token,
        user: {
            id: user.id,
            phone: user.phone,
            name: user.name,
            role: user.role
        }
    });
});

/**
 * GET /api/auth/session
 * Verifies if active session exists and returns user info
 */
router.get('/session', (req, res) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    try {
        const payload = verifyToken(token);
        return res.json({ authenticated: true, userId: payload.userId, phone: payload.phone, role: payload.role, name: payload.name });
    } catch {
        return res.json({ authenticated: false });
    }
});

module.exports = router;
