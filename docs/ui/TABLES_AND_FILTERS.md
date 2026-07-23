# Soft ICE Platform Tables and Filters v1

Status: Approved  
Version: 1.0  
Date: 2026-07-23  
Classification: DOCUMENTED_ONLY

## Standard collection contract

Every operational collection defines stable search fields, typed filters, deterministic sorting, bounded pagination, result count, visible data scope and freshness. Search and filter state must be reflected in the URL where safe so views are reproducible.

| Capability | Requirement |
|---|---|
| Search | Debounced or explicit; describe searchable fields; never search hidden sensitive fields without permission. |
| Filters | High-value filters inline; advanced filters in a drawer; active filters shown as removable chips. |
| Sorting | Server-governed for large data; visible direction; deterministic tie-breaker. |
| Pagination | Cursor preferred; page size bounded; preserve filters and selection rules. |
| Columns | Permission-aware visibility; identity and primary status cannot both be hidden. |
| Saved views | Store query/display preferences, owner and scope; never grant access. |
| Bulk actions | Show selected count and scope; re-authorize every target on the backend. |
| Export | Asynchronous for large sets, scoped, expiring and audited. |
| Row actions | Named verbs in a consistent final column; hidden or explained when unavailable. |
| Audit | Show actor, time, source and correlation link where the user has audit permission. |

## States and recovery

Skeleton rows preserve structure while loading. `No records`, `No matches`, `No access`, `Stale data` and `Source unavailable` are distinct states. Errors retain query controls and offer retry plus a correlation reference when available. Mobile uses a `RecordList`, preserving identity, status, essential facts and filter meaning.

Destructive, financial, commercial, permission, machine-command and irreversible bulk actions require consequence-led confirmation and fresh backend authorization. UI visibility is never authorization.

