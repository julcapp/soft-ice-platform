const express = require('express');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');
const { createCustomerAuthenticator } = require('../../platform/security/authenticateCustomer');
const { ApiError } = require('../../platform/errors/ApiError');

function createPrivateChannelRouter({ authCoreService, privateChannelBillingService, privateChannelPaymentAdapter }) {
  const router = express.Router();
  const authenticateCustomer = createCustomerAuthenticator(authCoreService);

  router.get('/me', authenticateCustomer, asyncHandler(async (req, res) => {
    const customerId = req.securityContext.subject_id;
    const [plan, subscription] = await Promise.all([
      privateChannelBillingService.getPlan('PRIVATE_TELEGRAM_MONTHLY'),
      privateChannelBillingService.getCustomerSubscription(customerId),
    ]);
    sendData(res, req, {
      plan: { code: plan.code, name: plan.name, priceRub: Number(plan.priceRub), billingPeriodDays: Number(plan.billingPeriodDays), isActive: Boolean(plan.isActive) },
      subscription,
      paymentProvider: { provider: 'YOOKASSA', configured: Boolean(privateChannelPaymentAdapter?.isConfigured?.()) },
      recurringConsentVersion: 'private-channel-recurring-v1',
    });
  }));

  router.post('/me/checkout', authenticateCustomer, asyncHandler(async (req, res) => {
    if (!privateChannelPaymentAdapter) throw unavailable('PRIVATE_CHANNEL_PAYMENT_ADAPTER_NOT_CONFIGURED', 'Payment adapter is not configured.');
    const customerId = req.securityContext.subject_id;
    const plan = await privateChannelBillingService.getPlan(req.body?.planCode || 'PRIVATE_TELEGRAM_MONTHLY');
    const subscription = await privateChannelBillingService.subscribe(customerId, {
      planCode: plan.code,
      recurringEnabled: req.body?.recurringEnabled === true,
      recurringConsentVersion: req.body?.recurringConsentVersion,
    });
    const payment = await privateChannelPaymentAdapter.createInitialPayment({
      subscription,
      plan,
      recurringRequested: subscription.recurringRequested,
      idempotencyKey: req.get('Idempotency-Key') || undefined,
    });
    sendData(res, req, {
      subscription,
      payment: { provider: 'YOOKASSA', paymentId: payment.providerPaymentId, status: payment.status, confirmationUrl: payment.confirmationUrl },
    }, 201);
  }));

  router.post('/me/subscriptions/:subscriptionId/cancel', authenticateCustomer, asyncHandler(async (req, res) => {
    sendData(res, req, await privateChannelBillingService.cancel(req.securityContext.subject_id, req.params.subscriptionId, { atPeriodEnd: req.body?.atPeriodEnd !== false }));
  }));

  router.post('/webhooks/yookassa', asyncHandler(async (req, res) => {
    if (!privateChannelPaymentAdapter) throw unavailable('PRIVATE_CHANNEL_PAYMENT_ADAPTER_NOT_CONFIGURED', 'Payment adapter is not configured.');
    const incoming = req.body || {};
    if (incoming.type !== 'notification' || !String(incoming.event || '').startsWith('payment.')) return res.sendStatus(200);
    const paymentId = incoming.object?.id;
    if (!paymentId) return res.sendStatus(200);

    // Do not trust webhook payload alone. Re-read the payment from YooKassa before changing access/billing state.
    const payment = await privateChannelPaymentAdapter.getPayment(paymentId);
    if (payment.status !== 'succeeded' || payment.paid !== true) return res.sendStatus(200);
    const subscriptionId = payment.metadata?.private_channel_subscription_id;
    if (!subscriptionId) return res.sendStatus(200);
    const amountRub = Number(payment.amount?.value || 0);
    const paymentMethodRef = payment.payment_method?.saved === true ? payment.payment_method?.id || null : null;
    await privateChannelBillingService.recordPayment({
      subscriptionId,
      provider: 'YOOKASSA',
      providerPaymentId: payment.id,
      providerPaymentMethodRef: paymentMethodRef,
      amountRub,
      idempotencyKey: `yookassa:${payment.id}:succeeded`,
    });
    return res.sendStatus(200);
  }));

  return router;
}

function unavailable(code, message) { return new ApiError({ statusCode: 503, code, message, source: 'payment_provider' }); }
module.exports = { createPrivateChannelRouter };
