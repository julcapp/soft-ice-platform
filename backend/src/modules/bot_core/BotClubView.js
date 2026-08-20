function buildClubSummary({ customerName = null, moneyBalanceRub = 0, bonusBalance = 0, welcomeBonus = null, referralSummary = null, miniAppUrl = null } = {}) {
  const lines = [];
  if (customerName) lines.push(`${customerName}, ваш Клуб Тимоши 🍦`);
  else lines.push('Ваш Клуб Тимоши 🍦');
  lines.push(`Клубный счёт: ${Number(moneyBalanceRub || 0).toFixed(2)} ₽`);
  lines.push(`Бонусы: ${Number(bonusBalance || 0)}`);
  if (welcomeBonus?.status === 'active') {
    lines.push(`Приветственный бонус: ${Number(welcomeBonus.amountRemaining || 0)}`);
    if (welcomeBonus.expiresAt) lines.push(`Действует до: ${formatDate(welcomeBonus.expiresAt)}`);
  }
  if (referralSummary) {
    lines.push(`Приглашено друзей: ${Number(referralSummary.invited || 0)}`);
    lines.push(`Выполнили условие: ${Number((referralSummary.firstPurchase || 0) + (referralSummary.qualifiedTopup || 0))}`);
  }

  return {
    title: '🎁 Мой клуб',
    text: lines.join('\n'),
    actions: [
      { type: 'action', action: 'referral', label: '👥 Пригласить друга' },
      miniAppUrl ? { type: 'open_mini_app', label: '📱 Открыть личный кабинет', url: miniAppUrl } : null,
      { type: 'action', action: 'main_menu', label: '← Назад' },
    ].filter(Boolean),
  };
}

function buildReferralRewardNotification({ amountBonus = null, miniAppUrl = null } = {}) {
  return {
    kind: 'referral_reward',
    title: '🎁 Вам начислен бонус!',
    text: amountBonus == null
      ? 'Приглашённый вами друг выполнил условия программы. Награда уже зачислена.'
      : `Приглашённый вами друг выполнил условия программы. Вам начислено ${Number(amountBonus)} бонусов.`,
    actions: [
      { type: 'action', action: 'referral', label: 'Посмотреть приглашения' },
      miniAppUrl ? { type: 'open_mini_app', label: 'Открыть Клуб Тимоши', url: miniAppUrl } : null,
    ].filter(Boolean),
  };
}

function buildReferralQualifiedNotification() {
  return {
    kind: 'referral_qualified',
    title: '🍦 Приглашение выполнено',
    text: 'Ваш друг выполнил условие реферальной программы. Мы оформляем предусмотренное вознаграждение.',
  };
}

function formatDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

module.exports = { buildClubSummary, buildReferralRewardNotification, buildReferralQualifiedNotification };
