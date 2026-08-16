# Organization 360 v1

Статус: Implemented with foundation-only projections  
Версия: 1.0  
Дата: 2026-08-16

## Назначение

Organization 360 — единый источник организационного контекста Soft ICE: организация, настраиваемая иерархия подразделений, сотрудники, организационные роли, точки размещения, связи с существующими аппаратами и назначения ответственности.

## Границы домена

Домен владеет `Organization`, `OrganizationUnit`, `OrganizationMember`, `OrganizationRoleAssignment`, `OrganizationLocation`, `OrganizationMachineAssignment` и `OrganizationResponsibility`. Он не владеет паролями, сессиями, техническими разрешениями, `Machine`, состоянием Machine Runtime, клиентами, заказами, платежами, телеметрией, запасами, обслуживанием, видео или событиями.

Связь сотрудника с пользователем выполняется необязательным `platformUserId` на существующий `Customer`. Организационная роль описывает место человека в организации и не является разрешением RBAC. Доступ проверяет существующий Auth Core.

## Модель данных

- `Organization` содержит реквизиты, адреса, контакты, статус и даты. Архивирование выполняется без физического удаления.
- `OrganizationUnit` образует настраиваемое дерево через `parentId`; код уникален внутри организации.
- `OrganizationMember` принадлежит одной организации и может принадлежать подразделению и существующему пользователю платформы.
- `OrganizationRoleAssignment` хранит назначение и отзыв организационной роли.
- `OrganizationLocation` хранит адрес, координаты `latitude`/`longitude`, режим работы и ответственных; координаты готовы для будущей карты.
- `OrganizationMachineAssignment` ссылается на существующий `Machine`, фиксирует владельца, эксплуатирующую организацию, точку и ответственных. Состояние аппарата не копируется.
- `OrganizationResponsibility` задаёт область `ORGANIZATION`, `UNIT`, `LOCATION`, `MACHINE` или `FINANCE` и поддерживает отзыв без удаления истории.

Все дочерние записи содержат `organizationId`; внешние ключи, составные уникальные ограничения, индексы и частичный индекс одного активного назначения аппарата обеспечиваются миграцией PostgreSQL.

## API v1

Чтение:

- `GET /api/v1/organizations`
- `GET /api/v1/organizations/:id`
- `GET /api/v1/organizations/:id/units`
- `GET /api/v1/organizations/:id/members`
- `GET /api/v1/organizations/:id/locations`
- `GET /api/v1/organizations/:id/machines`
- `GET /api/v1/organizations/:id/responsibilities`
- `GET /api/v1/organizations/:id/events`
- `GET /api/v1/organizations/:id/metrics`

Административные изменения выполняются `POST`/`PATCH` для организации, подразделений, сотрудников и точек, `POST`/`DELETE` для ролей, аппаратов и ответственности. Все mutations проходят существующую административную аутентификацию, проверку роли, tenant scope, аудит и публикацию события.

## События

Публикуются через стандартный `PlatformEvent`: `organization.created`, `organization.updated`, `organization.status_changed`, `organization.unit.created`, `organization.unit.updated`, `organization.member.created`, `organization.member.updated`, `organization.member.deactivated`, `organization.location.created`, `organization.location.updated`, `organization.machine.assigned`, `organization.machine.unassigned`, `organization.responsibility.assigned`, `organization.responsibility.revoked`.

Envelope содержит версию, aggregate, actor, channel, correlation и `organizationId` в payload/metadata. Транспорт Event Bus и Event Center в текущем составе остаются недолговечными foundation-адаптерами.

## Безопасность

`PLATFORM_OWNER` и совместимая legacy-роль `ADMIN` имеют глобальный scope. `ORGANIZATION_ADMIN` читает и изменяет только организацию из доверенного `securityContext.organization_id`; `ORGANIZATION_MANAGER` имеет только чтение. Заголовок разработки `X-Organization-Id` принимается только не в production. Несовпадение route organization ID и scope возвращает `403` до обращения к Runtime.

Критические mutations записываются в существующий `AuditRepository`. Пароли, токены и данные аутентификации в домене не хранятся.

## Показатели и готовность

Проекция read-only не создаёт собственные источники. Количество аппаратов и их сохранённый статус, продажи и оборот читаются из существующих моделей. Клиенты, инциденты и сервисные работы маркируются `FOUNDATION_ONLY`, поскольку production-проекции/событийное хранилище соседних доменов пока не завершены. Для недоступного Event Center возвращается явное состояние `FOUNDATION_ONLY`, а не фиктивная история.

## Ограничения и дальнейшее развитие

- `FOUNDATION_ONLY`: долговечный Event Bus/outbox/Event Center, production-проекции Maintenance и клиентских показателей.
- `BLOCKED_EXTERNAL`: официальная карта/геокодирование и внешние кадровые/бухгалтерские системы не подключены.
- `PLANNED`: полноценное администрирование из UI, массовые операции, временные замещения, PostgreSQL RLS и внешние организационные интеграции.
- Специализированная бухгалтерия и второй RBAC намеренно не реализованы.
