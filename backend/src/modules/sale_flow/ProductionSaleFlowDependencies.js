const path = require('node:path');
const { pathToFileURL } = require('node:url');

class PostgresOrganizationContext {
  constructor({ organizationRepository, prisma }) { this.organizationRepository = organizationRepository; this.prisma = prisma; this.implementationKind = 'PRODUCTION'; }
  async resolveByMachine(machineId) {
    const assignment = await this.organizationRepository.findActiveMachineAssignment(machineId);
    if (!assignment?.organizationId || !assignment.locationId) return null;
    const inventoryLocation = await this.prisma.inventoryRuntimeLocation.findFirst({ where: { machineId, locationType: 'MACHINE', active: true }, orderBy: { id: 'asc' } });
    if (!inventoryLocation) return null;
    return { organizationId: assignment.organizationId, organizationLocationId: assignment.locationId, locationId: inventoryLocation.id };
  }
}

class PostgresOrderDomain {
  constructor({ orderRuntime, paymentAdapter }) { this.orderRuntime = orderRuntime; this.paymentAdapter = paymentAdapter; this.implementationKind = 'PRODUCTION'; }
  async create(input, context = {}) {
    const result = await this.forTransaction(context.transactionClient).createOrder(input.customerId, { amount: input.totalAmount, currency: input.currency, machineId: input.machineId }, context);
    return { ...result.order, orderId: result.order.id };
  }
  async getPaymentDetails(orderId) {
    const order = await this.orderRuntime.orderService.orderRepository.findById(orderId);
    if (!order) throw unavailable('ORDER_NOT_FOUND', 'Заказ не найден.');
    return { amount: Number(order.amount), currency: order.currency };
  }
  confirmPayment(orderId, context) { return this.orderRuntime.confirmPayment(orderId, context); }
  rejectPayment(orderId, context) { return this.orderRuntime.cancelOrder(orderId, context); }
  requireRefund(orderId, request) { return this.paymentAdapter.refund({ orderId, ...request }); }
  getFulfillmentDetails() { return {}; }
  complete(orderId, context = {}) {
    const prisma = context.transactionClient || this.orderRuntime.orderService.orderRepository.prisma;
    return prisma.order.update({ where: { id: orderId }, data: { status: 'COMPLETED' } });
  }
  forTransaction(prisma) {
    if (!prisma) return this.orderRuntime;
    const service = this.orderRuntime.orderService;
    const { OrderRuntime } = require('../order/OrderRuntime');
    const { OrderService } = require('../order/OrderService');
    const { OrderRepository } = require('../order/OrderRepository');
    return new OrderRuntime({ orderService: new OrderService({ orderRepository: new OrderRepository(prisma), auditRepository: null, domainEventPublisher: null, clubAccountService: null, machineRuntime: null, clock: service.clock }) });
  }
}

class BlockedExternalPaymentAdapter {
  constructor() { this.implementationKind = 'PRODUCTION'; this.integrationStatus = 'BLOCKED_EXTERNAL'; }
  pay() { throw unavailable('PAYMENT_ADAPTER_BLOCKED_EXTERNAL', 'Production Payment provider не подключён.'); }
  refund() { throw unavailable('PAYMENT_REFUND_BLOCKED_EXTERNAL', 'Production Payment refund provider не подключён.'); }
}

class BlockedExternalMachineAdapter {
  constructor() { this.implementationKind = 'PRODUCTION'; this.integrationStatus = 'BLOCKED_EXTERNAL'; }
  dispense() { throw unavailable('MACHINE_ADAPTER_BLOCKED_EXTERNAL', 'Production Machine provider не подключён.'); }
}

class ProductEnginePriceCalculator {
  constructor({ modulePath = path.resolve(__dirname, '../../../../frontend/miniapp/src/domain/pricing/index.js') } = {}) {
    this.modulePath = modulePath; this.implementationKind = 'PRODUCTION'; this.modulePromise = null;
  }
  async calculate({ product, configuration, recipe, quantity = 1 }) {
    if (!product || !configuration || !recipe) throw unavailable('PRICE_INPUT_INCOMPLETE', 'Для серверного расчёта нужны Product, Configuration и Recipe.');
    if (!this.modulePromise) this.modulePromise = import(pathToFileURL(this.modulePath).href);
    const { pricingService } = await this.modulePromise;
    const value = pricingService.calculatePrice(product, configuration, recipe);
    return { totalAmount: value.finalPrice * quantity, currency: value.currency, unitPrice: value.finalPrice };
  }
}

function createProductionSaleFlowService({ SaleFlowService, repository, organizationContext, orderDomain, priceCalculator, paymentAdapter, machineAdapter, inventory, metrics }) {
  for (const [name, dependency] of Object.entries({ repository, organizationContext, orderDomain, priceCalculator, paymentAdapter, machineAdapter, inventory })) {
    if (!dependency || dependency.implementationKind !== 'PRODUCTION') throw unavailable('SALE_FLOW_PRODUCTION_COMPOSITION_INCOMPLETE', `Production Sale Flow: dependency ${name} отсутствует или не является production implementation.`);
  }
  inventory.priceCalculator = (request) => priceCalculator.calculate(request);
  return new SaleFlowService({ repository, organizationContext, orderDomain, priceCalculator, paymentAdapter, machineAdapter, inventory, metrics });
}

function unavailable(code, message) { return Object.assign(new Error(message), { code, statusCode: 503 }); }
module.exports = { PostgresOrganizationContext, PostgresOrderDomain, ProductEnginePriceCalculator, BlockedExternalPaymentAdapter, BlockedExternalMachineAdapter, createProductionSaleFlowService };
