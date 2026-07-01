import { NotImplementedError } from '../../shared/errors/index.js';

export class OrderRepository {
  async createOrder(orderDraft) {
    throw new NotImplementedError();
  }

  async getOrderById(orderId) {
    throw new NotImplementedError();
  }

  async updateOrderStatus(orderId, status) {
    throw new NotImplementedError();
  }
}
