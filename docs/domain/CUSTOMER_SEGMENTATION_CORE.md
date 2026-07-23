# Customer Segmentation Core v1

Status: Implemented  
Version: 1.0  
Date: 2026-07-21

## Purpose

Segmentation owns reusable customer classifications for future loyalty, recommendation, CRM and consent-aware advertising consumers. It does not execute campaigns, grant rewards, calculate discounts or make recommendations.

## Model

- `Segment` defines a stable uppercase code, display metadata, type (`MANUAL` or `SYSTEM`) and activation status.
- `SegmentRule` stores declarative JSON criteria for a system segment. Core v1 stores and validates rule envelopes but does not evaluate them.
- `CustomerSegment` is an assignment period. Assignment appends a row; removal sets `unassignedAt`, preserving history.

Initial supported semantic codes are `NEW_CUSTOMER`, `ACTIVE_CUSTOMER`, `VIP_CUSTOMER`, `BIRTHDAY_UPCOMING` and `CLUB_MEMBER`. They are examples/contracts, not automatically seeded classifications.

## Invariants

- Segment codes are unique stable semantic IDs.
- Manual segments accept only manual assignments; system segments accept only system assignments.
- Rules belong only to system segments.
- Inactive segments remain queryable but reject new assignments and are excluded from active customer projections.
- A customer can have at most one open assignment period per segment.
- Deactivation does not erase definitions, rules, or assignment history.

## Runtime boundary

`SegmentationRuntime` exposes segment creation/listing, activation, system-rule creation, assignment/unassignment, active membership lookup and history lookup. Operator mutation HTTP endpoints are intentionally deferred until operator authentication and authorization exist.

## Out of scope

Rule evaluation jobs, purchase/activity thresholds, birthday scheduling, automatic Club membership synchronization, advertising audiences, campaign execution, recommendation ranking, consent policy and rewards are not implemented in v1.
