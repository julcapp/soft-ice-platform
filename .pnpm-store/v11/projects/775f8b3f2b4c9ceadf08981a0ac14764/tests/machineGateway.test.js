const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');
const express = require('express');
const { createMachineGatewayRouter } = require('../src/api/v1/machineGatewayRoutes');
const { sendError } = require('../src/platform/http/apiResponse');
const { CommandQueue, MachineErrorMapper, MachineGateway, MachineGatewayRuntime, MachineSession, TelemetryStore, XmlCommandBuilder, XmlResponseParser } = require('../src/modules/machine_gateway');
const { InMemoryDomainEventPublisher } = require('../src/platform/events/DomainEventPublisher');

test('XML command builder escapes data and parser normalizes response, heartbeat, and telemetry', () => {
  const builder = new XmlCommandBuilder();
  const parser = new XmlResponseParser();
  const xml = builder.build({ commandId: 'cmd_1', type: 'dispense', machineId: 'hx_1', payload: { order_id: 'order<&1', portions: 2 }, issuedAt: new Date('2026-07-21T00:00:00Z') });
  assert.match(xml, /order&lt;&amp;1/);
  assert.deepEqual(parser.parse('<huaxin><response command_id="cmd_1" status="OK"><temperature>-18.5</temperature></response></huaxin>'), { kind: 'response', commandId: 'cmd_1', status: 'ok', code: null, message: null, data: { temperature: -18.5 } });
  assert.equal(parser.parse('<huaxin><heartbeat machine_id="hx_1" status="ready" timestamp="2026-07-21T00:00:00Z"/></huaxin>').kind, 'heartbeat');
  assert.deepEqual(parser.parse('<huaxin><telemetry machine_id="hx_1"><temperature>-19</temperature><door_open>false</door_open></telemetry></huaxin>').values, { temperature: -19, door_open: false });
  assert.throws(() => parser.parse('<!DOCTYPE x [<!ENTITY y SYSTEM "file:///x">]><response/>'), { code: 'MACHINE_PROTOCOL_INVALID_RESPONSE' });
});

test('command queue serializes work and rejects overflow', async () => {
  const releases = []; const order = [];
  const queue = new CommandQueue({ maxSize: 2, execute: ({ id }) => new Promise((resolve) => { order.push(id); releases.push(resolve); }) });
  const first = queue.enqueue({ id: 1 }); const second = queue.enqueue({ id: 2 });
  await assert.rejects(queue.enqueue({ id: 3 }), { code: 'MACHINE_QUEUE_FULL' });
  releases.shift()('one'); await first; await new Promise(setImmediate); assert.deepEqual(order, [1, 2]); releases.shift()('two'); assert.equal(await second, 'two');
});

test('machine session correlates acknowledgements and reports rejection', async () => {
  const parser = new XmlResponseParser(); const transport = new FakeTransport(); const session = new MachineSession({ transport, parser, commandTimeoutMs: 100 });
  await session.connect();
  transport.reply = '<response command_id="cmd_ok" status="accepted"><result>queued</result></response>';
  assert.equal((await session.send({ commandId: 'cmd_ok', xml: '<x/>' })).status, 'accepted');
  transport.reply = '<response command_id="cmd_bad" status="rejected" code="E12"><message>blocked</message></response>';
  await assert.rejects(session.send({ commandId: 'cmd_bad', xml: '<x/>' }), { code: 'MACHINE_COMMAND_REJECTED' });
});

test('gateway tracks lifecycle, commands, heartbeat freshness, telemetry, and events', async () => {
  let now = new Date('2026-07-21T00:00:00Z'); const clock = () => new Date(now); const transport = new FakeTransport(); const parser = new XmlResponseParser();
  const publisher = new InMemoryDomainEventPublisher({ clock });
  const runtime = new MachineGatewayRuntime({ machineId: 'hx_1', session: new MachineSession({ transport, parser, clock, commandTimeoutMs: 100 }), commandBuilder: new XmlCommandBuilder(), telemetryStore: new TelemetryStore({ clock }), errorMapper: new MachineErrorMapper(), domainEventPublisher: publisher, clock, heartbeatIntervalMs: 60000, heartbeatTimeoutMs: 30000, reconnectBaseDelayMs: 1 });
  assert.ok(runtime instanceof MachineGateway);
  await runtime.start(); assert.equal(runtime.getStatus().connection, 'CONNECTED');
  transport.reply = '<response command_id="cmd_1" status="ok"><position>1</position></response>';
  assert.deepEqual(await runtime.sendCommand({ commandId: 'cmd_1', type: 'dispense', payload: { position: 1 } }), { commandId: 'cmd_1', status: 'ok', code: null, data: { position: 1 } });
  transport.emit('data', '<heartbeat machine_id="hx_1" status="ready" timestamp="2026-07-21T00:00:00Z"/>');
  transport.emit('data', '<telemetry machine_id="hx_1" timestamp="2026-07-21T00:00:01Z"><temperature>-18</temperature></telemetry>');
  assert.equal(runtime.getTelemetry().samples[0].values.temperature, -18);
  now = new Date('2026-07-21T00:01:00Z'); assert.equal(runtime.getStatus().availability, 'STALE');
  assert.ok(publisher.getPublishedEvents().some(({ canonicalName }) => canonicalName === 'Machines.CommandAcknowledged'));
  await runtime.stop();
});

test('gateway maps disconnected transport and manual reconnect restores status', async () => {
  const transport = new FakeTransport(); transport.connectError = Object.assign(new Error('down'), { code: 'MACHINE_CONNECTION_UNAVAILABLE' });
  const runtime = makeRuntime(transport);
  await assert.rejects(runtime.reconnect(), (error) => error.statusCode === 503 && error.retryable);
  transport.connectError = null; await runtime.reconnect(); assert.equal(runtime.getStatus().availability, 'ONLINE'); await runtime.stop();
});

test('machine gateway API exposes status, telemetry, command, reconnect and requires authentication', async (t) => {
  const calls = [];
  const machineGateway = {
    async getStatus() { return statusFixture(); },
    async getTelemetry() { return { machineId: 'hx_1', samples: [{ machineId: 'hx_1', recordedAt: '2026-07-21T00:00:00Z', receivedAt: '2026-07-21T00:00:01Z', values: { temperature: -18 } }] }; },
    async sendCommand(command) { calls.push(command); return { commandId: command.commandId, status: 'accepted', data: {} }; },
    async reconnect() { calls.push('reconnect'); return statusFixture(); },
  };
  const app = express(); app.use(express.json()); app.use('/api/v1/machine', createMachineGatewayRouter({ authCoreService: { authenticateAccessToken: async () => ({ subject_id: 'customer_1' }) }, machineGateway })); app.use((error, req, res, next) => sendError(res, req, error));
  const server = await new Promise((resolve) => { const value = app.listen(0, '127.0.0.1', () => resolve(value)); }); t.after(() => server.close()); const base = `http://127.0.0.1:${server.address().port}/api/v1/machine`;
  assert.equal((await fetch(`${base}/status`)).status, 401);
  const headers = { Authorization: 'Bearer test', 'Content-Type': 'application/json' };
  assert.equal((await fetch(`${base}/status`, { headers })).status, 200);
  assert.equal((await fetch(`${base}/telemetry`, { headers })).status, 200);
  assert.equal((await fetch(`${base}/command`, { method: 'POST', headers, body: JSON.stringify({ command_id: 'cmd_api', type: 'dispense', payload: { position: 1 } }) })).status, 202);
  assert.equal((await fetch(`${base}/reconnect`, { method: 'POST', headers })).status, 202);
  assert.equal(calls[0].type, 'dispense'); assert.equal(calls[1], 'reconnect');
});

class FakeTransport extends EventEmitter {
  async connect() { if (this.connectError) throw this.connectError; }
  async send() { const response = this.reply; this.reply = null; return response; }
  async close() {}
}
function makeRuntime(transport) { const parser = new XmlResponseParser(); return new MachineGatewayRuntime({ session: new MachineSession({ transport, parser, commandTimeoutMs: 20 }), commandBuilder: new XmlCommandBuilder(), telemetryStore: new TelemetryStore(), errorMapper: new MachineErrorMapper(), reconnectBaseDelayMs: 10000 }); }
function statusFixture() { return { machineId: 'hx_1', connection: 'CONNECTED', availability: 'ONLINE', lastConnectedAt: null, lastDisconnectedAt: null, lastHeartbeatAt: null, reconnectAttempts: 0, queueDepth: 0, heartbeatIntervalMs: 15000, heartbeatTimeoutMs: 45000, lastError: null }; }
