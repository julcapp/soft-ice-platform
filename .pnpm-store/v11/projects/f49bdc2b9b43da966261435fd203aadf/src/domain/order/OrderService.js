import { OrderRepository } from './OrderRepository.js';

export class OrderService {
  constructor(repository = new OrderRepository()) {
    this.repository = repository;
  }

  createOrder(orderDraft) {
    return this.repository.createOrder(orderDraft);
  }

  getOrderById(orderId) {
    return this.repository.getOrderById(orderId);
  }

  updateOrderStatus(orderId, status) {
    return this.repository.updateOrderStatus(orderId, status);
  }
}
