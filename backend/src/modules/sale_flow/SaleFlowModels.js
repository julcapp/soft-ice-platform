const FLOW_STATE = Object.freeze({
  STARTED: 'STARTED',
  WAITING_FOR_PAYMENT: 'WAITING_FOR_PAYMENT',
  PAYMENT_CONFIRMED: 'PAYMENT_CONFIRMED',
  FULFILLMENT_AUTHORIZED: 'FULFILLMENT_AUTHORIZED',
  DISPENSING: 'DISPENSING',
  COMPLETED: 'COMPLETED',
  STOPPED: 'STOPPED',
  REFUND_REQUIRED: 'REFUND_REQUIRED',
});

const TRANSITIONS = Object.freeze({
  STARTED: ['WAITING_FOR_PAYMENT', 'STOPPED'],
  WAITING_FOR_PAYMENT: ['PAYMENT_CONFIRMED', 'STOPPED'],
  PAYMENT_CONFIRMED: ['FULFILLMENT_AUTHORIZED', 'REFUND_REQUIRED'],
  FULFILLMENT_AUTHORIZED: ['DISPENSING', 'REFUND_REQUIRED'],
  DISPENSING: ['COMPLETED', 'REFUND_REQUIRED'],
});

function transition(flow, next, at = new Date()) {
  if (flow.flowState === next) return flow;
  if (!(TRANSITIONS[flow.flowState] || []).includes(next)) {
    throw Object.assign(new Error(`Недопустимый переход процесса: ${flow.flowState} -> ${next}.`), { code: 'SALE_FLOW_TRANSITION_INVALID', statusCode: 409 });
  }
  flow.flowState = next;
  flow.updatedAt = at;
  flow.timestamps[next] = at;
  return flow;
}

module.exports = { FLOW_STATE, TRANSITIONS, transition };
