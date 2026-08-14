# Таксономия событий

Версия типа входит в идентичность: `MACHINE_DISCONNECTED.v1`, `PAYMENT_CONFIRMED.v1`, `VIDEO_RECORDING_STARTED.v1`.

Категории v1: система, бизнес, автомат, клиент, платёж, склад, обслуживание, связь, видеонаблюдение, безопасность, оператор, организация, уведомление, аудит и прочее. Технические коды сохраняются в API, пользовательские названия отображаются по-русски.

Важность: `INFO`, `BUSINESS`, `WARNING`, `INCIDENT`, `CRITICAL`, `EMERGENCY`. Она задаётся `EventTypeDefinition`, а не выводится из имени. Начальный каталог зарегистрирован в коде; типы без реального publisher помечены `REGISTERED_NOT_EMITTED`.
# События Gift Transfer

Добавлены `PREPAID_ORDER_CANCEL_REQUESTED`, `PREPAID_ORDER_CANCELLED_TO_BALANCE`, `GIFT_TRANSFER_CREATED`, `GIFT_INVITATION_CREATED`, `GIFT_INVITATION_SENT`, `GIFT_INVITATION_OPENED`, `GIFT_RECIPIENT_REGISTERED`, `GIFT_TRANSFER_AVAILABLE`, `GIFT_ACCEPTED`, `GIFT_REDEMPTION_REQUESTED`, `GIFT_REDEMPTION_CODE_ISSUED`, `GIFT_REDEEMED`, `GIFT_TRANSFER_CANCELLED`, `GIFT_EXPIRED`, `GIFT_RETURNED_TO_SENDER`, `REFERRAL_CREATED_FROM_GIFT`, `REFERRAL_FIRST_OWN_PURCHASE_COMPLETED`. Все события передачи разделяют `correlationId`.
