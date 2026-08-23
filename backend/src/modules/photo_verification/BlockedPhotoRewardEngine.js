class BlockedPhotoRewardEngine {
  async grant({ photoChallengeId, customerId }) {
    return {
      granted: false,
      status: 'blocked',
      reasonCode: 'PHOTO_REWARD_ENGINE_NOT_CONFIGURED',
      photoChallengeId,
      customerId,
    };
  }
}

module.exports = { BlockedPhotoRewardEngine };
