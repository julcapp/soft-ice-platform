'use strict';

function normalizeTimeForPrisma(value) {
  if (value instanceof Date) return value;
  if (typeof value !== 'string' || !/^\d{2}:\d{2}(:\d{2})?$/.test(value)) return value;
  const normalized = value.length === 5 ? `${value}:00` : value;
  return new Date(`1970-01-01T${normalized}.000Z`);
}
function normalizeSchedules(schedules = []) { return schedules.map((item) => ({ ...item, startTime: normalizeTimeForPrisma(item.startTime), endTime: normalizeTimeForPrisma(item.endTime) })); }
function timeFromPrisma(value) { return value instanceof Date ? value.toISOString().slice(11, 19) : value; }
function serializeVersion(version) { if (!version) return version; return { ...version, schedules: (version.schedules || []).map((item) => ({ ...item, startTime: timeFromPrisma(item.startTime), endTime: timeFromPrisma(item.endTime) })) }; }
function serializeCampaign(campaign) { if (!campaign) return campaign; return { ...campaign, currentVersion: serializeVersion(campaign.currentVersion), effectiveVersion: serializeVersion(campaign.effectiveVersion) }; }
function versionScalarData(version, createdBy) { return { status: version.status || 'DRAFT', benefitType: version.benefitType, benefitValue: version.benefitValue, priority: version.priority || 0, stackingMode: version.stackingMode || 'BEST_PRICE', exclusiveGroup: version.exclusiveGroup || null, priceLockSeconds: version.priceLockSeconds || 300, startsAt: version.startsAt || null, endsAt: version.endsAt || null, timezone: version.timezone || 'Europe/Moscow', approvalPolicy: version.approvalPolicy || 'SINGLE_APPROVAL', isManualOverride: Boolean(version.isManualOverride), budgetAmount: version.budgetAmount ?? null, budgetAction: version.budgetAction || 'STOP', maxApplications: version.maxApplications ?? null, maxApplicationsPerCustomer: version.maxApplicationsPerCustomer ?? null, minimumFinalPrice: version.minimumFinalPrice ?? null, metadata: version.metadata || undefined, createdBy }; }
const versionInclude = { schedules: true, targets: true, audiences: true, rules: true, channels: true };

class PromotionRepository {
  constructor(prisma) { if (!prisma) throw new Error('Prisma client is required.'); this.prisma = prisma; }

  async createDraft(input) {
    const { code, name, description = null, createdBy, version } = input;
    return this.prisma.$transaction(async (tx) => {
      const campaign = await tx.promotionCampaign.create({ data: { code, name, description, status: 'DRAFT', createdBy } });
      const createdVersion = await tx.promotionVersion.create({ data: { campaignId: campaign.id, version: version.version || 1, ...versionScalarData({ ...version, status: 'DRAFT' }, createdBy), schedules: { create: normalizeSchedules(version.schedules || []) }, targets: { create: version.targets || [] }, audiences: { create: version.audiences || [] }, rules: { create: version.rules || [] }, channels: { create: version.channels || [] } } });
      await tx.promotionCampaign.update({ where: { id: campaign.id }, data: { currentVersionId: createdVersion.id } });
      await tx.promotionEvent.create({ data: { campaignId: campaign.id, promotionVersionId: createdVersion.id, eventType: 'DRAFT_CREATED', actorType: 'ADMIN_USER', actorId: createdBy, newValue: { code, name, version: createdVersion.version } } });
      return this.getCampaignById(campaign.id, tx);
    });
  }

  async getCampaignById(id, client = this.prisma) {
    const campaign = await client.promotionCampaign.findUnique({ where: { id }, include: { currentVersion: { include: versionInclude }, effectiveVersion: { include: versionInclude } } });
    return serializeCampaign(campaign);
  }

  async listCampaigns(client = this.prisma) {
    const rows = await client.promotionCampaign.findMany({ include: { currentVersion: { include: versionInclude }, effectiveVersion: { include: versionInclude } }, orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }] });
    return rows.map(serializeCampaign);
  }

  async updateDraft({ campaignId, patch, actorId }) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.getCampaignById(campaignId, tx);
      if (!current) return null;
      const campaignData = {};
      if (Object.prototype.hasOwnProperty.call(patch, 'name')) campaignData.name = patch.name;
      if (Object.prototype.hasOwnProperty.call(patch, 'description')) campaignData.description = patch.description;
      if (Object.keys(campaignData).length) await tx.promotionCampaign.update({ where: { id: campaignId }, data: campaignData });
      if (patch.version) {
        const versionId = current.currentVersion.id;
        const versionPatch = { ...patch.version, status: 'DRAFT' };
        ['schedules','targets','audiences','rules','channels','id','campaignId','version','createdAt','createdBy'].forEach((key) => delete versionPatch[key]);
        if (Object.keys(versionPatch).length) await tx.promotionVersion.update({ where: { id: versionId }, data: versionPatch });
        for (const [key, model] of [['schedules','promotionSchedule'],['targets','promotionTarget'],['audiences','promotionAudience'],['rules','promotionRule'],['channels','promotionChannel']]) {
          if (patch.version[key]) {
            await tx[model].deleteMany({ where: { promotionVersionId: versionId } });
            const rows = key === 'schedules' ? normalizeSchedules(patch.version[key]) : patch.version[key];
            if (rows.length) await tx[model].createMany({ data: rows.map((x) => ({ ...x, promotionVersionId: versionId })) });
          }
        }
      }
      if (!current.effectiveVersionId) await tx.promotionCampaign.update({ where: { id: campaignId }, data: { status: 'DRAFT' } });
      await tx.promotionEvent.create({ data: { campaignId, promotionVersionId: current.currentVersionId, eventType: 'DRAFT_UPDATED', actorType: 'ADMIN_USER', actorId, oldValue: { campaignStatus: current.status, versionStatus: current.currentVersion.status }, newValue: patch } });
      return this.getCampaignById(campaignId, tx);
    });
  }

  async createVersion({ campaignId, version, actorId }) {
    return this.prisma.$transaction(async (tx) => {
      const campaign = await this.getCampaignById(campaignId, tx);
      if (!campaign) return null;
      const max = await tx.promotionVersion.aggregate({ where: { campaignId }, _max: { version: true } });
      const nextVersion = (max._max.version || 0) + 1;
      const created = await tx.promotionVersion.create({ data: { campaignId, version: nextVersion, ...versionScalarData({ ...version, status: 'DRAFT' }, actorId), schedules: { create: normalizeSchedules(version.schedules || []) }, targets: { create: version.targets || [] }, audiences: { create: version.audiences || [] }, rules: { create: version.rules || [] }, channels: { create: version.channels || [] } } });
      await tx.promotionCampaign.update({ where: { id: campaignId }, data: { currentVersionId: created.id, ...(campaign.effectiveVersionId ? {} : { status: 'DRAFT' }) } });
      await tx.promotionEvent.create({ data: { campaignId, promotionVersionId: created.id, eventType: 'VERSION_CREATED', actorType: 'ADMIN_USER', actorId, oldValue: { currentVersionId: campaign.currentVersionId, effectiveVersionId: campaign.effectiveVersionId, campaignStatus: campaign.status }, newValue: { currentVersionId: created.id, version: nextVersion, status: 'DRAFT' } } });
      return this.getCampaignById(campaignId, tx);
    });
  }

  async updateWorkingVersionStatus({ campaignId, status, actorId, eventType, metadata }) {
    return this.prisma.$transaction(async (tx) => {
      const campaign = await tx.promotionCampaign.findUnique({ where: { id: campaignId } });
      if (!campaign?.currentVersionId) return null;
      const before = await tx.promotionVersion.findUnique({ where: { id: campaign.currentVersionId } });
      await tx.promotionVersion.update({ where: { id: campaign.currentVersionId }, data: { status } });
      if (!campaign.effectiveVersionId) await tx.promotionCampaign.update({ where: { id: campaignId }, data: { status } });
      await tx.promotionEvent.create({ data: { campaignId, promotionVersionId: campaign.currentVersionId, eventType, actorType: 'SYSTEM', actorId, oldValue: { versionStatus: before?.status }, newValue: { versionStatus: status }, metadata } });
      return this.getCampaignById(campaignId, tx);
    });
  }

  async updateCampaignStatus({ campaignId, status, actorId, validationResult }) {
    return this.updateWorkingVersionStatus({ campaignId, status, actorId, eventType: status === 'READY' ? 'VALIDATION_PASSED' : 'VALIDATION_FAILED', metadata: validationResult });
  }

  async transitionStatus({ campaignId, status, actorId, eventType, actorType = 'ADMIN_USER', reason = null, metadata = undefined, versionPatch = undefined, activateWorkingVersion = false }) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.promotionCampaign.findUnique({ where: { id: campaignId } });
      if (!current) return null;
      if (versionPatch && current.currentVersionId) await tx.promotionVersion.update({ where: { id: current.currentVersionId }, data: versionPatch });
      const shouldActivateWorking = activateWorkingVersion || ['ACTIVATED','RUN_NOW'].includes(eventType);
      let effectiveVersionId = current.effectiveVersionId;
      if (status === 'ACTIVE' && shouldActivateWorking && current.currentVersionId) {
        if (current.effectiveVersionId && current.effectiveVersionId !== current.currentVersionId) {
          await tx.promotionVersion.update({ where: { id: current.effectiveVersionId }, data: { status: 'SUPERSEDED' } });
        }
        await tx.promotionVersion.update({ where: { id: current.currentVersionId }, data: { status: 'ACTIVE' } });
        effectiveVersionId = current.currentVersionId;
        await tx.promotionCampaign.update({ where: { id: campaignId }, data: { status: 'ACTIVE', effectiveVersionId } });
      } else {
        const servingId = current.effectiveVersionId || current.currentVersionId;
        if (servingId) await tx.promotionVersion.update({ where: { id: servingId }, data: { status } });
        await tx.promotionCampaign.update({ where: { id: campaignId }, data: { status, ...(status === 'ARCHIVED' ? { archivedAt: new Date() } : {}) } });
      }
      await tx.promotionEvent.create({ data: { campaignId, promotionVersionId: shouldActivateWorking ? current.currentVersionId : (current.effectiveVersionId || current.currentVersionId), eventType, actorType, actorId, oldValue: { status: current.status, effectiveVersionId: current.effectiveVersionId }, newValue: { status, effectiveVersionId }, reason, metadata } });
      return this.getCampaignById(campaignId, tx);
    });
  }

  async requestApproval({ campaignId, promotionVersionId, approvalPolicy, requestedBy, reason = null, metadata = undefined }) {
    return this.prisma.$transaction(async (tx) => {
      await tx.promotionApproval.updateMany({ where: { promotionVersionId, status: 'PENDING' }, data: { status: 'CANCELLED', decidedAt: new Date(), reason: 'Superseded by a new approval request.' } });
      const request = await tx.promotionApproval.create({ data: { campaignId, promotionVersionId, approvalPolicy, status: 'PENDING', requestedBy, reason, metadata } });
      await tx.promotionEvent.create({ data: { campaignId, promotionVersionId, eventType: 'APPROVAL_REQUESTED', actorType: 'ADMIN_USER', actorId: requestedBy, newValue: { approvalId: request.id, approvalPolicy }, reason, metadata } });
      return request;
    });
  }

  async getPendingApprovalRequest(promotionVersionId) { return this.prisma.promotionApproval.findFirst({ where: { promotionVersionId, status: 'PENDING' }, orderBy: { requestedAt: 'desc' } }); }

  async recordApprovalDecision({ campaignId, promotionVersionId, approvalPolicy, requestedBy, decidedBy, status, reason = null, metadata = undefined }) {
    return this.prisma.$transaction(async (tx) => {
      const decision = await tx.promotionApproval.create({ data: { campaignId, promotionVersionId, approvalPolicy, status, requestedBy, decidedBy, decidedAt: new Date(), reason, metadata } });
      await tx.promotionEvent.create({ data: { campaignId, promotionVersionId, eventType: status === 'APPROVED' ? 'APPROVAL_GRANTED' : 'APPROVAL_REJECTED', actorType: 'ADMIN_USER', actorId: decidedBy, newValue: { approvalId: decision.id, status, approvalPolicy }, reason, metadata } });
      if (status === 'REJECTED') await tx.promotionApproval.updateMany({ where: { promotionVersionId, status: 'PENDING' }, data: { status: 'REJECTED', decidedBy, decidedAt: new Date(), reason } });
      return decision;
    });
  }

  async listApprovals(promotionVersionId) { return this.prisma.promotionApproval.findMany({ where: { promotionVersionId }, orderBy: { requestedAt: 'asc' } }); }
  async countApprovals(promotionVersionId) { const rows = await this.prisma.promotionApproval.findMany({ where: { promotionVersionId, status: 'APPROVED', decidedBy: { not: null } }, select: { decidedBy: true }, distinct: ['decidedBy'] }); return rows.length; }
  async hasOwnerApproval(promotionVersionId) { const row = await this.prisma.promotionApproval.findFirst({ where: { promotionVersionId, status: 'APPROVED', metadata: { path: ['deciderRoles'], array_contains: 'OWNER' } } }); return Boolean(row); }

  async getUsageSummary(promotionVersionId) {
    const aggregate = await this.prisma.promotionApplication.aggregate({ where: { promotionVersionId }, _count: { _all: true }, _sum: { discountAmount: true, baseAmount: true, finalAmount: true }, _min: { finalAmount: true } });
    return { applications: aggregate._count?._all || 0, discountAmount: Number(aggregate._sum?.discountAmount || 0), baseAmount: Number(aggregate._sum?.baseAmount || 0), finalAmount: Number(aggregate._sum?.finalAmount || 0), minimumObservedFinalAmount: aggregate._min?.finalAmount == null ? null : Number(aggregate._min.finalAmount) };
  }

  async recordEvent({ campaignId, promotionVersionId = null, eventType, actorType = 'SYSTEM', actorId = null, reason = null, metadata = undefined, oldValue = undefined, newValue = undefined }) {
    return this.prisma.promotionEvent.create({ data: { campaignId, promotionVersionId, eventType, actorType, actorId, reason, metadata, oldValue, newValue } });
  }
}

module.exports = { PromotionRepository, normalizeSchedules, serializeCampaign };
