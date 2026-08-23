const { PaymentRepository } = require('./PaymentRepository');
const { PaymentService } = require('./PaymentService');
const { ReconciliationService } = require('./ReconciliationService');
const { PaymentInboxWorker } = require('./PaymentInboxWorker');
const adapters = require('./PaymentProviderAdapter');
const models = require('./PaymentModels');
module.exports = { name: 'payment', status: 'implemented', owns: ['authoritative payment lifecycle', 'provider inbox', 'refund lifecycle', 'payment reconciliation'], PaymentRepository, PaymentService, ReconciliationService, PaymentInboxWorker, ...adapters, ...models };
