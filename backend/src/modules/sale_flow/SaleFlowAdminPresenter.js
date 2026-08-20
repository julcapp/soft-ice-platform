function presentSaleFlow(flow, events = []) {
  const states = { CREATED: 'Создан', AWAITING_PAYMENT: 'Ожидает оплату', PAID: 'Оплачен', FULFILLMENT_AUTHORIZED: 'Выдача разрешена', DISPENSING: 'Идёт выдача', COMPLETED: 'Завершён', PAYMENT_FAILED: 'Ошибка оплаты', CANCELLED: 'Отменён', EXPIRED: 'Истёк', FULFILLMENT_FAILED: 'Ошибка выдачи', REFUND_REQUIRED: 'Требуется возврат' };
  const recovery = { NONE: 'Не требуется', SAFE_TO_RESUME: 'Можно безопасно продолжить', NEEDS_RECONCILIATION: 'Требуется сверка', RECOVERING: 'Восстановление', RECOVERED: 'Восстановлен', MANUAL_REVIEW_REQUIRED: 'Требуется ручная проверка' };
  return {
    mode: flow.metadata?.mode === 'SIMULATOR' ? 'Тестовый режим' : 'Рабочий режим',
    persistence: flow.persistenceMode === 'IN_MEMORY_TEST' ? 'Тестовое хранилище' : 'Состояние сохранено',
    fields: {
      'Идентификатор процесса': flow.flowId,
      'Заказ': flow.orderId,
      'Клиент': flow.customerId,
      'Аппарат': flow.machineId,
      'Точка': flow.locationId,
      'Организация': flow.organizationId,
      'Состояние процесса': states[flow.currentState || flow.flowState] || flow.currentState,
      'Статус восстановления': recovery[flow.recoveryStatus] || flow.recoveryStatus,
      'Версия': flow.version,
      'Последнее изменение': flow.updatedAt,
      'Последняя ошибка': flow.lastErrorCode || null,
      'Требуется сверка': flow.recoveryStatus === 'NEEDS_RECONCILIATION' ? 'Да' : 'Нет',
      'Ссылка на платёж': flow.paymentReference || null,
      'Ссылка на резерв': flow.inventoryReservationReference,
      'Дата и время': flow.startedAt,
      'Correlation ID': flow.correlationId,
    },
    eventTimeline: events.filter((event) => event.correlationId === flow.correlationId).map((event) => ({ eventType: event.eventType, occurredAt: event.occurredAt, source: event.sourceChannel })),
  };
}
module.exports = { presentSaleFlow };
