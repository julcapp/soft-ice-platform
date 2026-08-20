const ONBOARDING_STAGE = Object.freeze({
  STARTED: 'started',
  IDENTITY_LINKED: 'identity_linked',
  PHONE_VERIFICATION_REQUIRED: 'phone_verification_required',
  VERIFIED: 'verified',
  CHANNEL_SUBSCRIPTION_OFFER: 'channel_subscription_offer',
  READY: 'ready',
});

function buildWelcomeMessage(context = {}) {
  if (context.referralCode) {
    return {
      kind: 'referral',
      title: 'Вас пригласили в Клуб Тимоши!',
      text: 'Завершите регистрацию, чтобы активировать условия приглашения после первой покупки или квалифицирующего пополнения клубного счёта.',
    };
  }

  if (context.machineId) {
    return {
      kind: 'machine',
      title: 'Вы у аппарата «У Тимоши» 🍦',
      text: 'Подключитесь к Клубу Тимоши, чтобы получать бонусы и открыть возможности этого аппарата.',
    };
  }

  if (context.campaignId) {
    return {
      kind: 'campaign',
      title: 'Добро пожаловать в «У Тимоши»!',
      text: 'Вы пришли по специальному приглашению. Продолжите, чтобы подключиться к Клубу Тимоши.',
    };
  }

  return {
    kind: 'default',
    title: 'Добро пожаловать в «У Тимоши»! 🍦',
    text: 'Здесь начинаются бонусы, подарки и удобный доступ к вашим заказам. Продолжите, чтобы войти в Клуб Тимоши.',
  };
}

function buildSubscriptionOffer({ telegramChannelUrl = null, maxChannelUrl = null } = {}) {
  return {
    title: 'Будьте ближе к «У Тимоши» 🍦',
    text: 'Подпишитесь на наши каналы, чтобы первыми узнавать о новых вкусах, подарках и специальных предложениях.',
    optional: true,
    actions: [
      telegramChannelUrl ? { type: 'open_url', channel: 'telegram', label: 'Подписаться в Telegram', url: telegramChannelUrl } : null,
      maxChannelUrl ? { type: 'open_url', channel: 'max', label: 'Подписаться в MAX', url: maxChannelUrl } : null,
      { type: 'skip', label: 'Напомнить позже' },
    ].filter(Boolean),
  };
}

function buildMainMenu({ miniAppUrl, machineId = null } = {}) {
  const miniAppTarget = machineId && miniAppUrl
    ? `${miniAppUrl}${miniAppUrl.includes('?') ? '&' : '?'}machine_id=${encodeURIComponent(machineId)}`
    : miniAppUrl;

  return [
    miniAppTarget ? { type: 'open_mini_app', label: '📱 Открыть У Тимоши', url: miniAppTarget } : null,
    { type: 'action', label: '🎁 Мой клуб', action: 'club' },
    { type: 'action', label: '👥 Пригласить друга', action: 'referral' },
    { type: 'action', label: '📦 Мой заказ', action: 'order' },
    { type: 'action', label: '📍 Где купить', action: 'locations' },
    { type: 'action', label: '💬 Помощь', action: 'help' },
  ].filter(Boolean);
}

module.exports = {
  ONBOARDING_STAGE,
  buildWelcomeMessage,
  buildSubscriptionOffer,
  buildMainMenu,
};