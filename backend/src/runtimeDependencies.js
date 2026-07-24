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
const { AdminDashboardService, DemoAdminDashboardProvider } = require('./modules/admin_dashboard');
const { MachineTwinProjectionService, MachineTwinRepository, createDemoMachineTwinSources } = require('./modules/machine_digital_twin');
const { EventBus, EventHandlerRegistry, InMemoryEventStore, InMemoryOutbox, InMemoryDeadLetterStore } = require('./platform/events');
const { InMemoryMachineRuntimeRepository, MachineRuntimePolicy, MachineRuntimeEventMapper, MachineRuntimeService, MachineRuntimeProjectionAdapter } = require('./modules/machine_runtime');
const { InventoryRuntime, InventoryService, InventoryEventSubscriber, InMemoryInventoryRepository } = require('./modules/inventory');
const { MaintenanceRuntime, MaintenanceService, InMemoryMaintenanceRepository, MaintenanceProjection } = require('./modules/maintenance');

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
  const platformEventStore = new InMemoryEventStore();
  const platformEventOutbox = new InMemoryOutbox();
  const deadLetterStore = new InMemoryDeadLetterStore();
  const platformEventRegistry = new EventHandlerRegistry();
  const platformEventBus = new EventBus({ registry: platformEventRegistry, eventStore: platformEventStore, outbox: platformEventOutbox, deadLetterStore, maxDeliveryAttempts: 3, logger });
  const inventoryRepository = new InMemoryInventoryRepository();
  const inventoryRuntime = new InventoryRuntime({ service: new InventoryService({
    repository: inventoryRepository, auditRepository, eventPublisher: platformEventBus,
  }) });
  const inventorySubscriber = new InventoryEventSubscriber({ runtime: inventoryRuntime });
  for (const eventType of ['CUP_DISPENSE_COMPLETED', 'PRODUCT_DISPENSE_COMPLETED', 'TOPPING_DISPENSE_COMPLETED', 'MachineOperations.InventoryConsumed']) {
    platformEventRegistry.register(eventType, inventorySubscriber.subscriber());
  }
  const machineRuntimeRepository = new InMemoryMachineRuntimeRepository();
  const machineRuntimeProjectionAdapter = new MachineRuntimeProjectionAdapter();
  platformEventRegistry.register('*', machineRuntimeProjectionAdapter.subscriber());
  const machineRuntimeService = new MachineRuntimeService({ repository: machineRuntimeRepository, policy: new MachineRuntimePolicy(), eventPublisher: platformEventBus, eventMapper: new MachineRuntimeEventMapper() });
  const maintenanceRepository = new InMemoryMaintenanceRepository();
  const maintenanceProjection = new MaintenanceProjection();
  platformEventRegistry.register('*', maintenanceProjection.subscriber());
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
  for (const machine of [
    { machineId: 'machine_demo_1', machineCode: 'SI-TOM-001', qrCode: 'softice:machine:machine_demo_1:SI-TOM-001' },
    { machineId: 'machine_demo_2', machineCode: 'SI-TOM-002', qrCode: 'softice:machine:machine_demo_2:SI-TOM-002' },
  ]) maintenanceRepository.registerMachine(machine);
  const maintenanceRuntime = new MaintenanceRuntime({ service: new MaintenanceService({
    repository: maintenanceRepository, eventPublisher: platformEventBus, inventoryRuntime,
    machineRuntimeService, machineTwinService: null, projection: maintenanceProjection,
  }) });
  const adminDashboardService = new AdminDashboardService({
    provider: new DemoAdminDashboardProvider(),
  });
  const machineTwinRepository = new MachineTwinRepository();
  const machineTwinDataMode = config?.environment === 'production' ? 'LIVE' : 'DEMO';
  const machineTwinService = new MachineTwinProjectionService({
    sources: machineTwinDataMode === 'DEMO' ? createDemoMachineTwinSources() : {},
    repository: machineTwinRepository,
    dataMode: machineTwinDataMode,
  });
  const previousOperationsSource = machineTwinService.sources.machineOperations;
  machineTwinService.sources.machineOperations = {
    status: previousOperationsSource?.status || 'AVAILABLE',
    label: 'Maintenance Runtime projection',
    getSummary: async (machineId) => {
      const [existing, maintenance] = await Promise.all([
        previousOperationsSource?.getSummary?.(machineId) || null,
        maintenanceProjection.getSummary(machineId),
      ]);
      return {
        ...(existing || {}), ...maintenance,
        assignedOperator: existing?.assignedOperator || maintenance.openServiceTasks[0]?.operatorId || null,
        openServiceTasks: [...(existing?.openServiceTasks || []), ...maintenance.openServiceTasks],
        recentTestRuns: [...(maintenance.recentTestRuns || []), ...(existing?.recentTestRuns || [])],
      };
    },
  };

  return {
    adminDashboardService,
    machineTwinService,
    machineRuntimeService,
    inventoryRuntime,
    maintenanceRuntime,
    platformEventBus,
    platformEventStore,
    deadLetterStore,
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
