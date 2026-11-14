'use strict';
const crypto = require('node:crypto');

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const GENERIC_RESULT = Object.freeze({ accepted: true, message: 'Если сотрудник может войти, код направлен в MAX.' });

function normalizeSellerPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  const n = digits.length === 11 && digits[0] === '8' ? '7' + digits.slice(1) : digits;
  if (!/^7\d{10}$/.test(n)) return null;
  return '+' + n;
}
function tokenHash(secret, domain, value) {
  return crypto.createHmac('sha256', secret).update(domain + ':' + value).digest('hex');
}
function authError(code) {
  const e = new Error('Не удалось подтвердить вход. Запросите новый код.');
  e.code = code;
  return e;
}

// Repository contract: resolveSellerWithVerifiedMax({phone,terminalId}) returns
// {sellerId, pointId, terminalId, maxRecipientId} only if member ACTIVE,
// location ACTIVE, employee assigned to point AND MAX identity independently
// verified. Other cases MUST yield null, without notifying a third party.
// createChallenge, markSent, invalidate, and consumeChallenge are durable,
// atomic operations. consumeChallenge validates and decrements attempts in DB
// and must NEVER return success for the same challenge twice.
class SellerMaxAuthService {
  constructor({ repository, maxSender, secret, clock = () => new Date(),
    randomInt = crypto.randomInt, ttlMs = OTP_TTL_MS, maxAttempts = MAX_ATTEMPTS } = {}) {
    if (!repository || !maxSender || typeof maxSender.sendPrivateMessage !== 'function') throw new Error('seller MAX dependencies required');
    if (typeof secret !== 'string' || secret.length < 32) throw new Error('strong seller OTP secret required');
    this.repository = repository;
    this.maxSender = maxSender;
    this.secret = secret;
    this.clock = clock;
    this.randomInt = randomInt;
    this.ttlMs = ttlMs;
    this.maxAttempts = maxAttempts;
  }

  async request({ phone, terminalId }) {
    const normalizedPhone = normalizeSellerPhone(phone);
    if (!normalizedPhone || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(String(terminalId || ''))) {
      throw authError('INVALID_REQUEST');
    }
    // Rate limit at edge BEFORE employee lookup (IP + phone fingerprint + terminal).
    const seller = await this.repository.resolveSellerWithVerifiedMax({ phone: normalizedPhone, terminalId });
    if (!seller) return { ...GENERIC_RESULT, challengeId: null };
    const code = String(this.randomInt(0, 1000000)).padStart(6, '0');
    const id = crypto.randomUUID();
    const expiresAt = new Date(this.clock().getTime() + this.ttlMs);
    await this.repository.createChallenge({
      id, sellerId: seller.sellerId, pointId: seller.pointId,
      terminalId, codeHash: tokenHash(this.secret, 'seller-otp:' + id, code),
      expiresAt, maxAttempts: this.maxAttempts,
    });
    try {
      await this.maxSender.sendPrivateMessage({
        recipientId: seller.maxRecipientId,
        text: 'Код входа в TimoPOS: ' + code + '. Действует 5 минут. Никому не сообщайте код.',
      });
      await this.repository.markSent(id);
    } catch (_error) {
      await this.repository.invalidate(id);
      return { ...GENERIC_RESULT, challengeId: null };
    }
    return { ...GENERIC_RESULT, challengeId: id, expiresAt: expiresAt.toISOString() };
  }

  async verify({ challengeId, code, terminalId }) {
    if (typeof challengeId !== 'string' || !/^[\da-f-]{36}$/i.test(challengeId)
      || !/^\d{6}$/.test(String(code)) || !terminalId) throw authError('INVALID_CODE');
    const codeHash = tokenHash(this.secret, 'seller-otp:' + challengeId, code);
    const sessionToken = crypto.randomBytes(32).toString('base64url');
    const sessionHash = tokenHash(this.secret, 'seller-session', sessionToken);
    const sellerContext = await this.repository.consumeChallenge({
      challengeId, codeHash, terminalId, at: this.clock(), sessionHash,
    });
    if (!sellerContext) throw authError('INVALID_OR_EXPIRED_CODE');
    // The repository must recheck membership, point assignment and verified
    // MAX identity in the SAME transaction before creating the session.
    return { sessionToken, seller: {
      id: sellerContext.sellerId,
      fullName: sellerContext.fullName,
      maskedPhone: sellerContext.maskedPhone,
      point: sellerContext.point,
      role: sellerContext.role,
      shift: sellerContext.shift || null,
    } };
  }

  async logout(sessionToken) {
    if (!sessionToken) return;
    return this.repository.revokeSession(tokenHash(this.secret, 'seller-session', sessionToken));
  }
}
module.exports = { SellerMaxAuthService, OTP_TTL_MS, MAX_ATTEMPTS, normalizeSellerPhone, tokenHash };
