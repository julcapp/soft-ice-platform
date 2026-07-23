# ADR-015: Executive Console and Future AI Supervisor

Status: Accepted
Date: 2026-07-23
Decision owners: Product Owner and Architecture
Scope: Architecture and contracts only

## Context

Executives need a concise, reliable view of commercial, financial and operational performance without receiving unrestricted administrator powers. Future AI capabilities may help detect anomalies and prepare recommendations, but must not become an ungoverned command path or a new source of business truth.

## Decision

Executive Console is a separate, primarily read-only application surface over versioned reporting projections. It shares identity, reporting and audit infrastructure with Admin Console but has separate routes, permission bundles, navigation and session policy.

Executive Console does not call domain mutation APIs. An authorized executive who also holds an administrator role must enter Admin Console through a separately authorized session/context to perform a command.

## Executive information architecture

The initial dashboard set is:

| Dashboard | Decision questions | Principal measures |
|---|---|---|
| Company Overview | Is the business healthy today and versus plan? | paid sales, orders, average order value, refunds, active machines, availability, stockout impact |
| Commercial Performance | What products, locations and campaigns drive results? | product mix, machine/location performance, promotion and advertising attribution |
| Operations and Fleet | Where is service capacity or availability at risk? | uptime, degraded/offline fleet, failed dispense rate, incident aging, task SLA |
| Finance and Cash | Are payments and settlements complete and explainable? | accepted payments, settlement lag, reconciliation exceptions, refunds |
| Inventory and Waste | Is stock sufficient and controlled? | expected stock, days/servings remaining, variance, test/service consumption, waste |
| Customer and Growth | Are acquisition and retention moving safely? | active customers, repeat rate, loyalty participation and consent-governed growth metrics |
| Risk and Compliance | What requires executive attention? | unresolved high-severity incidents, audit exceptions, break-glass activity, access-review debt |

Every tile shows definition version, period, comparison basis, freshness and completeness. Drill-down is permission-scoped and aggregated by default. Small cohorts and personal data are suppressed according to privacy policy.

## Executive reporting contracts

Executive queries use `/api/v1/executive` and accept explicit period, time zone, currency and organization/location scope. Required contracts are:

- `GET /overview`;
- `GET /commercial`;
- `GET /operations`;
- `GET /finance`;
- `GET /inventory`;
- `GET /growth`;
- `GET /risk`;
- `GET /metric-definitions/{metricKey}`;
- `POST /exports`.

Responses are generated from the same governed reporting projections used by Admin Console, with stricter aggregation and redaction. They include `as_of`, projection watermark, metric version, source coverage, missing-source flags and comparison methodology.

Scheduled reports and board packs are future delivery mechanisms. Any export is asynchronous, scoped, expiring and audited.

## Metric governance

Each executive metric has:

- stable semantic key and business owner;
- formula and inclusion/exclusion rules;
- source contexts and event/schema versions;
- currency, unit, time zone and rounding policy;
- freshness objective and late-data behavior;
- dimensional grain and allowed drill-down;
- privacy classification and suppression threshold;
- reconciliation rule where a financial or inventory measure is involved.

Metric changes create a new version and effective date. Historical reports retain the version used. Forecast, target and actual values are distinct data types and never silently combined.

## Permissions and separation of duties

Representative permissions are `executive.overview.read`, `executive.finance.read`, `executive.operations.read`, `executive.inventory.read`, `executive.growth.read`, `executive.risk.read` and `executive.export`.

Scope restrictions apply by legal entity, region or business unit. Finance, customer and audit drill-down require separate grants. Executive access confers no implicit price, refund, campaign, operator, inventory-correction or access-administration permission.

## Future AI Supervisor extension

AI Supervisor is a future advisory subsystem positioned after governed reporting and alerting:

```text
domain facts -> governed projections/alerts -> AI Supervisor analysis
  -> evidence-linked observation or recommendation
  -> human review
  -> existing Admin Console workflow
  -> owning-domain validation and audit
```

### Permitted future capabilities

- summarize current dashboard state and material changes;
- detect statistical anomalies against approved baselines;
- correlate machine health, inventory, sales and operator workload;
- forecast stockout, maintenance demand or cash/reconciliation risk with confidence ranges;
- propose a task, investigation, replenishment plan or campaign review;
- explain which governed facts and metric versions support a recommendation;
- prioritize an existing alert queue using approved policy.

### Prohibited authority

AI Supervisor must not:

- execute refunds, price changes, inventory corrections or machine commands;
- activate/pause campaigns or select customer-level advertising;
- assign permissions or open break-glass access;
- approve service reports or evidence;
- alter source facts, projections, audit records or metric definitions;
- infer consent, legal eligibility or verified identity;
- learn from or expose secrets and unnecessary personal data;
- bypass the same owning-domain validation required for a human administrator.

Any future write assistance is limited to a typed draft proposal. A human with the relevant permission must review and submit it through the existing command contract. High-risk proposals may require dual approval.

## AI governance contract

Every AI output must record:

- `ai_run_id`, model/provider/version and prompt/policy version;
- initiating actor or scheduled-job identity;
- purpose, permitted scope and data classification;
- input projection IDs, watermarks and evidence references;
- output type, confidence/uncertainty and limitations;
- recommendation status and human reviewer;
- any resulting command correlation ID;
- safety/policy decision, latency and error outcome.

Outputs are labelled as observations, forecasts or recommendations—not facts. Retrieval is allow-listed and permission-filtered before model access. Retention, evaluation, quality thresholds, model hosting, data residency, incident response and human-approval policy require a separate ADR before implementation.

## Failure and safety behavior

- Missing, stale or contradictory inputs produce an explicit insufficient-evidence result.
- Model unavailability never blocks core operations or authoritative reporting.
- Recommendations expire when source projections or policies change.
- A rejected recommendation remains auditable and cannot be resubmitted automatically.
- Executive and administrator users can inspect evidence and report unsafe or incorrect output.

## Consequences

- Executives receive decision-grade visibility without administrative mutation rights.
- Metric governance becomes a prerequisite for trustworthy dashboards and AI.
- AI remains replaceable, advisory and downstream of authoritative platform contracts.
- No domain must depend on AI Supervisor for correctness or availability.

## Out of scope

This decision adds no UI, model integration, prompt, vector store, reporting runtime, API route, schema, automation or business logic.

## Related documentation

- `docs/architecture/ADR/ADR-014-admin-console-foundation-v1.md`
- `docs/architecture/PLATFORM_ROLES_AND_ACCESS.md`
- `docs/architecture/PLATFORM_DATA_FLOWS.md`
- `docs/architecture/ARCHITECTURE_GOVERNANCE.md`
