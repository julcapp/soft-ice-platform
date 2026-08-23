const express = require('express');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');
const { createCustomerAuthenticator } = require('../../platform/security/authenticateCustomer');
const { ApiError } = require('../../platform/errors/ApiError');

const CHANNELS = {
  TELEGRAM: { planCode: 'PRIVATE_TELEGRAM_MONTHLY', provider: 'TELEGRAM_BOT_API' },
  MAX: { planCode: 'PRIVATE_MAX_MONTHLY', provider: 'MAX_BOT_API' },
};

function createPrivateChannelRouter({ authCoreService, privateChannelBillingService, privateChannelPaymentAdapter, privateChannelAccessService, privateChannelRenewalService, privateChannelRecoveryService, customerProfileCommunicationService, paymentOperationsService, paymentEconomicsService }) {
  const router = express.Router();
  const authenticateCustomer = createCustomerAuthenticator(authCoreService);

  router.get('/me', authenticateCustomer, asyncHandler(async (req, res) => {
    const customerId = req.securityContext.subject_id;
    const channelType = normalizeChannel(req.query.channel || 'TELEGRAM');
    const channel = CHANNELS[channelType];
    const [plan, subscription, access, renewalRecovery] = await Promise.all([
      privateChannelBillingService.getPlan(channel.planCode),
      privateChannelBillingService.getCustomerSubscription(customerId, channel.planCode),
      privateChannelAccessService?.listCustomerAccess?.(customerId) || [],
      privateChannelRecoveryService?.getCustomerRecovery?.(customerId, channel.planCode) || null,
    ]);
    sendData(res, req, {
      channelType,
      plan: { code: plan.code, name: plan.name, priceRub: Number(plan.priceRub), billingPeriodDays: Number(plan.billingPeriodDays), isActive: Boolean(plan.isActive) },
      subscription,
      renewalRecovery,
      access: (access || []).filter((row) => String(row.channelType).toUpperCase() === channelType),
      paymentProvider: { provider: 'YOOKASSA', configured: Boolean(privateChannelPaymentAdapter?.isConfigured?.()), receiptConfigured: Boolean(privateChannelPaymentAdapter?.isReceiptConfigured?.()) },
      accessProvider: { provider: channel.provider, configured: Boolean(privateChannelAccessService?.isConfigured?.(channelType)) },
      recurringConsentVersion: 'private-channel-recurring-v1',
    });
  }));

  router.post('/me/checkout', authenticateCustomer, asyncHandler(async (req, res) => {
    if (!privateChannelPaymentAdapter) throw unavailable('PRIVATE_CHANNEL_PAYMENT_ADAPTER_NOT_CONFIGURED', 'Payment adapter is not configured.');
    const customerId = req.securityContext.subject_id;
    const channelType = normalizeChannel(req.body?.channelType || planCodeToChannel(req.body?.planCode));
    const planCode = CHANNELS[channelType].planCode;
    const plan = await privateChannelBillingService.getPlan(planCode);
    const subscription = await privateChannelBillingService.subscribe(customerId, { planCode, recurringEnabled: req.body?.recurringEnabled === true, recurringConsentVersion: req.body?.recurringConsentVersion });
    let receiptCustomer = null;
    if (privateChannelPaymentAdapter.isReceiptConfigured?.() && customerProfileCommunicationService?.getProfileState) {
      const profileState = await customerProfileCommunicationService.getProfileState(customerId);
      if (profileState.emailVerification?.status === 'VERIFIED' && profileState.customer?.email) receiptCustomer = { email: profileState.customer.email };
      else if (profileState.customer?.phone) receiptCustomer = { phone: String(profileState.customer.phone).replace(/\D/g, '') };
    }
    const payment = await privateChannelPaymentAdapter.createInitialPayment({ subscription, plan, recurringRequested: subscription.recurringRequested, receiptCustomer, idempotencyKey: req.get('Idempotency-Key') || undefined });
    sendData(res, req, { channelType, subscription, payment: { provider: 'YOOKASSA', paymentId: payment.providerPaymentId, status: payment.status, confirmationUrl: payment.confirmationUrl } }, 201);
  }));

  router.post('/me/subscriptions/:subscriptionId/cancel', authenticateCustomer, asyncHandler(async (req, res) => {
    sendData(res, req, await privateChannelBillingService.cancel(req.securityContext.subject_id, req.params.subscriptionId, { atPeriodEnd: req.body?.atPeriodEnd !== false }));
  }));

  router.post('/webhooks/yookassa', asyncHandler(async (req, res) => {
    if (!privateChannelPaymentAdapter) throw unavailable('PRIVATE_CHANNEL_PAYMENT_ADAPTER_NOT_CONFIGURED', 'Payment adapter is not configured.');
    const incoming = req.body || {};
    if (incoming.type !== 'notification') return res.sendStatus(200);
    if (incoming.event === 'refund.succeeded') {
      if (incoming.object?.id && paymentOperationsService?.handleRefundSucceeded) await paymentOperationsService.handleRefundSucceeded(incoming.object.id);
      return res.sendStatus(200);
    }
    if (!String(incoming.event || '').startsWith('payment.')) return res.sendStatus(200);
    const paymentId = incoming.object?.id;
    if (!paymentId) return res.sendStatus(200);
    const payment = await privateChannelPaymentAdapter.getPayment(paymentId);
    if (payment.status !== 'succeeded' || payment.paid !== true) return res.sendStatus(200);
    const subscriptionId = payment.metadata?.private_channel_subscription_id;
    if (!subscriptionId) return res.sendStatus(200);
    const amountRub = Number(payment.amount?.value || 0);
    const paymentMethodRef = payment.payment_method?.saved === true ? payment.payment_method?.id || null : null;
    const paymentMethodType = payment.payment_method?.type || null;
    const recorded = await privateChannelBillingService.recordPayment({ subscriptionId, provider: 'YOOKASSA', providerPaymentId: payment.id, providerPaymentMethodRef: paymentMethodRef, paymentMethodType, amountRub, idempotencyKey: `yookassa:${payment.id}:succeeded` });
    if (paymentEconomicsService?.recordFromPayment && payment.income_amount?.value != null) {
      await paymentEconomicsService.recordFromPayment({
        customerId: recorded.customerId || payment.metadata?.customer_id || null,
        paymentSourceType: 'PRIVATE_CHANNEL',
        paymentSourceId: recorded.id,
        provider: 'YOOKASSA',
        providerPaymentId: payment.id,
        paymentMethodType,
        grossAmountRub: amountRub,
        incomeAmountRub: Number(payment.income_amount.value),
        occurredAt: payment.captured_at ? new Date(payment.captured_at) : new Date(),
      });
    }
    if (payment.receipt_registration && paymentOperationsService?.recordReceipt) {
      await paymentOperationsService.recordReceipt({ customerId: recorded.customerId || payment.metadata?.customer_id, sourceType: 'PRIVATE_CHANNEL', sourcePaymentId: recorded.id, subscriptionId, provider: 'YOOKASSA', receiptType: 'PAYMENT', amountRub, status: String(payment.receipt_registration).toUpperCase(), issuedAt: payment.receipt_registration === 'succeeded' ? new Date() : null });
    }
    await privateChannelRenewalService?.markPaid?.(payment.id);
    if (privateChannelAccessService && recorded.periodEnd) {
      const channelType = planCodeToChannel(recorded.planCode || payment.metadata?.plan_code);
      try { await privateChannelAccessService.grantForPaidPeriod({ subscriptionId, customerId: recorded.customerId || payment.metadata?.customer_id, channelType, validFrom: recorded.periodStart, validUntil: recorded.periodEnd }); }
      catch (error) { console.error('Private channel access grant failed after successful payment', { subscriptionId, paymentId, channelType, code: error.code || error.message }); }
    }
    return res.sendStatus(200);
  }));

  return router;
}

function normalizeChannel(value) { const channel = String(value || 'TELEGRAM').toUpperCase(); if (!CHANNELS[channel]) throw new ApiError({ statusCode: 400, code: 'PRIVATE_CHANNEL_TYPE_INVALID', message: 'Поддерживаются TELEGRAM и MAX.', source: 'runtime' }); return channel; }
function planCodeToChannel(planCode) { return String(planCode || '').toUpperCase().includes('MAX') ? 'MAX' : 'TELEGRAM'; }
function unavailable(code, message) { return new ApiError({ statusCode: 503, code, message, source: 'payment_provider' }); }
module.exports = { createPrivateChannelRouter, normalizeChannel, planCodeToChannel };
