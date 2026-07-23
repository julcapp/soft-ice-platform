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

const MACHINE_DOMAIN_EVENTS = Object.freeze({
  MACHINE_DISPENSE_REQUESTED: {
    name: 'MachineDispenseRequested',
    canonicalName: 'Machines.DispenseRequested',
    version: 1,
    category: 'domain',
  },
  DISPENSE_STARTED: {
    name: 'DispenseStarted',
    canonicalName: 'Machines.DispenseStarted',
    version: 1,
    category: 'domain',
  },
  DISPENSE_COMPLETED: {
    name: 'DispenseCompleted',
    canonicalName: 'Machines.DispenseCompleted',
    version: 1,
    category: 'domain',
  },
  DISPENSE_FAILED: {
    name: 'DispenseFailed',
    canonicalName: 'Machines.DispenseFailed',
    version: 1,
    category: 'domain',
  },
});

module.exports = {
  MACHINE_DOMAIN_EVENTS,
  ORDER_DOMAIN_EVENTS,
};
