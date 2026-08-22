const { PHOTO_VERIFICATION_DECISIONS } = require('./constants');
const { assertAdmin } = require('./PhotoVerificationAdminService');

const MANUAL_ACTIONS = Object.freeze({
  APPROVE: 'approve',
  REVIEW: 'review',
  REJECT: 'reject',
});

class PhotoManualReviewService {
  constructor({ repository, storage, customerWorkflow, publishingOrchestrator, rewardEngine, moderationLifecycle }) {
    for (const [name, dependency] of Object.entries({ repository, storage, customerWorkflow, publishingOrchestrator, rewardEngine, moderationLifecycle })) {
      if (!dependency) throw new Error(`${name} is required`);
    }
    Object.assign(this, { repository, storage, customerWorkflow, publishingOrchestrator, rewardEngine, moderationLifecycle });
  }

  async list(securityContext, { limit = 50 } = {}) {
    assertAdmin(securityContext);
    return this.repository.listManualReviewQueue({ limit });
  }

  async get(securityContext, photoChallengeId) {
    assertAdmin(securityContext);
    const item = await this.repository.getManualReviewItem(photoChallengeId);
    if (!item) throw notFound();
    return item;
  }

  async getPreview(securityContext, photoChallengeId) {
    const item = await this.get(securityContext, photoChallengeId);
    if (!item.storageKey) throw notFound('PHOTO_SOURCE_NOT_FOUND');
    return { buffer: await this.storage.get(item.storageKey), storageKey: item.storageKey };
  }

  async decide(securityContext, photoChallengeId, { action, reason = '', correlationId = null } = {}) {
    assertAdmin(securityContext);
    if (!Object.values(MANUAL_ACTIONS).includes(action)) throw invalid('PHOTO_MANUAL_ACTION_INVALID');
    const normalizedReason = String(reason || '').trim();
    if ((action === MANUAL_ACTIONS.REJECT || action === MANUAL_ACTIONS.REVIEW) && normalizedReason.length < 3) {
      throw invalid('PHOTO_MANUAL_REASON_REQUIRED');
    }

    const item = await this.repository.getManualReviewItem(photoChallengeId);
    if (!item) throw notFound();
    const actorId = securityContext?.userId || securityContext?.actorId || securityContext?.subject || 'admin';
    const decision = action === MANUAL_ACTIONS.APPROVE
      ? PHOTO_VERIFICATION_DECISIONS.APPROVED
      : action === MANUAL_ACTIONS.REVIEW
        ? PHOTO_VERIFICATION_DECISIONS.MANUAL_REVIEW
        : PHOTO_VERIFICATION_DECISIONS.REJECTED;

    const result = {
      provider: 'manual',
      model: null,
      decision,
      confidence: 1,
      fraudScore: item.fraudScore == null ? null : Number(item.fraudScore),
      reasonCode: normalizedReason || `manual_${action}`,
      checks: { manualDecision: true, actorId },
      agentVersion: 'manual-v1',
    };
    await this.moderationLifecycle.recordModerationResult({ photoChallengeId, result, correlationId });
    await this.repository.recordEvent({
      photoChallengeId,
      eventType: 'manual_moderation_decision',
      eventSource: 'admin_console',
      actorId,
      correlationId,
      payload: { action, decision, reason: normalizedReason || null },
    });
    const customerStatus = await this.customerWorkflow.recordModerationDecision({
      photoChallengeId,
      customerId: item.customerId,
      decision,
      reasonCode: result.reasonCode,
      correlationId,
    });

    if (decision !== PHOTO_VERIFICATION_DECISIONS.APPROVED) {
      return { stage: decision, decision, customerStatus };
    }

    const settings = await this.repository.getSettings('default');
    if (!settings?.publishingEnabled) {
      return { stage: 'publication_pending', decision, customerStatus };
    }

    const buffer = await this.storage.get(item.storageKey);
    const publication = await this.publishingOrchestrator.publishAll({
      photoChallengeId,
      media: { buffer, mimeType: mimeTypeFromStorageKey(item.storageKey), filename: `${photoChallengeId}.jpg` },
      caption: '',
      correlationId,
    });
    for (const channel of publication.results.filter((entry) => entry.status === 'published')) {
      await this.customerWorkflow.recordPublished({
        photoChallengeId,
        customerId: item.customerId,
        channel: channel.channel,
        publicationUrl: channel.publicationUrl,
        publishedAt: new Date(),
        correlationId,
      });
    }
    if (!publication.allRequiredPublished) return { stage: 'publication_incomplete', decision, publication, customerStatus };

    const reward = await this.rewardEngine.grant({
      photoChallengeId,
      customerId: item.customerId,
      correlationId,
      idempotencyKey: `photo-reward:${photoChallengeId}`,
    });
    await this.repository.recordEvent({
      photoChallengeId,
      eventType: reward.granted ? 'photo_reward_granted' : 'photo_reward_pending',
      eventSource: 'photo_reward_engine',
      correlationId,
      payload: { granted: Boolean(reward.granted), reasonCode: reward.reasonCode || null, transactionId: reward.transactionId || null, amountBonus: reward.amountBonus ?? null },
    });
    if (!reward.granted) return { stage: 'reward_pending', decision, publication, reward, customerStatus };

    const rewardStatus = await this.customerWorkflow.recordRewarded({
      photoChallengeId,
      customerId: item.customerId,
      amountBonus: reward.amountBonus,
      balanceAfterBonus: reward.balanceAfterBonus,
      transactionId: reward.transactionId,
      correlationId,
    });

    if (settings.retentionPolicy === 'delete_after_publication') {
      await this.storage.delete(item.storageKey);
      await this.moderationLifecycle.recordSourceDeletion({
        photoChallengeId,
        storageKey: item.storageKey,
        publicationConfirmed: true,
        correlationId,
      });
    }
    return { stage: 'completed', decision, publication, reward, rewardStatus, customerStatus };
  }
}

function mimeTypeFromStorageKey(storageKey) {
  const value = String(storageKey || '').toLowerCase();
  if (value.endsWith('.png')) return 'image/png';
  if (value.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}
function notFound(code = 'PHOTO_MANUAL_REVIEW_NOT_FOUND') { const e = new Error(code); e.code = code; e.statusCode = 404; return e; }
function invalid(code) { const e = new Error(code); e.code = code; e.statusCode = 400; return e; }

module.exports = { PhotoManualReviewService, MANUAL_ACTIONS };
