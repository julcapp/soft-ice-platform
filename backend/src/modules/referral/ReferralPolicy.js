const REFERRAL_STATUS = Object.freeze({
  INVITED: 'invited',
  REGISTERED: 'registered',
  QUALIFICATION_PENDING: 'qualification_pending',
  QUALIFIED: 'qualified',
  REWARDED: 'rewarded',
  REJECTED: 'rejected',
});

const QUALIFYING_ACTION = Object.freeze({
  FIRST_PURCHASE: 'first_purchase',
  QUALIFIED_CLUB_TOPUP: 'qualified_club_topup',
});

function assertReferralParticipants({ referrerCustomerId, referredCustomerId }) {
  if (!referrerCustomerId || !referredCustomerId) {
    throw new Error('referrerCustomerId and referredCustomerId are required.');
  }
  if (String(referrerCustomerId) === String(referredCustomerId)) {
    const error = new Error('Self-referral is not allowed.');
    error.code = 'SELF_REFERRAL';
    throw error;
  }
}

function isQualifyingAction(action) {
  return Object.values(QUALIFYING_ACTION).includes(action);
}

module.exports = { REFERRAL_STATUS, QUALIFYING_ACTION, assertReferralParticipants, isQualifyingAction };
