/**
 * Talent Exchange service errors.
 *
 * Services throw these; the shared middleware/errorHandler.js already turns any
 * error carrying `statusCode` into `res.status(code).json({ message })`, so
 * controllers never build error responses themselves — they just `next(err)`.
 * This keeps controllers thin and the HTTP mapping in one place.
 */

class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

const badRequest = (msg) => new ApiError(400, msg);
const forbidden = (msg = 'Not authorised') => new ApiError(403, msg);
const notFound = (msg = 'Not found') => new ApiError(404, msg);
const conflict = (msg) => new ApiError(409, msg);
const unprocessable = (msg) => new ApiError(422, msg);

module.exports = { ApiError, badRequest, forbidden, notFound, conflict, unprocessable };
