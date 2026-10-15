const express = require('express');
const { createAdminAuthenticator } = require('../../platform/security/authenticateAdmin');
function createPaymentWebhookRouter({ paymentService }) {
  const router = express.Router();
  router.post('/:provider', async (req, res, next) => { try {
    const received = await paymentService.receiveWebhook({ provider: String(req.params.provider).toUpperCase(), headers: req.headers, rawBody: req.rawBody, body: req.body });
    res.status(received.duplicate ? 200 : 202).json({ data: { accepted: true, duplicate: received.duplicate, inboxId: received.inbox.id } });
  } catch (error) { next(error); } });
  return router;
}
function createPaymentRouter({ paymentRepository, adminAuth = {} }) {
  const router = express.Router(); router.use(createAdminAuthenticator(adminAuth));
  const scope = (req) => { const roles = req.securityContext.roles || []; const platform = roles.includes('PLATFORM_OWNER'); const trusted = req.securityContext.organization_id || (req.securityContext.auth_method === 'development_header' ? req.get('X-Organization-Id') : null); const requested = req.query.organizationId || req.get('X-Organization-Id') || null; if (!platform && (!trusted || requested && requested !== trusted)) throw forbidden(); return { platform, organizationId: platform ? requested : trusted }; };
  router.get('/', async (req, res, next) => { try { const items = await paymentRepository.list(req.query, scope(req)); res.json({ data: items.map(present) }); } catch (error) { next(error); } });
  router.get('/:id', async (req, res, next) => { try { const tenant = scope(req); const item = tenant.organizationId ? await paymentRepository.getById(tenant.organizationId, req.params.id) : await paymentRepository.prisma.payment.findUnique({ where: { id: req.params.id }, include: { refunds: true, reconciliationItems: true } }); if (!item) return res.status(404).json({ error: { code: 'PAYMENT_NOT_FOUND', message: 'Платёж не найден.' } }); res.json({ data: present(item) }); } catch (error) { next(error); } });
  return router;
}
function present(value) { return { id: value.id, orderId: value.orderId, organizationId: value.organizationId, provider: value.provider, status: value.status, amount: String(value.amount), currency: value.currency, createdAt: value.createdAt, updatedAt: value.updatedAt, providerReference: value.providerPaymentId, reconciliationStatus: value.reconciliationItems?.some(x => ['OPEN','MANUAL_REVIEW'].includes(x.status)) ? 'ТРЕБУЕТ ПРОВЕРКИ' : 'РАСХОЖДЕНИЙ НЕТ', refunds: value.refunds || [] }; }
function forbidden(){return Object.assign(new Error('Tenant scope обязателен.'),{code:'PAYMENT_TENANT_SCOPE_REQUIRED',statusCode:403});}
module.exports = { createPaymentRouter, createPaymentWebhookRouter };
