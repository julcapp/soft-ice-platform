const { ApiError } = require('../errors/ApiError');
function createAdminAuthenticator({ environment = process.env.NODE_ENV || 'development', sessionService, requiredPermission } = {}) {
  return async function authenticateAdmin(req, res, next) {
    if (req.securityContext?.roles) {
      if (!requiredPermission || req.securityContext.auth_method === 'development_header' || req.securityContext.permissions?.includes('admin:*') || req.securityContext.permissions?.includes(requiredPermission)) return next();
      return next(new ApiError({ statusCode: 403, code: 'ADMIN_PERMISSION_DENIED', message: 'Required administrator permission is not granted.', source: 'security' }));
    }
    const authorization = req.get('Authorization') || '';
    if (authorization.startsWith('Bearer ') && sessionService) {
      try {
        req.securityContext = await sessionService.validateToken(authorization.slice(7), { requiredPermission, organizationId: req.params.organizationId || req.get('X-Organization-Id') || undefined });
        return next();
      } catch (error) { return next(error); }
    }
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
const ADMIN_ROUTE_PERMISSIONS = Object.freeze([
  [/^\/security\/sessions\//, 'admin:session:revoke'], [/^\/security/, 'admin:access:read'], [/^\/dashboard/, 'admin:dashboard:read'],
  [/^\/(machine-twins|machine-runtime|machine-dispenses|machines)/, 'admin:machine:read'],
  [/^\/inventory/, 'admin:inventory:read'], [/^\/maintenance/, 'admin:maintenance:read'],
  [/^\/(crm|customer-360|customers)/, 'admin:customer:read'],
  [/^\/(platform-events|event-center|events|dead-letter)/, 'admin:event:read'], [/^\/outbox/, 'admin:outbox:read'],
  [/^\/(payments|sale-flows)/, 'admin:payment:read'], [/^\/gift-transfers/, 'admin:gift:read'],
  [/^\/(video|cameras|recordings)/, 'admin:video:read'],
]);
const TENANT_UNSCOPED_ADMIN_ROUTES = Object.freeze([/^\/dashboard/, /^\/(crm|customer-360|customers)/, /^\/(video|cameras|recordings)/]);
function createAdminRouteBoundary(options = {}) {
  return (req, res, next) => {
    const basePermission = ADMIN_ROUTE_PERMISSIONS.find(([pattern]) => pattern.test(req.path))?.[1];
    const permission = basePermission && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && basePermission.endsWith(':read') ? `${basePermission.slice(0, -5)}:manage` : basePermission;
    if (!permission) return next(new ApiError({ statusCode: 500, code: 'ADMIN_ROUTE_CLASSIFICATION_MISSING', message: 'Administrative route has no security classification.', source: 'security' }));
    return createAdminAuthenticator({ ...options, requiredPermission: permission })(req, res, (error) => {
      if (error) return next(error);
      req.organizationScope = Object.freeze({ global: req.securityContext.roles?.includes('PLATFORM_OWNER') || false, organizationId: req.securityContext.organizationId || req.securityContext.organization_id || null });
      if (!req.organizationScope.global && req.securityContext.auth_method !== 'development_header' && TENANT_UNSCOPED_ADMIN_ROUTES.some((pattern) => pattern.test(req.path))) return next(new ApiError({ statusCode: 403, code: 'ADMIN_TENANT_RESOURCE_UNSCOPED', message: 'This administrative resource does not yet provide a verified tenant ownership predicate.', source: 'security' }));
      const requestedOrganizationId = req.params.organizationId || req.query.organizationId || req.body?.organizationId || req.get('X-Organization-Id') || null;
      if (!req.organizationScope.global && requestedOrganizationId && requestedOrganizationId !== req.organizationScope.organizationId) return next(new ApiError({ statusCode: 403, code: 'ADMIN_TENANT_SCOPE_DENIED', message: 'Requested organization is outside the authenticated session scope.', source: 'security' }));
      return next();
    });
  };
}
module.exports = { createAdminAuthenticator, createAdminRouteBoundary, ADMIN_ROUTE_PERMISSIONS, TENANT_UNSCOPED_ADMIN_ROUTES };
