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

class PromotionRepository {
  constructor(prisma) {
    if (!prisma) throw new Error('Prisma client is required.');
    this.prisma = prisma;
  }

  async createDraft(input) {
    const {
      code,
      name,
      description = null,
      createdBy,
      version,
    } = input;

    return this.prisma.$transaction(async (tx) => {
      const campaign = await tx.promotionCampaign.create({
        data: {
          code,
          name,
          description,
          status: 'DRAFT',
          createdBy,
        },
      });

      const createdVersion = await tx.promotionVersion.create({
        data: {
          campaignId: campaign.id,
          version: version.version || 1,
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
          newValue: {
            code,
            name,
            version: createdVersion.version,
          },
        },
      });

      return this.getCampaignById(campaign.id, tx);
    });
  }

  async getCampaignById(id, client = this.prisma) {
    return client.promotionCampaign.findUnique({
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
  }

  async updateCampaignStatus({ campaignId, status, actorId, validationResult }) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.promotionCampaign.findUnique({ where: { id: campaignId } });
      if (!current) throw new Error('Promotion campaign not found.');

      const updated = await tx.promotionCampaign.update({
        where: { id: campaignId },
        data: { status },
      });

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

module.exports = { PromotionRepository, normalizeSchedules };
