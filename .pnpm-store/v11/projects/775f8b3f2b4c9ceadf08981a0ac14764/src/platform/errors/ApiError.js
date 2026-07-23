class ApiError extends Error {
  constructor({
    statusCode = 500,
    code = 'INTERNAL_ERROR',
    message = 'Unexpected server error.',
    details = [],
    source = 'api',
    retryable = false,
  } = {}) {
    super(message);

    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.source = source;
    this.retryable = retryable;
  }
}

module.exports = {
  ApiError,
};
