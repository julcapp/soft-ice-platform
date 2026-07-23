const { EventEmitter } = require('events');
const { withCode } = require('./CommandQueue');

class MachineSession extends EventEmitter {
  constructor({ transport, parser, clock = () => new Date(), commandTimeoutMs = 5000 } = {}) {
    super(); this.transport = transport || new UnconfiguredTransport(); this.parser = parser; this.clock = clock; this.commandTimeoutMs = commandTimeoutMs; this.connected = false; this.pending = new Map(); this.bound = false;
  }
  async connect() { this.bindTransport(); await this.transport.connect(); this.connected = true; this.emit('connected', { at: this.clock() }); }
  async disconnect() { this.connected = false; this.rejectPending(withCode('Machine connection closed.', 'MACHINE_CONNECTION_UNAVAILABLE')); await this.transport.close?.(); this.emit('disconnected', { at: this.clock(), reason: 'requested' }); }
  async send({ commandId, xml }) {
    if (!this.connected) throw withCode('Machine is not connected.', 'MACHINE_CONNECTION_UNAVAILABLE');
    const pending = new Promise((resolve, reject) => { const timer = setTimeout(() => { this.pending.delete(commandId); reject(withCode('Machine command timed out.', 'MACHINE_COMMAND_TIMEOUT')); }, this.commandTimeoutMs); timer.unref?.(); this.pending.set(commandId, { resolve, reject, timer }); });
    try { const immediate = await this.transport.send(xml); if (typeof immediate === 'string') this.receive(immediate); } catch (error) { const entry = this.pending.get(commandId); if (entry) { clearTimeout(entry.timer); this.pending.delete(commandId); entry.reject(error); } }
    return pending;
  }
  receive(xml) {
    let parsed; try { parsed = this.parser.parse(xml); } catch (error) { this.emit('protocolError', error); return; }
    this.emit(parsed.kind, parsed);
    if (parsed.kind === 'response' && parsed.commandId && this.pending.has(parsed.commandId)) { const entry = this.pending.get(parsed.commandId); clearTimeout(entry.timer); this.pending.delete(parsed.commandId); if (['ok', 'accepted', 'success'].includes(parsed.status)) entry.resolve(parsed); else entry.reject(Object.assign(new Error(parsed.message || 'Machine rejected command.'), { code: 'MACHINE_COMMAND_REJECTED', machineCode: parsed.code })); }
  }
  bindTransport() { if (this.bound || !this.transport.on) return; this.bound = true; this.transport.on('data', (data) => this.receive(String(data))); this.transport.on('close', () => { this.connected = false; this.rejectPending(withCode('Machine connection closed.', 'MACHINE_CONNECTION_UNAVAILABLE')); this.emit('disconnected', { at: this.clock(), reason: 'transport_closed' }); }); this.transport.on('error', (error) => this.emit('transportError', error)); }
  rejectPending(error) { for (const entry of this.pending.values()) { clearTimeout(entry.timer); entry.reject(error); } this.pending.clear(); }
}

class UnconfiguredTransport extends EventEmitter { async connect() { throw withCode('Huaxin transport is not configured.', 'MACHINE_CONNECTION_UNAVAILABLE'); } async send() { throw withCode('Huaxin transport is not configured.', 'MACHINE_CONNECTION_UNAVAILABLE'); } async close() {} }
module.exports = { MachineSession, UnconfiguredTransport };
