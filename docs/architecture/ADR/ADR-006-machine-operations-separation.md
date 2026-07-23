# ADR-006: Separate Machine Operations from CRM

Status: Accepted
Date: 2026-07-23

## Context

Machine maintenance work includes assignments, checklist execution, refills, tests, physical evidence, faults and reviewed service reports. Treating that work as generic CRM activity would mix customer/commercial management with operational machine records, weaken least privilege and obscure inventory reconciliation.

The repository contains earlier numeric ADR filenames for Financial Core. This descriptive ADR is a new checkpoint record and does not supersede or rewrite those historical files.

## Decision

Machine Operations Platform is a separate bounded context from CRM.

Operator App is limited to assigned-machine visibility, maintenance tasks, versioned checklists, refill records, test runs, photo evidence, fault reporting and service-report submission. Operators cannot change prices, commercial machine settings, loyalty rules, advertising or customers.

Administrators may manage prices and commercial settings through their owning domains; configure checklists; assign and review maintenance work; audit all operator activity; approve or reject service reports; and perform maintenance/test actions when required. All administrative operations remain permission-controlled and audited.

Every test operation creates inventory consumption records using `TEST_CUP`, `TEST_ICECREAM`, `TEST_TOPPING`, `TEST_FULL_CYCLE`, `CALIBRATION`, `CLEANING` or `WASTE` as applicable. Test/service consumption is distinct from sales consumption and is included in total stock reconciliation.

CRM/Admin Console remains the central management system and provides Machine Operations oversight through explicit contracts without owning Machine Operations records.

## Consequences

- operational permissions are deny by default and separate from CRM permissions;
- completed checklist versions and audit history remain immutable;
- service reports have explicit submission and approval/rejection states;
- inventory movements retain sales versus test/service classification and a common reconciliation path;
- administrator maintenance actions are recorded under the administrator actor, not impersonated as operator work;
- future operational capabilities require incremental contracts and offline/conflict rules where applicable.

## Alternatives rejected

- Store machine service work as generic CRM activities.
- Grant operators broad CRM or commercial-administration access.
- Treat test stock usage as sales or omit it from stock reconciliation.

## Scope

Documentation only. No application code, Prisma schema or business logic is changed.
