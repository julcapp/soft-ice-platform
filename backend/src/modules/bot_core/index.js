const { BotGateway } = require('./BotGateway');
const { BotAdapter } = require('./BotAdapter');
const { TelegramAdapter } = require('./TelegramAdapter');
const { MaxAdapter } = require('./MaxAdapter');
const { parseStartPayload } = require('./DeepLinkParser');

module.exports = {
  name: 'bot_core',
  status: 'foundation',
  owns: [
    'cross-channel bot gateway',
    'Telegram and MAX transport boundaries',
    'bot deep-link context parsing',
    'bot channel event normalization',
  ],
  BotGateway,
  BotAdapter,
  TelegramAdapter,
  MaxAdapter,
  parseStartPayload,
};
