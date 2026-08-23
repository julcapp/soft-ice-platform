'use strict';

function normalizeTimeForPrisma(value) {
  if (value instanceof Date) return value;
  if (typeof value !== 'string' || !/^\d{2}:\d{2}(:\d{2})?$/.test(value)) return value;
  const normalized = value.length === 5 ? `${value}:00` : value;
  return new Date(`1970-01-01T${normalized}.000Z`);
}

function normalizeSchedules(schedules = []) {
  return schedules.map((item) => ({
    ...item,
    startTime: normalizeTimeForPrisma(item.startTime),
    endTime: normalizeTimeForPrisma(item.endTime),
  }));
}

function timeFromPrisma(value) {
  if (!(value instanceof Date)) return value;
  return value.toISOString().slice(11, 19);
}

function serializeCampaign(campaign) {
  if (!campaign || !campaign.currentVersion) return campaign;
  return {
    ...campaign,
    currentVersion: {
      ...campaign.currentVersion,
      schedules: (campaign.currentVersion.schedules || []).map((item) => ({
        ...item,
        startTime: timeFromPrisma(item.startTime),
        endTime: timeFromPrisma(item.endTime),
      })),
    },
  };
}

function versionScalarData(version, createdBy) {
  return {
    benefitType: version.benefitType,
    benefitValue: version.benefitValue,
    priority: version.priority || 0,
    stackingMode: version.stackingMode || 'BEST_PRICE',
    exclusiveGroup: version.exclusiveGroup || null,
    priceLockSeconds: version.priceLockSeconds || 300,
    startsAt: version.startsAt || null,
    endsAt: version.endsAt || null,
    timezone: version.timezone || 'Europe/Moscow',
    approvalPolicy: version.approvalPolicy || 'SINGLE_APPROVAL',
    isManualOverride: Boolean(version.isManualOverride),
    budgetAmount: version.budgetAmount ?? null,
    budgetAction: version.budgetAction || 'STOP',
    maxApplications: version.maxApplications ?? null,
    maxApplicationsPerCustomer: version.maxApplicationsPerCustomer ?? null,
    minimumFinalPrice: version.minimumFinalPrice ?? null,
    metadata: version.metadata || undefined,
    createdBy,
  };
}

class PromotionRepository {
  constructor(prisma) {
    if (!prisma) throw new Error('Prisma client is required.');
    this.prisma = prisma;
  }

  async createDraft(input) {
    const { code, name, description = null, createdBy, version } = input;

    return this.prisma.$transaction(async (tx) => {
      const campaign = await tx.promotionCampaign.create({
        data: { code, name, description, status: 'DRAFT', createdBy },
      });

      const createdVersion = await tx.promotionVersion.create({
        data: {
          campaignId: campaign.id,
          version: version.version || 1,
          ...versionScalarData(version, createdBy),
          schedules: { create: normalizeSchedules(version.schedules || []) },
          targets: { create: version.targets || [] },
          audiences: { create: version.audiences || [] },
          rules: { create: version.rules || [] },
          channels: { create: version.channels || [] },
        },
      });

      await tx.promotionCampaign.update({
        where: { id: campaign.id },
        data: { currentVersionId: createdVersion.id },
      });

      await tx.promotionEvent.create({
        data: {
          campaignId: campaign.id,
          promotionVersionId: createdVersion.id,
          eventType: 'DRAFT_CREATED',
          actorType: 'ADMIN_USER',
          actorId: createdBy,
          newValue: { code, name, version: createdVersion.version },
        },
      });

      return this.getCampaignById(campaign.id, tx);
    });
  }

  async getCampaignById(id, client = this.prisma) {
    const campaign = await client.promotionCampaign.findUnique({
      where: { id },
      include: {
        currentVersion: {
          include: {
            schedules: true,
            targets: true,
            audiences: true,
            rules: true,
            channels: true,
          },
        },
      },
    });
    return serializeCampaign(campaign);
  }

  async updateDraft({ campaignId, patch, actorId }) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.getCampaignById(campaignId, tx);
      if (!current) return null;

      const campaignData = {};
      if (Object.prototype.hasOwnProperty.call(patch, 'name')) campaignData.name = patch.name;
      if (Object.prototype.hasOwnProperty.call(patch, 'description')) campaignData.description = patch.description;
      if (Object.keys(campaignData).length > 0) {
        await tx.promotionCampaign.update({ where: { id: campaignId }, data: campaignData });
      }

      if (patch.version) {
        const versionId = current.currentVersion.id;
        const versionPatch = { ...patch.version };
        const relationKeys = ['schedules', 'targets', 'audiences', 'rules', 'channels'];
        relationKeys.forEach((key) => delete versionPatch[key]);
        if (Object.prototype.hasOwnProperty.call(versionPatch, 'startTime')) delete versionPatch.startTime;
        if (Object.keys(versionPatch).length > 0) {
          const normalized = { ...versionPatch };
          if (Object.prototype.hasOwnProperty.call(normalized, 'startsAt')) normalized.startsAt = normalized.startsAt || null;
          if (Object.prototype.hasOwnProperty.call(normalized, 'endsAt')) normalized.endsAt = normalized.endsAt || null;
          await tx.promotionVersion.update({ where: { id: versionId }, data: normalized });
        }

        if (patch.version.schedules) {
          await tx.promotionSchedule.deleteMany({ where: { promotionVersionId: versionId } });
          if (patch.version.schedules.length) await tx.promotionSchedule.createMany({ data: normalizeSchedules(patch.version.schedules).map((x) => ({ ...x, promotionVersionId: versionId })) });
        }
        if (patch.version.targets) {
          await tx.promotionTarget.deleteMany({ where: { promotionVersionId: versionId } });
          if (patch.version.targets.length) await tx.promotionTarget.createMany({ data: patch.version.targets.map((x) => ({ ...x, promotionVersionId: versionId })) });
        }
        if (patch.version.audiences) {
          await tx.promotionAudience.deleteMany({ where: { promotionVersionId: versionId } });
          if (patch.version.audiences.length) await tx.promotionAudience.createMany({ data: patch.version.audiences.map((x) => ({ ...x, promotionVersionId: versionId })) });
        }
        if (patch.version.rules) {
          await tx.promotionRule.deleteMany({ where: { promotionVersionId: versionId } });
          if (patch.version.rules.length) await tx.promotionRule.createMany({ data: patch.version.rules.map((x) => ({ ...x, promotionVersionId: versionId })) });
        }
        if (patch.version.channels) {
          await tx.promotionChannel.deleteMany({ where: { promotionVersionId: versionId } });
          if (patch.version.channels.length) await tx.promotionChannel.createMany({ data: patch.version.channels.map((x) => ({ ...x, promotionVersionId: versionId })) });
        }
      }

      await tx.promotionCampaign.update({ where: { id: campaignId }, data: { status: 'DRAFT' } });
      await tx.promotionEvent.create({
        data: {
          campaignId,
          promotionVersionId: current.currentVersionId,
          eventType: 'DRAFT_UPDATED',
          actorType: 'ADMIN_USER',
          actorId,
          oldValue: { name: current.name, description: current.description, status: current.status },
          newValue: patch,
        },
      });
      return this.getCampaignById(campaignId, tx);
    });
  }

  async createVersion({ campaignId, version, actorId }) {
    return this.prisma.$transaction(async (tx) => {
      const campaign = await this.getCampaignById(campaignId, tx);
      if (!campaign) return null;
      const nextVersion = (await tx.promotionVersion.aggregate({ where: { campaignId }, _max: { version: true } }))._max.version + 1;
      const created = await tx.promotionVersion.create({
        data: {
          campaignId,
          version: nextVersion,
          ...versionScalarData(version, actorId),
          schedules: { create: normalizeSchedules(version.schedules || []) },
          targets: { create: version.targets || [] },
          audiences: { create: version.audiences || [] },
          rules: { create: version.rules || [] },
          channels: { create: version.channels || [] },
        },
      });
      await tx.promotionCampaign.update({ where: { id: campaignId }, data: { currentVersionId: created.id, status: 'DRAFT' } });
      await tx.promotionEvent.create({
        data: {
          campaignId,
          promotionVersionId: created.id,
          eventType: 'VERSION_CREATED',
          actorType: 'ADMIN_USER',
          actorId,
          oldValue: { currentVersionId: campaign.currentVersionId, version: campaign.currentVersion?.version },
          newValue: { currentVersionId: created.id, version: nextVersion },
        },
      });
      return this.getCampaignById(campaignId, tx);
    });
  }

  async updateCampaignStatus({ campaignId, status, actorId, validationResult }) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.promotionCampaign.findUnique({ where: { id: campaignId } });
      if (!current) throw new Error('Promotion campaign not found.');

      const updated = await tx.promotionCampaign.update({ where: { id: campaignId }, data: { status } });
      await tx.promotionEvent.create({
        data: {
          campaignId,
          promotionVersionId: current.currentVersionId,
          eventType: status === 'READY' ? 'VALIDATION_PASSED' : 'VALIDATION_FAILED',
          actorType: 'SYSTEM',
          actorId,
          oldValue: { status: current.status },
          newValue: { status },
          metadata: validationResult,
        },
      });
      return updated;
    });
  }
}

module.exports = { PromotionRepository, normalizeSchedules, serializeCampaign };
