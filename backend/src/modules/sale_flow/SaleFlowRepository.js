// FOUNDATION_ONLY: хранит только orchestration/recovery state и ключи дедупликации.
// Не является хранилищем заказов, платежей, склада, клиентов или лояльности.
class InMemorySaleFlowRepository {
  constructor() {
    this.flows = new Map();
    this.tokens = new Map();
    this.createRequests = new Map();
    this.paymentCallbacks = new Map();
    this.providerTransactions = new Map();
    this.effects = new Map();
  }
  saveFlow(flow) { this.flows.set(flow.orderId, flow); return flow; }
  findFlow(orderId) { return this.flows.get(orderId) || null; }
  listFlows() { return [...this.flows.values()]; }
  saveToken(token) { this.tokens.set(token.tokenId, token); return token; }
  findToken(tokenId) { return this.tokens.get(tokenId) || null; }
  rememberCreate(key, flow) { if (this.createRequests.has(key)) return { duplicate: true, flow: this.createRequests.get(key) }; this.createRequests.set(key, flow); return { duplicate: false, flow }; }
  findCreated(key) { return this.createRequests.get(key) || null; }
  rememberPayment(key, result) { if (this.paymentCallbacks.has(key)) return { duplicate: true, result: this.paymentCallbacks.get(key) }; this.paymentCallbacks.set(key, result); return { duplicate: false, result }; }
  findPayment(key) { return this.paymentCallbacks.get(key) || null; }
  rememberProviderTransaction(provider, transactionId, orderId) { const key = `${provider}:${transactionId}`; const previous = this.providerTransactions.get(key); if (previous) return { duplicate: true, orderId: previous }; this.providerTransactions.set(key, orderId); return { duplicate: false, orderId }; }
}
module.exports = { InMemorySaleFlowRepository };
