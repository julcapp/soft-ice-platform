const ORDER_DOMAIN_EVENTS = Object.freeze({
  ORDER_CREATED: {
    name: 'OrderCreated',
    canonicalName: 'Orders.Created',
    version: 1,
    category: 'domain',
  },
  ORDER_PAID: {
    name: 'OrderPaid',
    canonicalName: 'Orders.PaymentConfirmed',
    version: 1,
    category: 'domain',
  },
  ORDER_CANCELLED: {
    name: 'OrderCancelled',
    canonicalName: 'Orders.Cancelled',
    version: 1,
    category: 'domain',
  },
});

module.exports = {
  ORDER_DOMAIN_EVENTS,
};
