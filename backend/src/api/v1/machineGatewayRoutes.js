const express = require('express');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');
const { createCustomerAuthenticator } = require('../../platform/security/authenticateCustomer');

function createMachineGatewayRouter({ authCoreService, machineGateway }) {
  const router = express.Router();
  const authenticate = createCustomerAuthenticator(authCoreService);
  router.use(authenticate);
  router.get('/status', asyncHandler(async (req, res) => sendData(res, req, toStatusDto(await machineGateway.getStatus()))));
  router.get('/telemetry', asyncHandler(async (req, res) => sendData(res, req, toTelemetryDto(await machineGateway.getTelemetry()))));
  router.post('/command', asyncHandler(async (req, res) => {
    const result = await machineGateway.sendCommand({ commandId: req.body?.command_id, machineId: req.body?.machine_id, type: req.body?.type, payload: req.body?.payload });
    sendData(res, req, { type: 'machine_command', id: result.commandId, attributes: { status: result.status, code: result.code || null, data: result.data } }, 202);
  }));
  router.post('/reconnect', asyncHandler(async (req, res) => sendData(res, req, toStatusDto(await machineGateway.reconnect()), 202)));
  return router;
}
function toStatusDto(status) { return { type: 'machine_gateway_status', id: status.machineId, attributes: snake(status) }; }
function toTelemetryDto(telemetry) { return { type: 'machine_telemetry', id: telemetry.machineId, attributes: { samples: telemetry.samples.map((sample) => ({ machine_id: sample.machineId, recorded_at: sample.recordedAt, received_at: sample.receivedAt, values: sample.values })) } }; }
function snake(status) { return { connection: status.connection, availability: status.availability, last_connected_at: status.lastConnectedAt, last_disconnected_at: status.lastDisconnectedAt, last_heartbeat_at: status.lastHeartbeatAt, reconnect_attempts: status.reconnectAttempts, queue_depth: status.queueDepth, heartbeat_interval_ms: status.heartbeatIntervalMs, heartbeat_timeout_ms: status.heartbeatTimeoutMs, last_error: status.lastError }; }
module.exports = { createMachineGatewayRouter };
