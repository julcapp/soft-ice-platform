const { TransportRenderer } = require('./TransportRenderer');

class MaxRenderer extends TransportRenderer {
  renderView(view) {
    const base = super.renderView(view);
    return {
      text: base.text,
      attachments: [{
        type: 'inline_keyboard',
        payload: {
          buttons: base.actions.map((action) => [toMaxButton(action)]).filter((row) => row[0]),
        },
      }],
    };
  }
}

function toMaxButton(action) {
  if (!action) return null;
  if (['open_url', 'open_mini_app', 'share', 'qr'].includes(action.type) && action.url) {
    return { type: 'link', text: action.label, url: action.url };
  }
  if (action.type === 'copy' && action.value) {
    return { type: 'callback', text: action.label, payload: `copy:${action.value}`.slice(0, 128) };
  }
  if (action.action) return { type: 'callback', text: action.label, payload: `action:${action.action}` };
  return null;
}

module.exports = { MaxRenderer, toMaxButton };
