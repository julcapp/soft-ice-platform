const { ApiError } = require('../errors/ApiError');

function createCustomerAuthenticator(authCoreService) {
  return async function authenticateCustomer(req, res, next) {
    try {
      const authorization = req.get('Authorization') || '';
      const [scheme, token] = authorization.split(' ');

      if (scheme !== 'Bearer' || !token) {
        throw new ApiError({
          statusCode: 401,
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Bearer authentication is required.',
        });
      }

      req.securityContext = await authCoreService.authenticateAccessToken(token, {
        correlationId: req.correlationId,
      });

      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = {
  createCustomerAuthenticator,
};
