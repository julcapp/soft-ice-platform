function classifyTerminalAttempt(attempt) {
  if (!attempt) return 'WAITING';
  if (['RECONCILIATION_REQUIRED','TIMED_OUT','FAILED','CANCELED','DISPENSED'].includes(attempt.status)) return 'ATTENTION_REQUIRED';
  if (['ACCEPTED','DISPENSING'].includes(attempt.status) && (attempt.acceptedAt || attempt.startedAt)) return 'PREPARING';
  if (['AUTHORIZED','QUEUED','DISPATCHING','SENT'].includes(attempt.status)) return 'TRANSMITTING';
  return 'WAITING';
}
module.exports = { classifyTerminalAttempt };
