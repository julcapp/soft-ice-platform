const test = require('node:test');
const assert = require('node:assert/strict');
const { CustomerPaymentProfileService, maskReference, normalizePaymentMethodType } = require('../src/modules/payment_profile/CustomerPaymentProfileService');

test('payment profile combines history, receipts and refunds without exposing full provider secrets', async () => {
  const fullMethodRef = 'pm_1234567890_super_secret_reference';
  const fullFiscalDrive = '9282440300123456';
  const prisma = {
    customer: { findUnique: async () => ({ id: 'c1' }) },
    $queryRawUnsafe: async (sql) => {
      if (sql.includes('FROM "Payment"')) return [{ id: 'p1', clubTopupId: 'topup1', amountRub: 150, currency: 'RUB', provider: 'yookassa', providerPaymentId: 'pay_123456789', providerStatus: 'succeeded', status: 'confirmed', description: 'Пополнение', metadata: { payment_method: { type: 'sbp' } }, createdAt: new Date('2026-08-20T10:00:00Z'), confirmedAt: new Date('2026-08-20T10:01:00Z'), canceledAt: null }];
      if (sql.includes('FROM "PrivateChannelPayment"')) return [{ id: 'pp1', amountRub: 99, provider: 'YOOKASSA', providerPaymentId: 'pay_private_987654321', paymentKind: 'INITIAL', paymentMethodType: 'bank_card', status: 'PAID', periodStart: new Date('2026-08-21T00:00:00Z'), periodEnd: new Date('2026-09-20T00:00:00Z'), paidAt: new Date('2026-08-21T00:01:00Z'), failedAt: null, createdAt: new Date('2026-08-21T00:00:00Z'), subscriptionId: 's1', planCode: 'PRIVATE_TELEGRAM_MONTHLY', channelType: 'TELEGRAM' }];
      if (sql.includes('FROM "PrivateChannelSubscription"')) return [{ id: 's1', status: 'ACTIVE', currentPeriodStart: new Date('2026-08-21T00:00:00Z'), currentPeriodEnd: new Date('2026-09-20T00:00:00Z'), recurringEnabled: true, recurringConsentAt: new Date('2026-08-21T00:00:00Z'), recurringConsentVersion: 'private-channel-recurring-v1', providerPaymentMethodRef: fullMethodRef, cancelAtPeriodEnd: false, cancelledAt: null, createdAt: new Date('2026-08-21T00:00:00Z'), updatedAt: new Date('2026-08-21T00:01:00Z'), planCode: 'PRIVATE_TELEGRAM_MONTHLY', planName: 'Telegram', channelType: 'TELEGRAM', priceRub: 99, billingPeriodDays: 30 }];
      if (sql.includes('FROM "PaymentReceipt"')) return [{ id: 'r1', paymentSourceType: 'PAYMENT', paymentSourceId: 'p1', orderId: 'o1', subscriptionId: null, provider: 'YOOKASSA', providerReceiptId: 'receipt_123456789', receiptType: 'PAYMENT', status: 'SUCCEEDED', amountRub: 150, currency: 'RUB', fiscalDocumentNumber: '42', fiscalDriveNumber: fullFiscalDrive, fiscalSign: '9876543210', receiptUrl: 'https://example.test/receipt/r1', customerEmail: 'person@example.com', issuedAt: new Date('2026-08-20T10:02:00Z'), createdAt: new Date('2026-08-20T10:01:30Z') }];
      if (sql.includes('FROM "PaymentRefund"')) return [{ id: 'rf1', paymentSourceType: 'PAYMENT', paymentSourceId: 'p1', orderId: 'o1', subscriptionId: null, provider: 'YOOKASSA', providerRefundId: 'refund_123456789', status: 'SUCCEEDED', amountRub: 50, currency: 'RUB', reason: 'Частичный возврат', requestedAt: new Date('2026-08-22T10:00:00Z'), succeededAt: new Date('2026-08-22T10:01:00Z'), failedAt: null, createdAt: new Date('2026-08-22T10:00:00Z') }];
      return [];
    },
  };
  const profile = await new CustomerPaymentProfileService({ prisma }).get('c1');
  assert.equal(profile.paymentMethods.length, 1);
  assert.equal(profile.recurringSubscriptions[0].recurringConsent.version, 'private-channel-recurring-v1');
  assert.equal(profile.recurringSubscriptions[0].recurringConsent.hasSavedPaymentMethod, true);
  assert.equal(profile.paymentHistory.length, 2);
  assert.equal(profile.paymentHistory.find((item) => item.paymentId === 'p1').paymentMethodType, 'SBP');
  assert.equal(profile.paymentHistory.find((item) => item.paymentId === 'pp1').paymentMethodType, 'BANK_CARD');
  assert.equal(profile.receiptHistory[0].linkedEntity.type, 'ORDER');
  assert.equal(profile.refundHistory[0].amountRub, 50);
  assert.equal(profile.refundHistory[0].status, 'SUCCEEDED');
  assert.equal(profile.security.fullProviderPaymentMethodReferenceExposed, false);
  assert.equal(profile.security.fullFiscalDeviceIdentifiersExposed, false);
  assert.notEqual(profile.paymentMethods[0].maskedReference, fullMethodRef);
  const serialized = JSON.stringify(profile);
  assert.equal(serialized.includes(fullMethodRef), false);
  assert.equal(serialized.includes(fullFiscalDrive), false);
});

test('maskReference keeps support-friendly fragments without returning the full provider id', () => {
  assert.equal(maskReference('pay_1234567890'), 'pay_••••••7890');
  assert.equal(maskReference('abcd1234'), 'ab••••34');
});

test('payment method normalization keeps SBP, card and internal balance distinct', () => {
  assert.equal(normalizePaymentMethodType('sbp'), 'SBP');
  assert.equal(normalizePaymentMethodType('bank_card'), 'BANK_CARD');
  assert.equal(normalizePaymentMethodType('internal_balance'), 'CLUB_BALANCE');
  assert.equal(normalizePaymentMethodType(null), 'UNKNOWN');
});
