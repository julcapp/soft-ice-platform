class PhotoRewardPolicy {
  constructor({ repository, scopeKey = 'default' } = {}) {
    if (!repository) throw new Error('repository is required');
    this.repository = repository;
    this.scopeKey = scopeKey;
  }

  async resolveBonusUnits() {
    const settings = await this.repository.getSettings(this.scopeKey);
    const value = settings?.rewardBonusUnits;
    if (value == null) return null;
    const normalized = Number(value);
    return Number.isInteger(normalized) && normalized > 0 ? normalized : null;
  }
}

module.exports = { PhotoRewardPolicy };
