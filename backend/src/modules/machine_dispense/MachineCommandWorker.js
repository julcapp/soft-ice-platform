const { OutboxWorker } = require('../transactional_outbox');

class MachineCommandPublisher {
  constructor({ machineDispenseService }) { this.machineDispenseService = machineDispenseService; }
  async publish(event) {
    if (event.eventType !== 'MACHINE_COMMAND_QUEUED') return null;
    return this.machineDispenseService.deliverCommand(event);
  }
}

class MachineCommandWorker extends OutboxWorker {
  constructor({ machineDispenseService, ...options }) {
    super({ ...options, publisher: new MachineCommandPublisher({ machineDispenseService }) });
  }
  runOnce(options = {}) { return super.runOnce({ ...options, eventTypes: ['MACHINE_COMMAND_QUEUED'] }); }
}

module.exports = { MachineCommandPublisher, MachineCommandWorker };
