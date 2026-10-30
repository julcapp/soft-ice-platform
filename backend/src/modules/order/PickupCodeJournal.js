const { randomUUID } = require('node:crypto');

async function savePickupCodeIssue({ prisma, customerId, order, codeHash, codeExpiresAt, orderExpiresAt, now }) {
  const issuanceId = randomUUID();
  return prisma.$transaction(async tx => {
    await tx.$queryRawUnsafe('SELECT 1 AS locked FROM "Order" WHERE "id"=$1 FOR UPDATE', order.id);
    const current = await tx.order.findFirst({ where: { id: order.id, customerId, status: 'PAID', paymentStatus: 'paid' } });
    const paid = current && await tx.payment.findFirst({ where: { orderId: order.id, customerId, status: 'SUCCEEDED', channel: { in: ['MINIAPP', 'WEB'] } } });
    const flow = current && await tx.saleFlow.findFirst({ where: { orderId: order.id, currentState: 'PAID' } });
    if (!current || !paid || !flow || orderExpiresAt <= now) throw Object.assign(new Error('Заказ недоступен для получения.'), { code: 'PICKUP_ORDER_NOT_AVAILABLE', statusCode: 409 });
    const reissued = Boolean(current.activePickupCodeHash);
    await tx.order.update({ where: { id: order.id }, data: { activePickupCodeHash: codeHash, expiresAt: orderExpiresAt } });
    const title = reissued ? 'Код получения перевыпущен' : 'Код получения создан';
    await tx.customerTimelineEvent.create({ data: {
      customerId, eventType: reissued ? 'PICKUP_CODE_REISSUED' : 'PICKUP_CODE_ISSUED', category: 'ORDER', title,
      description: 'Код доступен в Mini App. Значение кода скрыто.', sourceDomain: 'prepaid_pickup',
      sourceEntityType: 'PickupCodeIssue', sourceEntityId: issuanceId, correlationId: order.id, occurredAt: now,
      metadata: { orderId: order.id, machineId: order.machineId, expiresAt: codeExpiresAt.toISOString(), previousCodeInvalidated: reissued },
    } });
    const messageId = randomUUID(), deliveryId = randomUUID();
    const body = `${title}. Заказ ${order.id}. Код скрыт. Действует до ${codeExpiresAt.toISOString()}.`;
    await tx.$executeRawUnsafe('INSERT INTO "ProjectMessage" ("id","source","sourceId","recipientType","recipientId","subject","body","sender","correlationId","redacted","createdAt") VALUES ($1,\'MINIAPP_PICKUP\',$2,\'CUSTOMER\',$3,$4,$5,\'Сервер\',$6,TRUE,$7)', messageId, issuanceId, customerId, title, body, order.id, now);
    // AVAILABLE records server-side availability, not proof that the client rendered it.
    await tx.$executeRawUnsafe('INSERT INTO "ProjectMessageDelivery" ("id","messageId","channel","status","createdAt","updatedAt") VALUES ($1,$2,\'MINIAPP\',\'AVAILABLE\',$3,$3)', deliveryId, messageId, now);
    await tx.$executeRawUnsafe('INSERT INTO "ProjectMessageDeliveryHistory" ("deliveryId","status","occurredAt") VALUES ($1,\'AVAILABLE\',$2)', deliveryId, now);
    return { issuanceId, messageId };
  });
}

module.exports = { savePickupCodeIssue };
