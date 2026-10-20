'use strict';
const express = require('express');
const fs = require('node:fs');
const { sha256 } = require('../../platform/security/hash');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');
const { verifyTelegramInitData } = require('../../platform/security/telegramMiniAppVerifier');
const { assertCustomerAccess } = require('../../modules/customer/CustomerAccessPolicy');
const { MiniAppPreorderService } = require('../../modules/order/MiniAppPreorderService');
const { resolvePricingService } = require('./pricingRoutes');
const { CatalogService, CatalogRepository } = require('../../modules/catalog');
const { getPrismaClient } = require('../../common/database');

const fail = (code, message, statusCode) => Object.assign(new Error(message), { code, statusCode });

function readTestAuthConfig() {
  // The existing root-owned TEST-only configuration. Never load the production key.
  const allowed = new Set(['TELEGRAM_TEST_BOT_TOKEN', 'TELEGRAM_TEST_ALLOWED_USER_IDS']);
  const values = {};
  for (const line of fs.readFileSync('/etc/softice/miniapp-test-auth.env', 'utf8').split(/\r?\n/)) {
    const index = line.indexOf('=');
    const key = line.slice(0, index);
    if (index > 0 && allowed.has(key)) values[key] = line.slice(index + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return { botToken: values.TELEGRAM_TEST_BOT_TOKEN,
    allowedUserIds: new Set(String(values.TELEGRAM_TEST_ALLOWED_USER_IDS || '').split(',').filter(Boolean)) };
}

async function authenticateTestBuyer(prisma, raw, config, now = new Date()) {
  if (!config.botToken || !config.allowedUserIds?.size) throw fail('PREORDER_TEST_AUTH_UNCONFIGURED', 'Тестовый вход ещё не настроен.', 503);
  if (typeof raw !== 'string' || raw.length > 16384) throw fail('PREORDER_AUTH_INVALID', 'Откройте приложение из тестового Telegram-бота.', 401);
  const params = new URLSearchParams(raw);
  const keys = [...params.keys()];
  const stamp = Number(params.get('auth_date'));
  if (new Set(keys).size !== keys.length || !/^[a-f0-9]{64}$/i.test(params.get('hash') || '') || !Number.isInteger(stamp)
      || stamp > now.getTime() / 1000 + 60 || stamp < now.getTime() / 1000 - 3600) {
    throw fail('PREORDER_AUTH_INVALID', 'Повторно откройте приложение из тестового бота.', 401);
  }
  const identity = verifyTelegramInitData(raw, { botToken: config.botToken, maxAgeSeconds: 3600, now });
  if (!config.allowedUserIds.has(identity.user.id)) throw fail('PREORDER_TEST_BUYER_DENIED', 'Этот аккаунт не включён в тест.', 403);
  const bindings = await prisma.customerIdentity.findMany({ where: { provider: 'telegram', externalSubjectHash: { in: [sha256(identity.user.id), identity.subjectHash] },
    status: 'active', revokedAt: null }, include: { customer: true } });
  const verified = bindings.filter(binding => binding.verifiedAt && binding.customer);
  if (new Set(verified.map(binding => binding.customer.id)).size > 1) {
    throw fail('PREORDER_IDENTITY_CONFLICT', 'Найдены разные привязки профиля. Обратитесь в поддержку.', 409);
  }
  const binding = verified[0];
  if (!binding) throw fail('PREORDER_VERIFIED_PROFILE_REQUIRED', 'Сначала подтвердите профиль в боте.', 403);
  assertCustomerAccess(binding.customer, now);
  return binding.customer;
}

function createMiniAppTestPreorderRouter(dependencies) {
  dependencies = { ...dependencies, prisma: dependencies.prisma || getPrismaClient() };
  dependencies.catalogService ||= new CatalogService({ repository: new CatalogRepository(dependencies.prisma) });
  const router = express.Router();
  let service;
  const getService = () => {
    if (!dependencies.terminalCheckoutService?.testCardEnabled || !dependencies.paymentCheckoutService) {
      throw fail('PREORDER_TEST_DISABLED', 'Тестовые покупки пока отключены.', 503);
    }
    service ||= new MiniAppPreorderService({ ...dependencies, pricingService: resolvePricingService(dependencies) });
    return service;
  };
  router.use(asyncHandler(async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    let config;
    try { config = readTestAuthConfig(); } catch { throw fail('PREORDER_TEST_AUTH_UNCONFIGURED', 'Тестовый вход ещё не настроен.', 503); }
    req.preorderCustomer = await authenticateTestBuyer(dependencies.prisma, req.body?.init_data, config);
    next();
  }));
  const topupService=()=>new (require('../../modules/club_account/MiniAppClubTopupService').MiniAppClubTopupService)({prisma:dependencies.prisma,adapter:dependencies.paymentCheckoutService?.providers?.YOOKASSA});
  let reconciling=false;
  const topupTimer=setInterval(async()=>{if(reconciling||!dependencies.paymentCheckoutService?.providers?.YOOKASSA)return;reconciling=true;try{await topupService().reconcile();}catch(error){dependencies.logger?.error('club_topup_reconciliation_failed',{code:error.code||'CLUB_TOPUP_RETRY'});}finally{reconciling=false;}},60000);topupTimer.unref();
  router.post('/club/topup',asyncHandler(async(req,res)=>sendData(res,req,await topupService().initiate(req.preorderCustomer.id))));
  router.post('/club/topup/:id/status',asyncHandler(async(req,res)=>sendData(res,req,await topupService().refresh(req.preorderCustomer.id,req.params.id))));
  router.post('/catalog', asyncHandler(async (req, res) => {
    const service = getService();
    const [catalog, account] = await Promise.all([
      dependencies.catalogService.getMachineCatalog('TEST-MACHINE-001'), service.account(req.preorderCustomer, { filter: req.body.accountFilter || 'active', page: req.body.accountPage ?? 0 }),
    ]);
    const sber = dependencies.sberQrPaymentAdapter;
    sendData(res, req, { ...catalog, account, paymentMethods: [sber?.capability('TEST-MACHINE-001') || { id:'sber_sbp', available:false }] });
  }));
  router.post('/quote', asyncHandler(async (req, res) => {
    sendData(res, req, await getService().quote(req.preorderCustomer, { ...req.body, machineId: 'TEST-MACHINE-001' }));
  }));
  router.post('/orders/recent', asyncHandler(async (req, res) => {
    sendData(res, req, await getService().recent(req.preorderCustomer));
  }));
  router.post('/orders', asyncHandler(async (req, res) => {
    sendData(res, req, await getService().create(req.preorderCustomer, req.body), 201);
  }));
  router.post('/orders/:id/payment', asyncHandler(async (req, res) => {
    sendData(res, req, await getService().pay(req.preorderCustomer, req.params.id), 201);
  }));
  router.post('/orders/:id/sber-payment', asyncHandler(async (req, res) => {
    const adapter=dependencies.sberQrPaymentAdapter;
    if(!adapter)throw fail('SBER_QR_NOT_CONFIGURED','СБП от Сбербанка пока подключается.',503);
    adapter.assertReady('TEST-MACHINE-001');
    const {order,flow}=await getService().own(req.preorderCustomer,req.params.id);
    if(order.status!=='PAYMENT_PENDING')throw fail('PREORDER_NOT_AWAITING_PAYMENT','Заказ уже не ожидает оплаты.',409);
    const result=await dependencies.paymentCheckoutService.initiate({organizationId:flow.organizationId,orderId:order.id,saleFlowId:flow.flowId,provider:'SBER_SBP',channel:'MINIAPP',method:'sbp',idempotencyKey:`miniapp-sber:${order.id}`,description:'Предзаказ «У Тимоши»',metadata:{fulfillmentMode:'PICKUP'},returnUrl:'https://miniapp.utimoshi.ru/preorder-return.html'});
    sendData(res,req,{orderId:order.id,paymentId:result.payment.id,confirmationUrl:result.confirmationUrl,status:result.status});
  }));
  router.post('/orders/:id/club-payment', asyncHandler(async (req, res) => {
    getService(); // Keep the same enabled TEST checkout boundary as card payments.
    const { MiniAppTestClubPurchaseService } = require('../../modules/club_account/MiniAppTestClubPurchaseService');
    sendData(res, req, await new MiniAppTestClubPurchaseService({ prisma: dependencies.prisma }).pay(req.preorderCustomer, req.params.id));
  }));
  router.post('/orders/:id/status', asyncHandler(async (req, res) => {
    sendData(res, req, await getService().status(req.preorderCustomer, req.params.id));
  }));
  router.post('/orders/:id/gift', asyncHandler(async (req, res) => {
    const { order } = await getService().own(req.preorderCustomer, req.params.id);
    if (order.machineId !== 'TEST-MACHINE-001') throw fail('PREORDER_TEST_MACHINE_REQUIRED', 'Доступен только тестовый аппарат.', 403);
    if (!dependencies.giftTransferRuntime) throw fail('GIFT_UNAVAILABLE', 'Сервис подарков недоступен.', 503);
    const payment = await dependencies.prisma.payment.findFirst({ where: { orderId: order.id, status: 'SUCCEEDED' } });
    if (!payment || !order.expiresAt || new Date(order.expiresAt) <= new Date()) throw fail('GIFT_ORDER_UNAVAILABLE', 'Проверьте оплату и срок получения заказа.');
    const result = await dependencies.giftTransferRuntime.createGift(req.preorderCustomer.id, order.id,
      { recipientPhone: require('../../modules/gift_transfer/GiftRecipientPhone').validateGiftRecipientPhone(req.body.recipientPhone) }, { actorId:req.preorderCustomer.id, actorType:'customer', sourceChannel:'miniapp_test', correlationId:req.requestId });
    sendData(res, req, { giftId:result.giftTransfer.id, status:result.giftTransfer.status, expiresAt:result.giftTransfer.expiresAt,
      deliveryQueued:result.deliveryQueued, invitationStatus:result.invitation.status }, 201);
  }));
  router.post('/orders/:id/pickup-code', asyncHandler(async (req, res) => {
    if (!dependencies.prepaidPickupService) throw fail('PICKUP_SERVICE_UNAVAILABLE', 'Сервис получения заказа недоступен.', 503);
    const result = await dependencies.prepaidPickupService.issueCode(req.preorderCustomer.id, req.params.id);
    sendData(res, req, { orderId: result.orderId, machineId: result.machineId, code: result.code, qrPayload: result.qrPayload, qrDataUrl: result.qrDataUrl, expiresAt: result.expiresAt, orderExpiresAt: result.orderExpiresAt, amount: result.amount, currency: result.currency });
  }));
  return router;
}
module.exports = { createMiniAppTestPreorderRouter, authenticateTestBuyer };
