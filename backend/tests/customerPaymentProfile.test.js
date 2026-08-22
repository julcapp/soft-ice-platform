const test = require('node:test');
const assert = require('node:assert/strict');
const { CustomerPaymentProfileService, maskReference } = require('../src/modules/payment_profile/CustomerPaymentProfileService');

test('payment profile combines history and never exposes full saved payment method reference', async () => {
  const fullMethodRef = 'pm_1234567890_super_secret_reference';
  const prisma = {
    customer: { findUnique: async () => ({ id: 'c1' }) },
    $queryRawUnsafe: async (sql) => {
      if (sql.includes('FROM "Payment"')) return [{ id: 'p1', amountRub: 150, currency: 'RUB', provider: 'yookassa', providerPaymentId: 'pay_123456789', providerStatus: 'succeeded', status: 'confirmed', description: 'Пополнение', createdAt: new Date('2026-08-20T10:00:00Z'), confirmedAt: new Date('2026-08-20T10:01:00Z'), canceledAt: null }];
      if (sql.includes('FROM "PrivateChannelPayment"')) return [{ id: 'pp1', amountRub: 99, provider: 'YOOKASSA', providerPaymentId: 'pay_private_987654321', paymentKind: 'INITIAL', status: 'PAID', periodStart: new Date('2026-08-21T00:00:00Z'), periodEnd: new Date('2026-09-20T00:00:00Z'), paidAt: new Date('2026-08-21T00:01:00Z'), failedAt: null, createdAt: new Date('2026-08-21T00:00:00Z'), subscriptionId: 's1', planCode: 'PRIVATE_TELEGRAM_MONTHLY', channelType: 'TELEGRAM' }];
      if (sql.includes('FROM "PrivateChannelSubscription"')) return [{ id: 's1', status: 'ACTIVE', currentPeriodStart: new Date('2026-08-21T00:00:00Z'), currentPeriodEnd: new Date('2026-09-20T00:00:00Z'), recurringEnabled: true, recurringConsentAt: new Date('2026-08-21T00:00:00Z'), recurringConsentVersion: 'private-channel-recurring-v1', providerPaymentMethodRef: fullMethodRef, cancelAtPeriodEnd: false, cancelledAt: null, createdAt: new Date('2026-08-21T00:00:00Z'), updatedAt: new Date('2026-08-21T00:01:00Z'), planCode: 'PRIVATE_TELEGRAM_MONTHLY', planName: 'Telegram', channelType: 'TELEGRAM', priceRub: 99, billingPeriodDays: 30 }];
      return [];
    },
  };
  const profile = await new CustomerPaymentProfileService({ prisma }).get('c1');
  assert.equal(profile.paymentMethods.length, 1);
  assert.equal(profile.recurringSubscriptions[0].recurringConsent.version, 'private-channel-recurring-v1');
  assert.equal(profile.recurringSubscriptions[0].recurringConsent.hasSavedPaymentMethod, true);
  assert.equal(profile.paymentHistory.length, 2);
  assert.equal(profile.security.fullProviderPaymentMethodReferenceExposed, false);
  assert.notEqual(profile.paymentMethods[0].maskedReference, fullMethodRef);
  assert.equal(JSON.stringify(profile).includes(fullMethodRef), false);
});

test('maskReference keeps support-friendly fragments without returning the full provider id', () => {
  assert.equal(maskReference('pay_1234567890'), 'pay_••••••7890');
  assert.equal(maskReference('abcd1234'), 'ab••••34');
});
