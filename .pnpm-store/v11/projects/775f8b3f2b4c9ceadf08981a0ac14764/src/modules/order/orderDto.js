function toOrderDto(order) {
  return {
    type: 'order',
    id: order.id,
    attributes: {
      order_id: order.id,
      customer_id: order.customerId,
      status: order.status,
      amount: Number(order.amount ?? order.amountPaidRub ?? 0),
      currency: order.currency || 'RUB',
      created_at: toIsoString(order.createdAt),
      updated_at: toIsoString(order.updatedAt || order.createdAt),
    },
  };
}

function toOrderCreationDto({ order }) {
  return toOrderDto(order);
}

function toIsoString(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date(value).toISOString();
}

module.exports = {
  toOrderCreationDto,
  toOrderDto,
};
