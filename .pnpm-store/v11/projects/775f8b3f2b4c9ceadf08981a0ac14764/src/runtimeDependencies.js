const { ClubAccountRepository } = require('./modules/club_account/ClubAccountRepository');
const { ClubAccountRuntime } = require('./modules/club_account/ClubAccountRuntime');
const { CustomerRepository } = require('./modules/customer/CustomerRepository');
const { CustomerRuntime } = require('./modules/customer/CustomerRuntime');
const { CustomerIdentityProviderRegistry } = require('./modules/customer/CustomerIdentityProvider');
const { ConsentRepository } = require('./modules/consent/ConsentRepository');
const { ConsentRuntime } = require('./modules/consent/ConsentRuntime');
const { SegmentationRepository } = require('./modules/segmentation/SegmentationRepository');
const { SegmentationRuntime } = require('./modules/segmentation/SegmentationRuntime');
const { MachineRepository } = require('./modules/machine/MachineRepository');
const { MachineRuntime } = require('./modules/machine/MachineRuntime');
const { MachineService } = require('./modules/machine/MachineService');
const { MachineOperationsRepository, MachineOperationsRuntime, MachineOperationsService } = require('./modules/machine_operations');
const { MachineGatewayRuntime, MachineSession, XmlCommandBuilder, XmlResponseParser, MachineErrorMapper, TelemetryStore } = require('./modules/machine_gateway');
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
const { verifyTelegramInitData } = require('./platform/security/telegramMiniAppVerifier');

function createRuntimeDependencies({ logger, metrics, config } = {}) {
  const prisma = getPrismaClient();
  const auditRepository = new AuditRepository(prisma);
  const customerRepository = new CustomerRepository(prisma);
  const consentRepository = new ConsentRepository(prisma);
  const segmentationRepository = new SegmentationRepository(prisma);
  const clubAccountRepository = new ClubAccountRepository(prisma);
  const orderRepository = new OrderRepository(prisma);
  const machineRepository = new MachineRepository(prisma);
  const machineOperationsRepository = new MachineOperationsRepository(prisma);
  const authSessionRepository = new AuthSessionRepository(prisma);
  const idempotencyRepository = new IdempotencyRepository(prisma);
  const idempotencyService = new IdempotencyService(idempotencyRepository);
  const domainEventPublisher = new InMemoryDomainEventPublisher({ logger, metrics });
  const gatewayConfig = config?.machineGateway || {};
  const machineSession = new MachineSession({ parser: new XmlResponseParser(), commandTimeoutMs: gatewayConfig.commandTimeoutMs });
  const machineGateway = new MachineGatewayRuntime({
    machineId: gatewayConfig.machineId,
    session: machineSession,
    commandBuilder: new XmlCommandBuilder(),
    telemetryStore: new TelemetryStore({ limit: gatewayConfig.telemetryLimit }),
    errorMapper: new MachineErrorMapper(),
    domainEventPublisher,
    metrics,
    logger,
    heartbeatIntervalMs: gatewayConfig.heartbeatIntervalMs,
    heartbeatTimeoutMs: gatewayConfig.heartbeatTimeoutMs,
    reconnectBaseDelayMs: gatewayConfig.reconnectBaseDelayMs,
    reconnectMaxDelayMs: gatewayConfig.reconnectMaxDelayMs,
    maxReconnectAttempts: gatewayConfig.maxReconnectAttempts,
    queueMaxSize: gatewayConfig.queueMaxSize,
  });

  const customerRuntime = new CustomerRuntime({
    customerRepository,
    auditRepository,
    identityProviderRegistry: new CustomerIdentityProviderRegistry(),
  });
  const consentRuntime = new ConsentRuntime({ consentRepository, customerRepository, auditRepository });
  const segmentationRuntime = new SegmentationRuntime({ segmentationRepository, customerRepository, auditRepository });

  const clubAccountRuntime = new ClubAccountRuntime({
    clubAccountRepository,
    auditRepository,
  });

  const machineService = new MachineService({
    machineRepository,
    auditRepository,
    domainEventPublisher,
  });

  const machineRuntime = new MachineRuntime({
    machineService,
  });
  const machineOperationsRuntime = new MachineOperationsRuntime({
    service: new MachineOperationsService({ repository: machineOperationsRepository, auditRepository }),
  });

  const orderService = new OrderService({
    orderRepository,
    auditRepository,
    domainEventPublisher,
    clubAccountService: clubAccountRuntime,
    machineRuntime,
    machineOperationsRuntime,
    machineGateway,
  });

  const orderRuntime = new OrderRuntime({
    orderService,
  });

  const authCoreService = new AuthCoreService({
    authSessionRepository,
    customerRuntime,
    consentRuntime,
    segmentationRuntime,
    clubAccountRuntime,
    auditRepository,
    idempotencyService,
    metrics,
    accessTokenTtlSeconds: config?.auth.accessTokenTtlSeconds,
    telegramVerifier: config ? (initData) => verifyTelegramInitData(initData, {
      botToken: config.auth.telegramBotToken,
      maxAgeSeconds: config.auth.telegramInitDataMaxAgeSeconds,
    }) : undefined,
  });

  return {
    authCoreService,
    customerRuntime,
    consentRuntime,
    clubAccountRuntime,
    machineRuntime,
    orderRuntime,
    domainEventPublisher,
  };
}

module.exports = {
  createRuntimeDependencies,
};
