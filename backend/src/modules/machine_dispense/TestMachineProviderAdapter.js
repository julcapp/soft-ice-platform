'use strict';

class TestMachineProviderAdapter {
  constructor({ allowedMachineIds = ['TEST-MACHINE-001'], acceptDelayMs = 1800, dispensingDelayMs = 4800, completeDelayMs = 8500 } = {}) {
    this.allowedMachineIds = new Set(allowedMachineIds);
    this.acceptDelayMs = acceptDelayMs;
    this.dispensingDelayMs = dispensingDelayMs;
    this.completeDelayMs = completeDelayMs;
    this.machineDispenseService = null;
    this.timers = new Set();
  }

  attachMachineDispenseService(service) {
    this.machineDispenseService = service;
  }

  async sendDispenseCommand({ commandId, machineId }) {
    if (!this.allowedMachineIds.has(machineId)) throw blocked();
    if (!this.machineDispenseService) throw blocked('TEST_MACHINE_SIMULATOR_NOT_ATTACHED');

    this.schedule(commandId, machineId, 'ACCEPTED', this.acceptDelayMs, 'test-machine-accepted');
    this.schedule(commandId, machineId, 'DISPENSING', this.dispensingDelayMs, 'test-machine-dispensing');
    this.schedule(commandId, machineId, 'DISPENSED', this.completeDelayMs, 'test-machine-dispensed');

    return { providerCommandId: commandId };
  }

  async healthCheck() {
    return { status: 'UP', mode: 'TEST_SIMULATOR' };
  }

  async reconcileCommand({ commandId, machineId }) {
    if (!this.allowedMachineIds.has(machineId)) throw blocked();
    const attempt = await this.machineDispenseService?.repository?.getByCommand('HUAXIN', commandId);
    if (!attempt) return { status: 'NOT_DISPENSED' };
    if (attempt.status === 'DISPENSED') return { status: 'DISPENSED', providerEventId: `test-reconcile-${commandId}` };
    if (attempt.status === 'FAILED') return { status: 'FAILED', failureCode: attempt.failureCode || 'TEST_MACHINE_FAILED' };
    return { status: 'UNKNOWN' };
  }

  async verifyCallback() {
    return true;
  }

  schedule(commandId, machineId, status, delayMs, prefix) {
    const timer = setTimeout(async () => {
      this.timers.delete(timer);
      try {
        const attempt = await this.machineDispenseService.repository.getByCommand('HUAXIN', commandId);
        if (!attempt || attempt.machineId !== machineId) return;
        await this.machineDispenseService.applyPhysicalResult(attempt, status, { providerEventId: `${prefix}-${commandId}`, physicalConsumptionUnknown: false });
      } catch {
        // The authoritative state machine remains the source of truth; failed test callbacks are intentionally not retried here.
      }
    }, delayMs);
    timer.unref?.();
    this.timers.add(timer);
  }
}

function blocked(code = 'MACHINE_PROVIDER_BLOCKED_EXTERNAL') {
  return Object.assign(new Error('Test machine provider is not available for this machine.'), { code, statusCode: 503 });
}

module.exports = { TestMachineProviderAdapter };
