const PHOTO_PUBLISHING_TARGETS = Object.freeze({
  VK: Object.freeze({
    channel: 'VK',
    targetId: 'club239119350',
    required: true,
  }),
  TELEGRAM: Object.freeze({
    channel: 'TELEGRAM',
    targetId: null,
    required: true,
  }),
  MAX: Object.freeze({
    channel: 'MAX',
    targetId: null,
    required: true,
  }),
});

module.exports = { PHOTO_PUBLISHING_TARGETS };
