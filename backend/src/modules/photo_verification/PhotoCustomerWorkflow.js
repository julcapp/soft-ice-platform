const { USER_PHOTO_STATUSES, publicStatus } = require('./UserPhotoStatus');

class PhotoCustomerWorkflow {
  constructor({ repository, notifier = null }) {
    if (!repository) throw new Error('repository is required');
    this.repository = repository;
    this.notifier = notifier;
  }

  async recordUploaded({ photoChallengeId, customerId, correlationId }) {
    const status = publicStatus(USER_PHOTO_STATUSES.MODERATION);
    await this._recordAndNotify({ photoChallengeId, customerId, correlationId, eventType: 'customer_photo_moderation_started', status });
    return status;
  }

  async handleDuplicateCheck({ photoChallengeId, customerId, duplicateResult, correlationId }) {
    if (duplicateResult?.duplicate) {
      const status = publicStatus(USER_PHOTO_STATUSES.DUPLICATE, { reasonCode: 'exact_duplicate' });
      await this._recordAndNotify({ photoChallengeId, customerId, correlationId, eventType: 'customer_photo_duplicate_rejected', status });
      return { stopBeforeVision: true, status };
    }

    if (duplicateResult?.nearDuplicate) {
      const status = publicStatus(USER_PHOTO_STATUSES.ADDITIONAL_REVIEW, { reasonCode: 'near_duplicate' });
      await this._recordAndNotify({ photoChallengeId, customerId, correlationId, eventType: 'customer_photo_additional_review', status });
      return { stopBeforeVision: true, routeToManualReview: true, status };
    }

    return { stopBeforeVision: false, status: null };
  }

  async recordModerationDecision({ photoChallengeId, customerId, decision, reasonCode, correlationId }) {
    let status;
    let eventType;
    if (decision === 'approved') {
      status = publicStatus(USER_PHOTO_STATUSES.APPROVED);
      eventType = 'customer_photo_moderation_approved';
    } else if (decision === 'manual_review') {
      status = publicStatus(USER_PHOTO_STATUSES.ADDITIONAL_REVIEW);
      eventType = 'customer_photo_additional_review';
    } else {
      status = publicStatus(USER_PHOTO_STATUSES.REJECTED, { reasonCode: reasonCode || 'moderation_rejected' });
      eventType = 'customer_photo_moderation_rejected';
    }
    await this._recordAndNotify({ photoChallengeId, customerId, correlationId, eventType, status });
    return status;
  }

  async recordPublished({ photoChallengeId, customerId, channel, publicationUrl, publishedAt, correlationId }) {
    const status = publicStatus(USER_PHOTO_STATUSES.PUBLISHED, {
      channel,
      publicationUrl: publicationUrl || null,
      publishedAt: publishedAt || new Date(),
    });
    await this._recordAndNotify({ photoChallengeId, customerId, correlationId, eventType: 'customer_photo_published', status });
    return status;
  }

  async recordRewarded({ photoChallengeId, customerId, amountBonus, balanceAfterBonus, transactionId, correlationId }) {
    const status = publicStatus(USER_PHOTO_STATUSES.REWARDED, {
      amountBonus: Number(amountBonus),
      balanceAfterBonus: Number.isFinite(Number(balanceAfterBonus)) ? Number(balanceAfterBonus) : null,
      transactionId: transactionId || null,
    });
    await this._recordAndNotify({ photoChallengeId, customerId, correlationId, eventType: 'customer_photo_rewarded', status });
    return status;
  }

  async _recordAndNotify({ photoChallengeId, customerId, correlationId, eventType, status }) {
    await this.repository.recordEvent({
      photoChallengeId,
      eventType,
      eventSource: 'photo_customer_workflow',
      correlationId,
      payload: { customerId: customerId || null, ...status },
    });

    if (this.notifier?.notify) {
      await this.notifier.notify({ customerId, photoChallengeId, correlationId, ...status });
    }
  }
}

module.exports = { PhotoCustomerWorkflow };
