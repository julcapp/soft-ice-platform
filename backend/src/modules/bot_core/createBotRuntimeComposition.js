const { getPrismaClient } = require('../../common/database');
const { sha256 } = require('../../platform/security/hash');
const { CustomerRepository } = require('../customer/CustomerRepository');
const { ClubAccountRepository } = require('../club_account/ClubAccountRepository');
const { ReferralRepository, ReferralService } = require('../referral');
const { WelcomeBonusRepository } = require('../welcome_bonus');
const { TelegramAdapter } = require('./TelegramAdapter');
const { MaxAdapter } = require('./MaxAdapter');
const { TelegramRenderer } = require('./TelegramRenderer');
const { MaxRenderer } = require('./MaxRenderer');
const { BotTransportSender } = require('./BotTransportSender');
const { BotRuntime } = require('./BotRuntime');
const { BotActionRouter } = require('./BotActionRouter');
const { BotOnboardingService } = require('./BotOnboardingService');
const { BotUserFlowService } = require('./BotUserFlowService');
const { buildMainMenu } = require('./OnboardingPolicy');

function createBotRuntimeComposition({ dependencies, env = process.env, clients = {}, logger = console } = {}) {
  if (!dependencies?.customerRuntime) throw new Error('customerRuntime dependency is required.');
  const prisma = getPrismaClient();
  const customerRepository = new CustomerRepository(prisma);
  const clubAccountRepository = new ClubAccountRepository(prisma);
  const referralRepository = new ReferralRepository(prisma);
  const referralService = new ReferralService({ repository: referralRepository });
  const welcomeBonusRepository = new WelcomeBonusRepository(prisma);
  const bonusRepository = { findByCustomerId: (customerId) => prisma.bonusAccount.findUnique({ where: { customerId } }) };

  const miniAppUrl = env.BOT_MINI_APP_URL || env.MINI_APP_URL || 'https://app.utimoshi.ru';
  const inviteBaseUrl = env.BOT_SMART_LINK_URL || 'https://go.utimoshi.ru/start';
  const userFlow = new BotUserFlowService({
    customerRepository, clubAccountRepository, bonusRepository, welcomeBonusRepository,
    referralRepository, referralService, miniAppUrl,
    inviteLinkBuilder: (payload, channel) => `${inviteBaseUrl}?start=${encodeURIComponent(payload)}&channel=${encodeURIComponent(channel)}`,
  });

  const customerExperienceService = {
    buildClubView: ({ customerId }) => userFlow.getClub(customerId),
    buildReferralView: ({ customerId, channel }) => userFlow.getReferral(customerId, channel),
    buildMainMenuView: ({ context = {} }) => ({ title: 'У Тимоши', text: 'Выберите действие.', actions: buildMainMenu({ miniAppUrl, machineId: context?.inbound?.context?.machineId || null }) }),
    buildMiniAppView: () => ({ title: 'У Тимоши', text: 'Откройте приложение «У Тимоши».', actions: [{ type: 'open_mini_app', label: '📱 Открыть У Тимоши', url: miniAppUrl }] }),
  };

  const customerResolver = {
    async resolve({ channel, inbound }) {
      if (!inbound.externalUserId) return { customerId: null, customer: null };
      const found = await customerRepository.findByIdentity(channel, sha256(String(inbound.externalUserId)));
      return { customerId: found?.customer?.id || null, customer: found?.customer || null };
    },
  };

  const onboardingService = new BotOnboardingService({
    customerService: dependencies.customerRuntime,
    miniAppUrl,
    telegramChannelUrl: env.BOT_TELEGRAM_CHANNEL_URL || null,
    maxChannelUrl: env.BOT_MAX_CHANNEL_URL || null,
  });

  return new BotRuntime({
    adapters: { telegram: new TelegramAdapter(clients.telegram), max: new MaxAdapter(clients.max) },
    renderers: {
      telegram: new TelegramRenderer({ features: clients.telegram?.features }),
      max: new MaxRenderer(),
    },
    actionRouter: new BotActionRouter({ customerExperienceService }),
    onboardingService,
    customerResolver,
    sender: new BotTransportSender({ clients, logger }),
  });
}

module.exports = { createBotRuntimeComposition };
