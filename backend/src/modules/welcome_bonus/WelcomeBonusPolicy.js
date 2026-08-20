const WELCOME_BONUS_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  QUALIFIED: 'QUALIFIED',
  CONVERTED: 'CONVERTED',
  USED: 'USED',
  EXPIRED: 'EXPIRED',
});

const WELCOME_BONUS_QUALIFYING_ACTION = Object.freeze({
  REFERRAL_QUALIFIED: 'referral_qualified',
  REPEAT_CLUB_TOPUP: 'repeat_club_topup',
});

const DEFAULT_VALID_DAYS = 30;

function addDays(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function isWelcomeBonusQualifyingAction(action) {
  return Object.values(WELCOME_BONUS_QUALIFYING_ACTION).includes(action);
}

module.exports = {
  WELCOME_BONUS_STATUS,
  WELCOME_BONUS_QUALIFYING_ACTION,
  DEFAULT_VALID_DAYS,
  addDays,
  isWelcomeBonusQualifyingAction,
};
