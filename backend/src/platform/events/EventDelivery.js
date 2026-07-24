const EventDeliveryStatus = Object.freeze({
  PENDING: 'PENDING', DELIVERED: 'DELIVERED', FAILED: 'FAILED',
  DEAD_LETTERED: 'DEAD_LETTERED', DUPLICATE_SKIPPED: 'DUPLICATE_SKIPPED',
});
class EventDelivery {
  constructor(value) { Object.assign(this, value); Object.freeze(this); }
}
module.exports = { EventDelivery, EventDeliveryStatus };
