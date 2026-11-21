const ADMIN_ROLES = new Set(['PLATFORM_OWNER', 'ADMIN']);
const ALLOWED_MODES = new Set(['disabled', 'manual_only', 'ai_assisted']);

function assertAdmin(securityContext) {
  const roles = Array.isArray(securityContext?.roles) ? securityContext.roles : [];
  if (!roles.some((role) => ADMIN_ROLES.has(role))) {
    const error = new Error('Administrative photo verification access is not permitted');
    error.code = 'PHOTO_VERIFICATION_ADMIN_PERMISSION_DENIED';
    error.statusCode = 403;
    throw error;
  }
}

class PhotoVerificationAdminService {
  constructor({ repository }) {
    if (!repository) throw new Error('repository is required');
    this.repository = repository;
  }

  async getSettings(securityContext, scopeKey = 'default') {
    assertAdmin(securityContext);
    return this.repository.getSettings(scopeKey);
  }

  async updateSettings(securityContext, patch, scopeKey = 'default') {
    assertAdmin(securityContext);
    if (patch.mode && !ALLOWED_MODES.has(patch.mode)) throw new Error('Unsupported photo verification mode');
    if (patch.rewardBonusUnits !== undefined && patch.rewardBonusUnits !== null) {
      const value = Number(patch.rewardBonusUnits);
      if (!Number.isInteger(value) || value <= 0) {
        const error = new Error('rewardBonusUnits must be a positive integer or null');
        error.code = 'PHOTO_REWARD_BONUS_UNITS_INVALID';
        error.statusCode = 400;
        throw error;
      }
      patch = { ...patch, rewardBonusUnits: value };
    }
    const actorId = securityContext?.userId || securityContext?.actorId || null;
    return this.repository.upsertSettings({ scopeKey, ...patch, updatedBy: actorId });
  }
}

module.exports = { PhotoVerificationAdminService, ADMIN_ROLES, assertAdmin };
