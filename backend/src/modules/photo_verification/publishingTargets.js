const PHOTO_PUBLISHING_TARGETS = Object.freeze({
  VK: Object.freeze({
    channel: 'VK',
    targetId: 'club239119350',
    publicUrl: 'https://vk.com/club239119350',
    required: true,
    purpose: 'public_ugc',
  }),
  TELEGRAM: Object.freeze({
    channel: 'TELEGRAM',
    targetId: '@ice_robo_club',
    publicUrl: 'https://t.me/ice_robo_club',
    required: true,
    purpose: 'public_ugc',
  }),
  MAX: Object.freeze({
    channel: 'MAX',
    targetId: null,
    publicUrl: 'https://max.ru/channel_soft_icecream',
    required: true,
    purpose: 'public_ugc',
  }),
});

const PHOTO_PAID_SUBSCRIPTION_CHANNELS = Object.freeze({
  TELEGRAM_PRIVATE: Object.freeze({
    channel: 'TELEGRAM',
    inviteUrl: 'https://t.me/+-zM7xM2VUCI5ODZi',
    monthlyPriceRub: 99,
    active: false,
    purpose: 'paid_subscription',
    note: 'Benefits and discount/bonus rules are intentionally not finalized yet.',
  }),
});

module.exports = {
  PHOTO_PUBLISHING_TARGETS,
  PHOTO_PAID_SUBSCRIPTION_CHANNELS,
};
