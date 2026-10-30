class BotAdapter {
  constructor(channel) {
    this.channel = channel;
  }

  normalizeInbound() {
    throw new Error(`${this.channel} adapter must implement normalizeInbound()`);
  }

  async sendMessage() {
    throw new Error(`${this.channel} adapter must implement sendMessage()`);
  }

  async sendDeepLinkButton() {
    throw new Error(`${this.channel} adapter must implement sendDeepLinkButton()`);
  }
}

module.exports = {
  BotAdapter,
};
