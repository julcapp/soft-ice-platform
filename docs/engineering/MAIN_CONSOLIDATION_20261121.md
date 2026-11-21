# Аудит и консолидация Soft_ICE → main (2026-11-21)

Статус: **кандидат интеграции, НЕ слит в main, НЕ развёрнут в production**.

## Точки восстановления
- Исходный main: `3f420a390c984b9ca5a33df45a58802e4acfd620`
- Резервная GitHub ветка: `backup/main-before-consolidation-20261121`
- Production-сервер `/home/julcapp/soft-ice-platform`: **не менять/не чистить**. В tracked-файлах 21 локальное изменение и многочисленные untracked; рабочий HEAD 7962b5c; требуется самостоятельный аудит перед переносом.
- BOSS-2: `soft-ice-buildcheck` имеет локальную правку `backend/prisma/schema.prisma`; исходная security-ветка имеет `.tmp/`. Эти изменения не удалены.

## Аудит GitHub
На момент первичной проверки обнаружены 60 веток, включая `main`; лишь `main` сливалась с собой, остальные 59 не являются предками `origin/main`. Старый `main` отстаёт от `canonical/soft-ice-20261030` на 991 коммит и от новых веток TimoPOS ещё сильнее. Поэтому «удалить все временные ветки» сейчас означало бы утратить независимые изменения.

### Выделенные источники интеграции
1. `feature/timopos-five-points-otp-monitor-20261117` — база кандидата, HEAD 4b01e0a, уже включает canonical, основные TimoPOS и module layout.
2. `feature/gift-of-happiness-20261121` — объединена, конфликт в `GiftTransferService` разрешён с сохранением более новой PostgreSQL/outbox реализации. Проверка телефона и имени дарителя, безопасный HTTPS invitation URL и attribution.
3. `feature/point-nfc-qr-manager-20261115` — объединена; единая точечная NFC/QR метка с отзывом и проверкой токенов.

Другие ветки (mail-delivery, gift-transfer-postgres-runtime, payment, admin/security, display, photo-verification, currency-core) требуют оценки уникальных коммитов и cherry-pick/merge только после проверки применимости к текущей модели. Наличие 800+ коммитов в старых ветках **не является основанием** для прямого слияния; большая часть — общий предок, и нужно сравнивать merge-base + tree.

## Проверки BOSS-2
- Исходный TimoPOS: `npm.cmd test` — 885 tests, 773 pass, 21 fail, 91 skipped.
- Кандидат после gift + NFC: 897 tests, 785 pass, 21 fail, 91 skipped.
- Gift/notification targeted: 16/16 pass.
- NFC/QR targeted: 7/7 pass.
- Все новые падения исключены после обновления фикстур подтверждённого телефона. 21 исходная ошибка и 91 skipped остаются.
- Тесты без реальной аппаратной выдачи, рабочего платёжного провайдера и полной PostgreSQL E2E **не являются production acceptance**.

## Блокирующие группы тестов (21 исходная ошибка)
- CRM: 3;
- gift Prisma repository mocks: 2;
- частичные возвраты/payment API: 7;
- production platform config: 1;
- terminal checkout: 1;
- test-club-purchase rollback harness: 1;
- transactional outbox: 6.
Обязательны разбор причин и контрольная проверка в чистом CI/staging, а не отключение тестов.

## Порядок выравнивания
1. Снять инвентаризацию серверных untracked файлов и production deployments, отделить конфигурации/секреты от исходников. Никаких `git clean -fd`, `reset --hard` или переписывания истории.
2. Сохранить локальные уникальные изменения в отдельные backup-ветки/патчи на соответствующем устройстве, проверить отсутствие секретов, лишь затем перенести в кандидат.
3. Доработать новый gift persistence + OTP + frontend; убрать FOUNDATION_ONLY аппаратную выдачу в рамках отдельного релизного шага.
4. Исправить исходные тесты; прогнать PostgreSQL, ЮKassa, machine callback, Mini App, CRM, consent, MAX/Telegram, NFC.
5. Сверить production state/revision vs release candidate, подготовить миграции, бэкап БД, план rollback и smoke tests.
6. Только при успешной приёмке переводить PR из draft и объединять с `main`; только после этого согласованный deploy.
7. Ветки удалять лишь когда в `main` попали все уникальные коммиты или создан доступный архивный ref, с учётом прикреплённых worktrees и открытых PR.

## Синхронизация
- GitHub `integration/main-unification-20261121` = `a273a413570766c45041bf86b0b8f707ecbde30a` до добавления данного аудита.
- BOSS-2: `C:\Users\Admin\Documents\GitHub\soft-ice-main-unification`
- Home-Boss: `C:\Users\julcapp\Documents\GitHub\soft-ice-main-unification`
- Server: `/home/julcapp/soft-ice-main-unification`
- Единство SHA проверять после каждого обновления. **Код в Git/worktree не означает запущенный сервис.**

Изменения в рабочем production сервере, его сервисах, БД и системе выдачи **не производились**.
