const { ApiError } = require('../../platform/errors/ApiError');
const ADMIN_ROLES = new Set(['PLATFORM_OWNER', 'ADMIN']);
class AdminDashboardService {
  constructor({ provider }) { this.provider = provider; }
  async getDashboard(securityContext) {
    const roles = Array.isArray(securityContext?.roles) ? securityContext.roles : [];
    if (!roles.some((role) => ADMIN_ROLES.has(role))) {
      throw new ApiError({ statusCode: 403, code: 'ADMIN_PERMISSION_DENIED', message: 'Administrative dashboard access is not permitted.', source: 'platform_service' });
    }
    return {
      ...await this.provider.getDashboard(),
      permissionScope: { roles: roles.filter((role) => ADMIN_ROLES.has(role)), permissions: ['admin.dashboard.read'], access: 'READ_ONLY' },
    };
  }
}
module.exports = { ADMIN_ROLES, AdminDashboardService };
