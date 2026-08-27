const { TransportRenderer } = require('./TransportRenderer');

class TelegramRenderer extends TransportRenderer {
  constructor({ features = {} } = {}) {
    super();
    this.features = {
      disabledButtons: features.disabledButtons === true,
    };
  }

  renderView(view) {
    const base = super.renderView(view);
    const telegram = view?.channelOptions?.telegram || {};
    return {
      text: base.text,
      reply_markup: {
        inline_keyboard: base.actions
          .map((action) => [toTelegramButton(action, this.features)])
          .filter((row) => row[0]),
      },
      rich_message: telegram.richMessage || null,
      delivery: telegram.delivery || null,
    };
  }
}

function toTelegramButton(action, features = {}) {
  if (!action) return null;
  const disabled = action?.channelOptions?.telegram?.disabled === true;
  if (disabled) {
    return features.disabledButtons ? { text: action.label, disabled: {} } : null;
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
