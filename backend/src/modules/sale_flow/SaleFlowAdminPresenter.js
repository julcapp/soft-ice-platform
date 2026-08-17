function presentSaleFlow(flow, events = []) {
  return {
    mode: 'Тестовый режим',
    fields: {
      'Заказ': flow.orderId,
      'Клиент': flow.customerId,
      'Аппарат': flow.machineId,
      'Точка': flow.locationId,
      'Организация': flow.organizationId,
      'Состояние процесса': flow.flowState,
      'Ссылка на платёж': flow.paymentId || null,
      'Ссылка на резерв': flow.reservationId,
      'Дата и время': flow.createdAt,
      'Correlation ID': flow.correlationId,
    },
    eventTimeline: events.filter((event) => event.correlationId === flow.correlationId).map((event) => ({ eventType: event.eventType, occurredAt: event.occurredAt, source: event.sourceChannel })),
  };
}
module.exports = { presentSaleFlow };
