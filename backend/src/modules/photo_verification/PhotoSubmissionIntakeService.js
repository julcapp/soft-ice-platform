class PhotoSubmissionIntakeService {
  constructor({ repository, storage, customerWorkflow }) {
    if (!repository || !storage || !customerWorkflow) throw new Error('repository, storage and customerWorkflow are required');
    this.repository = repository;
    this.storage = storage;
    this.customerWorkflow = customerWorkflow;
  }

  async getActiveChallenge(customerId) {
    const challenge = await this.repository.findActiveChallengeForCustomer(customerId);
    return challenge ? { ...challenge, captureMode: 'camera_required' } : null;
  }

  async submit({ customerId, photoChallengeId, buffer, mimeType, correlationId }) {
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

    const stored = await this.storage.put({ customerId, photoChallengeId, buffer, mimeType });
    await this.repository.attachSourceFile({ photoChallengeId, customerId, storageKey: stored.storageKey });
    const customerStatus = await this.customerWorkflow.recordUploaded({ photoChallengeId, customerId, correlationId });
    return { photoChallengeId, storageKey: stored.storageKey, captureMode: 'camera_required', customerStatus };
  }
}

module.exports = { PhotoSubmissionIntakeService };
