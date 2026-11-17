'use strict';
const { maxInteger } = require('../bot_core/MaxBotApiClient');

/**
 * Adapter between the established MAX API client and seller OTP delivery.
 * Accepts only an independently verified, decrypted MAX user id provided by
 * PrismaSellerMaxAuthRepository. No PII or OTP is logged by this adapter.
 */
class MaxSellerOtpSender {
  constructor({ maxClient } = {}) {
    if (!maxClient || typeof maxClient.sendMessage !== 'function')
      throw new Error('MAX seller sender requires MaxBotApiClient');
    this.maxClient = maxClient;
  }
  async sendPrivateMessage({ recipientId, text } = {}) {
    const userId = maxInteger(recipientId);
    if (!userId || userId.startsWith('-')) throw new Error('INVALID_MAX_RECIPIENT');
    if (typeof text !== 'string' || !/^Код входа в TimoPOS: \d{6}\. Действует 5 минут\./u.test(text))
      throw new Error('INVALID_SELLER_OTP_MESSAGE');
    return this.maxClient.sendMessage({ userId, text, notify:true });
  }
}
module.exports = { MaxSellerOtpSender };
