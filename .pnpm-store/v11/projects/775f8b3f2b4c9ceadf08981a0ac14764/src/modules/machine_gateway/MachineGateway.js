class MachineGateway {
  async getStatus() { throw new Error('MachineGateway.getStatus must be implemented.'); }
  async getTelemetry() { throw new Error('MachineGateway.getTelemetry must be implemented.'); }
  async sendCommand() { throw new Error('MachineGateway.sendCommand must be implemented.'); }
  async reconnect() { throw new Error('MachineGateway.reconnect must be implemented.'); }
}

module.exports = { MachineGateway };
