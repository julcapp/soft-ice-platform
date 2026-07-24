class ExternalChannelRepository {
  constructor() { this.profiles = new Map(); this.subscriptions = new Map(); }
  listProfiles(customerId, channelType) { return [...this.profiles.values()].filter((x) => x.customerId === customerId && (!channelType || x.channelType === channelType)); }
  listSubscriptions(customerId, channelType) { return [...this.subscriptions.values()].filter((x) => x.customerId === customerId && (!channelType || x.channelType === channelType)); }
  saveProfile(value) { this.profiles.set(value.id, value); return value; }
  saveSubscription(value) { this.subscriptions.set(value.id, value); return value; }
  findProfile(id) { return this.profiles.get(id) || null; }
  findSubscription(id) { return this.subscriptions.get(id) || null; }
}
module.exports = { ExternalChannelRepository };
