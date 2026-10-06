const { YooKassaPaymentAdapter } = require('./YooKassaPaymentAdapter');
const { YooKassaPaymentProviderAdapter } = require('./YooKassaPaymentProviderAdapter');
const { PaymentCheckoutService } = require('./PaymentCheckoutService');
const { PaymentAttemptRepository } = require('./PaymentAttemptRepository');
const { PaymentOrchestrator } = require('./PaymentOrchestrator');

const { PaymentRepository } = require('./PaymentRepository');
const { PaymentService } = require('./PaymentService');
const { ReconciliationService } = require('./ReconciliationService');
const { PaymentInboxWorker } = require('./PaymentInboxWorker');
const adapters = require('./PaymentProviderAdapter');
const models = require('./PaymentModels');
module.exports = { name: 'payment', status: 'implemented', owns: ['authoritative payment lifecycle', 'provider inbox', 'refund lifecycle', 'payment reconciliation', 'payment intent boundary', 'provider references', 'yookassa and sbp payment orchestration', 'verified payment webhooks'], PaymentRepository, PaymentService, PaymentCheckoutService, ReconciliationService, PaymentInboxWorker, YooKassaPaymentAdapter, YooKassaPaymentProviderAdapter, PaymentAttemptRepository, PaymentOrchestrator, ...adapters, ...models };

