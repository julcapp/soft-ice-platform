class VkExternalChannelAdapter {
  async getProfile() { throw new Error('BLOCKED_EXTERNAL'); }
  async getCommunitySubscription() { throw new Error('BLOCKED_EXTERNAL'); }
}
class ManualVkExternalChannelAdapter extends VkExternalChannelAdapter {
  constructor(repository) { super(); this.repository = repository; }
  getProfile(customerId) { return this.repository.listProfiles(customerId, 'VK'); }
  getCommunitySubscription(customerId) { return this.repository.listSubscriptions(customerId, 'VK'); }
}
class MockVkExternalChannelAdapter extends VkExternalChannelAdapter {
  constructor(data = {}) { super(); this.data = data; }
  async getProfile(customerId) { return this.data[customerId]?.profile || null; }
  async getCommunitySubscription(customerId) { return this.data[customerId]?.subscription || null; }
}
module.exports = { VkExternalChannelAdapter, ManualVkExternalChannelAdapter, MockVkExternalChannelAdapter };
