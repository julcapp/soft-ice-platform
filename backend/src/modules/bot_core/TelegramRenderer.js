const { TransportRenderer } = require('./TransportRenderer');

class TelegramRenderer extends TransportRenderer {
  renderView(view) {
    const base = super.renderView(view);
    return {
      text: base.text,
      reply_markup: {
        inline_keyboard: base.actions.map((action) => [toTelegramButton(action)]).filter((row) => row[0]),
      },
    };
  }
}

function toTelegramButton(action) {
  if (!action) return null;
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
