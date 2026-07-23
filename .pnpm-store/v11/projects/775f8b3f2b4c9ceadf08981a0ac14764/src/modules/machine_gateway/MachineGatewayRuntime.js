const crypto = require('crypto');
const { MachineGateway } = require('./MachineGateway');
const { CommandQueue } = require('./CommandQueue');

class MachineGatewayRuntime extends MachineGateway {
  constructor({ machineId = 'huaxin_default', session, commandBuilder, telemetryStore, errorMapper, domainEventPublisher, metrics, logger, clock = () => new Date(), heartbeatIntervalMs = 15000, heartbeatTimeoutMs = 45000, reconnectBaseDelayMs = 1000, reconnectMaxDelayMs = 30000, maxReconnectAttempts = 5, queueMaxSize = 100 } = {}) {
    super(); Object.assign(this, { machineId, session, commandBuilder, telemetryStore, errorMapper, domainEventPublisher, metrics, logger, clock, heartbeatIntervalMs, heartbeatTimeoutMs, reconnectBaseDelayMs, reconnectMaxDelayMs, maxReconnectAttempts });
    this.state = { connection: 'DISCONNECTED', availability: 'UNKNOWN', lastConnectedAt: null, lastDisconnectedAt: null, lastHeartbeatAt: null, reconnectAttempts: 0, lastError: null };
    this.queue = new CommandQueue({ maxSize: queueMaxSize, execute: (command) => this.execute(command), onChange: (size) => metrics?.gauge('soft_ice_machine_gateway_queue_depth', size, { machine_id: machineId }) });
    this.bindSession(); this.heartbeatTimer = null; this.reconnectTimer = null; this.stopped = false;
  }
  async start() { this.stopped = false; try { await this.connect(); } catch (error) { this.scheduleReconnect(error); } return this.getStatus(); }
  async stop() { this.stopped = true; clearInterval(this.heartbeatTimer); clearTimeout(this.reconnectTimer); this.queue.clear(); await this.session.disconnect(); }
  async connect() { this.setConnection('CONNECTING'); await this.session.connect(); this.state.reconnectAttempts = 0; this.state.lastError = null; this.startHeartbeat(); }
  async reconnect() { clearTimeout(this.reconnectTimer); try { await this.session.disconnect(); } catch (_) {} try { await this.connect(); return this.getStatus(); } catch (error) { this.scheduleReconnect(error); throw this.errorMapper.map(error); } }
  getStatus() { this.refreshFreshness(); return { machineId: this.machineId, ...this.state, queueDepth: this.queue.size, heartbeatIntervalMs: this.heartbeatIntervalMs, heartbeatTimeoutMs: this.heartbeatTimeoutMs }; }
  getTelemetry() { return { machineId: this.machineId, samples: this.telemetryStore.snapshot() }; }
  async sendCommand(request = {}) { const command = { commandId: request.commandId || `machine_command_${crypto.randomUUID()}`, type: required(request.type, 'type'), machineId: request.machineId || this.machineId, payload: request.payload || {}, issuedAt: this.clock() }; try { return await this.queue.enqueue(command); } catch (error) { throw this.errorMapper.map(error); } }
  async execute(command) { const xml = this.commandBuilder.build(command); this.metrics?.increment('soft_ice_machine_gateway_commands_total', 1, { machine_id: command.machineId, type: command.type }); const response = await this.session.send({ commandId: command.commandId, xml }); await this.publish('Machines.CommandAcknowledged', { command_id: command.commandId, command_type: command.type, status: response.status }); return { commandId: command.commandId, status: response.status, code: response.code, data: response.data || {} }; }
  bindSession() {
    this.session.on('connected', ({ at }) => { this.state.lastConnectedAt = at.toISOString(); this.state.availability = 'ONLINE'; this.setConnection('CONNECTED'); this.publish('Machines.Connected', {}); });
    this.session.on('disconnected', ({ at, reason }) => { this.state.lastDisconnectedAt = at.toISOString(); this.state.availability = 'OFFLINE'; this.setConnection('DISCONNECTED'); this.publish('Machines.Disconnected', { reason }); if (!this.stopped) this.scheduleReconnect(); });
    this.session.on('heartbeat', (message) => { this.state.lastHeartbeatAt = (message.timestamp && validDate(message.timestamp)) ? new Date(message.timestamp).toISOString() : this.clock().toISOString(); this.state.availability = ['ok', 'ready', 'online'].includes(message.status) ? 'ONLINE' : 'DEGRADED'; this.metrics?.gauge('soft_ice_machine_gateway_heartbeat_age_ms', 0, { machine_id: this.machineId }); });
    this.session.on('telemetry', (sample) => { const recorded = this.telemetryStore.record(sample); this.publish('Machines.TelemetryReceived', { recorded_at: recorded.recordedAt, values: recorded.values }); });
    this.session.on('transportError', (error) => { this.state.lastError = safeError(error); });
    this.session.on('protocolError', (error) => { this.state.lastError = safeError(error); this.publish('Machines.ProtocolErrorDetected', { code: error.code }); });
  }
  startHeartbeat() { clearInterval(this.heartbeatTimer); this.heartbeatTimer = setInterval(() => { this.sendCommand({ type: 'heartbeat' }).catch((error) => { this.state.lastError = safeError(error); this.state.availability = 'DEGRADED'; }); this.refreshFreshness(); }, this.heartbeatIntervalMs); this.heartbeatTimer.unref?.(); }
  refreshFreshness() { if (!this.state.lastHeartbeatAt) return; const age = this.clock().getTime() - new Date(this.state.lastHeartbeatAt).getTime(); this.metrics?.gauge('soft_ice_machine_gateway_heartbeat_age_ms', age, { machine_id: this.machineId }); if (age > this.heartbeatTimeoutMs && this.state.availability !== 'OFFLINE') { this.state.availability = 'STALE'; this.publish('Machines.HeartbeatMissed', { age_ms: age }); } }
  scheduleReconnect(error) { if (error) this.state.lastError = safeError(error); if (this.stopped || this.reconnectTimer || this.state.reconnectAttempts >= this.maxReconnectAttempts) return; this.state.reconnectAttempts += 1; const delay = Math.min(this.reconnectBaseDelayMs * (2 ** (this.state.reconnectAttempts - 1)), this.reconnectMaxDelayMs); this.setConnection('RECONNECTING'); this.reconnectTimer = setTimeout(async () => { this.reconnectTimer = null; try { await this.connect(); } catch (nextError) { this.scheduleReconnect(nextError); } }, delay); this.reconnectTimer.unref?.(); }
  setConnection(connection) { this.state.connection = connection; this.metrics?.gauge('soft_ice_machine_status', connection === 'CONNECTED' ? 1 : 0, { machine_id: this.machineId }); }
  async publish(canonicalName, payload) { if (!this.domainEventPublisher) return null; return this.domainEventPublisher.publish({ name: canonicalName.split('.').pop(), canonicalName, aggregateType: 'Machine', aggregateId: this.machineId, occurredAt: this.clock(), payload }); }
}
function required(value, name) { if (typeof value !== 'string' || !value.trim()) { const error = new TypeError(`${name} is required.`); error.code = 'MACHINE_COMMAND_INVALID'; throw error; } return value.trim(); }
function safeError(error) { return { code: error?.code || 'MACHINE_GATEWAY_ERROR', message: error?.message || 'Machine gateway operation failed.' }; }
function validDate(value) { return !Number.isNaN(new Date(value).getTime()); }
module.exports = { MachineGatewayRuntime };
