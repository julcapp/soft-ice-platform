# ADR-023: Runtime Event Source Boundaries

Status: Accepted  
Date: 2026-07-23

Events transport facts and never become authoritative domain state. Cross-domain effects use service contracts or idempotent subscribers, never direct database writes. Digital Twin consumes Runtime events as read projections only and cannot command Runtime. Inventory consumes confirmed consumption facts with sale/test/calibration/cleaning/waste reasons. Gateway normalizes vendor data before Runtime.
