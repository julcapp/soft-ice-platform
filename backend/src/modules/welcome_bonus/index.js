const { WelcomeBonusService } = require('./WelcomeBonusService');
const { WelcomeBonusRepository } = require('./WelcomeBonusRepository');
const {
  WELCOME_BONUS_STATUS,
  WELCOME_BONUS_QUALIFYING_ACTION,
  DEFAULT_VALID_DAYS,
  addDays,
  isWelcomeBonusQualifyingAction,
} = require('./WelcomeBonusPolicy');

module.exports = {
  name: 'welcome_bonus',
  status: 'foundation',
  owns: [
    'welcome promo bonus grants',
    '30 day welcome bonus expiry',
    'welcome bonus qualification by referral or repeat club topup',
    'separate promotional balance from customer money and regular bonuses',
  ],
  WelcomeBonusService,
  WelcomeBonusRepository,
  WELCOME_BONUS_STATUS,
  WELCOME_BONUS_QUALIFYING_ACTION,
  DEFAULT_VALID_DAYS,
  addDays,
  isWelcomeBonusQualifyingAction,
};
