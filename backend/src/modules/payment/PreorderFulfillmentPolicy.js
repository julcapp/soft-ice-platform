'use strict';
function isPickupPreorder(flow) {
  return flow?.metadata?.fulfillmentMode === 'PICKUP' && flow.metadata.sourceChannel === 'MINIAPP';
}
function pickupExpiry(flow, paidAt) {
  return isPickupPreorder(flow) ? new Date(new Date(paidAt).getTime() + 48 * 60 * 60 * 1000) : null;
}
module.exports = { isPickupPreorder, pickupExpiry };
