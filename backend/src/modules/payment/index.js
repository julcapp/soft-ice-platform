const { YooKassaPaymentAdapter } = require('./YooKassaPaymentAdapter');
const { PaymentRepository } = require('./PaymentRepository');
const { PaymentOrchestrator } = require('./PaymentOrchestrator');

module.exports = {
  name: 'payment',
  status: 'runtime-v1',
  owns: [
    'payment intent boundary',
    'provider references',
    'YooKassa and SBP payment orchestration',
    'verified payment webhooks',
  ],
  YooKassaPaymentAdapter,
  PaymentRepository,
  PaymentOrchestrator,
};
