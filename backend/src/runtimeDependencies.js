const { ClubAccountRepository } = require('./modules/club_account/ClubAccountRepository');
const { ClubAccountRuntime } = require('./modules/club_account/ClubAccountRuntime');
const { CustomerRepository } = require('./modules/customer/CustomerRepository');
const { CustomerRuntime } = require('./modules/customer/CustomerRuntime');
const { AuditRepository } = require('./platform/audit/AuditRepository');
const { getPrismaClient } = require('./common/database');
const { IdempotencyRepository } = require('./platform/idempotency/IdempotencyRepository');
const { IdempotencyService } = require('./platform/idempotency/IdempotencyService');
const { AuthCoreService } = require('./platform/security/AuthCoreService');
const { AuthSessionRepository } = require('./platform/security/AuthSessionRepository');

function createRuntimeDependencies() {
  const prisma = getPrismaClient();
  const auditRepository = new AuditRepository(prisma);
  const customerRepository = new CustomerRepository(prisma);
  const clubAccountRepository = new ClubAccountRepository(prisma);
  const authSessionRepository = new AuthSessionRepository(prisma);
  const idempotencyRepository = new IdempotencyRepository(prisma);
  const idempotencyService = new IdempotencyService(idempotencyRepository);

  const customerRuntime = new CustomerRuntime({
    customerRepository,
    auditRepository,
  });

  const clubAccountRuntime = new ClubAccountRuntime({
    clubAccountRepository,
    auditRepository,
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
  };
}

module.exports = {
  createRuntimeDependencies,
};
