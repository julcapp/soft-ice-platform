import { PaymentRepository } from './PaymentRepository.js';

export class PaymentService {
  constructor(repository = new PaymentRepository()) {
    this.repository = repository;
  }

  createPayment(paymentDraft) {
    return this.repository.createPayment(paymentDraft);
  }

  getPaymentById(paymentId) {
    return this.repository.getPaymentById(paymentId);
  }

  updatePaymentStatus(paymentId, status) {
    return this.repository.updatePaymentStatus(paymentId, status);
  }
}
