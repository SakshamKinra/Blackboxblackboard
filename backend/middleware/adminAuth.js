// ============================================================
// middleware/adminAuth.js
// JWT verification middleware for admin-only routes.
// Reads the Bearer token from the Authorization header,
// verifies it using the JWT_SECRET env var, and attaches
// the decoded payload to req.admin.
// ============================================================

const jwt = require('jsonwebtoken');

const adminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired token.',
    });
  }
};

module.exports = adminAuth;
