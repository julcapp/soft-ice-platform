const { TransportRenderer } = require('./TransportRenderer');

class TelegramRenderer extends TransportRenderer {
  constructor({ features = {}, miniAppEntryPolicy = action => action } = {}) {
    super();
    this.miniAppEntryPolicy = miniAppEntryPolicy;
    this.features = {
      disabledButtons: features.disabledButtons === true,
    };
  }

  renderView(view, { chatType = null, externalUserId = null } = {}) {
    const base = super.renderView(view);
    base.actions = base.actions.map(action => this.miniAppEntryPolicy(action, { chatType, externalUserId }));
    const telegram = view?.channelOptions?.telegram || {};
    const requestContact = chatType === 'private' && base.actions.some((action) => action.type === 'request_contact');
    return {
      text: base.text,
      reply_markup: requestContact ? {
        keyboard: base.actions.filter((action) => action.type === 'request_contact' || action.type === 'open_mini_app')
          .map((action) => [action.type === 'request_contact' ? { text: action.label, request_contact: true }
            : toTelegramButton(action, this.features, { chatType })]),
        resize_keyboard: true, one_time_keyboard: true,
      } : {
        inline_keyboard: base.actions
          .map((action) => [toTelegramButton(action, this.features, { chatType })])
          .filter((row) => row[0]),
      },
      rich_message: telegram.richMessage || null,
      delivery: telegram.delivery || null,
    };
  }
}

function toTelegramButton(action, features = {}, { chatType = null } = {}) {
  if (!action) return null;
  const disabled = action?.channelOptions?.telegram?.disabled === true;
  if (disabled) {
    return features.disabledButtons ? { text: action.label, disabled: {} } : null;
  }
  if (action.type === 'open_mini_app' && action.url && chatType === 'private') {
    const url = new URL(action.url);
    if (url.protocol !== 'https:') throw new Error('Telegram Mini App requires HTTPS.');
    return { text: action.label, web_app: { url: action.url } };
  }
  if (['open_url', 'open_mini_app', 'share', 'qr'].includes(action.type) && action.url) {
    return { text: action.label, url: action.url };
  }
  if (action.type === 'copy' && action.value) {
    return { text: action.label, callback_data: `copy:${action.value}`.slice(0, 64) };
  }
  if (action.action) return { text: action.label, callback_data: `action:${action.action}` };
  return null;
}

module.exports = { TelegramRenderer, toTelegramButton };
