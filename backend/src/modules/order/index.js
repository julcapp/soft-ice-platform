const { ORDER_STATUS, ORDER_STATUSES, OrderEntity } = require('./OrderEntity');
const { OrderRepository } = require('./OrderRepository');
const { OrderRuntime } = require('./OrderRuntime');
const { OrderService } = require('./OrderService');
const { QuotedOrderService } = require('./QuotedOrderService');

module.exports = {
  name: 'order',
  status: 'runtime',
  owns: ['purchase lifecycle boundary', 'order payment state', 'order domain events', 'pricing quote order binding'],
  ORDER_STATUS,
  ORDER_STATUSES,
  OrderEntity,
  OrderRepository,
  OrderRuntime,
  OrderService,
  QuotedOrderService,
};
