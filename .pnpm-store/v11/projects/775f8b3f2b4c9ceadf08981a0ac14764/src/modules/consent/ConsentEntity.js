const CONSENT_TYPES = Object.freeze([
  'PERSONAL_DATA',
  'MARKETING',
  'ADVERTISING',
  'PARTNER_OFFERS',
  'PHOTO_USAGE',
]);

const CONSENT_SOURCE_CHANNELS = Object.freeze([
  'TELEGRAM',
  'MINI_APP',
  'MACHINE',
  'WEBSITE',
]);

class ConsentEntity {
  constructor(record) {
    if (!record || !CONSENT_TYPES.includes(record.consentType)) {
      throw new TypeError('Consent type is invalid.');
    }
    if (!CONSENT_SOURCE_CHANNELS.includes(record.sourceChannel)) {
      throw new TypeError('Consent source channel is invalid.');
    }
    if (!(record.consentedAt instanceof Date) || Number.isNaN(record.consentedAt.getTime())) {
      throw new TypeError('Consent timestamp is invalid.');
    }
    Object.assign(this, record);
  }
}

module.exports = { CONSENT_SOURCE_CHANNELS, CONSENT_TYPES, ConsentEntity };
