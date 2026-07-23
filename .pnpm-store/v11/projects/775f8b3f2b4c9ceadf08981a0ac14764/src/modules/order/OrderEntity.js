const ORDER_STATUS = Object.freeze({
  CREATED: 'CREATED',
  PAYMENT_PENDING: 'PAYMENT_PENDING',
  PAID: 'PAID',
  DISPENSING: 'DISPENSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
});

const ORDER_STATUSES = Object.freeze(Object.values(ORDER_STATUS));

class OrderEntity {
  constructor({ id, customerId, status, amount, currency, createdAt, updatedAt }) {
    this.id = id;
    this.customerId = customerId;
    this.status = status;
    this.amount = amount;
    this.currency = currency;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  canConfirmPayment() {
    return [ORDER_STATUS.CREATED, ORDER_STATUS.PAYMENT_PENDING].includes(this.status);
  }

  isTerminal() {
    return [ORDER_STATUS.COMPLETED, ORDER_STATUS.FAILED, ORDER_STATUS.CANCELLED].includes(
      this.status,
    );
  }
}

function toOrderEntity(order) {
  if (!order) {
    return null;
  }

  return new OrderEntity({
    id: order.id,
    customerId: order.customerId,
    status: order.status || ORDER_STATUS.CREATED,
    amount: Number(order.amount ?? order.amountPaidRub ?? 0),
    currency: order.currency || 'RUB',
    createdAt: order.createdAt,
    updatedAt: order.updatedAt || order.createdAt,
  });
}

module.exports = {
  ORDER_STATUS,
  ORDER_STATUSES,
  OrderEntity,
  toOrderEntity,
};
