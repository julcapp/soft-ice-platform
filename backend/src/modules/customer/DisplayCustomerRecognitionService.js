const crypto = require('crypto');

const { normalizePhone } = require('./CustomerEntity');
const { ApiError } = require('../../platform/errors/ApiError');

const RECOGNITION_STATE = Object.freeze({
  RETURNING: 'RETURNING',
  NEW: 'NEW',
  UNAVAILABLE: 'UNAVAILABLE',
});

const CHALLENGE_STATUS = Object.freeze({
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  INVALIDATED: 'INVALIDATED',
  EXPIRED: 'EXPIRED',
});

class DisplayCustomerRecognitionService {
  constructor({
    customerRepository,
    auditRepository,
    verificationProvider = new UnavailableDisplayPhoneVerificationProvider(),
    challengeRepository = new InMemoryDisplayPhoneChallengeRepository(),
    abuseGuard = new UnavailableDisplayRecognitionAbuseGuard(),
    clock = () => new Date(),
    codeFactory = secureCode,
  }) {
    Object.assign(this, {
      customerRepository, auditRepository, verificationProvider, challengeRepository,
      abuseGuard, clock, codeFactory,
    });
  }

  async recognize(request = {}, context = {}) {
    request = request && typeof request === 'object' ? request : {};
    const machineId = requiredMachineId(request.machineId ?? request.machine_id);
    const phone = requiredPhone(request.phone);
    const phoneFingerprint = fingerprint(phone);

    try {
      await this.abuseGuard.check({ machineId, phoneFingerprint, now: this.clock() });
    } catch (error) {
      await this.audit(RECOGNITION_STATE.UNAVAILABLE, machineId, context, 'ABUSE_GUARD_UNAVAILABLE');
      return unavailableRecognition();
    }

    let customer;
    try {
      customer = await this.customerRepository.findByVerifiedPhone(phone);
    } catch {
      await this.audit(RECOGNITION_STATE.UNAVAILABLE, machineId, context, 'LOOKUP_UNAVAILABLE');
      return unavailableRecognition();
    }
    if (customer) {
      await this.audit(RECOGNITION_STATE.RETURNING, machineId, context, 'VERIFIED_PHONE_MATCH');
      return { state: RECOGNITION_STATE.RETURNING };
    }

    try {
      const challenge = await this.issueChallenge({ machineId, phone, phoneFingerprint, context });
      await this.audit(RECOGNITION_STATE.NEW, machineId, context, 'VERIFICATION_CHALLENGE_ISSUED');
      return { state: RECOGNITION_STATE.NEW, verification: publicChallenge(challenge) };
    } catch (error) {
      await this.audit(RECOGNITION_STATE.NEW, machineId, context, 'VERIFICATION_PROVIDER_UNAVAILABLE');
      return { state: RECOGNITION_STATE.NEW, verification: unavailableVerification() };
    }
  }

  async verify(challengeId, request = {}) {
    const challenge = await this.challengeRepository.findById(challengeId);
    if (!challenge) throw safeError(404, 'DISPLAY_PHONE_CHALLENGE_NOT_FOUND', 'Проверка номера не найдена.');
    const now = this.clock();
    if (challenge.status !== CHALLENGE_STATUS.PENDING) return publicChallenge(challenge);
    if (challenge.expiresAt <= now) {
      challenge.status = CHALLENGE_STATUS.EXPIRED;
      await this.challengeRepository.save(challenge);
      return publicChallenge(challenge);
    }
    const code = typeof request?.code === 'string' ? request.code.trim() : '';
    if (/^\d{6}$/.test(code) && matchesCode(challenge, code)) {
      challenge.status = CHALLENGE_STATUS.VERIFIED;
      challenge.verifiedAt = now;
      await this.challengeRepository.save(challenge);
      return publicChallenge(challenge);
    }

    challenge.failedAttempts += 1;
    if (challenge.failedAttempts >= challenge.maxAttempts) challenge.status = CHALLENGE_STATUS.INVALIDATED;
    await this.challengeRepository.save(challenge);
    return publicChallenge(challenge);
  }

  async resend(challengeId, request = {}, context = {}) {
    const previous = await this.challengeRepository.findById(challengeId);
    if (!previous) throw safeError(404, 'DISPLAY_PHONE_CHALLENGE_NOT_FOUND', 'Проверка номера не найдена.');
    request = request && typeof request === 'object' ? request : {};
    const machineId = requiredMachineId(request.machineId ?? request.machine_id);
    const phone = requiredPhone(request.phone);
    if (previous.machineId !== machineId || previous.phoneFingerprint !== fingerprint(phone)) {
      throw safeError(404, 'DISPLAY_PHONE_CHALLENGE_NOT_FOUND', 'Проверка номера не найдена.');
    }
    previous.status = CHALLENGE_STATUS.INVALIDATED;
    await this.challengeRepository.save(previous);
    try {
      await this.abuseGuard.check({ machineId, phoneFingerprint: previous.phoneFingerprint, now: this.clock() });
      const challenge = await this.issueChallenge({ machineId, phone, phoneFingerprint: previous.phoneFingerprint, context });
      return publicChallenge(challenge);
    } catch {
      return unavailableVerification();
    }
  }

  async issueChallenge({ machineId, phone, phoneFingerprint, context }) {
    const now = this.clock();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);
    const code = this.codeFactory();
    const salt = crypto.randomBytes(16).toString('hex');
    const challenge = {
      id: `display_phone_${crypto.randomUUID()}`,
      machineId,
      phoneFingerprint,
      codeSalt: salt,
      codeHash: hashCode(code, salt),
      status: CHALLENGE_STATUS.PENDING,
      failedAttempts: 0,
      maxAttempts: 3,
      createdAt: now,
      expiresAt,
      verifiedAt: null,
    };
    await this.verificationProvider.sendCode({ phone, code, challengeId: challenge.id, expiresAt });
    await this.challengeRepository.create(challenge);
    return challenge;
  }

  async audit(state, machineId, context, reasonCode) {
    // Public headers and caller-supplied machine IDs must not become PII in audit.
    try {
      return await this.auditRepository?.record?.({
        eventType: 'DISPLAY_PHONE_RECOGNITION',
        subjectType: 'anonymous',
        subjectId: null,
        targetType: 'Machine',
        targetId: fingerprint(machineId),
        action: 'recognize_verified_phone',
        decision: state,
        reasonCode,
        sourceChannel: 'TERMINAL',
        correlationId: `corr_${crypto.randomUUID()}`,
        metadata: { recognition_state: state },
      });
    } catch {
      throw safeError(503, 'DISPLAY_RECOGNITION_AUDIT_UNAVAILABLE', 'Проверка временно недоступна.');
    }
  }
}

class InMemoryDisplayPhoneChallengeRepository {
  constructor() { this.challenges = new Map(); }
  async create(challenge) {
    for (const current of this.challenges.values()) {
      if (current.machineId === challenge.machineId
        && current.phoneFingerprint === challenge.phoneFingerprint
        && current.status === CHALLENGE_STATUS.PENDING) current.status = CHALLENGE_STATUS.INVALIDATED;
    }
    this.challenges.set(challenge.id, challenge);
    return challenge;
  }
  async findById(id) { return this.challenges.get(id) || null; }
  async save(challenge) { this.challenges.set(challenge.id, challenge); return challenge; }
}

class UnavailableDisplayPhoneVerificationProvider {
  async sendCode() {
    throw new ApiError({
      statusCode: 503,
      code: 'DISPLAY_PHONE_VERIFICATION_UNAVAILABLE',
      message: 'Проверка номера временно недоступна.',
      source: 'adapter',
      retryable: true,
    });
  }
}

class DeterministicDisplayPhoneVerificationProvider {
  constructor() {
    if (process.env.NODE_ENV !== 'test') throw new Error('Display verifier is test-only.');
  }
  async sendCode() {
    if (process.env.NODE_ENV !== 'test') throw new Error('Display verifier is test-only.');
    return { status: 'SENT' };
  }
}

class AllowDisplayRecognitionAbuseGuard { async check() {} }

class UnavailableDisplayRecognitionAbuseGuard {
  async check() {
    throw new ApiError({ statusCode: 503, code: 'DISPLAY_RECOGNITION_ABUSE_GUARD_UNAVAILABLE', message: 'Проверка временно недоступна.' });
  }
}

function publicChallenge(challenge) {
  return {
    challengeId: challenge.id,
    status: challenge.status,
    expiresAt: challenge.expiresAt.toISOString(),
    maxAttempts: challenge.maxAttempts,
    remainingAttempts: Math.max(0, challenge.maxAttempts - challenge.failedAttempts),
    resendCreatesNewChallenge: true,
  };
}

function unavailableRecognition() {
  return { state: RECOGNITION_STATE.UNAVAILABLE, retryable: true };
}

function unavailableVerification() {
  return { challengeId: null, status: 'UNAVAILABLE', expiresAt: null, maxAttempts: 3, remainingAttempts: 0, resendCreatesNewChallenge: true };
}

function requiredMachineId(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value.trim())) {
    throw safeError(400, 'DISPLAY_MACHINE_ID_INVALID', 'Не удалось определить автомат.');
  }
  return value.trim();
}

function requiredPhone(value) {
  if (typeof value !== 'string' || value.length > 64 || !/^[+\d ()-]+$/.test(value)) {
    throw safeError(400, 'DISPLAY_PHONE_INVALID', 'Введите российский номер телефона полностью.');
  }
  const compact = value.trim().replace(/[ ()-]/g, '');
  if (/^\d{10}$/.test(compact)) value = `+7${compact}`;
  else if (/^7\d{10}$/.test(compact)) value = `+${compact}`;
  const normalized = normalizePhone(value);
  if (!normalized || !/^\+7[3489]\d{9}$/.test(normalized)) {
    throw safeError(400, 'DISPLAY_PHONE_INVALID', 'Введите российский номер телефона полностью.');
  }
  return normalized;
}

function safeError(statusCode, code, message) {
  return new ApiError({ statusCode, code, message, source: 'runtime', retryable: false });
}

// Process-local keyed fingerprints: no enumerable unsalted phone hashes at rest.
const fingerprintKey = crypto.randomBytes(32);
function fingerprint(value) { return crypto.createHmac('sha256', fingerprintKey).update(value).digest('hex'); }
function hashCode(code, salt) { return crypto.scryptSync(code, salt, 32); }
function matchesCode(challenge, code) { return crypto.timingSafeEqual(challenge.codeHash, hashCode(code, challenge.codeSalt)); }
function secureCode() { return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0'); }

module.exports = {
  AllowDisplayRecognitionAbuseGuard,
  CHALLENGE_STATUS,
  DeterministicDisplayPhoneVerificationProvider,
  DisplayCustomerRecognitionService,
  InMemoryDisplayPhoneChallengeRepository,
  RECOGNITION_STATE,
  UnavailableDisplayPhoneVerificationProvider,
  UnavailableDisplayRecognitionAbuseGuard,
};
