const { sameMoney } = require('./PaymentModels');
class ReconciliationService {
  constructor({ repository, providers, paymentService }) { Object.assign(this, { repository, providers, paymentService }); }
  async reconcilePayment(organizationId, paymentId) {
    const payment = await this.repository.getById(organizationId, paymentId);
    if (!payment) throw Object.assign(new Error('Платёж не найден.'), { code: 'PAYMENT_NOT_FOUND', statusCode: 404 });
    const provider = this.providers[payment.provider];
    if (!provider || !payment.providerPaymentId) return this.mismatch(payment, 'UNKNOWN_PROVIDER_PAYMENT');
    const remote = await provider.getPaymentStatus(payment.providerPaymentId);
    if (!remote) return this.mismatch(payment, 'UNKNOWN_PROVIDER_PAYMENT');
    let category = null;
    if (!sameMoney(payment.amount, remote.amount) || payment.currency !== remote.currency) category = 'AMOUNT_MISMATCH';
    else if (['CREATED', 'PENDING', 'AUTHORIZED'].includes(payment.status) && remote.status === 'SUCCEEDED') category = 'LOCAL_PENDING_PROVIDER_SUCCEEDED';
    else if (payment.status === 'SUCCEEDED' && ['FAILED', 'CANCELED'].includes(remote.status)) category = 'LOCAL_SUCCEEDED_PROVIDER_FAILED';
    else if (payment.status === 'REFUND_PENDING' && remote.refundStatus && remote.refundStatus !== 'PENDING') category = 'REFUND_STATE_MISMATCH';
    return category ? this.mismatch(payment, category, remote) : { matched: true, category: null };
  }
  async recordDuplicateProviderEvent(payment, providerEventId) { return this.mismatch(payment, 'DUPLICATE_PROVIDER_EVENT', { providerEventId }); }
  async mismatch(payment, category, remote = {}) { const item = await this.paymentService.recordMismatch(payment, category, remote); return { matched: false, category, item }; }
}
module.exports = { ReconciliationService };
