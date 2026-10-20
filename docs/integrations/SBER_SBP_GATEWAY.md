# СБП от Сбербанка

20.10.2026. Отдельный провайдер SBER_SBP внутри общего PaymentCheckoutService. Интерфейсы аппарата и TEST Mini App показывают «СБП от Сбербанка». Покупатель переходит по выданной банком динамической ссылке НСПК, где выбирает доступный банк; собственный список приложений и подмена схемы ссылки не реализуются.

## Состояние

Подготовлены адаптер, mTLS транспорт, создание QR, запрос статуса, проверка назначения/суммы, регистрация общего провайдера, вход Mini App с действующей проверкой Telegram/принадлежности заказа, точечный установщик terminal hook. На сервере при проверке20.10 настройки SBER отсутствовали. Банковский приём не активирован. Проверки используют заглушки, не подтверждают работу настоящего договора. Производственный доступ и сертификаты требуют настройки и проверки; флаг CONTRACT_VERIFIED сам по себе не является подтверждением банка.

## Конфигурация

Переменные процесса backend: SBER_QR_ENABLED=false, SBER_QR_CONTRACT_VERIFIED=false; SBER_QR_MEMBER_ID, SBER_QR_MERCHANT_ID, SBER_QR_TID, SBER_QR_ID_QR, SBER_QR_ALLOWED_MACHINE_IDS; SBER_QR_CLIENT_ID, SBER_QR_CLIENT_SECRET, SBER_QR_CERT_PATH, SBER_QR_KEY_PATH, SBER_QR_CA_PATH, при необходимости SBER_QR_KEY_PASSPHRASE. Секреты/ключи не помещать в Git, frontend или ответы capabilities. Переданные владельцем MID641000010032 и TID24889019 пока не проверены банком через API. MID не приравнивать MemberID/idQR. Тестовый аппарат нельзя разрешать для настоящего приёма денег автоматически.

Фиксированный HTTPS mc.api.sberbank.ru:443, OAuth tokens/v3/oauth, QR /prod/qr/order/v3/creation и status. mTLS, проверка доверия TLS,10сек, ответ до1МБ, без редиректов и автоматического повтора создания.

## Подтверждение

Сумма берётся из Order в копейках; валюта банка643. Ссылка должна быть HTTPS qr.nspk.ru и type02. Статический type01 не используется для checkout. Результат creation никогда не подтверждает оплату. Для SUCCEEDED нужен ответ status с error_code000000, order_statePAID и ровно одной успешной PAY(response_code00), совпадающими суммой, валютой, банковским заказом, MID/TID/idQR. Иные/неизвестные форматы не признаются оплатой. Банковский профиль и актуальную JSON-схему надо подтвердить до включения.

До сетевого создания общий Payment intent уже существует. CAS в metadata.sberCreateRqUid разрешает ровно одну отправку создания по локальному Payment. После неопределённого ответа повтор создания запрещён: требуется сверка по partner_order_number/TID. Автоматическое восстановление потерянного bank-order-id пока не реализовано. Возвраты/реестр пока не подключены: методы возврата отказывают явно, без фиктивного успеха. Комиссия и чеки не выдумываются.

Mini App вызывает orders/:id/sber-payment только после существующей аутентификации. Статус и последующее получение остаются в общем заказе. Шлюз Сбера не создаёт команды выдачи и бонусных проводок самостоятельно. Для аппарата patch-sber-terminal-hook.py сохраняет существующий runtime и расширяет метод sber_sbp, проверяя готовность до создания заказа. Общий ключ checkout по quote остаётся прежним, чтобы смена способа не создала второй платёж.

## Источники и проверки

Приложенные владельцем инструкции2021: обзор13стр, спецификацияv8.1(35стр), портал22стр. Актуальные страницы: https://developers.sber.ru/docs/ru/sber-api/scenarios/transfers/qr-payment/opisanie-servisov и /podkluchenie; спецификации /specifications/qr/plati-qr/order-create и /status-request. В актуальной таблице notify для СБП не заявлен; используем status. Старые PDF endpoints8443/tokenv2 не переносятся. У примеров PDF есть некорректные rq_uid/коды: не копировать их как успешные фикстуры.

`node --test backend/tests/sberQrGateway.test.js backend/tests/miniAppPreorder.test.js frontend/miniapp/src/terminal/SberPaymentMethods.test.js`; npm run build в frontend/miniapp. Серверный smoke: capabilities200/availablefalse без секретов, unauth Mini App401, прямая попытка terminal sber_sbp503 до создания заказа. Реальных запросов к банку при установке нет.
