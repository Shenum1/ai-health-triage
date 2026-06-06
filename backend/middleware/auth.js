// backend/middleware/auth.js
const jwt = require('jsonwebtoken');
const { findById } = require('../models/user');

async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.token || extractBearer(req);
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await findById(decoded.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });

    req.user = user;
    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Session expired' : 'Invalid token';
    return res.status(401).json({ error: msg });
  }
}

async function optionalAuth(req, res, next) {
  try {
    const token = req.cookies?.token || extractBearer(req);
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await findById(decoded.userId);
      if (user) req.user = user;
    }
  } catch (_) {}
  next();
}

function extractBearer(req) {
  const h = req.headers.authorization;
  return h && h.startsWith('Bearer ') ? h.slice(7) : null;
}

module.exports = { requireAuth, optionalAuth };
