const { ReferralService, createReferralCode } = require('./ReferralService');
const { REFERRAL_STATUS, QUALIFYING_ACTION, assertReferralParticipants, isQualifyingAction } = require('./ReferralPolicy');
const { buildReferralSection } = require('./ReferralView');

module.exports = {
  name: 'referral',
  status: 'foundation',
  owns: [
    'personal referral codes',
    'referral attribution after verified customer resolution',
    'referral qualification state machine',
    'self-referral protection',
    'referral funnel view model',
  ],
  ReferralService,
  createReferralCode,
  REFERRAL_STATUS,
  QUALIFYING_ACTION,
  assertReferralParticipants,
  isQualifyingAction,
  buildReferralSection,
};
