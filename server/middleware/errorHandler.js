const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  if (err.name === 'MulterError' && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'File too large (max 10MB)' });
  }
  if (err.message === 'Only image files are allowed') {
    return res.status(400).json({ message: err.message });
  }
  // Mongoose validation (maxlength, enum, required, custom array caps)
  if (err.name === 'ValidationError') {
    const first = Object.values(err.errors)[0];
    return res.status(400).json({ message: first?.message || 'Invalid input' });
  }
  // Malformed ObjectId in a route param
  if (err.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid identifier' });
  }
  // Duplicate unique key (e.g. email already registered)
  if (err.code === 11000) {
    return res.status(409).json({ message: 'That value is already taken' });
  }
  if (err.statusCode) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  // An unexpected failure. The message and stack go to the logs only — the
  // client gets the correlation id instead, which is the part that makes a
  // bug report actionable without leaking internals.
  logger.error(err.message, {
    stack: err.stack,
    method: req.method,
    path: req.originalUrl,
    userId: req.user?.userId ? String(req.user.userId) : undefined,
  });
  res.status(500).json({ message: 'Something went wrong', requestId: req.id });
};

module.exports = errorHandler;
