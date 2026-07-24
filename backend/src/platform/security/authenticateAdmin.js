const { ApiError } = require('../errors/ApiError');
function createAdminAuthenticator({ environment = process.env.NODE_ENV || 'development' } = {}) {
  return function authenticateAdmin(req, res, next) {
    if (req.securityContext?.roles) return next();
    const role = req.get('X-Admin-Role');
    if (environment !== 'production' && role) {
      req.securityContext = {
        subject_type: 'administrator', subject_id: req.get('X-Admin-Subject') || 'development-admin',
        roles: role.split(',').map((value) => value.trim()).filter(Boolean), auth_method: 'development_header',
      };
      return next();
    }
    return next(new ApiError({ statusCode: 401, code: 'ADMIN_AUTHENTICATION_REQUIRED', message: 'Administrator authentication is required.', source: 'api' }));
  };
}
module.exports = { createAdminAuthenticator };
