// ============================================================
// middleware/errorHandler.js
// Centralised Express error-handling middleware.
// Must be registered LAST in server.js (after all routes) so
// it catches errors forwarded via next(err).
// ============================================================

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Log the full error stack in development for easy debugging.
  console.error('[ErrorHandler]', err.stack || err.message);

  // Use the status code already set on the error object, or
  // fall back to 500 (Internal Server Error).
  const statusCode = err.statusCode || err.status || 500;

  // Send a clean JSON error response — never leak stack traces
  // or sensitive details to the client in production.
  res.status(statusCode).json({
    success: false,
    // Use a custom message if provided, otherwise generic text.
    message: err.message || 'Internal Server Error',
    // Only include stack trace when running locally.
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
