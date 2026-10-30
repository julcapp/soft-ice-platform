'use strict';

const crypto = require('node:crypto');
const { normalizePhone } = require('./CustomerEntity');

const PHONE_STATUS = Object.freeze({
  UNVERIFIED: 'UNVERIFIED',
  VERIFIED: 'VERIFIED',
});

const CONTACT_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  LINKED: 'LINKED',
  ARCHIVED: 'ARCHIVED',
});

const NOTIFICATION_STATUS = Object.freeze({
  PENDING_IDENTITY: 'PENDING_IDENTITY',
  WAITING_RECEIPT: 'WAITING_RECEIPT',
  PENDING_CONSENT: 'PENDING_CONSENT',
  READY: 'READY',
  SENT: 'SENT',
});

const NOTIFICATION_TYPE = Object.freeze({
  PURCHASE_COMPLETED: 'PURCHASE_COMPLETED',
  FISCAL_RECEIPT_READY: 'FISCAL_RECEIPT_READY',
  LOYALTY_ACCOUNT_INVITE: 'LOYALTY_ACCOUNT_INVITE',
});

class UnverifiedPurchaseContactRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  findActive({ phoneFingerprint, machineId }) {
    return this.prisma.unverifiedPurchaseContact.findFirst({
      where: {
        phoneFingerprint,
        machineId,
        status: CONTACT_STATUS.ACTIVE,
        phoneStatus: PHONE_STATUS.UNVERIFIED,
      },
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  create(data) {
    return this.prisma.unverifiedPurchaseContact.create({ data });
  }

  update(id, data) {
    return this.prisma.unverifiedPurchaseContact.update({ where: { id }, data });
  }

  findById(id) {
    return this.prisma.unverifiedPurchaseContact.findUnique({ where: { id } });
  }

  findLatestByFingerprint(phoneFingerprint) {
    return this.prisma.unverifiedPurchaseContact.findFirst({
      where: { phoneFingerprint },
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  createNotification(data) {
    return this.prisma.purchaseNotificationIntent.create({ data });
  }

  updatePendingNotificationsForContact(contactId, data) {
    return this.prisma.purchaseNotificationIntent.updateMany({
      where: {
        contactId,
        status: { in: [
          NOTIFICATION_STATUS.PENDING_IDENTITY,
          NOTIFICATION_STATUS.PENDING_CONSENT,
          NOTIFICATION_STATUS.WAITING_RECEIPT,
        ] },
      },
      data,
    });
  }
}

class UnverifiedPurchaseContactService {
  constructor({
    repository,
    codec,
    fingerprintSecret,
    clock = () => new Date(),
    logger = console,
  }) {
    if (!repository) throw new Error('Unverified purchase contact repository is required.');
    if (!codec) throw new Error('PII codec is required.');
    if (!fingerprintSecret) throw new Error('Phone fingerprint secret is required.');
    this.repository = repository;
    this.codec = codec;
    this.fingerprintSecret = fingerprintSecret;
    this.clock = clock;
    this.logger = logger;
  }

  async recordPhone({ machineId, phone, source = 'TERMINAL', metadata = null }) {
    const normalized = normalizePhone(phone);
    if (!normalized || !/^\+7[3489]\d{9}$/.test(normalized)) {
      const error = new Error('A valid Russian phone is required.');
      error.code = 'UNVERIFIED_PHONE_INVALID';
      throw error;
    }
    if (!machineId) {
      const error = new Error('machineId is required.');
      error.code = 'UNVERIFIED_MACHINE_ID_REQUIRED';
      throw error;
    }

    const phoneFingerprint = this.fingerprint(normalized);
    const now = this.clock();
    const existing = await this.repository.findActive({ phoneFingerprint, machineId });
    if (existing && !existing.orderId) {
      return this.repository.update(existing.id, {
        lastSeenAt: now,
        metadata: mergeMetadata(existing.metadata, metadata),
      });
    }

    const id = crypto.randomUUID();
    return this.repository.create({
      id,
      phoneCiphertext: this.codec.encrypt(normalized, this.aad(id)),
      phoneFingerprint,
      phoneMasked: maskPhone(normalized),
      phoneStatus: PHONE_STATUS.UNVERIFIED,
      machineId,
      status: CONTACT_STATUS.ACTIVE,
      source,
      capturedAt: now,
      lastSeenAt: now,
      metadata: metadata || undefined,
    });
  }

  async attachCompletedPurchase({
    contactId,
    orderId,
    customerId = null,
    machineId = null,
    amountRub = null,
    bonusAccrued = null,
    bonusBalance = null,
    receiptUrl = null,
    correlationId = null,
  }) {
    const contact = await this.repository.findById(contactId);
    if (!contact) {
      const error = new Error('Unverified purchase contact not found.');
      error.code = 'UNVERIFIED_CONTACT_NOT_FOUND';
      throw error;
    }
    const now = this.clock();
    const updated = await this.repository.update(contact.id, {
      orderId,
      customerId,
      machineId: machineId || contact.machineId,
      purchaseCompletedAt: now,
      lastSeenAt: now,
    });

    const common = {
      orderId,
      customerId,
      contactId: updated.id,
      machineId: machineId || updated.machineId,
      phoneStatus: updated.phoneStatus,
      phoneCiphertext: updated.phoneCiphertext,
      phoneFingerprint: updated.phoneFingerprint,
      phoneMasked: updated.phoneMasked,
      amountRub,
      bonusAccrued,
      bonusBalance,
      correlationId,
      source: 'SALE_FLOW',
    };

    const purchase = await this.repository.createNotification({
      ...common,
      notificationType: NOTIFICATION_TYPE.PURCHASE_COMPLETED,
      status: customerId ? NOTIFICATION_STATUS.READY : NOTIFICATION_STATUS.PENDING_IDENTITY,
    });

    const receipt = await this.repository.createNotification({
      ...common,
      notificationType: NOTIFICATION_TYPE.FISCAL_RECEIPT_READY,
      status: receiptUrl
        ? (customerId ? NOTIFICATION_STATUS.READY : NOTIFICATION_STATUS.PENDING_IDENTITY)
        : NOTIFICATION_STATUS.WAITING_RECEIPT,
      receiptUrl,
    });

    const invite = await this.repository.createNotification({
      ...common,
      notificationType: NOTIFICATION_TYPE.LOYALTY_ACCOUNT_INVITE,
      status: NOTIFICATION_STATUS.PENDING_CONSENT,
    });

    return { contact: updated, intents: [purchase, receipt, invite] };
  }

  async linkVerifiedPhone({ phone, customerId }) {
    const normalized = normalizePhone(phone);
    const phoneFingerprint = this.fingerprint(normalized);
    const contact = await this.repository.findLatestByFingerprint(phoneFingerprint);
    if (!contact) return null;
    const now = this.clock();
    const updated = await this.repository.update(contact.id, {
      customerId,
      phoneStatus: PHONE_STATUS.VERIFIED,
      status: CONTACT_STATUS.LINKED,
      linkedAt: now,
      lastSeenAt: now,
    });
    await this.repository.updatePendingNotificationsForContact(contact.id, {
      customerId,
      phoneStatus: PHONE_STATUS.VERIFIED,
      resolvedAt: now,
    });
    return updated;
  }

  decryptPhone(contact) {
    return this.codec.decrypt(contact.phoneCiphertext, this.aad(contact.id));
  }

  fingerprint(phone) {
    return crypto.createHmac('sha256', this.fingerprintSecret).update(String(phone)).digest('hex');
  }

  aad(id) {
    return `unverified-purchase-contact:${id}`;
  }
}

function maskPhone(phone) {
  const value = String(phone || '');
  const match = value.match(/^\+7(\d{3})(\d{3})(\d{2})(\d{2})$/);
  if (!match) return '+7 *** ***-**-**';
  return `+7 ${match[1]} ***-${match[3]}-${match[4]}`;
}

function mergeMetadata(current, next) {
  return { ...(isObject(current) ? current : {}), ...(isObject(next) ? next : {}) };
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

module.exports = {
  UnverifiedPurchaseContactRepository,
  UnverifiedPurchaseContactService,
  PURCHASE_NOTIFICATION_TYPE: NOTIFICATION_TYPE,
  PURCHASE_NOTIFICATION_STATUS: NOTIFICATION_STATUS,
  PURCHASE_CONTACT_STATUS: CONTACT_STATUS,
  PURCHASE_PHONE_STATUS: PHONE_STATUS,
  maskPhone,
};
