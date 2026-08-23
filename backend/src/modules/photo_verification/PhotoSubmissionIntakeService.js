class PhotoSubmissionIntakeService {
  constructor({ repository, storage, customerWorkflow, captureChallengeService }) {
    if (!repository || !storage || !customerWorkflow || !captureChallengeService) {
      throw new Error('repository, storage, customerWorkflow and captureChallengeService are required');
    }
    this.repository = repository;
    this.storage = storage;
    this.customerWorkflow = customerWorkflow;
    this.captureChallengeService = captureChallengeService;
  }

  async getActiveChallenge(customerId, { correlationId = null } = {}) {
    const challenge = await this.repository.findActiveChallengeForCustomer(customerId);
    if (!challenge) return null;
    const captureChallenge = await this.captureChallengeService.issue({
      photoChallengeId: challenge.id,
      customerId,
      correlationId,
    });
    return {
      ...challenge,
      captureMode: 'camera_required',
      captureChallenge,
    };
  }

  async submit({ customerId, photoChallengeId, buffer, mimeType, captureCode, correlationId }) {
    if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error('Photo body is required');
    const challenge = await this.repository.getChallengeForCustomer(photoChallengeId, customerId);
    if (!challenge) {
      const error = new Error('Photo challenge was not found for current customer');
      error.code = 'PHOTO_CHALLENGE_NOT_FOUND';
      error.statusCode = 404;
      throw error;
    }
    if (challenge.deadlineAt && new Date(challenge.deadlineAt) < new Date()) {
      const error = new Error('Photo challenge has expired');
      error.code = 'PHOTO_CHALLENGE_EXPIRED';
      error.statusCode = 409;
      throw error;
    }
    if (challenge.photoFilePath) {
      const error = new Error('Photo challenge already has a submitted source file');
      error.code = 'PHOTO_CHALLENGE_ALREADY_SUBMITTED';
      error.statusCode = 409;
      throw error;
    }

    const capture = await this.captureChallengeService.verify({ photoChallengeId, customerId, code: captureCode });
    if (!capture.valid) {
      const error = new Error('One-time capture code is invalid, expired or already used');
      error.code = capture.reasonCode;
      error.statusCode = 409;
      throw error;
    }

    const stored = await this.storage.put({ customerId, photoChallengeId, buffer, mimeType });
    try {
      await this.repository.attachSourceFile({ photoChallengeId, customerId, storageKey: stored.storageKey });
    } catch (error) {
      await this.storage.delete?.(stored.storageKey).catch(() => null);
      throw error;
    }

    await this.captureChallengeService.consume({
      photoChallengeId,
      customerId,
      issuedEventId: capture.issuedEventId,
      correlationId,
    });
    const customerStatus = await this.customerWorkflow.recordUploaded({ photoChallengeId, customerId, correlationId });
    return {
      photoChallengeId,
      storageKey: stored.storageKey,
      captureMode: 'camera_required',
      captureChallengeConsumed: true,
      customerStatus,
    };
  }
}

module.exports = { PhotoSubmissionIntakeService };
