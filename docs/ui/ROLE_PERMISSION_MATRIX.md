# Admin Console Role and Permission Matrix v1

Status: Specification
Version: 1.0
Date: 2026-07-23

## 1. Access model

Roles are starting permission bundles, not unconditional authority. Effective access is:

```text
authenticated actor
AND explicit permission
AND resource scope
AND field/data-class policy
AND owning-domain rule
AND required step-up/approval
```

Deny is the default. UI visibility never substitutes for backend enforcement. Permissions may be limited by organization, region, location, machine group or machine.

Legend: **M** manage/execute, **R** read, **L** limited task/support action, **—** denied. A cell never grants immutable-record editing or domain-rule bypass.

## 2. Role definitions

| Role | Mission | Key constraints |
|---|---|---|
| Owner | Company governance and executive decisions | Executive Console is owner-only and read-only; admin mutations require separate Admin Console authorization |
| Administrator | Cross-domain administration and operations oversight | Granular permissions; no direct table/provider/vendor writes; high-risk actions audited |
| Operator | Execute assigned field work | Assigned machines/tasks only; no customer, commercial, loyalty, advertising or access administration |
| Support | Resolve customer/order/payment questions safely | Masked PII by default; may request, not approve, financial/loyalty corrections |
| Marketing | Manage advertisers, campaigns, creative, segments and governed analytics | No customer-level targeting without separately approved purpose; no access/finance administration |
| Accountant | Payments, settlement, reconciliation, revenue and inventory-value reporting | No product, campaign, operator or system administration |
| Read-only Auditor | Independent evidence and control review | No mutations; exports separately scoped and audited |

## 3. Section-level matrix

| Section/capability | Owner | Administrator | Operator | Support | Marketing | Accountant | Auditor |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Admin Dashboard | R | R | — | L | L | L | R |
| Executive Console | R | — | — | — | — | — | — |
| Customers | R | M | — | L | Aggregate | L | R |
| Sensitive customer fields | Separate | Separate | — | L | — | L | Separate |
| Consent history | R | R | — | L | Aggregate gate only | — | R |
| Machines | R | M | Assigned L | L | Aggregate | R | R |
| Machine commands | — | Separate M | Assigned test only | — | — | — | — |
| Fleet and map | R | M | Assigned L | — | Aggregate | R | R |
| Operators/assignments | R | M | Own R | — | — | — | R |
| Service execution | — | Explicit M | Assigned M | — | — | — | R |
| Completion approval | — | M | — | — | — | — | R |
| Inventory/warehouse | R | M | Assigned L | — | — | R | R |
| Inventory correction | — | Separate M | — | — | — | Request/L | — |
| Products | R | M | — | R | R | R | R |
| Recipes | R | M | Assigned R | — | — | Cost R | R |
| Prices/commercial config | R | Separate M | — | R | R | R | R |
| Payments | R | M | — | L | Aggregate | M | R |
| Refund request | — | M | — | Request/L | — | Request/L | — |
| Refund approval | — | Separate M | — | — | — | Separate M | — |
| Reconciliation | R | M | — | L | — | M | R |
| Loyalty | R | M | — | L | M | Liability R | R |
| Loyalty adjustment | — | Separate M | — | Request/L | Request/L | R | — |
| Advertising/campaigns | R | M | — | — | M | Financial R | R |
| Reports/analytics | R | R | Own L | L | Domain R | Domain R | R |
| Audit | R | R | Own permitted | — | Own actions | Financial actions | R |
| Notifications | Own | Own/shared M | Own | Own | Own | Own | Own |
| Users/roles/scopes | R | Separate M | — | — | — | — | R |
| System settings | R | Separate M | — | — | — | — | R |
| Platform settings | R | M | — | — | Branding L | Finance L | R |

## 4. Representative permission catalog

| Domain | Read permissions | Mutation/review permissions |
|---|---|---|
| Dashboard | `dashboard.read`, widget-specific reads | `dashboard.preferences.manage` |
| Customers | `customers.read`, `customers.pii.reveal`, `consents.read` | `customers.profile.manage`, `support.notes.manage` |
| Segments | `segments.read`, `segments.members.read` | `segments.manage`, `segments.publish` |
| Machines/Fleet | `machines.read`, `machine.telemetry.read`, `fleet.read`, `fleet.map.read` | `machines.metadata.manage`, `machine.commands.execute`, `fleet.groups.manage` |
| Operations | `operators.read`, `operations.tasks.read`, `service_reports.read` | `operations.tasks.manage`, `operations.assignments.manage`, `service_reports.approve`, `service_reports.reject` |
| Operator | `operator.assigned.read` | `operator.assigned.execute`, `inventory.assigned_machine.move`, `service_report.assigned.submit` |
| Inventory | `inventory.read`, `inventory.movements.read`, `warehouses.read` | `inventory.transfers.manage`, `inventory.corrections.request`, `warehouse.receipts.manage` |
| Catalog/Recipe | `products.read`, `recipes.read` | `products.manage`, `products.publish`, `recipes.manage`, `recipes.publish` |
| Payments | `payments.read`, `reconciliation.read` | `refunds.request`, `refunds.approve`, `reconciliation.manage` |
| Loyalty | `loyalty.analytics.read`, `loyalty.rules.read` | `loyalty.rules.manage`, `loyalty.rules.publish`, `loyalty.adjustments.request/approve` |
| Advertising | `advertisers.read`, `campaigns.read`, `advertising.analytics.read` | `advertisers.manage`, `campaigns.manage`, `campaigns.approve`, `campaigns.activate` |
| Reports | `reports.{family}.read` | `reports.{family}.export` |
| Audit/access | `audit.read`, `access_reviews.read` | `audit.export`, `access_reviews.manage`, `access.roles.manage`, `access.sessions.revoke` |
| Settings | `system.*.read`, `platform.*.read` | explicit `system.*.manage`, `platform.*.manage` |
| Executive | `executive.overview/finance/operations/inventory/growth/risk.read` | `executive.export` only |

Exact permission keys remain subject to an implementation security increment; semantics and separation must remain stable.

## 5. Sensitive actions and controls

| Action | Minimum UI control | Additional policy |
|---|---|---|
| Reveal PII | purpose prompt and timed reveal | sensitive read audited |
| Export sensitive data | field/scope preview, purpose, expiry | asynchronous, watermarked where required |
| Machine command/test | eligibility and safety confirmation | step-up; assigned/explicit scope; result audited |
| Refund/loyalty adjustment | amount, reason, evidence, expected version | requester cannot approve where policy requires |
| Inventory correction | expected/observed values and provenance | original movement remains immutable |
| Campaign activation | validation summary and effective window | creative/placement/consent policy must pass |
| Service-report approval | immutable evidence/checklist review | reviewer independence when configured |
| Role/scope/feature flag | before/after diff, reason, step-up | approval and alert for high risk |
| Break-glass | incident, reason, duration, strong auth | time-bound, separately alerted and reviewed |

## 6. Field-level redaction

- Phone/email: masked except permitted support/identity use.
- Customer names and IDs: minimized in marketing, analytics and executive aggregates.
- Payment data: safe provider reference only; no credentials, signatures or raw payloads.
- Operator location: task/route necessity only; retention and access controlled.
- Photos/signatures: evidence permission, retention notice and audited access.
- Costs/profit/cash: Accountant, Owner and explicitly authorized Administrator only.
- Audit device/IP metadata: security/audit permission only.

## 7. Separation of duties

The same actor must not approve their own refund, loyalty adjustment, high-value inventory correction, access grant or service report when the applicable policy requires independent review. Role possession does not override this constraint. The UI clearly labels `Requester`, `Reviewer` and `Approver`, disables ineligible approval and explains the policy.

## 8. Owner-only Executive Console

Owner is the only v1 role with Executive Console navigation. Executive data is aggregated, privacy-suppressed and read-only. Owner access does not imply administrator mutation permissions. Exports require `executive.export` and are audited.
