'use strict';

const GIFT_ACCEPT_ACTION = 'gift_accept';
const GIFT_ID_PATTERN = /^gift_[A-Za-z0-9-]{1,48}$/;
const EXPECTED_GIFT_ERRORS = new Set([
  'RESOURCE_NOT_FOUND',
  'GIFT_ACCEPT_NOT_ALLOWED',
  'GIFT_EXPIRED',
]);

class BotGiftActionService {
  constructor({ giftTransferRuntime, miniAppUrl, logger = console } = {}) {
    if (!giftTransferRuntime) throw new Error('giftTransferRuntime is required.');
    this.giftTransferRuntime = giftTransferRuntime;
    this.miniAppUrl = miniAppUrl || null;
    this.logger = logger;
  }

  async listGifts({ customerId, channel }) {
    if (!customerId) return authenticationRequiredView(this.miniAppUrl);

    const rows = await this.giftTransferRuntime.listOwn(customerId);
    const received = (rows || [])
      .filter((gift) => gift.recipientCustomerId === customerId)
      .filter((gift) => ['AVAILABLE', 'ACCEPTED', 'REDEMPTION_READY'].includes(gift.status))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    if (!received.length) {
      return {
        title: 'Мои подарки',
        text: 'Сейчас у вас нет подарков, доступных для принятия или получения.',
        actions: [
          this.miniAppUrl ? { type: 'open_mini_app', label: '📱 Открыть У Тимоши', url: this.miniAppUrl } : null,
          { type: 'action', label: '← Главное меню', action: 'menu' },
        ].filter(Boolean),
      };
    }

    const available = received.filter((gift) => gift.status === 'AVAILABLE');
    const accepted = received.length - available.length;
    const lines = [
      available.length ? `Можно принять: ${available.length}.` : null,
      accepted ? `Уже принято: ${accepted}.` : null,
      'Код получения формируется только в Mini App и не отправляется временным сообщением.',
    ].filter(Boolean);

    const actions = available.slice(0, 5).map((gift) => ({
      type: 'action',
      label: gift.metadata?.senderName
        ? `🎁 Принять подарок от ${gift.metadata.senderName}`
        : '🎁 Принять подарок',
      action: buildGiftAcceptAction(gift.id),
    }));
    actions.push(
      this.miniAppUrl ? { type: 'open_mini_app', label: '📱 Открыть подарки', url: this.miniAppUrl } : null,
      { type: 'action', label: '← Главное меню', action: 'menu' },
    );

    return {
      title: 'Мои подарки',
      text: lines.join('\n'),
      actions: actions.filter(Boolean),
    };
  }

  async acceptGift({ customerId, giftId, channel, context = {} }) {
    if (!customerId) return authenticationRequiredView(this.miniAppUrl);

    try {
      const gift = await this.giftTransferRuntime.accept(customerId, giftId, {
        correlationId: context.correlationId || null,
        actorType: 'customer',
        actorId: customerId,
        sourceChannel: `bot_${channel}`,
      });
      return acceptedGiftView({ gift, channel, miniAppUrl: this.miniAppUrl });
    } catch (error) {
      if (!EXPECTED_GIFT_ERRORS.has(error?.code)) throw error;
      this.logger?.warn?.('bot.gift.accept.rejected', {
        code: error.code,
        giftId,
        customerId,
        channel,
      });
      return unavailableGiftView(this.miniAppUrl);
    }
  }
}

function parseGiftAction(action) {
  if (typeof action !== 'string') return null;
  const prefix = `${GIFT_ACCEPT_ACTION}:`;
  if (!action.startsWith(prefix)) return null;
  const giftId = action.slice(prefix.length);
  return GIFT_ID_PATTERN.test(giftId) ? { kind: GIFT_ACCEPT_ACTION, giftId } : null;
}

function buildGiftAcceptAction(giftId) {
  if (!GIFT_ID_PATTERN.test(String(giftId || ''))) throw new Error('Valid giftId is required.');
  return `${GIFT_ACCEPT_ACTION}:${giftId}`;
}

function acceptedGiftView({ gift, channel, miniAppUrl }) {
  const text = [
    'Подарок закреплён за вами.',
    'Откройте Mini App, когда будете готовы получить его у аппарата.',
  ].join('\n');
  const actions = [];

  if (channel === 'telegram') {
    actions.push({
      type: 'action',
      label: 'Подарок принят',
      action: buildGiftAcceptAction(gift.id),
      channelOptions: { telegram: { disabled: true } },
    });
  }
  if (miniAppUrl) actions.push({ type: 'open_mini_app', label: '📱 Открыть подарок', url: miniAppUrl });
  actions.push({ type: 'action', label: '← Главное меню', action: 'menu' });

  return {
    title: 'Подарок принят 🎁',
    text,
    actions,
    channelOptions: {
      telegram: {
        richMessage: { markdown: `**Подарок принят 🎁**\n\n${text}` },
      },
    },
  };
}

function authenticationRequiredView(miniAppUrl) {
  return {
    title: 'Нужно войти в Клуб Тимоши',
    text: 'Откройте Mini App и завершите вход, чтобы безопасно работать с подарками.',
    actions: [
      miniAppUrl ? { type: 'open_mini_app', label: '📱 Войти в У Тимоши', url: miniAppUrl } : null,
      { type: 'action', label: '← Главное меню', action: 'menu' },
    ].filter(Boolean),
  };
}

function unavailableGiftView(miniAppUrl) {
  return {
    title: 'Подарок недоступен',
    text: 'Подарок уже принят, отменён, просрочен или предназначен другому пользователю. Проверьте раздел подарков в Mini App.',
    actions: [
      miniAppUrl ? { type: 'open_mini_app', label: '📱 Проверить подарки', url: miniAppUrl } : null,
      { type: 'action', label: '← Главное меню', action: 'menu' },
    ].filter(Boolean),
  };
}

module.exports = {
  BotGiftActionService,
  GIFT_ACCEPT_ACTION,
  buildGiftAcceptAction,
  parseGiftAction,
  acceptedGiftView,
};
