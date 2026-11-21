'use strict';
const { PrismaSellerMaxAuthRepository } = require('./PrismaSellerMaxAuthRepository');
const { SellerMaxAuthService } = require('./SellerMaxAuthService');
const { MaxSellerOtpSender } = require('./MaxSellerOtpSender');
const { AesGcmValueCodec } = require('../../platform/security/AesGcmValueCodec');

/**
 * Explicit opt-in composition. Never silently start in production.
 * Rate limiting MUST be a durable/distributed limiter for more than one backend replica.
 * The recipient ciphertext must have been encrypted with exactly this AAD convention
 * during independent verified seller/MAX enrollment.
 */
function createTimoPosSellerAuthRuntime({
  prisma, maxClient, otpSecret, encryptionKey, rateLimiter, allowedOrigin,
} = {}) {
  if (!prisma || !maxClient || typeof otpSecret !== 'string' || otpSecret.length < 32
    || typeof rateLimiter?.check !== 'function' || typeof allowedOrigin !== 'string')
    throw new Error('TimoPOS seller auth composition requires DB, MAX, secrets, limiter and origin');
  const codec = new AesGcmValueCodec({key:encryptionKey});
  const decryptRecipient = (ciphertext, sellerId) => {
    if (!sellerId || typeof sellerId !== 'string') throw new Error('SELLER_ID_REQUIRED');
    return codec.decrypt(ciphertext, `timopos:seller:${sellerId}:max`);
  };
  const repository = new PrismaSellerMaxAuthRepository({
    prisma, secret:otpSecret, decryptRecipient,
  });
  const service = new SellerMaxAuthService({
    repository, maxSender:new MaxSellerOtpSender({maxClient}), secret:otpSecret,
  });
  return Object.freeze({
    sellerMaxAuthService:service,
    sellerMaxAuthRepository:repository,
    rateLimiter,
    allowedOrigin,
    // Never enable insecure transport via production factory.
    allowInsecureTestTransport:false,
  });
}
module.exports={createTimoPosSellerAuthRuntime};
