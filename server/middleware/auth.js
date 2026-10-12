/**
 * Auth Middleware — Lightweight JWT-like token verification
 * Uses HMAC-SHA256 via Node's built-in crypto (no external packages needed)
 */

const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'dam_super_secret_key_2026';

/**
 * Create a signed token: base64(header).base64(payload).signature
 */
function createToken(payload) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    return `${header}.${body}.${sig}`;
}

/**
 * Verify and decode a token — throws on invalid/expired
 */
function verifyToken(token) {
    if (!token || typeof token !== 'string') throw new Error('No token');
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Malformed token');
    const [header, body, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    if (sig !== expectedSig) throw new Error('Invalid token signature');
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) throw new Error('Token expired');
    return payload;
}

/**
 * Express middleware — extracts user from Authorization: Bearer <token>
 */
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    try {
        const payload = verifyToken(token);
        req.userId = payload.userId;
        req.userPhone = payload.phone;
        req.userRole = payload.role || 'user';
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Unauthorized: ' + err.message });
    }
}

/**
 * Optional auth — sets req.userId if token present, doesn't block if missing
 */
function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    try {
        const payload = verifyToken(token);
        req.userId = payload.userId;
        req.userPhone = payload.phone;
        req.userRole = payload.role || 'user';
    } catch {
        req.userId = null;
        req.userPhone = null;
    }
    next();
}

module.exports = { authMiddleware, optionalAuth, createToken, verifyToken };
