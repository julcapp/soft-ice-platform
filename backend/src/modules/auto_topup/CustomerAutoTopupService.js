const { randomUUID } = require('crypto');
const { ApiError } = require('../../platform/errors/ApiError');

const TOMSK_OFFSET_MS = 7 * 60 * 60 * 1000;

class CustomerAutoTopupService {
  constructor({ prisma, paymentAdapter, clubAccountRuntime, clock = () => new Date(), offerVersion = process.env.AUTO_TOPUP_OFFER_VERSION || 'AUTO_TOPUP_OFFER_V1' }) {
    if (!prisma) throw new Error('prisma is required');
    if (!paymentAdapter) throw new Error('paymentAdapter is required');
    if (!clubAccountRuntime) throw new Error('clubAccountRuntime is required');
    this.prisma = prisma;
    this.paymentAdapter = paymentAdapter;
    this.clubAccountRuntime = clubAccountRuntime;
    this.clock = clock;
    this.offerVersion = offerVersion;
  }

  async get(customerId) {
    const rows = await this.prisma.$queryRawUnsafe(
      'SELECT * FROM "CustomerAutoTopupSchedule" WHERE "customerId"=$1 LIMIT 1',
      customerId,
    );
    return rows[0] ? projectSchedule(rows[0]) : null;
  }

  async setup(customerId, request = {}, context = {}) {
    const amountRub = positiveMoney(request.amountRub ?? request.amount);
    const billingDay = validBillingDay(request.billingDay ?? 1);
    const offerVersion = String(request.offerVersion || this.offerVersion || '').trim();
    if (!offerVersion) throw validation('AUTO_TOPUP_OFFER_VERSION_REQUIRED', 'Не указана версия условий автопополнения.');

    const account = await this.clubAccountRuntime.getOwnAccount(customerId);
    const accountStatus = account.status || (account.clubActive ? 'active' : 'pending_activation');
    if (accountStatus !== 'active') throw validation('AUTO_TOPUP_CLUB_ACCOUNT_NOT_ACTIVE', 'Лицевой счёт должен быть активен.');

    const existingRows = await this.prisma.$queryRawUnsafe(
      'SELECT * FROM "CustomerAutoTopupSchedule" WHERE "customerId"=$1 LIMIT 1',
      customerId,
    );
    const existing = existingRows[0] || null;
    const now = this.clock();

    if (existing?.providerPaymentMethodRef) {
      const rows = await this.prisma.$queryRawUnsafe(
        'UPDATE "CustomerAutoTopupSchedule" SET "amountRub"=$2,"billingDay"=$3,"offerVersion"=$4,"offerAcceptedAt"=$5,"status"=\'ACTIVE\',"disabledAt"=NULL,"nextChargeAt"=COALESCE("nextChargeAt",$6),"updatedAt"=$5 WHERE "id"=$1 RETURNING *',
        existing.id, amountRub, billingDay, offerVersion, now, nextMonthlyTomsk(now, billingDay),
      );
      return { schedule: projectSchedule(rows[0]), setupPayment: null, paymentMethodAlreadySaved: true };
    }

    const scheduleId = existing?.id || randomUUID();
    const rows = existing
      ? await this.prisma.$queryRawUnsafe(
        'UPDATE "CustomerAutoTopupSchedule" SET "amountRub"=$2,"billingDay"=$3,"offerVersion"=$4,"offerAcceptedAt"=$5,"status"=\'PENDING_SETUP\',"disabledAt"=NULL,"updatedAt"=$5 WHERE "id"=$1 RETURNING *',
        scheduleId, amountRub, billingDay, offerVersion, now,
      )
      : await this.prisma.$queryRawUnsafe(
        'INSERT INTO "CustomerAutoTopupSchedule" ("id","customerId","status","amountRub","currency","frequency","billingDay","provider","offerVersion","offerAcceptedAt","createdAt","updatedAt") VALUES ($1,$2,\'PENDING_SETUP\',$3,\'RUB\',\'MONTHLY\',$4,\'YOOKASSA\',$5,$6,$6,$6) RETURNING *',
        scheduleId, customerId, amountRub, billingDay, offerVersion, now,
      );
    const schedule = rows[0];
    const idempotencyKey = String(context.idempotencyKey || `auto-topup-setup:${scheduleId}:${now.toISOString()}`);
    const attemptId = randomUUID();

    await this.prisma.$executeRawUnsafe(
      'INSERT INTO "CustomerAutoTopupAttempt" ("id","scheduleId","customerId","provider","idempotencyKey","amountRub","currency","status","scheduledFor","attemptedAt","createdAt","updatedAt") VALUES ($1,$2,$3,\'YOOKASSA\',$4,$5,\'RUB\',\'CREATED\',$6,$6,$6,$6) ON CONFLICT ("idempotencyKey") DO NOTHING',
      attemptId, scheduleId, customerId, idempotencyKey, amountRub, now,
    );

    try {
      const payment = await this.paymentAdapter.createAutoTopupInitialPayment({ schedule, idempotencyKey });
      await this.prisma.$executeRawUnsafe(
        'UPDATE "CustomerAutoTopupAttempt" SET "providerPaymentId"=$2,"status"=\'AWAITING_WEBHOOK\',"updatedAt"=$3 WHERE "idempotencyKey"=$1',
        idempotencyKey, payment.providerPaymentId || null, now,
      );
      if (payment.raw?.status === 'succeeded' && payment.raw?.paid === true) await this.handleSucceeded(payment.raw);
      return { schedule: projectSchedule(schedule), setupPayment: payment, paymentMethodAlreadySaved: false };
    } catch (error) {
      await this.prisma.$executeRawUnsafe(
        'UPDATE "CustomerAutoTopupAttempt" SET "status"=\'FAILED\',"failureCode"=$2,"failureMessage"=$3,"updatedAt"=$4 WHERE "idempotencyKey"=$1',
        idempotencyKey, String(error.code || 'AUTO_TOPUP_SETUP_FAILED').slice(0, 120), String(error.message || 'Setup failed').slice(0, 500), now,
      );
      throw error;
    }
  }

  async disable(customerId) {
    const now = this.clock();
    const rows = await this.prisma.$queryRawUnsafe(
      'UPDATE "CustomerAutoTopupSchedule" SET "status"=\'DISABLED\',"disabledAt"=$2,"nextChargeAt"=NULL,"updatedAt"=$2 WHERE "customerId"=$1 RETURNING *',
      customerId, now,
    );
    if (!rows[0]) throw new ApiError({ statusCode: 404, code: 'AUTO_TOPUP_NOT_FOUND', message: 'Автопополнение не настроено.', source: 'runtime' });
    return projectSchedule(rows[0]);
  }

  async processDue({ limit = 100 } = {}) {
    const now = this.clock();
    const rows = await this.prisma.$queryRawUnsafe(
      'SELECT * FROM "CustomerAutoTopupSchedule" WHERE "status"=\'ACTIVE\' AND "frequency"=\'MONTHLY\' AND "providerPaymentMethodRef" IS NOT NULL AND "nextChargeAt" IS NOT NULL AND "nextChargeAt"<=$1 ORDER BY "nextChargeAt" ASC LIMIT $2',
      now, Math.min(Math.max(Number(limit) || 100, 1), 500),
    );
    const results = [];
    for (const row of rows) results.push(await this.processOne(row));
    return results;
  }

  async processOne(schedule) {
    const scheduledFor = new Date(schedule.nextChargeAt);
    const cycle = cycleKey(scheduledFor);
    const idempotencyKey = `auto-topup:${schedule.id}:${cycle}`;
    const existingRows = await this.prisma.$queryRawUnsafe(
      'SELECT * FROM "CustomerAutoTopupAttempt" WHERE "idempotencyKey"=$1 LIMIT 1',
      idempotencyKey,
    );
    const existing = existingRows[0];
    if (existing && ['AWAITING_WEBHOOK','SUCCEEDED','CREDITED','FAILED'].includes(existing.status)) return { ...existing, idempotentReplay: true };

    const now = this.clock();
    if (!existing) {
      await this.prisma.$executeRawUnsafe(
        'INSERT INTO "CustomerAutoTopupAttempt" ("id","scheduleId","customerId","provider","idempotencyKey","amountRub","currency","status","scheduledFor","attemptedAt","createdAt","updatedAt") VALUES ($1,$2,$3,\'YOOKASSA\',$4,$5,\'RUB\',\'CREATED\',$6,$7,$7,$7)',
        randomUUID(), schedule.id, schedule.customerId, idempotencyKey, Number(schedule.amountRub), scheduledFor, now,
      );
    }

    try {
      const payment = await this.paymentAdapter.createAutoTopupRecurringPayment({ schedule, idempotencyKey });
      await this.prisma.$executeRawUnsafe(
        'UPDATE "CustomerAutoTopupAttempt" SET "providerPaymentId"=$2,"status"=\'AWAITING_WEBHOOK\',"attemptedAt"=$3,"updatedAt"=$3 WHERE "idempotencyKey"=$1',
        idempotencyKey, payment.providerPaymentId || null, now,
      );
      if (payment.raw?.status === 'succeeded' && payment.raw?.paid === true) return this.handleSucceeded(payment.raw);
      return { scheduleId: schedule.id, providerPaymentId: payment.providerPaymentId, status: 'AWAITING_WEBHOOK' };
    } catch (error) {
      const nextChargeAt = nextMonthlyTomsk(now, Number(schedule.billingDay || 1));
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          'UPDATE "CustomerAutoTopupAttempt" SET "status"=\'FAILED\',"failureCode"=$2,"failureMessage"=$3,"updatedAt"=$4 WHERE "idempotencyKey"=$1',
          idempotencyKey, String(error.code || 'AUTO_TOPUP_PAYMENT_FAILED').slice(0, 120), String(error.message || 'Payment failed').slice(0, 500), now,
        );
        await tx.$executeRawUnsafe(
          'UPDATE "CustomerAutoTopupSchedule" SET "nextChargeAt"=$2,"updatedAt"=$3 WHERE "id"=$1 AND "status"=\'ACTIVE\'',
          schedule.id, nextChargeAt, now,
        );
      });
      return { scheduleId: schedule.id, status: 'FAILED', nextChargeAt, errorCode: error.code || 'AUTO_TOPUP_PAYMENT_FAILED' };
    }
  }

  async handleFailed(payment) {
    const scheduleId = payment?.metadata?.auto_topup_schedule_id;
    if (!scheduleId) return { applied: false, reason: 'not_auto_topup' };
    const rows = await this.prisma.$queryRawUnsafe('SELECT * FROM "CustomerAutoTopupSchedule" WHERE "id"=$1 LIMIT 1', scheduleId);
    const schedule = rows[0];
    if (!schedule) return { applied: false, reason: 'schedule_not_found' };
    const now = this.clock();
    const isSetup = String(payment?.metadata?.payment_kind || '').toUpperCase() === 'AUTO_TOPUP_SETUP' || schedule.status === 'PENDING_SETUP';
    const nextChargeAt = isSetup ? null : nextMonthlyTomsk(now, Number(schedule.billingDay || 1));
    await this.prisma.$transaction(async (tx) => {
      if (payment?.id) {
        await tx.$executeRawUnsafe(
          'UPDATE "CustomerAutoTopupAttempt" SET "status"=\'FAILED\',"failureCode"=$2,"failureMessage"=$3,"updatedAt"=$4 WHERE "providerPaymentId"=$1',
          payment.id, String(payment?.cancellation_details?.reason || payment?.status || 'CANCELED').slice(0, 120), String(payment?.cancellation_details?.party || 'yookassa').slice(0, 500), now,
        );
      }
      await tx.$executeRawUnsafe(
        'UPDATE "CustomerAutoTopupSchedule" SET "status"=$2,"nextChargeAt"=$3,"updatedAt"=$4 WHERE "id"=$1',
        schedule.id, isSetup ? 'PENDING_SETUP' : 'ACTIVE', nextChargeAt, now,
      );
    });
    return { applied: true, scheduleId, status: 'FAILED', nextChargeAt };
  }

  async handleSucceeded(payment) {
    if (!payment || payment.status !== 'succeeded' || payment.paid !== true) return { applied: false, reason: 'payment_not_succeeded' };
    const scheduleId = payment.metadata?.auto_topup_schedule_id;
    if (!scheduleId) return { applied: false, reason: 'not_auto_topup' };

    const rows = await this.prisma.$queryRawUnsafe('SELECT * FROM "CustomerAutoTopupSchedule" WHERE "id"=$1 LIMIT 1', scheduleId);
    const schedule = rows[0];
    if (!schedule) throw new ApiError({ statusCode: 404, code: 'AUTO_TOPUP_SCHEDULE_NOT_FOUND', message: 'График автопополнения не найден.', source: 'runtime' });
    if (payment.metadata?.customer_id && String(payment.metadata.customer_id) !== String(schedule.customerId)) {
      throw validation('AUTO_TOPUP_CUSTOMER_MISMATCH', 'Платёж не соответствует владельцу лицевого счёта.');
    }

    const amountRub = positiveMoney(payment.amount?.value);
    const now = payment.captured_at ? new Date(payment.captured_at) : this.clock();
    const paymentMethodRef = payment.payment_method?.saved === true ? payment.payment_method?.id || null : schedule.providerPaymentMethodRef || null;
    const paymentMethodType = payment.payment_method?.type || schedule.paymentMethodType || null;

    const credit = await this.clubAccountRuntime.topUpOwnAccount(
      schedule.customerId,
      {
        amount: amountRub,
        currency: 'RUB',
        reason: 'monthly_auto_topup',
        referenceEntityType: 'YooKassaPayment',
        referenceEntityId: payment.id,
        sourceId: payment.id,
      },
      {
        idempotencyKey: `auto-topup-credit:${payment.id}`,
        correlationId: payment.id,
        actorType: 'system',
        actorId: 'customer_auto_topup',
        sourceChannel: 'yookassa_webhook',
      },
    );

    const nextChargeAt = paymentMethodRef ? nextMonthlyTomsk(now, Number(schedule.billingDay || 1)) : null;
    const nextStatus = paymentMethodRef ? 'ACTIVE' : 'PENDING_SETUP';
    await this.prisma.$executeRawUnsafe(
      'UPDATE "CustomerAutoTopupSchedule" SET "status"=$2,"providerPaymentMethodRef"=COALESCE($3,"providerPaymentMethodRef"),"paymentMethodType"=COALESCE($4,"paymentMethodType"),"nextChargeAt"=$5,"lastSucceededAt"=$6,"disabledAt"=NULL,"updatedAt"=$6 WHERE "id"=$1',
      schedule.id, nextStatus, paymentMethodRef, paymentMethodType, nextChargeAt, now,
    );

    await this.prisma.$executeRawUnsafe(
      'INSERT INTO "CustomerAutoTopupAttempt" ("id","scheduleId","customerId","provider","providerPaymentId","idempotencyKey","amountRub","currency","status","scheduledFor","attemptedAt","succeededAt","creditedTransactionId","createdAt","updatedAt") VALUES ($1,$2,$3,\'YOOKASSA\',$4,$5,$6,\'RUB\',\'CREDITED\',$7,$7,$7,$8,$7,$7) ON CONFLICT ("providerPaymentId") DO UPDATE SET "status"=\'CREDITED\',"succeededAt"=EXCLUDED."succeededAt","creditedTransactionId"=EXCLUDED."creditedTransactionId","updatedAt"=EXCLUDED."updatedAt"',
      randomUUID(), schedule.id, schedule.customerId, payment.id, `yookassa:${payment.id}:auto-topup`, amountRub, now, credit.transaction?.id || null,
    );

    return { applied: true, scheduleId: schedule.id, customerId: schedule.customerId, amountRub, creditedTransactionId: credit.transaction?.id || null, nextChargeAt, recurringActive: Boolean(paymentMethodRef) };
  }
}

function nextMonthlyTomsk(now, billingDay) {
  const day = validBillingDay(billingDay);
  const tomsk = new Date(new Date(now).getTime() + TOMSK_OFFSET_MS);
  let year = tomsk.getUTCFullYear();
  let month = tomsk.getUTCMonth() + 1;
  if (month === 12) { month = 0; year += 1; }
  return new Date(Date.UTC(year, month, day, 0, 20, 0, 0) - TOMSK_OFFSET_MS);
}

function cycleKey(value) {
  const date = new Date(value);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function positiveMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw validation('AUTO_TOPUP_AMOUNT_INVALID', 'Сумма автопополнения должна быть больше нуля.');
  return Math.round(amount * 100) / 100;
}

function validBillingDay(value) {
  const day = Number(value);
  if (!Number.isInteger(day) || day < 1 || day > 28) throw validation('AUTO_TOPUP_BILLING_DAY_INVALID', 'День автопополнения должен быть от 1 до 28.');
  return day;
}

function projectSchedule(row) {
  return {
    id: row.id,
    customerId: row.customerId,
    status: row.status,
    amountRub: Number(row.amountRub || 0),
    currency: row.currency,
    frequency: row.frequency,
    billingDay: Number(row.billingDay || 1),
    provider: row.provider,
    paymentMethodSaved: Boolean(row.providerPaymentMethodRef),
    paymentMethodType: row.paymentMethodType || null,
    offerVersion: row.offerVersion,
    offerAcceptedAt: row.offerAcceptedAt,
    nextChargeAt: row.nextChargeAt,
    lastSucceededAt: row.lastSucceededAt,
    disabledAt: row.disabledAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function validation(code, message) {
  return new ApiError({ statusCode: 400, code, message, source: 'runtime' });
}

module.exports = { CustomerAutoTopupService, nextMonthlyTomsk, projectSchedule };
