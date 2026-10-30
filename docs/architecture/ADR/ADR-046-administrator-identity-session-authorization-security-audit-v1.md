# ADR-046 — Administrator Identity, Session, Authorization & Security Audit v1

Статус: Accepted
Дата: 2026-08-25

## Решение

`OrganizationMember` остаётся source of truth членства в tenant. `Administrator` — стабильная security identity, связанная ровно с одним durable member и организацией composite FK. Её статусы `ACTIVE`, `DISABLED`, `REVOKED` немедленно влияют на доступ; отдельный каталог сотрудников не создаётся.

Production Admin BFF принимает только opaque Bearer session token, хранит только SHA-256 hash и при каждом запросе заново проверяет session expiry/revocation, administrator state и active membership. Tenant выводится из durable session и membership. `X-Admin-Role`, `X-Admin-Subject`, `X-Organization-Id` разрешены только изолированному development/test adapter и всегда отклоняются в production.

Authorization использует единую role-to-permission matrix, explicit permission bindings и deny-by-default. Проверка включает authenticated principal, active identity/member, session tenant, required permission и resource organization. Роль сама по себе не является полным решением policy. Изменение access state не кэшируется в session claims, поэтому отзыв действует со следующего запроса. Security-sensitive mutation должна повторить проверку внутри своей транзакционной границы, чтобы не создавать TOCTOU.

Security audit использует существующий append-only `AuditEvent`, дополненный `organizationId`, `sessionId`, `idempotencyKey`. Секреты, raw tokens, credentials и credential-bearing metadata запрещены; allow-list/sanitization применяется до записи. Session creation/revocation атомарно создаёт существующий `TransactionalOutboxEvent`; delivery остаётся `AT_LEAST_ONCE`, consumer дедуплицирует `eventId`/`idempotencyKey`. Ошибка audit/outbox откатывает mutation.

Access-management data foundation включает role/permission bindings и session revocation. Command API назначения прав в этом инкременте не публикуется (`FOUNDATION_ONLY`). Будущие команды обязаны использовать semantic fingerprint и unique idempotency contract: повтор эквивалентной команды возвращает прежний logical result; иной fingerprint с тем же key — fail-closed conflict.

Approval foundation хранит requester/approver, action/target, fingerprint, reason, expiry и решение. PostgreSQL запрещает self-approval. Execution/manual reconciliation не реализованы (`FOUNDATION_ONLY`). Break-glass foundation требует explicit grant, reason, restricted permission list, bounded expiry, audit и revocation; скрытого master bypass нет. Activation API и step-up provider остаются `FOUNDATION_ONLY`.

## Границы и статусы

- `IMPLEMENTED`: durable identity/session schema, hashed opaque sessions, validation/revocation, tenant derivation, permission matrix, production Bearer boundary, session audit/outbox atomicity.
- `FOUNDATION_ONLY`: public access-management commands, approval lifecycle/execution, break-glass activation, RLS, step-up authentication, complete Admin Console login UI.
- `BLOCKED_EXTERNAL`: approved administrator IdP/OIDC/SAML credentials, MFA/step-up provider and production identity proofing. До подключения provider session creation доступно только внутреннему verified-auth adapter/service и не является публичным login endpoint.

Все административные routes классифицируются как `PERMISSION_PROTECTED`, кроме будущего provider callback/login (`PUBLIC` только после отдельного утверждения). `/api/v1/admin/security/session` — `AUTHENTICATED`. Финансовые/manual mutation endpoints этим решением не добавляются.

## Последствия

Production development-header trust закрыт fail-closed. RLS не внедряется скрытно и остаётся отдельным roadmap increment. Реальная production готовность невозможна без внешнего identity provider и полного независимого PostgreSQL/security review.
