class GiftTransferRepository {
  constructor() { this.transfers = new Map(); this.invitations = new Map(); this.claims = new Map(); this.redemptions = new Map(); this.referrals = new Map(); this.deliveries = new Map(); }
  saveTransfer(value) { this.transfers.set(value.id, value); return value; }
  saveInvitation(value) { this.invitations.set(value.id, value); return value; }
  saveClaim(value) { this.claims.set(value.id, value); return value; }
  saveRedemption(value) { this.redemptions.set(value.id, value); return value; }
  saveReferral(value) { this.referrals.set(value.id, value); return value; }
  saveDelivery(value) { this.deliveries.set(value.id, value); return value; }
  findById(id) { return this.transfers.get(id) || null; }
  findByOrderId(orderId) { return [...this.transfers.values()].find((x) => x.originalOrderId === orderId) || null; }
  findActiveByOrderId(orderId) { return [...this.transfers.values()].find((x) => x.originalOrderId === orderId && !['REDEEMED','EXPIRED','CANCELLED','RETURNED_TO_SENDER'].includes(x.status)) || null; }
  findInvitationByTokenHash(hash) { return [...this.invitations.values()].find((x) => x.tokenHash === hash) || null; }
  findPendingInvitationByPhone(phone) { return [...this.invitations.values()].find((x) => x.recipientPhoneNormalized === phone && ['CREATED','SENT','OPENED'].includes(x.status)) || null; }
  listForCustomer(customerId) { return [...this.transfers.values()].filter((x) => x.senderCustomerId === customerId || x.recipientCustomerId === customerId); }
  list() { return [...this.transfers.values()]; }
  listDeliveries(notificationId) { return [...this.deliveries.values()].filter((x) => x.notificationId === notificationId); }
}
module.exports = { GiftTransferRepository };
