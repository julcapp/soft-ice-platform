class MobileCarrierAdapter {
  async getSimStatus() { throw new Error('BLOCKED_EXTERNAL'); }
  async getBalance() { throw new Error('BLOCKED_EXTERNAL'); }
  async getTariff() { throw new Error('BLOCKED_EXTERNAL'); }
  async getTrafficRemaining() { throw new Error('BLOCKED_EXTERNAL'); }
  async getNextChargeDate() { throw new Error('BLOCKED_EXTERNAL'); }
  async verifyPhoneNumber() { throw new Error('BLOCKED_EXTERNAL'); }
}
class ManualMobileCarrierAdapter extends MobileCarrierAdapter { constructor(repository) { super(); this.repository = repository; } }
class MockMobileCarrierAdapter extends MobileCarrierAdapter {
  constructor(data = {}) { super(); this.data = data; }
  getSimStatus(id) { return this.data[id]?.status || 'UNKNOWN'; }
  getBalance(id) { return this.data[id]?.currentBalance ?? null; }
  getTariff(id) { return this.data[id]?.tariff || null; }
  getTrafficRemaining(id) { return this.data[id]?.trafficRemainingMb ?? null; }
  getNextChargeDate(id) { return this.data[id]?.nextChargeAt || null; }
  verifyPhoneNumber(id) { return Boolean(this.data[id]?.phoneVerified); }
}
const BLOCKED_EXTERNAL_CARRIERS = Object.freeze(['МТС', 'МегаФон', 'Билайн', 'Tele2/T2']);
module.exports = { MobileCarrierAdapter, ManualMobileCarrierAdapter, MockMobileCarrierAdapter, BLOCKED_EXTERNAL_CARRIERS };
