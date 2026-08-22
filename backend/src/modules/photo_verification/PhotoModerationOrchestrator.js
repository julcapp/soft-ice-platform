const { PhotoVerificationAgent } = require('./PhotoVerificationAgent');
const { PHOTO_VERIFICATION_MODES, PHOTO_VERIFICATION_DECISIONS } = require('./constants');

class PhotoModerationOrchestrator {
  constructor({
    repository,
    storage,
    metadataAnalyzer,
    fingerprintService,
    duplicateDetector,
    technicalAnalyzer,
    customerWorkflow,
    moderationLifecycle,
    publishingOrchestrator,
    rewardEngine,
    captureVisualVerifier = null,
    visionProvider = null,
    logger = null,
  }) {
    Object.assign(this, {
      repository,
      storage,
      metadataAnalyzer,
      fingerprintService,
      duplicateDetector,
      technicalAnalyzer,
      customerWorkflow,
      moderationLifecycle,
      publishingOrchestrator,
      rewardEngine,
      captureVisualVerifier,
      visionProvider,
      logger,
    });
    for (const [name, dependency] of Object.entries({ repository, storage, technicalAnalyzer, customerWorkflow, moderationLifecycle, publishingOrchestrator, rewardEngine })) {
      if (!dependency) throw new Error(`${name} is required`);
    }
  }

  async process({ photoChallengeId, customerId, storageKey, mimeType = 'image/jpeg', caption = '', correlationId = null }) {
    const settings = await this.repository.getSettings('default');
    if (!settings?.enabled || settings.mode === PHOTO_VERIFICATION_MODES.DISABLED) {
      return this.#manual({ photoChallengeId, customerId, correlationId, reasonCode: 'service_disabled' });
    }

    const buffer = await this.storage.get(storageKey);
    const technical = await this.technicalAnalyzer.analyze({
      photoChallengeId,
      buffer,
      mimeType,
      receivedAt: new Date(),
    });

    const duplicateFlow = await this.customerWorkflow.handleDuplicateCheck({
      photoChallengeId,
      customerId,
      duplicateResult: technical.duplicateResult,
      correlationId,
    });
    if (duplicateFlow.stopBeforeVision) {
      return {
        stage: duplicateFlow.routeToManualReview ? 'manual_review' : 'rejected',
        status: duplicateFlow.status,
        technical,
      };
    }

    const mode = settings.mode || PHOTO_VERIFICATION_MODES.MANUAL_ONLY;
    const provider = mode === PHOTO_VERIFICATION_MODES.AI_ASSISTED ? this.visionProvider : null;
    if (mode === PHOTO_VERIFICATION_MODES.AI_ASSISTED && !provider) {
      return this.#manual({ photoChallengeId, customerId, correlationId, reasonCode: 'vision_provider_not_configured', technical });
    }

    const agent = new PhotoVerificationAgent({
      mode,
      provider,
      approvalThreshold: Number(settings.approvalThreshold ?? 0.9),
      rejectionThreshold: Number(settings.rejectionThreshold ?? 0.65),
      maxFraudScore: Number(settings.maxFraudScore ?? 0.5),
    });

    let result;
    try {
      result = await agent.verify({
        submissionId: photoChallengeId,
        challengeId: photoChallengeId,
        customerId,
        storageKey,
        rules: {
          requiredChannels: settings.requiredChannels || [],
          captureCodeVisualCheckRequired: Boolean(settings.challengeCodeEnabled),
        },
        metadata: technical.metadataResult,
        antifraud: technical.duplicateResult,
      });
    } catch (error) {
      this.logger?.warn?.('photo_verification.vision.failed', { photoChallengeId, code: error.code || 'VISION_FAILED' });
      return this.#manual({ photoChallengeId, customerId, correlationId, reasonCode: error.code || 'vision_failed', technical });
    }

    if (settings.challengeCodeEnabled) {
      if (!this.captureVisualVerifier?.verify) {
        result = forceManualReview(result, 'capture_code_visual_verifier_not_configured', {
          captureCodeMatches: false,
        });
      } else {
        const visualCheck = await this.captureVisualVerifier.verify({
          photoChallengeId,
          customerId,
          detectedCaptureCode: result.checks?.detectedCaptureCode || null,
        });
        result = {
          ...result,
          checks: {
            ...(result.checks || {}),
            captureCodeMatches: Boolean(visualCheck.matches),
          },
        };
        await this.repository.recordEvent({
          photoChallengeId,
          eventType: 'capture_code_visual_checked',
          eventSource: 'photo_moderation_orchestrator',
          correlationId,
          payload: {
            visible: Boolean(result.checks.captureCodeVisible),
            matches: Boolean(visualCheck.matches),
            reasonCode: visualCheck.reasonCode || null,
          },
        });
        if (!visualCheck.matches) {
          result = forceManualReview(result, visualCheck.reasonCode || 'capture_code_visual_check_failed');
        }
      }
    }

    await this.moderationLifecycle.recordModerationResult({ photoChallengeId, result, correlationId });
    const publicStatus = await this.customerWorkflow.recordModerationDecision({
      photoChallengeId,
      customerId,
      decision: result.decision,
      reasonCode: result.reasonCode,
      correlationId,
    });

    if (result.decision !== PHOTO_VERIFICATION_DECISIONS.APPROVED) {
      return { stage: result.decision, result, status: publicStatus, technical };
    }

    if (!settings.publishingEnabled) {
      return { stage: 'publication_pending', result, status: publicStatus, technical };
    }

    const publication = await this.publishingOrchestrator.publishAll({
      photoChallengeId,
      media: { buffer, mimeType, filename: `${photoChallengeId}.jpg` },
      caption,
      correlationId,
    });

    for (const channel of publication.results.filter((entry) => entry.status === 'published')) {
      await this.customerWorkflow.recordPublished({
        photoChallengeId,
        customerId,
        channel: channel.channel,
        publicationUrl: channel.publicationUrl,
        publishedAt: new Date(),
        correlationId,
      });
    }

    if (!publication.allRequiredPublished) {
      return { stage: 'publication_incomplete', result, publication, technical };
    }

    const reward = await this.rewardEngine.grant({
      photoChallengeId,
      customerId,
      correlationId,
      idempotencyKey: `photo-reward:${photoChallengeId}`,
    });
    await this.repository.recordEvent({
      photoChallengeId,
      eventType: reward.granted ? 'photo_reward_granted' : 'photo_reward_pending',
      eventSource: 'photo_reward_engine',
      correlationId,
      payload: {
        granted: Boolean(reward.granted),
        reasonCode: reward.reasonCode || null,
        transactionId: reward.transactionId || null,
        amountBonus: reward.amountBonus ?? null,
      },
    });

    if (!reward.granted) {
      return { stage: 'reward_pending', result, publication, reward, technical };
    }

    const rewardStatus = await this.customerWorkflow.recordRewarded({
      photoChallengeId,
      customerId,
      amountBonus: reward.amountBonus,
      balanceAfterBonus: reward.balanceAfterBonus,
      transactionId: reward.transactionId,
      correlationId,
    });

    if (settings.retentionPolicy === 'delete_after_publication') {
      await this.storage.delete(storageKey);
      await this.moderationLifecycle.recordSourceDeletion({
        photoChallengeId,
        storageKey,
        publicationConfirmed: true,
        correlationId,
      });
    }

    return { stage: 'completed', result, publication, reward, rewardStatus, technical };
  }

  async #manual({ photoChallengeId, customerId, correlationId, reasonCode, technical = null }) {
    const result = {
      provider: null,
      model: null,
      decision: PHOTO_VERIFICATION_DECISIONS.MANUAL_REVIEW,
      confidence: 0,
      fraudScore: 0,
      reasonCode,
      checks: {},
      agentVersion: '0.1.0',
    };
    await this.moderationLifecycle.recordModerationResult({ photoChallengeId, result, correlationId });
    const status = await this.customerWorkflow.recordModerationDecision({
      photoChallengeId,
      customerId,
      decision: PHOTO_VERIFICATION_DECISIONS.MANUAL_REVIEW,
      reasonCode,
      correlationId,
    });
    return { stage: 'manual_review', result, status, technical };
  }
}

function forceManualReview(result, reasonCode, extraChecks = {}) {
  return {
    ...result,
    decision: PHOTO_VERIFICATION_DECISIONS.MANUAL_REVIEW,
    reasonCode,
    checks: { ...(result.checks || {}), ...extraChecks },
  };
}

module.exports = { PhotoModerationOrchestrator, forceManualReview };
