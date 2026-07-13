const { ClubAccountRepository } = require('./modules/club_account/ClubAccountRepository');
const { ClubAccountRuntime } = require('./modules/club_account/ClubAccountRuntime');
const { CustomerRepository } = require('./modules/customer/CustomerRepository');
const { CustomerRuntime } = require('./modules/customer/CustomerRuntime');
const { OrderRepository } = require('./modules/order/OrderRepository');
const { OrderRuntime } = require('./modules/order/OrderRuntime');
const { OrderService } = require('./modules/order/OrderService');
const { AuditRepository } = require('./platform/audit/AuditRepository');
const { getPrismaClient } = require('./common/database');
const { InMemoryDomainEventPublisher } = require('./platform/events/DomainEventPublisher');
const { IdempotencyRepository } = require('./platform/idempotency/IdempotencyRepository');
const { IdempotencyService } = require('./platform/idempotency/IdempotencyService');
const { AuthCoreService } = require('./platform/security/AuthCoreService');
const { AuthSessionRepository } = require('./platform/security/AuthSessionRepository');

function createRuntimeDependencies() {
  const prisma = getPrismaClient();
  const auditRepository = new AuditRepository(prisma);
  const customerRepository = new CustomerRepository(prisma);
  const clubAccountRepository = new ClubAccountRepository(prisma);
  const orderRepository = new OrderRepository(prisma);
  const authSessionRepository = new AuthSessionRepository(prisma);
  const idempotencyRepository = new IdempotencyRepository(prisma);
  const idempotencyService = new IdempotencyService(idempotencyRepository);
  const domainEventPublisher = new InMemoryDomainEventPublisher();

  const customerRuntime = new CustomerRuntime({
    customerRepository,
    auditRepository,
  });

  const clubAccountRuntime = new ClubAccountRuntime({
    clubAccountRepository,
    auditRepository,
  });

  const orderService = new OrderService({
    orderRepository,
    auditRepository,
    domainEventPublisher,
    clubAccountService: clubAccountRuntime,
  });

  const orderRuntime = new OrderRuntime({
    orderService,
  });

  const authCoreService = new AuthCoreService({
    authSessionRepository,
    customerRuntime,
    clubAccountRuntime,
    auditRepository,
    idempotencyService,
  });

  return {
    authCoreService,
    customerRuntime,
    clubAccountRuntime,
    orderRuntime,
    domainEventPublisher,
  };
}

module.exports = {
  createRuntimeDependencies,
};
