'use strict';

const { PromotionValidationService } = require('./PromotionValidationService');
const { PromotionSafetyService } = require('./PromotionSafetyService');
function serviceError(code, message, statusCode, details = []) { const error = new Error(message); error.code = code; error.statusCode = statusCode; error.details = details; error.source = 'promotion_engine'; return error; }
const TRANSITIONS = {
  READY: new Set(['SCHEDULED','ACTIVE']),
  SCHEDULED: new Set(['ACTIVE','ENDED','PAUSED_BY_SAFETY']),
  ACTIVE: new Set(['PAUSED','PAUSED_BY_SAFETY','PAUSED_BY_BUDGET','ENDED']),
  PAUSED: new Set(['ACTIVE','PAUSED_BY_SAFETY','ENDED']),
  PAUSED_BY_SAFETY: new Set(['ACTIVE','ENDED']),
  PAUSED_BY_BUDGET: new Set(['ENDED']),
  ENDED: new Set(['ARCHIVED']),
};

class PromotionService {
  constructor({ repository, validationService, safetyService } = {}) {
    if (!repository) throw new Error('Promotion repository is required.');
    this.repository = repository;
    this.validationService = validationService || new PromotionValidationService();
    this.safetyService = safetyService || new PromotionSafetyService({ repository });
  }
  async createDraft(input) { this._assertDraftInput(input); try { return await this.repository.createDraft(input); } catch (error) { if (error?.code === 'P2002') throw serviceError('PROMOTION_CODE_CONFLICT','Promotion campaign code already exists.',409); throw error; } }
  async getCampaign(campaignId) { const campaign = await this.repository.getCampaignById(campaignId); if (!campaign) throw serviceError('PROMOTION_NOT_FOUND','Promotion campaign not found.',404); return campaign; }
  async listCampaigns() { return this.repository.listCampaigns(); }
  _workingStatus(campaign) { return campaign.currentVersion?.status || campaign.status; }

  async updateDraft({ campaignId, patch, actorId }) {
    const campaign = await this.getCampaign(campaignId);
    const workingStatus = this._workingStatus(campaign);
    if (!['DRAFT','VALIDATION_FAILED'].includes(workingStatus)) throw serviceError('PROMOTION_DRAFT_EDIT_FORBIDDEN',`Working version in status ${workingStatus} cannot be edited in place. Create a new version instead.`,409);
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw serviceError('PROMOTION_PATCH_REQUIRED','Promotion patch payload is required.',400);
    if (Object.prototype.hasOwnProperty.call(patch,'code')) throw serviceError('PROMOTION_CODE_IMMUTABLE','Campaign code cannot be changed after creation.',409);
    return this.repository.updateDraft({ campaignId, patch, actorId });
  }

  async createVersion({ campaignId, version, actorId }) {
    const campaign = await this.getCampaign(campaignId);
    if (['ARCHIVED','CANCELLED'].includes(campaign.status)) throw serviceError('PROMOTION_VERSION_FORBIDDEN',`Campaign in status ${campaign.status} cannot receive a new version.`,409);
    if (!version || typeof version !== 'object' || Array.isArray(version)) throw serviceError('PROMOTION_VERSION_REQUIRED','New promotion version payload is required.',400);
    const sourceVersion = campaign.effectiveVersion || campaign.currentVersion;
    const source = { ...sourceVersion, ...version, schedules: version.schedules ?? sourceVersion.schedules, targets: version.targets ?? sourceVersion.targets, audiences: version.audiences ?? sourceVersion.audiences, rules: version.rules ?? sourceVersion.rules, channels: version.channels ?? sourceVersion.channels };
    ['id','campaignId','version','status','createdAt','createdBy','currentForCampaigns','effectiveForCampaigns'].forEach((key)=>delete source[key]);
    return this.repository.createVersion({ campaignId, version: source, actorId });
  }

  async validateDraft({ campaignId, actorId = 'system' }) {
    const campaign = await this.getCampaign(campaignId);
    const workingStatus = this._workingStatus(campaign);
    if (!['DRAFT','VALIDATION_FAILED','READY'].includes(workingStatus)) throw serviceError('PROMOTION_STATUS_NOT_VALIDATABLE',`Working version in status ${workingStatus} cannot be validated.`,409);
    const result = this.validationService.validateCampaign({ ...campaign, status: workingStatus, version: campaign.currentVersion });
    await this.repository.updateCampaignStatus({ campaignId, status: result.nextStatus, actorId, validationResult: result });
    return { campaignId, campaignStatus: campaign.status, status: result.nextStatus, validation: result };
  }

  async requestApproval({ campaignId, actorId, reason = null }) {
    const campaign = await this.getCampaign(campaignId);
    if (this._workingStatus(campaign) !== 'READY') throw serviceError('PROMOTION_APPROVAL_REQUEST_FORBIDDEN', 'Approval can be requested only for a READY working version.', 409, [{ status: this._workingStatus(campaign) }]);
    const policy = campaign.currentVersion?.approvalPolicy || 'SINGLE_APPROVAL';
    if (policy === 'NONE') throw serviceError('PROMOTION_APPROVAL_NOT_REQUIRED', 'This promotion version does not require approval.', 409);
    return this.repository.requestApproval({ campaignId, promotionVersionId: campaign.currentVersion.id, approvalPolicy: policy, requestedBy: actorId, reason });
  }

  async approve({ campaignId, actorId, actorRoles = [], reason = null }) { return this._decideApproval({ campaignId, actorId, actorRoles, reason, decision: 'APPROVED' }); }
  async reject({ campaignId, actorId, actorRoles = [], reason = null }) { if (!reason || !String(reason).trim()) throw serviceError('PROMOTION_REJECTION_REASON_REQUIRED', 'Rejection reason is required.', 400); return this._decideApproval({ campaignId, actorId, actorRoles, reason, decision: 'REJECTED' }); }
  async _decideApproval({ campaignId, actorId, actorRoles, reason, decision }) {
    const campaign = await this.getCampaign(campaignId);
    if (this._workingStatus(campaign) !== 'READY') throw serviceError('PROMOTION_APPROVAL_DECISION_FORBIDDEN', 'Approval decisions are allowed only for a READY working version.', 409, [{ status: this._workingStatus(campaign) }]);
    const versionId = campaign.currentVersion.id;
    const policy = campaign.currentVersion.approvalPolicy || 'SINGLE_APPROVAL';
    const request = await this.repository.getPendingApprovalRequest(versionId);
    if (!request) throw serviceError('PROMOTION_APPROVAL_REQUEST_MISSING', 'No pending approval request exists for this promotion version.', 409);
    const normalizedRoles = actorRoles.map((role) => String(role).trim().toUpperCase());
    if (request.requestedBy === actorId) throw serviceError('PROMOTION_SELF_APPROVAL_FORBIDDEN', 'The approval requester cannot approve or reject the same promotion version.', 409);
    if (policy === 'OWNER_APPROVAL' && !normalizedRoles.includes('OWNER')) throw serviceError('PROMOTION_OWNER_APPROVAL_REQUIRED', 'OWNER_APPROVAL requires a decision by an OWNER.', 403);
    const existing = await this.repository.listApprovals(versionId);
    if (existing.some((row) => row.status === 'APPROVED' && row.decidedBy === actorId)) throw serviceError('PROMOTION_DUPLICATE_APPROVAL', 'This actor has already approved the current promotion version.', 409);
    return this.repository.recordApprovalDecision({ campaignId, promotionVersionId: versionId, approvalPolicy: policy, requestedBy: request.requestedBy, decidedBy: actorId, status: decision, reason, metadata: { deciderRoles: normalizedRoles } });
  }
  async getApprovalHistory(campaignId) { const campaign = await this.getCampaign(campaignId); return this.repository.listApprovals(campaign.currentVersion.id); }

  async schedule({ campaignId, actorId, startsAt, endsAt = undefined }) {
    const campaign = await this.getCampaign(campaignId);
    if (this._workingStatus(campaign) !== 'READY') throw serviceError('PROMOTION_INVALID_TRANSITION',`Working version ${this._workingStatus(campaign)} cannot be scheduled.`,409);
    await this._assertApproved(campaign);
    if (!startsAt || Number.isNaN(new Date(startsAt).getTime())) throw serviceError('PROMOTION_SCHEDULE_START_REQUIRED','Valid startsAt is required.',400);
    if (new Date(startsAt) <= new Date()) throw serviceError('PROMOTION_SCHEDULE_MUST_BE_FUTURE','Scheduled start must be in the future.',409);
    const patch = { startsAt: new Date(startsAt) }; if (endsAt !== undefined) patch.endsAt = endsAt ? new Date(endsAt) : null;
    if (campaign.effectiveVersionId) {
      await this.repository.updateWorkingVersionStatus({ campaignId, status: 'SCHEDULED', actorId, eventType: 'SCHEDULED', metadata: { startsAt, endsAt: endsAt ?? null } });
      await this.repository.updateDraft({ campaignId, patch: { version: patch }, actorId });
      await this.repository.updateWorkingVersionStatus({ campaignId, status: 'SCHEDULED', actorId, eventType: 'SCHEDULE_CONFIRMED', metadata: { startsAt, endsAt: endsAt ?? null } });
      return this.getCampaign(campaignId);
    }
    await this.repository.transitionStatus({ campaignId, status:'SCHEDULED', actorId, eventType:'SCHEDULED', versionPatch:patch, metadata:{ startsAt, endsAt: endsAt ?? null } });
    return this.getCampaign(campaignId);
  }

  async activate({ campaignId, actorId, runNow = false, durationMinutes = null }) {
    const campaign = await this.getCampaign(campaignId);
    const workingStatus = this._workingStatus(campaign);
    if (!['READY','SCHEDULED'].includes(workingStatus)) throw serviceError('PROMOTION_INVALID_TRANSITION',`Working version ${workingStatus} cannot be activated.`,409);
    await this._assertApproved(campaign);
    const patch = {};
    if (runNow) { patch.startsAt = new Date(); if (durationMinutes !== null) { const duration = Number(durationMinutes); if (!Number.isFinite(duration) || duration <= 0) throw serviceError('PROMOTION_DURATION_INVALID','durationMinutes must be positive.',400); patch.endsAt = new Date(Date.now() + duration * 60000); } }
    await this.repository.transitionStatus({ campaignId, status:'ACTIVE', actorId, eventType: runNow ? 'RUN_NOW' : 'ACTIVATED', versionPatch: Object.keys(patch).length ? patch : undefined, metadata:{ runNow, durationMinutes } });
    return this.getCampaign(campaignId);
  }

  async pause({ campaignId, actorId, reason = null }) { return this._simpleOperationalTransition(campaignId, actorId, 'PAUSED', 'PAUSED', reason); }
  async resume({ campaignId, actorId, reason = null }) { const campaign = await this.getCampaign(campaignId); if (campaign.status === 'PAUSED_BY_SAFETY') throw serviceError('PROMOTION_SAFETY_OVERRIDE_REQUIRED','Safety-paused campaign requires OWNER safety override.',409); if (campaign.status === 'PAUSED_BY_BUDGET') throw serviceError('PROMOTION_BUDGET_RESUME_FORBIDDEN','Budget-paused campaign cannot be resumed without a new version or ending the campaign.',409); return this._simpleOperationalTransition(campaignId, actorId, 'ACTIVE', 'RESUMED', reason, campaign); }
  async end({ campaignId, actorId, reason = null }) { return this._simpleOperationalTransition(campaignId, actorId, 'ENDED', 'ENDED', reason); }
  async archive({ campaignId, actorId, reason = null }) { return this._simpleOperationalTransition(campaignId, actorId, 'ARCHIVED', 'ARCHIVED', reason); }

  async emergencyStop({ campaignId, actorId, reason }) { const campaign = await this.getCampaign(campaignId); if (!['SCHEDULED','ACTIVE','PAUSED'].includes(campaign.status)) throw serviceError('PROMOTION_EMERGENCY_STOP_NOT_APPLICABLE', `Emergency stop is not applicable in status ${campaign.status}.`, 409); if (!reason || !String(reason).trim()) throw serviceError('PROMOTION_EMERGENCY_STOP_REASON_REQUIRED', 'Emergency stop reason is required.', 400); await this.repository.transitionStatus({ campaignId, status: 'PAUSED_BY_SAFETY', actorId, eventType: 'EMERGENCY_STOP', reason, metadata: { severity: 'CRITICAL', notificationCategory: 'INCIDENT' } }); return this.getCampaign(campaignId); }

  async evaluateSafety({ campaignId, observedFinalPrice = null, observedDiscountPercent = null, actorId = 'promotion-safety' }) {
    const campaign = await this.getCampaign(campaignId);
    const safetyCampaign = campaign.effectiveVersion ? { ...campaign, currentVersion: campaign.effectiveVersion } : campaign;
    const result = await this.safetyService.evaluate({ campaign: safetyCampaign, observedFinalPrice, observedDiscountPercent });
    const servingVersionId = campaign.effectiveVersion?.id || campaign.currentVersion.id;
    if (result.issues.length === 0) { await this.repository.recordEvent({ campaignId, promotionVersionId: servingVersionId, eventType: 'SAFETY_CHECK_PASSED', actorType: 'SYSTEM', actorId, metadata: result }); return result; }
    if (result.safe) { await this.repository.recordEvent({ campaignId, promotionVersionId: servingVersionId, eventType: 'SAFETY_WARNING', actorType: 'SYSTEM', actorId, metadata: { ...result, notificationCategory: 'BUDGET' } }); return result; }
    if (campaign.status === 'ACTIVE') await this.repository.transitionStatus({ campaignId, status: result.recommendedStatus, actorId, actorType: 'SYSTEM', eventType: result.recommendedStatus === 'PAUSED_BY_BUDGET' ? 'BUDGET_AUTO_PAUSED' : 'SAFETY_AUTO_PAUSED', reason: result.issues.map((item) => item.code).join(','), metadata: { ...result, notificationCategory: result.recommendedStatus === 'PAUSED_BY_BUDGET' ? 'BUDGET' : 'INCIDENT' } });
    else await this.repository.recordEvent({ campaignId, promotionVersionId: servingVersionId, eventType: 'SAFETY_CHECK_FAILED', actorType: 'SYSTEM', actorId, metadata: result });
    return { ...result, campaignStatus: campaign.status === 'ACTIVE' ? result.recommendedStatus : campaign.status };
  }

  async resumeAfterSafety({ campaignId, actorId, actorRoles = [], reason }) { const campaign = await this.getCampaign(campaignId); if (campaign.status !== 'PAUSED_BY_SAFETY') throw serviceError('PROMOTION_SAFETY_OVERRIDE_NOT_APPLICABLE','Campaign is not paused by safety.',409); const roles = actorRoles.map((role) => String(role).trim().toUpperCase()); if (!roles.includes('OWNER')) throw serviceError('PROMOTION_OWNER_SAFETY_OVERRIDE_REQUIRED','Only OWNER can resume a safety-paused promotion.',403); if (!reason || !String(reason).trim()) throw serviceError('PROMOTION_SAFETY_OVERRIDE_REASON_REQUIRED','Safety override reason is required.',400); const safetyCampaign = campaign.effectiveVersion ? { ...campaign, currentVersion: campaign.effectiveVersion } : campaign; const result = await this.safetyService.evaluate({ campaign: safetyCampaign }); const blocking = result.issues.filter((item) => item.severity === 'CRITICAL'); if (blocking.length) throw serviceError('PROMOTION_SAFETY_CONDITION_STILL_ACTIVE','Promotion still has blocking safety conditions.',409,blocking); await this.repository.transitionStatus({ campaignId, status:'ACTIVE', actorId, eventType:'SAFETY_OVERRIDE_RESUMED', reason, metadata:{ ownerOverride:true } }); return this.getCampaign(campaignId); }

  async _simpleOperationalTransition(campaignId, actorId, target, eventType, reason, existing = null) { const campaign = existing || await this.getCampaign(campaignId); this._assertTransition(campaign.status,target); await this.repository.transitionStatus({ campaignId, status:target, actorId, eventType, reason }); return this.getCampaign(campaignId); }
  _assertTransition(from,to) { if (!TRANSITIONS[from]?.has(to)) throw serviceError('PROMOTION_INVALID_TRANSITION',`Transition ${from} -> ${to} is not allowed.`,409,[{from,to}]); }
  async _assertApproved(campaign) { const policy = campaign.currentVersion?.approvalPolicy || 'SINGLE_APPROVAL'; if (policy === 'NONE') return; const required = policy === 'DUAL_APPROVAL' ? 2 : 1; const count = await this.repository.countApprovals(campaign.currentVersion.id); if (count < required) throw serviceError('PROMOTION_APPROVAL_REQUIRED',`Approval policy ${policy} requires ${required} approval(s).`,409,[{ policy, required, actual: count }]); if (policy === 'OWNER_APPROVAL' && !(await this.repository.hasOwnerApproval(campaign.currentVersion.id))) throw serviceError('PROMOTION_OWNER_APPROVAL_REQUIRED', 'OWNER_APPROVAL requires an approval made by an OWNER.', 409); }
  _assertDraftInput(input) { if (!input || typeof input !== 'object') throw serviceError('PROMOTION_DRAFT_REQUIRED','Draft input is required.',400); if (!input.code || !String(input.code).trim()) throw serviceError('PROMOTION_CODE_REQUIRED','Promotion code is required.',400); if (!input.name || !String(input.name).trim()) throw serviceError('PROMOTION_NAME_REQUIRED','Promotion name is required.',400); if (!input.createdBy || !String(input.createdBy).trim()) throw serviceError('PROMOTION_ACTOR_REQUIRED','createdBy is required.',400); if (!input.version || typeof input.version !== 'object') throw serviceError('PROMOTION_VERSION_REQUIRED','Initial promotion version is required.',400); }
}
module.exports = { PromotionService, serviceError, TRANSITIONS };
