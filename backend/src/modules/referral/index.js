const { ReferralService, createReferralCode } = require('./ReferralService');
const { ReferralRepository } = require('./ReferralRepository');
const { ReferralRewardEngine } = require('./ReferralRewardEngine');
const { REFERRAL_STATUS, QUALIFYING_ACTION, assertReferralParticipants, isQualifyingAction } = require('./ReferralPolicy');
const { buildReferralSection } = require('./ReferralView');

module.exports = {
  name: 'referral',
  status: 'foundation',
  owns: [
    'personal referral codes',
    'referral attribution after verified customer resolution',
    'referral qualification persistence and state machine',
    'self-referral protection',
    'referral reward orchestration',
    'referral funnel view model',
  ],
  ReferralService,
  ReferralRepository,
  ReferralRewardEngine,
  createReferralCode,
  REFERRAL_STATUS,
  QUALIFYING_ACTION,
  assertReferralParticipants,
  isQualifyingAction,
  buildReferralSection,
};
