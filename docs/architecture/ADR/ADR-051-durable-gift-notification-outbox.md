# ADR-051: Durable Gift Notification Outbox

## Статус

Принято — 08.09.2026.

## Контекст

Прямая отправка Telegram/MAX после сохранения подарка имеет crash window: backend
может завершиться между commit и provider-вызовом. Повтор всего HTTP-запроса опасен
дублированием подарка, а общий Sale Flow worker не должен забирать клиентские
уведомления с иным retry-поведением.

## Решение

1. Для зарегистрированного получателя `PrismaGiftTransferRepository.createGiftBundle`
   одной транзакцией создаёт transfer, invitation, referral и событие
   `GIFT_INVITATION_DELIVERY_REQUESTED`.
2. Событие использует стабильные `eventId` и `idempotencyKey`; payload содержит
   только идентификаторы агрегатов, notification ID и список каналов.
3. Телефон, invitation token, provider destination, redemption code и финансовые
   данные в payload запрещены. Destination разрешается только через зашифрованный binding.
4. Платформенное событие без организации разрешено только через закрытый allow-list.
   Tenant API по-прежнему не видит `organizationId = NULL`.
5. Отдельный worker claim фильтрует `eventType` и забирает по одному событию непосредственно
   перед обработкой. Provider timeout обязан быть меньше lease; временные ошибки используют
   exponential backoff, max attempts и dead letter. Постоянные ошибки dead-lettered сразу.
6. `NotificationOrchestrator` читает сохранённые delivery attempts и не вызывает
   повторно канал со статусом `SENT` или `DELIVERED`.
7. Просроченный, отменённый, возвращённый или выданный подарок не отправляется.
8. В production Gift Transfer использует Outbox, но worker и оба provider-канала
   включаются только независимыми fail-closed флагами после тестовой приёмки.
9. Отсутствие recipient binding является незавершённой предпосылкой, а не provider failure:
   событие откладывается без увеличения `attemptCount` до появления binding или срока приглашения.
10. После provider success приглашение переводится в `SENT` условным обновлением только при
    актуальных `GiftTransfer.status=AVAILABLE`, допустимом статусе приглашения и непросроченном TTL.

## Последствия

- потеря процесса после commit больше не теряет намерение отправить уведомление;
- доставка остаётся at-least-once на уровне provider boundary, а дедупликация
  успешного канала обеспечивается сохранённой парой `notificationId + channel`;
- после появления канонического customer событие может ожидать зашифрованный provider binding,
  не исчерпывая лимит реальных попыток доставки;
- оператору нужны мониторинг и runbook для `RETRY` и `DEAD_LETTER` до включения worker;
- миграция и включение production остаются отдельными решениями.
