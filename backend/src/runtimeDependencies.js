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
const { InMemoryOperatorWorkspaceRepository, OperatorWorkspaceService, OperatorWorkspaceRuntime } = require('./modules/operator_workspace');
const { CRMRepository, CRMService, CRMRuntime } = require('./modules/crm');
const { Customer360Repository, Customer360Service, Customer360Runtime, ExternalChannelRepository, ExternalChannelService } = require('./modules/customer_360');
const { MachineConnectivityRepository, MachineConnectivityService } = require('./modules/machine_connectivity');
const { VideoSurveillanceRepository, VideoSurveillanceService, VideoSurveillanceRuntime, MockRtspCameraAdapter, InMemoryVideoRecorderAdapter, LocalMetadataVideoStorageAdapter, VideoCamera, MotionSensor, VideoRecordingPolicy } = require('./modules/video_surveillance');
const { EventCenterRepository, EventCenterRuntime, EventCenterService, EventIngestionService, EventQueryService, EventNormalizationService, EventRetentionService, DefaultEventPayloadSanitizer, BasicEventSchemaValidator, InMemoryEventRecordPublisher, EventMetricsAdapter, ExistingEventBusSubscriber, createEventTypeRegistry } = require('./modules/event_center');
const { GiftTransferRepository, GiftTransferService, GiftTransferRuntime, NotificationOrchestrator, TelegramNotificationAdapter, MaxNotificationAdapter } = require('./modules/gift_transfer');

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
  const eventCenterRepository = new EventCenterRepository();
  const eventTypeRegistry = createEventTypeRegistry();
  const eventCenterMetrics = new EventMetricsAdapter();
  const eventNormalizationService = new EventNormalizationService({ registry: eventTypeRegistry, sanitizer: new DefaultEventPayloadSanitizer() });
  const eventIngestionService = new EventIngestionService({ repository: eventCenterRepository, normalization: eventNormalizationService, validator: new BasicEventSchemaValidator(), publisher: new InMemoryEventRecordPublisher(), metrics: eventCenterMetrics });
  const eventCenterService = new EventCenterService({ repository: eventCenterRepository, query: new EventQueryService(eventCenterRepository), ingestion: eventIngestionService, retention: new EventRetentionService({ repository: eventCenterRepository, auditRepository }), registry: eventTypeRegistry, auditRepository });
  const eventCenterRuntime = new EventCenterRuntime({ service: eventCenterService });
  platformEventRegistry.register('*', new ExistingEventBusSubscriber(eventIngestionService).subscriber());
  const inventoryRepository = new InMemoryInventoryRepository();
  for (const item of [
    { id: 'cup_200_ml', sku: 'cup_200_ml', name: 'Стаканчик 200 мл', category: 'CONSUMABLE', baseUnit: 'piece', metadata: {} },
    { id: 'mix_vanilla', sku: 'mix_vanilla', name: 'Смесь ванильная', category: 'INGREDIENT', baseUnit: 'gram', metadata: {} },
    { id: 'syrup_test', sku: 'syrup_test', name: 'Сироп для тестовых проливов', category: 'INGREDIENT', baseUnit: 'milliliter', metadata: {} },
  ]) inventoryRepository.createItem(item);
  for (const machineId of ['machine_demo_1', 'machine_demo_2']) {
    const locationId = `location_${machineId}`;
    inventoryRepository.createLocation({ id: locationId, code: locationId, name: `Остатки автомата ${machineId}`, locationType: 'MACHINE', machineId, warehouseId: null, metadata: {} });
    for (const itemId of ['cup_200_ml', 'mix_vanilla', 'syrup_test']) {
      inventoryRepository.appendMovement({ itemId, locationId, movementType: 'RECEIPT', quantity: 10000, delta: 10000, unit: 'base', reason: 'Демонстрационный начальный остаток', sourceType: 'DEMO_SEED', sourceId: machineId, actorType: 'SYSTEM', actorId: 'runtime-bootstrap', correlationId: 'runtime-bootstrap', idempotencyKey: `seed:${machineId}:${itemId}`, occurredAt: new Date(), metadata: { demo: true } });
    }
  }
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
  const giftTransferRepository = new GiftTransferRepository();
  const notificationOrchestrator = new NotificationOrchestrator({ repository: giftTransferRepository, adapters: [new TelegramNotificationAdapter(), new MaxNotificationAdapter()] });
  const giftTransferRuntime = new GiftTransferRuntime({ service: new GiftTransferService({ repository: giftTransferRepository, orderRepository, customerRepository, clubAccountRuntime, notificationOrchestrator, eventPublisher: platformEventBus, auditRepository }) });
  const crmRuntime = new CRMRuntime({ service: new CRMService({
    repository: new CRMRepository(prisma),
    clubAccountRuntime,
    segmentationRuntime,
    auditRepository,
    eventPublisher: platformEventBus,
  }) });
  const customer360Runtime = new Customer360Runtime({ service: new Customer360Service({
    repository: new Customer360Repository(prisma),
    eventPublisher: platformEventBus,
  }) });
  const externalChannelService = new ExternalChannelService({
    repository: new ExternalChannelRepository(), customerRepository: new Customer360Repository(prisma), eventPublisher: platformEventBus,
  });
  const machineConnectivityService = new MachineConnectivityService({
    repository: new MachineConnectivityRepository(), eventPublisher: platformEventBus,
  });
  const videoRepository = new VideoSurveillanceRepository();
  const videoService = new VideoSurveillanceService({
    repository: videoRepository, cameraAdapter: new MockRtspCameraAdapter(),
    recorderAdapter: new InMemoryVideoRecorderAdapter(), storageAdapter: new LocalMetadataVideoStorageAdapter(),
    eventPublisher: platformEventBus,
  });
  const videoSurveillanceRuntime = new VideoSurveillanceRuntime({ service: videoService });
  platformEventRegistry.register('*', videoService.subscriber());
  const demoCamera = videoRepository.saveCamera(new VideoCamera({ id: 'camera_demo_1', machineId: 'machine_demo_1', name: 'Камера зоны выдачи', model: 'Soft ICE Edge Camera v1', locationDescription: 'Над окном выдачи', rtspUrlSecretRef: 'secret://video/machine_demo_1/camera_demo_1', status: 'ONLINE', recordingMode: 'HYBRID', codec: 'H.264', resolution: '1920x1080', frameRate: 15, localStorageEnabled: true, localStorageCapacity: 128849018880, retentionHours: 72, preBufferSeconds: 10, postBufferSeconds: 20, source: 'DEMO' }));
  videoRepository.saveSensor(new MotionSensor({ id: 'sensor_demo_pir_1', machineId: demoCamera.machineId, cameraId: demoCamera.id, sensorType: 'PIR', status: 'ONLINE', sensitivity: 0.7, source: 'DEMO' }));
  videoRepository.saveSensor(new MotionSensor({ id: 'sensor_demo_analytics_1', machineId: demoCamera.machineId, cameraId: demoCamera.id, sensorType: 'CAMERA_ANALYTICS', status: 'ONLINE', sensitivity: 0.6, source: 'DEMO' }));
  videoRepository.savePolicy(new VideoRecordingPolicy({ cameraId: demoCamera.id, preBufferSeconds: 10, postBufferSeconds: 20, maximumRecordingSeconds: 300, zones: [{ zoneId: 'dispense_area', name: 'Зона выдачи', polygon: [[0.2,0.2],[0.8,0.2],[0.8,0.9],[0.2,0.9]], sensitivity: 0.6, triggerRecording: true }] }));
  for (const machine of [
    { machineId: 'machine_demo_1', machineCode: 'SI-TOM-001', qrCode: 'softice:machine:machine_demo_1:SI-TOM-001' },
    { machineId: 'machine_demo_2', machineCode: 'SI-TOM-002', qrCode: 'softice:machine:machine_demo_2:SI-TOM-002' },
  ]) maintenanceRepository.registerMachine(machine);
  const maintenanceRuntime = new MaintenanceRuntime({ service: new MaintenanceService({
    repository: maintenanceRepository, eventPublisher: platformEventBus, inventoryRuntime,
    machineRuntimeService, machineTwinService: null, projection: maintenanceProjection,
  }) });
  const operatorWorkspaceRepository = new InMemoryOperatorWorkspaceRepository();
  const operatorWorkspaceRuntime = new OperatorWorkspaceRuntime({ service: new OperatorWorkspaceService({
    repository: operatorWorkspaceRepository, eventPublisher: platformEventBus, inventoryRuntime,
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
      const workspace = operatorWorkspaceRuntime.getTwinSummary(machineId);
      return {
        ...(existing || {}), ...maintenance, ...workspace,
        assignedOperator: workspace.assignedOperator || existing?.assignedOperator || maintenance.openServiceTasks[0]?.operatorId || null,
        openServiceTasks: [...(workspace.openServiceTasks || []), ...(existing?.openServiceTasks || []), ...maintenance.openServiceTasks],
        recentTestRuns: [...(workspace.recentTestRuns || []), ...(maintenance.recentTestRuns || []), ...(existing?.recentTestRuns || [])],
      };
    },
  };

  return {
    adminDashboardService,
    machineTwinService,
    machineRuntimeService,
    inventoryRuntime,
    maintenanceRuntime,
    operatorWorkspaceRuntime,
    crmRuntime,
    customer360Runtime,
    externalChannelService,
    machineConnectivityService,
    videoSurveillanceRuntime,
    eventCenterRuntime,
    platformEventBus,
    platformEventStore,
    deadLetterStore,
    authCoreService,
    customerRuntime,
    consentRuntime,
    clubAccountRuntime,
    machineRuntime,
    orderRuntime,
    giftTransferRuntime,
    domainEventPublisher,
  };
}

module.exports = {
  createRuntimeDependencies,
};
