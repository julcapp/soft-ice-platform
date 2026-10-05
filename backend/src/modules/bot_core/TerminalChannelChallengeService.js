const crypto = require('node:crypto');
const { normalizePhone } = require('../customer/CustomerEntity');
const { sha256 } = require('../../platform/security/hash');

const STATUS = Object.freeze({
  PENDING: 'PENDING',
  STARTED: 'STARTED',
  VERIFIED: 'VERIFIED',
  CONSUMED: 'CONSUMED',
  EXPIRED: 'EXPIRED',
  INVALIDATED: 'INVALIDATED',
});

class PrismaTerminalChannelChallengeRepository {
  constructor(prisma) { this.prisma = prisma; }

  create(data) {
    return this.prisma.terminalChannelChallenge.create({ data });
  }

  findByTokenHash(tokenHash) {
    return this.prisma.terminalChannelChallenge.findUnique({ where: { tokenHash } });
  }

  findActiveByExternalUserIdHash({ channel, externalUserIdHash }) {
    return this.prisma.terminalChannelChallenge.findFirst({
      where: { channel, externalUserIdHash, status: STATUS.STARTED },
      orderBy: { createdAt: 'desc' },
    });
  }

  async invalidatePending({ phoneFingerprint, channel }) {
    await this.prisma.terminalChannelChallenge.updateMany({
      where: { phoneFingerprint, channel, status: { in: [STATUS.PENDING, STATUS.STARTED] } },
      data: { status: STATUS.INVALIDATED, consumedAt: new Date() },
    });
  }

  update(id, data) {
    return this.prisma.terminalChannelChallenge.update({ where: { id }, data });
  }
}

class TerminalChannelChallengeService {
  constructor({
    repository,
    customerRepository,
    phoneSecret,
    maxBotUrl,
    telegramBotUrl = null,
    clock = () => new Date(),
    ttlMs = 10 * 60 * 1000,
  }) {
    this.repository = repository;
    this.customerRepository = customerRepository;
    this.phoneSecret = phoneSecret;
    this.maxBotUrl = maxBotUrl;
    this.telegramBotUrl = telegramBotUrl;
    this.clock = clock;
    this.ttlMs = ttlMs;
    if (!phoneSecret) throw new Error('TERMINAL_CHANNEL_CHALLENGE_SECRET is required.');
  }

  async create({ machineId, phone, channel }) {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone || !/^\+7[3489]\d{9}$/.test(normalizedPhone)) {
      throw validationError('DISPLAY_PHONE_INVALID', 'Введите российский номер телефона полностью.');
    }
    const normalizedChannel = String(channel || '').trim().toUpperCase();
    if (!['MAX', 'TELEGRAM'].includes(normalizedChannel)) {
      throw validationError('CHANNEL_INVALID', 'Выберите доступный мессенджер.');
    }
    if (typeof machineId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(machineId)) {
      throw validationError('DISPLAY_MACHINE_ID_INVALID', 'Не удалось определить автомат.');
    }

    const phoneFingerprint = this.fingerprintPhone(normalizedPhone);
    await this.repository.invalidatePending({ phoneFingerprint, channel: normalizedChannel });

    const token = crypto.randomBytes(24).toString('base64url');
    const now = this.clock();
    const expiresAt = new Date(now.getTime() + this.ttlMs);
    await this.repository.create({
      tokenHash: sha256(token),
      phoneFingerprint,
      machineId,
      channel: normalizedChannel,
      status: STATUS.PENDING,
      expiresAt,
      metadata: { source: 'DISPLAY_PHONE' },
    });

    return {
      channel: normalizedChannel,
      expiresAt: expiresAt.toISOString(),
      deepLink: this.buildDeepLink(normalizedChannel, token),
    };
  }

  async start({ channel, token, externalUserId }) {
    const challenge = await this.getActive(channel, token);
    const now = this.clock();
    return this.repository.update(challenge.id, {
      status: STATUS.STARTED,
      startedAt: challenge.startedAt || now,
      externalUserIdHash: externalUserId ? sha256(String(externalUserId)) : challenge.externalUserIdHash,
    });
  }

  async verifyContact({ channel, token = null, externalUserId, phone, contactVerified }) {
    if (!contactVerified) throw validationError('CONTACT_NOT_VERIFIED', 'Не удалось подтвердить номер через мессенджер.');
    const normalizedChannel = String(channel || '').toUpperCase();
    const externalUserIdHash = externalUserId ? sha256(String(externalUserId)) : null;
    const challenge = token
      ? await this.getActive(normalizedChannel, token)
      : await this.repository.findActiveByExternalUserIdHash({ channel: normalizedChannel, externalUserIdHash });
    if (!challenge) throw validationError('CHALLENGE_NOT_FOUND', 'Проверка номера не найдена.');
    if (challenge.expiresAt <= this.clock()) throw validationError('CHALLENGE_EXPIRED', 'Срок подтверждения номера истёк.');
    if (challenge.externalUserIdHash && externalUserId && challenge.externalUserIdHash !== sha256(String(externalUserId))) {
      throw validationError('CHALLENGE_SUBJECT_MISMATCH', 'Проверка номера недействительна.');
    }

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone || !safeEqual(challenge.phoneFingerprint, this.fingerprintPhone(normalizedPhone))) {
      throw validationError('PHONE_MISMATCH', 'Номер в мессенджере не совпадает с номером, введённым на терминале.');
    }

    let customer = await this.customerRepository.findByVerifiedPhone(normalizedPhone);
    if (!customer) customer = await this.customerRepository.createVerifiedPhoneCustomer({ phone: normalizedPhone, verifiedAt: this.clock() });

    if (externalUserId) {
      const provider = normalizedChannel.toLowerCase();
      const subjectHash = sha256(String(externalUserId));
      const existingIdentity = await this.customerRepository.findByIdentity(provider, subjectHash);
      if (existingIdentity && existingIdentity.customer.id !== customer.id) {
        throw validationError('IDENTITY_CONFLICT', 'Этот аккаунт мессенджера уже связан с другим профилем.');
      }
      if (!existingIdentity) {
        await this.customerRepository.linkExternalIdentity(customer.id, {
          provider,
          externalSubjectHash: subjectHash,
          externalUsername: null,
          displayName: null,
          verificationMethod: `${provider}_request_contact`,
          sourceChannel: normalizedChannel,
          now: this.clock(),
        });
      }
    }

    const now = this.clock();
    const updated = await this.repository.update(challenge.id, {
      status: STATUS.VERIFIED,
      verifiedAt: now,
      customerId: customer.id,
      externalUserIdHash: externalUserId ? sha256(String(externalUserId)) : challenge.externalUserIdHash,
    });
    return { challenge: updated, customer, phone: normalizedPhone };
  }

  async getActive(channel, token) {
    if (!token || !/^[A-Za-z0-9_-]{20,128}$/.test(token)) throw validationError('CHALLENGE_INVALID', 'Проверка номера недействительна.');
    const challenge = await this.repository.findByTokenHash(sha256(token));
    if (!challenge || challenge.channel !== String(channel || '').toUpperCase()) throw validationError('CHALLENGE_NOT_FOUND', 'Проверка номера не найдена.');
    const now = this.clock();
    if (challenge.expiresAt <= now) {
      if (challenge.status !== STATUS.EXPIRED) await this.repository.update(challenge.id, { status: STATUS.EXPIRED, consumedAt: now });
      throw validationError('CHALLENGE_EXPIRED', 'Срок подтверждения номера истёк.');
    }
    if (![STATUS.PENDING, STATUS.STARTED].includes(challenge.status)) throw validationError('CHALLENGE_USED', 'Эта проверка номера уже завершена.');
    return challenge;
  }

  fingerprintPhone(phone) {
    return crypto.createHmac('sha256', this.phoneSecret).update(phone).digest('hex');
  }

  buildDeepLink(channel, token) {
    const payload = `verify_${token}`;
    const base = channel === 'MAX' ? this.maxBotUrl : this.telegramBotUrl;
    if (!base) throw validationError('CHANNEL_UNAVAILABLE', 'Выбранный мессенджер временно недоступен.');
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}start=${encodeURIComponent(payload)}`;
  }
}

function safeEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function validationError(code, message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code;
  return error;
}

module.exports = {
  PrismaTerminalChannelChallengeRepository,
  TerminalChannelChallengeService,
  TERMINAL_CHANNEL_CHALLENGE_STATUS: STATUS,
};
