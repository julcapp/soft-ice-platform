class PaymentInboxWorker {
  constructor({ repository, paymentService, workerId = `payment-inbox-${process.pid}`, clock = () => new Date(), batchSize = 50, leaseMs = 60000, retryDelayMs = 1000 }) {
    Object.assign(this, { repository, paymentService, workerId, clock, batchSize, leaseMs, retryDelayMs });
  }

  async runOnce() {
    const now = this.clock();
    await this.repository.releaseExpiredInbox(new Date(now.getTime() - this.leaseMs));
    const items = await this.repository.claimInbox({ workerId: this.workerId, batchSize: this.batchSize, now });
    const results = [];
    for (const item of items) {
      try { results.push({ id: item.id, ok: true, result: await this.paymentService.processInbox(item, { actorType: 'SYSTEM', actorId: this.workerId }) }); }
      catch (failure) { results.push({ id: item.id, ok: false, code: failure.code || 'PAYMENT_INBOX_PROCESSING_FAILED' }); }
    }
    return results;
  }
}

module.exports = { PaymentInboxWorker };
