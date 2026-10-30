'use strict';

const crypto = require('node:crypto');

class TerminalBuyerTokenService {
  constructor({ secret, ttlMs = 20 * 60 * 1000, clock = () => new Date() } = {}) {
    if (!secret) throw new Error('Terminal buyer token secret is required.');
    this.secret = String(secret);
    this.ttlMs = ttlMs;
    this.clock = clock;
  }

  issue({ machineId, customerId = null, contactId = null }) {
    if (!machineId) throw problem('TERMINAL_BUYER_MACHINE_REQUIRED', 'machineId обязателен.', 400);
    if (customerId && contactId) throw problem('TERMINAL_BUYER_IDENTITY_CONFLICT', 'Нельзя одновременно указать customerId и contactId.', 400);
    const now = this.clock();
    const payload = {
      v: 1,
      machineId: String(machineId),
      kind: customerId ? 'CUSTOMER' : contactId ? 'UNVERIFIED' : 'ANONYMOUS',
      id: customerId || contactId || null,
      iat: now.getTime(),
      exp: now.getTime() + this.ttlMs,
      nonce: crypto.randomBytes(12).toString('base64url'),
    };
    const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    return `${encoded}.${this.sign(encoded)}`;
  }

  verify(token, { machineId } = {}) {
    if (!token) return { kind: 'ANONYMOUS', id: null, machineId: machineId || null };
    const [encoded, signature, extra] = String(token).split('.');
    if (!encoded || !signature || extra !== undefined) throw problem('TERMINAL_BUYER_TOKEN_INVALID', 'Токен покупателя недействителен.', 401);
    const expected = this.sign(encoded);
    if (!safeEqual(signature, expected)) throw problem('TERMINAL_BUYER_TOKEN_INVALID', 'Токен покупателя недействителен.', 401);
    let payload;
    try { payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')); }
    catch { throw problem('TERMINAL_BUYER_TOKEN_INVALID', 'Токен покупателя недействителен.', 401); }
    if (payload.v !== 1 || !['CUSTOMER', 'UNVERIFIED', 'ANONYMOUS'].includes(payload.kind)) {
      throw problem('TERMINAL_BUYER_TOKEN_INVALID', 'Токен покупателя недействителен.', 401);
    }
    if (Number(payload.exp) <= this.clock().getTime()) throw problem('TERMINAL_BUYER_TOKEN_EXPIRED', 'Сессия покупателя истекла.', 401);
    if (machineId && payload.machineId !== machineId) throw problem('TERMINAL_BUYER_MACHINE_MISMATCH', 'Токен создан для другого аппарата.', 403);
    if (payload.kind !== 'ANONYMOUS' && !payload.id) throw problem('TERMINAL_BUYER_TOKEN_INVALID', 'Токен покупателя недействителен.', 401);
    return payload;
  }

  sign(encoded) {
    return crypto.createHmac('sha256', this.secret).update(encoded).digest('base64url');
  }
}

function safeEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
function problem(code, message, statusCode) { return Object.assign(new Error(message), { code, statusCode }); }

module.exports = { TerminalBuyerTokenService };
