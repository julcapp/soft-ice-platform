const { ApiError } = require('../../platform/errors/ApiError');

const KEYS = Object.freeze({
  CAMERA_QR: 'camera_qr',
  STARTUP_HARDWARE_SCAN: 'startup_hardware_scan',
  HARDWARE_INVENTORY_RUNTIME: 'hardware_inventory_runtime',
});

const DEFAULT_CAMERA_QR = Object.freeze({
  enabled: true,
  source: 'BROWSER_MEDIA_DEVICE',
  purpose: 'PICKUP_QR',
  preferredFacingMode: 'environment',
  autoScan: true,
  qrFormat: 'UTP1',
  fallbackManualCode: true,
});

const DEFAULT_STARTUP_SCAN = Object.freeze({
  enabled: true,
  scanCamera: true,
  scanQrScanner: true,
  scanPos: true,
  scanMdb: true,
  scanNetwork: true,
});

class AdminMachineSettingsService {
  constructor({ prisma, auditRepository }) {
    this.prisma = prisma;
    this.auditRepository = auditRepository;
  }

  async get(machineId, context = {}) {
    this.authorize(context);
    const machine = await this.requireMachine(machineId);
    const rows = await this.prisma.machineSetting.findMany({
      where: { machineId: machine.id, key: { in: Object.values(KEYS) } },
      orderBy: { key: 'asc' },
    });
    const byKey = Object.fromEntries(rows.map((row) => [row.key, row]));
    return {
      machine: { id: machine.id, machineCode: machine.machineCode, name: machine.name },
      cameraQr: {
        ...DEFAULT_CAMERA_QR,
        ...(byKey[KEYS.CAMERA_QR]?.value || {}),
        updatedAt: byKey[KEYS.CAMERA_QR]?.updatedAt || null,
      },
      startupHardwareScan: {
        ...DEFAULT_STARTUP_SCAN,
        ...(byKey[KEYS.STARTUP_HARDWARE_SCAN]?.value || {}),
        updatedAt: byKey[KEYS.STARTUP_HARDWARE_SCAN]?.updatedAt || null,
      },
      hardwareInventory: byKey[KEYS.HARDWARE_INVENTORY_RUNTIME]?.value || null,
      hardwareInventoryUpdatedAt: byKey[KEYS.HARDWARE_INVENTORY_RUNTIME]?.updatedAt || null,
    };
  }

  async reportHardwareInventory(machineId, input = {}) {
    const machine = await this.requireMachine(machineId);
    const snapshot = validateHardwareInventory(input);
    const operator = await this.ensureEdgeOperator(machine);
    const setting = await this.prisma.machineSetting.upsert({
      where: { machineId_key: { machineId: machine.id, key: KEYS.HARDWARE_INVENTORY_RUNTIME } },
      create: { machineId: machine.id, key: KEYS.HARDWARE_INVENTORY_RUNTIME, value: snapshot, updatedById: operator.id },
      update: { value: snapshot, updatedById: operator.id },
    });
    await this.auditRepository.record({
      eventType: 'Machine.HardwareInventoryReported',
      subjectType: 'machine',
      subjectId: machine.id,
      targetType: 'Machine',
      targetId: machine.id,
      action: 'report_hardware_inventory',
      decision: 'success',
      authMethod: 'equipment_api_key',
      sourceChannel: 'machine_edge',
      correlationId: input.correlationId || snapshot.scanId,
      metadata: {
        machine_code: machine.machineCode,
        scan_id: snapshot.scanId,
        device_count: snapshot.devices.length,
        agent_version: snapshot.agentVersion,
      },
    });
    return { machineId: machine.id, machineCode: machine.machineCode, key: setting.key, value: setting.value, updatedAt: setting.updatedAt };
  }

  async update(machineId, key, value, context = {}) {
    this.authorize(context);
    if (![KEYS.CAMERA_QR, KEYS.STARTUP_HARDWARE_SCAN].includes(key)) {
      throw new ApiError({ statusCode: 400, code: 'MACHINE_SETTING_KEY_NOT_EDITABLE', message: 'Эта настройка аппарата недоступна для изменения.', source: 'admin_machine_settings' });
    }
    const machine = await this.requireMachine(machineId);
    const normalized = key === KEYS.CAMERA_QR ? validateCameraQr(value) : validateStartupScan(value);
    const operator = await this.ensureAdminOperator(context);
    const setting = await this.prisma.machineSetting.upsert({
      where: { machineId_key: { machineId: machine.id, key } },
      create: { machineId: machine.id, key, value: normalized, updatedById: operator.id },
      update: { value: normalized, updatedById: operator.id },
    });
    await this.auditRepository.record({
      eventType: 'Admin.MachineSettingUpdated',
      subjectType: 'administrator',
      subjectId: context.subjectId,
      targetType: 'Machine',
      targetId: machine.id,
      action: 'update_machine_setting',
      decision: 'success',
      authMethod: context.authMethod || 'admin_session',
      sourceChannel: 'admin_console',
      correlationId: context.correlationId,
      metadata: { machine_code: machine.machineCode, key },
    });
    return this.get(machine.id, context);
  }

  authorize(context) {
    const roles = (context.roles || []).map((role) => String(role).toUpperCase());
    if (!roles.some((role) => ['ADMIN', 'PLATFORM_OWNER', 'OWNER'].includes(role))) {
      throw new ApiError({ statusCode: 403, code: 'MACHINE_SETTINGS_FORBIDDEN', message: 'Недостаточно прав для настройки аппарата.', source: 'admin_machine_settings' });
    }
    if (!context.subjectId) {
      throw new ApiError({ statusCode: 401, code: 'ADMIN_AUTHENTICATION_REQUIRED', message: 'Требуется авторизация администратора.', source: 'admin_machine_settings' });
    }
  }

  async requireMachine(machineId) {
    const machine = await this.prisma.machine.findFirst({
      where: { OR: [{ id: machineId }, { machineCode: machineId }] },
    });
    if (!machine) throw new ApiError({ statusCode: 404, code: 'MACHINE_NOT_FOUND', message: 'Аппарат не найден.', source: 'admin_machine_settings' });
    return machine;
  }

  async ensureAdminOperator(context) {
    const externalSubject = 'admin:' + context.subjectId;
    return this.prisma.operator.upsert({
      where: { externalSubject },
      create: { displayName: 'Администратор ' + context.subjectId, externalSubject, role: 'ADMIN', status: 'ACTIVE' },
      update: { role: 'ADMIN', status: 'ACTIVE' },
    });
  }

  async ensureEdgeOperator(machine) {
    const externalSubject = 'machine-edge:' + machine.machineCode;
    return this.prisma.operator.upsert({
      where: { externalSubject },
      create: { displayName: 'Edge agent ' + machine.machineCode, externalSubject, role: 'OPERATOR', status: 'ACTIVE' },
      update: { status: 'ACTIVE' },
    });
  }
}

function validateCameraQr(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('camera_qr');
  const source = String(value.source || 'BROWSER_MEDIA_DEVICE').toUpperCase();
  if (!['BROWSER_MEDIA_DEVICE', 'ANDROID_NATIVE_CAMERA', 'USB_SCANNER'].includes(source)) invalid('camera_qr.source');
  return {
    enabled: value.enabled !== false,
    source,
    purpose: 'PICKUP_QR',
    preferredFacingMode: value.preferredFacingMode === 'user' ? 'user' : 'environment',
    autoScan: value.autoScan !== false,
    qrFormat: 'UTP1',
    fallbackManualCode: value.fallbackManualCode !== false,
  };
}

function validateStartupScan(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('startup_hardware_scan');
  return {
    enabled: value.enabled !== false,
    scanCamera: value.scanCamera !== false,
    scanQrScanner: value.scanQrScanner !== false,
    scanPos: value.scanPos !== false,
    scanMdb: value.scanMdb !== false,
    scanNetwork: value.scanNetwork !== false,
  };
}

function validateHardwareInventory(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('hardware_inventory');
  const scanId = String(value.scanId || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(scanId)) invalid('hardware_inventory.scanId');
  const capturedAt = new Date(value.capturedAt);
  if (Number.isNaN(capturedAt.getTime())) invalid('hardware_inventory.capturedAt');
  const agentVersion = cleanText(value.agentVersion, 80) || 'unknown';
  const platform = cleanText(value.platform, 120) || 'unknown';
  const devices = Array.isArray(value.devices) ? value.devices.slice(0, 100).map((device, index) => normalizeDevice(device, index)) : [];
  const capabilities = value.capabilities && typeof value.capabilities === 'object' && !Array.isArray(value.capabilities) ? safeJson(value.capabilities) : {};
  return { scanId, capturedAt: capturedAt.toISOString(), agentVersion, platform, devices, capabilities };
}

function normalizeDevice(device, index) {
  if (!device || typeof device !== 'object' || Array.isArray(device)) invalid('hardware_inventory.devices.' + index);
  const type = String(device.type || '').toUpperCase();
  if (!['CAMERA', 'QR_SCANNER', 'POS', 'MDB', 'NETWORK', 'SERIAL', 'OTHER'].includes(type)) invalid('hardware_inventory.devices.' + index + '.type');
  const status = String(device.status || 'UNKNOWN').toUpperCase();
  if (!['ONLINE', 'OFFLINE', 'DEGRADED', 'UNSUPPORTED', 'UNKNOWN'].includes(status)) invalid('hardware_inventory.devices.' + index + '.status');
  return {
    id: cleanText(device.id, 240) || type + '-' + index,
    type,
    name: cleanText(device.name, 240) || type,
    vendor: cleanText(device.vendor, 160),
    model: cleanText(device.model, 240),
    driver: cleanText(device.driver, 240),
    status,
    capabilities: device.capabilities && typeof device.capabilities === 'object' && !Array.isArray(device.capabilities) ? safeJson(device.capabilities) : {},
  };
}

function cleanText(value, max) { const text = typeof value === 'string' ? value.trim() : ''; return text ? text.slice(0, max) : null; }
function safeJson(value) { return JSON.parse(JSON.stringify(value)); }

function invalid(field) {
  throw new ApiError({ statusCode: 400, code: 'MACHINE_SETTING_INVALID', message: 'Некорректная настройка аппарата.', details: [{ field }], source: 'admin_machine_settings' });
}

module.exports = { AdminMachineSettingsService, KEYS, DEFAULT_CAMERA_QR, DEFAULT_STARTUP_SCAN };
