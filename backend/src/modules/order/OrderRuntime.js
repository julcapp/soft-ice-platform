class OrderRuntime {
  constructor({ orderService }) {
    this.orderService = orderService;
  }

  async createOrder(customerId, request, context) {
    return this.orderService.createOrder(customerId, request, context);
  }

  async getOwnOrder(customerId, orderId) {
    return this.orderService.getOwnOrder(customerId, orderId);
  }

  async listOwnOrders(customerId, options) {
    return this.orderService.listOwnOrders(customerId, options);
  }

  async confirmPayment(orderId, context) {
    return this.orderService.confirmPayment(orderId, context);
  }

  async cancelOrder(orderId, context) {
    return this.orderService.cancelOrder(orderId, context);
  }
}

module.exports = {
  OrderRuntime,
};
