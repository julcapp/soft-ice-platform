const { BotGateway } = require('./BotGateway');
const { BotAdapter } = require('./BotAdapter');
const { TelegramAdapter } = require('./TelegramAdapter');
const { MaxAdapter } = require('./MaxAdapter');
const { parseStartPayload } = require('./DeepLinkParser');
const { BotOnboardingService } = require('./BotOnboardingService');
const { BotUserFlowService } = require('./BotUserFlowService');
const {
  buildClubSummary,
  buildReferralRewardNotification,
  buildReferralQualifiedNotification,
} = require('./BotClubView');
const {
  ONBOARDING_STAGE,
  buildWelcomeMessage,
  buildSubscriptionOffer,
  buildMainMenu,
} = require('./OnboardingPolicy');

module.exports = {
  name: 'bot_core',
  status: 'foundation',
  owns: [
    'cross-channel bot gateway',
    'Telegram and MAX transport boundaries',
    'bot deep-link context parsing',
    'bot channel event normalization',
    'bot onboarding orchestration',
    'channel subscription offer policy',
    'club summary user flow',
    'referral section user flow',
    'referral qualification and reward notifications',
  ],
  BotGateway,
  BotAdapter,
  TelegramAdapter,
  MaxAdapter,
  BotOnboardingService,
  BotUserFlowService,
  ONBOARDING_STAGE,
  buildWelcomeMessage,
  buildSubscriptionOffer,
  buildMainMenu,
  buildClubSummary,
  buildReferralRewardNotification,
  buildReferralQualifiedNotification,
  parseStartPayload,
};
