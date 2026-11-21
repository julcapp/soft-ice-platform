'use strict';
function assessCompletedOrder({ order, attempts, reservations, movements, debits, messages }) {
  const issues = [], warnings = [];
  const check = (ok, code) => { if (!ok) issues.push(code); };
  check(order.status === 'COMPLETED', 'ORDER_NOT_COMPLETED');
  check(order.payment?.status === 'SUCCEEDED', 'PAYMENT_NOT_SUCCEEDED');
  check(order.payment?.currency === order.currency && Number(order.payment?.amount) === Number(order.amount), 'PAYMENT_AMOUNT_MISMATCH');
  const successful = attempts.filter(a => a.status === 'DISPENSED');
  check(successful.length === 1, 'DISPENSE_COUNT_MISMATCH');
  const simulated = successful.some(a => String(a.providerEventId || '').startsWith('test-machine-'));
  const test = order.machineId === 'TEST-MACHINE-001' || order.payment?.metadata?.test === true || order.payment?.provider === 'TEST_CLUB_ACCOUNT';
  if (simulated) warnings.push('SIMULATED_DISPENSE_NOT_PHYSICAL_PROOF');
  const ingredients = [];
  for (const attempt of successful) {
    const reservation = reservations.find(r => r.reservationId === attempt.inventoryReservationId);
    check(Boolean(reservation), 'RESERVATION_MISSING');
    if (!reservation) continue;
    check(reservation.status === 'CONSUMED', 'RESERVATION_NOT_CONSUMED');
    check(reservation.orderId === order.id && reservation.machineId === order.machineId && reservation.organizationId === attempt.organizationId && reservation.locationId === attempt.locationId, 'RESERVATION_SCOPE_MISMATCH');
    check(reservation.items.length > 0, 'RESERVATION_ITEMS_MISSING');
    const linked = movements.filter(m => m.sourceId === reservation.reservationId);
    check(linked.length === reservation.items.length, 'MOVEMENT_COUNT_MISMATCH');
    for (const item of reservation.items) {
      const rows = linked.filter(m => m.itemId === item.inventoryItemId);
      check(item.status === 'CONSUMED' && item.consumedQuantity === item.reservedQuantity && item.reservedQuantity > 0, 'ITEM_CONSUMPTION_MISMATCH');
      check(rows.length === 1 && rows[0].quantity === item.consumedQuantity && rows[0].delta === -item.consumedQuantity && rows[0].unit === item.unit && rows[0].locationId === reservation.locationId && ['CONSUMPTION', 'TEST_CONSUMPTION'].includes(rows[0].movementType), 'MOVEMENT_MISMATCH');
      ingredients.push({ name: item.inventoryItem.name, quantity: item.consumedQuantity, unit: item.unit, movementCount: rows.length });
    }
  }
  if (order.payment?.provider === 'TEST_CLUB_ACCOUNT') check(debits.length === 1 && debits[0].paymentId === order.payment.id && debits[0].customerId === order.customerId && debits[0].test === true && debits[0].amountCents === Math.round(Number(order.amount) * 100), 'CLUB_DEBIT_MISMATCH');
  if (!messages.some(m => m.source === 'PURCHASE_COMPLETED')) warnings.push('COMPLETION_MESSAGE_NOT_FOUND');
  return { orderId: order.id, test, simulated, consistent: issues.length === 0, issues: [...new Set(issues)], warnings, amountRub: Number(order.amount), bonusEarned: order.bonusEarned, successfulDispenses: successful.length, ingredients, messages };
}
async function auditCompletedOrder(prisma, orderId) {
  if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(orderId || '')) throw new Error('Нужен UUID заказа.');
  return prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { payment: true } });
    if (!order) throw new Error('Заказ не найден.');
    const attempts = await tx.machineDispenseAttempt.findMany({ where: { orderId } });
    const reservations = await tx.inventoryRuntimeReservation.findMany({ where: { orderId }, include: { items: { include: { inventoryItem: true } } } });
    // Reservation correlation may differ from pickup correlation. Join by reservation ID.
    const movements = await tx.inventoryRuntimeMovement.findMany({ where: { sourceId: { in: reservations.map(r => r.reservationId) }, sourceType: 'CUSTOMER_SALE' } });
    const debits = await tx.$queryRawUnsafe('SELECT "paymentId","customerId","amountCents",test FROM "MiniAppTestClubDebit" WHERE "orderId"=$1', orderId);
    const messages = await tx.$queryRawUnsafe('SELECT number::text,source,subject FROM "ProjectMessage" WHERE "sourceId"=$1 OR body LIKE $2 ORDER BY number', orderId, '%' + orderId + '%');
    return assessCompletedOrder({ order, attempts, reservations, movements, debits, messages });
  }, { isolationLevel: 'RepeatableRead' });
}
module.exports = { assessCompletedOrder, auditCompletedOrder };
