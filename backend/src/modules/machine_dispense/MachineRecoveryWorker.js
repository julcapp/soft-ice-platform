class MachineRecoveryWorker {
  constructor({ repository, machineDispenseService, workerId = `machine-recovery-${process.pid}`, clock = () => new Date(), leaseMs = 60000, batchSize = 50 }) {
    Object.assign(this, { repository, machineDispenseService, workerId, clock, leaseMs, batchSize });
  }
  async runOnce() {
    const callbacks = await this.repository.claimCallbackRecoveryBatch({ workerId: this.workerId, now: this.clock(), leaseMs: this.leaseMs, limit: this.batchSize });
    const callbackResults = [];
    for (const inbox of callbacks) {
      try { callbackResults.push({ callbackId: inbox.id, ok: true, result: await this.machineDispenseService.recoverCallback(inbox, { workerId: this.workerId }) }); }
      catch (error) { callbackResults.push({ callbackId: inbox.id, ok: false, code: error.code || 'MACHINE_CALLBACK_RECOVERY_FAILED' }); }
    }
    const attempts = await this.repository.claimRecoveryBatch({ workerId: this.workerId, now: this.clock(), leaseMs: this.leaseMs, limit: this.batchSize });
    const results = [...callbackResults];
    for (const attempt of attempts) {
      try {
        let result;
        if (attempt.status === 'QUEUED') result = { attempt, action: 'WAITING_DURABLE_COMMAND_DELIVERY' };
        else if (attempt.status === 'DISPATCHING') result = await this.machineDispenseService.requireReconciliation(attempt, 'SEND_OUTCOME_UNKNOWN_AFTER_RESTART', { recovery: true });
        else result = await this.machineDispenseService.reconcileAttempt(attempt);
        results.push({ attemptId: attempt.id, ok: true, result });
      } catch (error) {
        results.push({ attemptId: attempt.id, ok: false, code: error.code || 'MACHINE_RECOVERY_FAILED' });
      } finally {
        await this.repository.releaseRecoveryClaim(attempt.id, this.workerId);
      }
    }
    return results;
  }
}
module.exports = { MachineRecoveryWorker };
