const { assertCustomerAccess } = require('../customer/CustomerAccessPolicy');
const { getPrismaClient } = require('../../common/database');
const { sha256 } = require('../../platform/security/hash');
const { CustomerRepository } = require('../customer/CustomerRepository');
const { ClubAccountRepository } = require('../club_account/ClubAccountRepository');
const { ReferralRepository, ReferralService } = require('../referral');
const { WelcomeBonusRepository } = require('../welcome_bonus');
const { TelegramAdapter } = require('./TelegramAdapter');
const { MaxAdapter } = require('./MaxAdapter');
const { TelegramRenderer } = require('./TelegramRenderer');
const { createTestMiniAppEntryPolicy } = require('./TestMiniAppEntryPolicy');
const { MaxRenderer } = require('./MaxRenderer');
const { BotTransportSender } = require('./BotTransportSender');
const { BotRuntime } = require('./BotRuntime');
const { BotActionRouter } = require('./BotActionRouter');
const { BotOnboardingService } = require('./BotOnboardingService');
const { BotUserFlowService } = require('./BotUserFlowService');
const { BotGiftActionService } = require('./BotGiftActionService');
const { buildMainMenu } = require('./OnboardingPolicy');
const { BotReferralAttributionService } = require('./BotReferralAttributionService');
const { createBotReferralLinks } = require('./BotReferralLinks');
const { PrepaidOrderReminderWorker } = require('./PrepaidOrderReminderWorker');

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
  const referralAttributionService = new BotReferralAttributionService({prisma, scopes: {telegram:clients.telegram?.token,max:clients.max?.token}});
  const buildInviteLink = createBotReferralLinks({
    telegramUsername: env.TELEGRAM_BOT_USERNAME || (clients.telegram?.token?.startsWith('572898079:') ? 'Exgorod_bot' : null),
    maxUsername: env.MAX_BOT_USERNAME || 'id7017438363_bot',
  });
  const userFlow = new BotUserFlowService({
    customerRepository, clubAccountRepository, bonusRepository, welcomeBonusRepository,
    referralRepository, referralService: referralAttributionService, miniAppUrl,
    inviteLinkBuilder: buildInviteLink,
  });

  const customerExperienceService = {
    buildClubView: ({ customerId }) => userFlow.getClub(customerId),
    buildReferralView: ({ customerId, channel }) => userFlow.getReferral(customerId, channel),
    buildMainMenuView: ({ context = {} }) => ({ title: 'У Тимоши', text: 'Выберите действие.', actions: buildMainMenu({ miniAppUrl, machineId: context?.inbound?.context?.machineId || null }) }),
    buildMiniAppView: () => ({ title: 'У Тимоши', text: 'Откройте приложение «У Тимоши».', actions: [{ type: 'open_mini_app', label: '📱 Открыть У Тимоши', url: miniAppUrl }] }),
  };

  const giftActionService = dependencies.giftTransferRuntime
    ? new BotGiftActionService({
      giftTransferRuntime: dependencies.giftTransferRuntime,
      miniAppUrl,
      logger,
    })
    : null;

  const customerResolver = {
    async resolve({ channel, inbound }) {
      if (!inbound.externalUserId) return { customerId: null, customer: null };
      const found = await customerRepository.findByIdentity(channel, sha256(String(inbound.externalUserId)));
      assertCustomerAccess(found?.customer);
      return { customerId: found?.customer?.id || null, customer: found?.customer || null };
    },
  };

  const onboardingService = new BotOnboardingService({
    customerService: dependencies.customerRuntime,
    miniAppUrl,
    telegramChannelUrl: env.BOT_TELEGRAM_CHANNEL_URL || null,
    maxChannelUrl: env.BOT_MAX_CHANNEL_URL || null,
  });

  const runtime = new BotRuntime({
    adapters: { telegram: new TelegramAdapter(clients.telegram), max: new MaxAdapter(clients.max) },
    renderers: {
      telegram: new TelegramRenderer({ features: clients.telegram?.features, miniAppEntryPolicy: createTestMiniAppEntryPolicy({ token: clients.telegram?.token, env }) }),
      max: new MaxRenderer(),
    },
    actionRouter: new BotActionRouter({ customerExperienceService, giftActionService }),
    onboardingService,
    customerResolver,
    referralAttributionService,
    terminalChannelChallengeService: dependencies.terminalChannelChallengeService || null,
    recipientBindingService: dependencies.botRecipientBindingService || null,
    sender: new BotTransportSender({ clients, logger }),
    logger,
  });
  if (clients.telegram?.token?.startsWith('572898079:') && env.MESSAGE_CENTER_ENABLED === 'true' && dependencies.botRecipientBindingService) {
    const fs = require('node:fs');
    const config = fs.readFileSync('/etc/softice/miniapp-test-auth.env','utf8');
    const allowedTelegramIds = (config.match(/^TELEGRAM_TEST_ALLOWED_USER_IDS=(.*)$/m)?.[1] || '').trim().replace(/^['"]|['"]$/g,'').split(',').map(x=>x.trim()).filter(Boolean);
    const worker = new PrepaidOrderReminderWorker({prisma,bindingService:dependencies.botRecipientBindingService,telegramClient:clients.telegram,journal:require('../message_center/MessageJournal').defaultMessageJournal(),allowedTelegramIds,miniAppUrl:'https://bot-test.utimoshi.ru/miniapp/'});
    const run = () => worker.runOnce().catch(error=>logger.error('prepaid.reminder.failed',{code:error.code || 'REMINDER_FAILED'}));
    const first = setTimeout(run,60000);first.unref();
    const timer = setInterval(run,60000);timer.unref();
    runtime.stopPrepaidReminders = () => {clearTimeout(first);clearInterval(timer);};
  }
  return runtime;

}

module.exports = { createBotRuntimeComposition };
