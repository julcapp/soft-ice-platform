const crypto = require('crypto');

function createCorrelationId() {
  return `corr_${crypto.randomUUID()}`;
}

function attachCorrelationId(req, res, next) {
  req.requestId = req.get('X-Request-ID') || `req_${crypto.randomUUID()}`;
  req.correlationId = req.get('X-Correlation-ID') || createCorrelationId();
  res.set('X-Request-ID', req.requestId);
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

function sendError(res, req, error, logger) {
  const expected = Number.isInteger(error.statusCode) && typeof error.code === 'string';
  const statusCode = expected ? error.statusCode : 500;
  const code = expected ? error.code : 'INTERNAL_ERROR';
  const message = expected ? error.message : 'Unexpected server error.';

  const errorId = `err_${crypto.randomUUID()}`;
  if (logger) logger[statusCode >= 500 ? 'error' : 'warn']('http.request.failed', { error_id: errorId, status_code: statusCode, error });
  res.status(statusCode).json({
    error: {
      error_id: errorId,
      code,
      message,
      details: expected ? error.details || [] : [],
      source: expected ? error.source || 'api' : 'api',
      retryable: expected && Boolean(error.retryable),
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
