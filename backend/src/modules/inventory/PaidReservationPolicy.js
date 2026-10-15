async function paidReservationProtection(tx, reservation, target, context = {}) {
  if (reservation.operationType !== 'CUSTOMER_SALE' || !reservation.orderId || !reservation.saleFlowId || !tx.payment?.findFirst) return false;
  const payment = await tx.payment.findFirst({ where: { organizationId: reservation.organizationId, orderId: reservation.orderId, saleFlowId: reservation.saleFlowId, status: 'SUCCEEDED' }, select: { id: true } });
  if (!payment) return false;
  if (target === 'EXPIRED') return true;
  if (target !== 'CONSUMED' || !context.transactionClient || !tx.machineDispenseAttempt?.findFirst) return false;
  const prefix = 'machine-consume:';
  if (!context.idempotencyKey?.startsWith(prefix)) return false;
  const attempt = await tx.machineDispenseAttempt.findFirst({ where: { organizationId: reservation.organizationId, orderId: reservation.orderId, saleFlowId: reservation.saleFlowId, machineId: reservation.machineId, inventoryReservationId: reservation.reservationId, commandId: context.idempotencyKey.slice(prefix.length), status: 'DISPENSED' }, select: { id: true } });
  return Boolean(attempt);
}
module.exports = { paidReservationProtection };
