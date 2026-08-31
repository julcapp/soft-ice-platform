class GiftTransferRepository {
  constructor() { this.transfers = new Map(); this.invitations = new Map(); this.claims = new Map(); this.redemptions = new Map(); this.referrals = new Map(); this.deliveries = new Map(); this.persistenceMode = 'IN_MEMORY_TEST'; }
  saveTransfer(value) { this.transfers.set(value.id, value); return value; }
  saveInvitation(value) { this.invitations.set(value.id, value); return value; }
  saveClaim(value) { this.claims.set(value.id, value); return value; }
  saveRedemption(value) { this.redemptions.set(value.id, value); return value; }
  saveReferral(value) { this.referrals.set(value.id, value); return value; }
  saveDelivery(value) { this.deliveries.set(value.id, value); return value; }
  createGiftBundle({ transfer, invitation, referral }) { this.saveTransfer(transfer); this.saveInvitation(invitation); this.saveReferral(referral); return { transfer, invitation, referral }; }
  persistClaim({ transfer, invitation, referral, claim }) { this.saveTransfer(transfer); this.saveInvitation(invitation); if (referral) this.saveReferral(referral); this.saveClaim(claim); return transfer; }
  persistAcceptance({ transfer, referral }) { this.saveTransfer(transfer); if (referral) this.saveReferral(referral); return transfer; }
  persistRedemption({ transfer, redemption, referral = null }) { this.saveTransfer(transfer); this.saveRedemption(redemption); if (referral) this.saveReferral(referral); return transfer; }
  persistCancellation({ transfer, invitation = null }) { this.saveTransfer(transfer); if (invitation) this.saveInvitation(invitation); return transfer; }
  findById(id) { return this.transfers.get(id) || null; }
  findByOrderId(id) { return [...this.transfers.values()].find((x) => x.originalOrderId === id) || null; }
  findActiveByOrderId(id) { return [...this.transfers.values()].find((x) => x.originalOrderId === id && !['REDEEMED','EXPIRED','CANCELLED','RETURNED_TO_SENDER'].includes(x.status)) || null; }
  findInvitationByTokenHash(hash) { return [...this.invitations.values()].find((x) => x.tokenHash === hash) || null; }
  findInvitationByGiftTransferId(giftTransferId) { return [...this.invitations.values()].find((x) => x.giftTransferId === giftTransferId) || null; }
  findPendingInvitationByPhone(phone) { return [...this.invitations.values()].find((x) => x.recipientPhoneNormalized === phone && ['CREATED','SENT','OPENED'].includes(x.status)) || null; }
  findReferralByGiftTransferId(giftTransferId) { return [...this.referrals.values()].find((x) => x.giftTransferId === giftTransferId) || null; }
  findRedemptionByGiftTransferId(giftTransferId) { return [...this.redemptions.values()].filter((x) => x.giftTransferId === giftTransferId).sort((a,b) => new Date(b.issuedAt)-new Date(a.issuedAt))[0] || null; }
  findRedemptionByAuthorizationHash(authorizationHash) { return [...this.redemptions.values()].find((x) => x.authorizationHash === authorizationHash) || null; }
  listForCustomer(customerId) { return [...this.transfers.values()].filter((x) => x.senderCustomerId === customerId || x.recipientCustomerId === customerId); }
  list() { return [...this.transfers.values()]; }
  listDeliveries(notificationId) { return [...this.deliveries.values()].filter((x) => x.notificationId === notificationId); }
  listDeliveriesByCorrelationId(correlationId) { return [...this.deliveries.values()].filter((x) => x.correlationId === correlationId); }
}
module.exports = { GiftTransferRepository };
