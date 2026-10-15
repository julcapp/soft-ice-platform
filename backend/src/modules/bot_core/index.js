const { BotGateway } = require('./BotGateway');
const { BotAdapter } = require('./BotAdapter');
const { TelegramAdapter } = require('./TelegramAdapter');
const { MaxAdapter } = require('./MaxAdapter');
const { MaxBotApiClient } = require('./MaxBotApiClient');
const { BotRecipientBindingRepository } = require('./BotRecipientBindingRepository');
const { BotRecipientBindingService } = require('./BotRecipientBindingService');
const { TransportRenderer } = require('./TransportRenderer');
const { TelegramRenderer } = require('./TelegramRenderer');
const { MaxRenderer } = require('./MaxRenderer');
const { BotActionRouter } = require('./BotActionRouter');
const { BotRuntime, extractCallback, isStartUpdate, resolveDestination } = require('./BotRuntime');
const { BotTransportSender } = require('./BotTransportSender');
const { parseStartPayload } = require('./DeepLinkParser');
const { BotOnboardingService } = require('./BotOnboardingService');
const { BotUserFlowService } = require('./BotUserFlowService');
const { BotGiftActionService, buildGiftAcceptAction, parseGiftAction } = require('./BotGiftActionService');
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
    'authenticated gift list and acceptance orchestration',
    'transport-specific rendering from shared view models',
    'bot action routing without business logic duplication',
    'runtime webhook dispatch and transport sending',
  ],
  BotGateway,
  BotAdapter,
  TelegramAdapter,
  MaxAdapter,
  MaxBotApiClient,
  BotRecipientBindingRepository,
  BotRecipientBindingService,
  TransportRenderer,
  TelegramRenderer,
  MaxRenderer,
  BotActionRouter,
  BotRuntime,
  BotTransportSender,
  extractCallback,
  isStartUpdate,
  resolveDestination,
  BotOnboardingService,
  BotUserFlowService,
  BotGiftActionService,
  buildGiftAcceptAction,
  parseGiftAction,
  ONBOARDING_STAGE,
  buildWelcomeMessage,
  buildSubscriptionOffer,
  buildMainMenu,
  buildClubSummary,
  buildReferralRewardNotification,
  buildReferralQualifiedNotification,
  parseStartPayload,
};
