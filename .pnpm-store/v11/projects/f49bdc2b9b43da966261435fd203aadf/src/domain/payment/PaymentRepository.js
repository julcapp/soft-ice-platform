import { NotImplementedError } from '../../shared/errors/index.js';

export class PaymentRepository {
  async createPayment(paymentDraft) {
    throw new NotImplementedError();
  }

  async getPaymentById(paymentId) {
    throw new NotImplementedError();
  }

  async updatePaymentStatus(paymentId, status) {
    throw new NotImplementedError();
  }
}
