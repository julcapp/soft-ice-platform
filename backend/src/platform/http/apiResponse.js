const crypto = require('crypto');

function createCorrelationId() {
  return `corr_${crypto.randomUUID()}`;
}

function attachCorrelationId(req, res, next) {
  req.correlationId = req.get('X-Correlation-ID') || createCorrelationId();
  res.set('X-Correlation-ID', req.correlationId);
  next();
}

function createMeta(correlationId) {
  return {
    api_version: 'v1',
    correlation_id: correlationId,
  };
}

function sendData(res, req, data, statusCode = 200) {
  res.status(statusCode).json({
    data,
    meta: createMeta(req.correlationId),
  });
}

function sendError(res, req, error) {
  const statusCode = error.statusCode || 500;
  const code = error.code || 'INTERNAL_ERROR';
  const message = error.message || 'Unexpected server error.';

  res.status(statusCode).json({
    error: {
      error_id: `err_${crypto.randomUUID()}`,
      code,
      message,
      details: error.details || [],
      source: error.source || 'api',
      retryable: Boolean(error.retryable),
    },
    meta: createMeta(req.correlationId || createCorrelationId()),
  });
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

module.exports = {
  attachCorrelationId,
  asyncHandler,
  createCorrelationId,
  createMeta,
  sendData,
  sendError,
};
