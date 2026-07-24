const CHANNEL_TYPES = Object.freeze(['VK', 'TELEGRAM', 'MAX', 'EMAIL', 'PHONE', 'PUSH', 'OTHER']);
const TARGET_TYPES = Object.freeze(['COMMUNITY', 'CHANNEL', 'CHAT', 'BOT', 'NEWSLETTER', 'OTHER']);
const VERIFICATION_STATUSES = Object.freeze(['VERIFIED', 'NOT_VERIFIED', 'UNKNOWN', 'UNAVAILABLE', 'STALE', 'REQUIRES_REFRESH']);
const DATA_SOURCES = Object.freeze(['OAUTH', 'OFFICIAL_API', 'MANUAL', 'IMPORT', 'SYSTEM_LINK', 'UNKNOWN']);

class CustomerExternalChannel { constructor(data) { Object.assign(this, data); } }
class CustomerExternalProfile { constructor(data) { Object.assign(this, data); } }
class CustomerChannelSubscription { constructor(data) { Object.assign(this, data); } }
class CustomerChannelVerification { constructor(data) { Object.assign(this, data); } }
class CustomerCommunicationPermission { constructor(data) { Object.assign(this, data); } }
class CustomerEngagementSummary { constructor(data) { Object.assign(this, data); Object.freeze(this); } }

module.exports = {
  CHANNEL_TYPES, TARGET_TYPES, VERIFICATION_STATUSES, DATA_SOURCES,
  CustomerExternalChannel, CustomerExternalProfile, CustomerChannelSubscription,
  CustomerChannelVerification, CustomerCommunicationPermission, CustomerEngagementSummary,
};
