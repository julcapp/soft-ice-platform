'use strict';

const { PromotionValidationService } = require('./PromotionValidationService');
function serviceError(code, message, statusCode, details = []) { const error = new Error(message); error.code = code; error.statusCode = statusCode; error.details = details; error.source = 'promotion_engine'; return error; }
const TRANSITIONS = { READY: new Set(['SCHEDULED','ACTIVE']), SCHEDULED: new Set(['ACTIVE','ENDED']), ACTIVE: new Set(['PAUSED','ENDED']), PAUSED: new Set(['ACTIVE','ENDED']), ENDED: new Set(['ARCHIVED']) };
class PromotionService {
  constructor({ repository, validationService } = {}) { if (!repository) throw new Error('Promotion repository is required.'); this.repository = repository; this.validationService = validationService || new PromotionValidationService(); }
  async createDraft(input) { this._assertDraftInput(input); try { return await this.repository.createDraft(input); } catch (error) { if (error?.code === 'P2002') throw serviceError('PROMOTION_CODE_CONFLICT','Promotion campaign code already exists.',409); throw error; } }
  async getCampaign(campaignId) { const campaign = await this.repository.getCampaignById(campaignId); if (!campaign) throw serviceError('PROMOTION_NOT_FOUND','Promotion campaign not found.',404); return campaign; }
  async updateDraft({ campaignId, patch, actorId }) { const campaign = await this.getCampaign(campaignId); if (!['DRAFT','VALIDATION_FAILED'].includes(campaign.status)) throw serviceError('PROMOTION_DRAFT_EDIT_FORBIDDEN',`Campaign in status ${campaign.status} cannot be edited in place. Create a new version instead.`,409); if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw serviceError('PROMOTION_PATCH_REQUIRED','Promotion patch payload is required.',400); if (Object.prototype.hasOwnProperty.call(patch,'code')) throw serviceError('PROMOTION_CODE_IMMUTABLE','Campaign code cannot be changed after creation.',409); return this.repository.updateDraft({ campaignId, patch, actorId }); }
  async createVersion({ campaignId, version, actorId }) { const campaign = await this.getCampaign(campaignId); if (['ARCHIVED','CANCELLED'].includes(campaign.status)) throw serviceError('PROMOTION_VERSION_FORBIDDEN',`Campaign in status ${campaign.status} cannot receive a new version.`,409); if (!version || typeof version !== 'object' || Array.isArray(version)) throw serviceError('PROMOTION_VERSION_REQUIRED','New promotion version payload is required.',400); const source = { ...campaign.currentVersion, ...version, schedules: version.schedules ?? campaign.currentVersion.schedules, targets: version.targets ?? campaign.currentVersion.targets, audiences: version.audiences ?? campaign.currentVersion.audiences, rules: version.rules ?? campaign.currentVersion.rules, channels: version.channels ?? campaign.currentVersion.channels }; ['id','campaignId','version','createdAt','createdBy'].forEach((key)=>delete source[key]); return this.repository.createVersion({ campaignId, version: source, actorId }); }
  async validateDraft({ campaignId, actorId = 'system' }) { const campaign = await this.getCampaign(campaignId); if (!['DRAFT','VALIDATION_FAILED','READY'].includes(campaign.status)) throw serviceError('PROMOTION_STATUS_NOT_VALIDATABLE',`Campaign in status ${campaign.status} cannot be validated.`,409); const result = this.validationService.validateCampaign({ ...campaign, version: campaign.currentVersion }); await this.repository.updateCampaignStatus({ campaignId, status: result.nextStatus, actorId, validationResult: result }); return { campaignId, status: result.nextStatus, validation: result }; }

  async requestApproval({ campaignId, actorId, reason = null }) {
    const campaign = await this.getCampaign(campaignId);
    if (campaign.status !== 'READY') throw serviceError('PROMOTION_APPROVAL_REQUEST_FORBIDDEN', 'Approval can be requested only for a READY campaign.', 409, [{ status: campaign.status }]);
    const policy = campaign.currentVersion?.approvalPolicy || 'SINGLE_APPROVAL';
    if (policy === 'NONE') throw serviceError('PROMOTION_APPROVAL_NOT_REQUIRED', 'This promotion version does not require approval.', 409);
    return this.repository.requestApproval({ campaignId, promotionVersionId: campaign.currentVersion.id, approvalPolicy: policy, requestedBy: actorId, reason });
  }

  async approve({ campaignId, actorId, actorRoles = [], reason = null }) {
    return this._decideApproval({ campaignId, actorId, actorRoles, reason, decision: 'APPROVED' });
  }

  async reject({ campaignId, actorId, actorRoles = [], reason = null }) {
    if (!reason || !String(reason).trim()) throw serviceError('PROMOTION_REJECTION_REASON_REQUIRED', 'Rejection reason is required.', 400);
    return this._decideApproval({ campaignId, actorId, actorRoles, reason, decision: 'REJECTED' });
  }

  async _decideApproval({ campaignId, actorId, actorRoles, reason, decision }) {
    const campaign = await this.getCampaign(campaignId);
    if (campaign.status !== 'READY') throw serviceError('PROMOTION_APPROVAL_DECISION_FORBIDDEN', 'Approval decisions are allowed only for a READY campaign.', 409, [{ status: campaign.status }]);
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

  async getApprovalHistory(campaignId) {
    const campaign = await this.getCampaign(campaignId);
    return this.repository.listApprovals(campaign.currentVersion.id);
  }

  async schedule({ campaignId, actorId, startsAt, endsAt = undefined }) { const campaign = await this.getCampaign(campaignId); this._assertTransition(campaign.status,'SCHEDULED'); await this._assertApproved(campaign); if (!startsAt || Number.isNaN(new Date(startsAt).getTime())) throw serviceError('PROMOTION_SCHEDULE_START_REQUIRED','Valid startsAt is required.',400); if (new Date(startsAt) <= new Date()) throw serviceError('PROMOTION_SCHEDULE_MUST_BE_FUTURE','Scheduled start must be in the future.',409); const patch = { startsAt: new Date(startsAt) }; if (endsAt !== undefined) patch.endsAt = endsAt ? new Date(endsAt) : null; await this.repository.transitionStatus({ campaignId, status:'SCHEDULED', actorId, eventType:'SCHEDULED', versionPatch:patch, metadata:{ startsAt, endsAt: endsAt ?? null } }); return this.getCampaign(campaignId); }
  async activate({ campaignId, actorId, runNow = false, durationMinutes = null }) { const campaign = await this.getCampaign(campaignId); this._assertTransition(campaign.status,'ACTIVE'); await this._assertApproved(campaign); const patch = {}; if (runNow) { patch.startsAt = new Date(); if (durationMinutes !== null) { const duration = Number(durationMinutes); if (!Number.isFinite(duration) || duration <= 0) throw serviceError('PROMOTION_DURATION_INVALID','durationMinutes must be positive.',400); patch.endsAt = new Date(Date.now() + duration * 60000); } } await this.repository.transitionStatus({ campaignId, status:'ACTIVE', actorId, eventType: runNow ? 'RUN_NOW' : 'ACTIVATED', versionPatch: Object.keys(patch).length ? patch : undefined, metadata:{ runNow, durationMinutes } }); return this.getCampaign(campaignId); }
  async pause({ campaignId, actorId, reason = null }) { return this._simpleTransition(campaignId, actorId, 'PAUSED', 'PAUSED', reason); }
  async resume({ campaignId, actorId, reason = null }) { const campaign = await this.getCampaign(campaignId); await this._assertApproved(campaign); return this._simpleTransition(campaignId, actorId, 'ACTIVE', 'RESUMED', reason, campaign); }
  async end({ campaignId, actorId, reason = null }) { return this._simpleTransition(campaignId, actorId, 'ENDED', 'ENDED', reason); }
  async archive({ campaignId, actorId, reason = null }) { return this._simpleTransition(campaignId, actorId, 'ARCHIVED', 'ARCHIVED', reason); }
  async _simpleTransition(campaignId, actorId, target, eventType, reason, existing = null) { const campaign = existing || await this.getCampaign(campaignId); this._assertTransition(campaign.status,target); await this.repository.transitionStatus({ campaignId, status:target, actorId, eventType, reason }); return this.getCampaign(campaignId); }
  _assertTransition(from,to) { if (!TRANSITIONS[from]?.has(to)) throw serviceError('PROMOTION_INVALID_TRANSITION',`Transition ${from} -> ${to} is not allowed.`,409,[{from,to}]); }
  async _assertApproved(campaign) {
    const policy = campaign.currentVersion?.approvalPolicy || 'SINGLE_APPROVAL';
    if (policy === 'NONE') return;
    const required = policy === 'DUAL_APPROVAL' ? 2 : 1;
    const count = await this.repository.countApprovals(campaign.currentVersion.id);
    if (count < required) throw serviceError('PROMOTION_APPROVAL_REQUIRED',`Approval policy ${policy} requires ${required} approval(s).`,409,[{ policy, required, actual: count }]);
    if (policy === 'OWNER_APPROVAL' && !(await this.repository.hasOwnerApproval(campaign.currentVersion.id))) throw serviceError('PROMOTION_OWNER_APPROVAL_REQUIRED', 'OWNER_APPROVAL requires an approval made by an OWNER.', 409);
  }
  _assertDraftInput(input) { if (!input || typeof input !== 'object') throw serviceError('PROMOTION_DRAFT_REQUIRED','Draft input is required.',400); if (!input.code || !String(input.code).trim()) throw serviceError('PROMOTION_CODE_REQUIRED','Promotion code is required.',400); if (!input.name || !String(input.name).trim()) throw serviceError('PROMOTION_NAME_REQUIRED','Promotion name is required.',400); if (!input.createdBy || !String(input.createdBy).trim()) throw serviceError('PROMOTION_ACTOR_REQUIRED','createdBy is required.',400); if (!input.version || typeof input.version !== 'object') throw serviceError('PROMOTION_VERSION_REQUIRED','Initial promotion version is required.',400); }
}
module.exports = { PromotionService, serviceError, TRANSITIONS };