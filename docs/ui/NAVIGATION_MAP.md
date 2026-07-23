# Admin Console Navigation Map v1

Status: Specification
Version: 1.0
Date: 2026-07-23

## 1. Navigation model

The future Admin Console uses role- and scope-aware navigation. Hidden navigation is not authorization; every read and action remains backend-enforced. A user sees a section when at least one child route is permitted. Direct links to unavailable routes return a safe denied state.

Default landing:

- Owner in Executive Console → Executive Overview.
- Owner in Admin Console → Dashboard.
- Administrator → Dashboard.
- Operator → Operator Workspace / Today.
- Support → Customers.
- Marketing → Advertising / Campaigns.
- Accountant → Payments.
- Auditor → Audit.

## 2. Admin Console hierarchy

```text
Admin Console
├─ Dashboard
│  ├─ Overview
│  └─ Widget drill-down
├─ Customers
│  ├─ Customer list
│  ├─ Customer profile
│  ├─ Segments
│  └─ Segment detail
├─ Machines
│  ├─ Machine list
│  ├─ Machine detail
│  │  ├─ Overview / live status
│  │  ├─ Telemetry / temperature
│  │  ├─ Inventory
│  │  ├─ Service history
│  │  ├─ Errors
│  │  └─ Commands
│  └─ Machine incidents
├─ Machine Fleet
│  ├─ Fleet overview
│  ├─ Fleet map
│  └─ Fleet groups
├─ Operators
│  ├─ Operator list
│  ├─ Operator profile
│  ├─ Assignments
│  ├─ Routes
│  ├─ Tasks
│  ├─ Task detail
│  └─ Completion approvals
├─ Inventory
│  ├─ Stock overview
│  ├─ Machine balances
│  ├─ Movements
│  ├─ Transfers
│  ├─ Transfer detail
│  ├─ Batches and expiry
│  ├─ Purchase history
│  └─ Consumption history
├─ Warehouse
│  ├─ Warehouse list
│  ├─ Warehouse detail
│  ├─ Receipts
│  ├─ Receipt detail
│  └─ Replenishment planning
├─ Products
│  ├─ Product list
│  ├─ Product detail
│  └─ Product editor
├─ Recipes
│  ├─ Recipe list
│  ├─ Recipe detail
│  ├─ Recipe version editor
│  └─ Recipe comparison
├─ Payments
│  ├─ Payment list
│  ├─ Payment detail
│  ├─ Reconciliation
│  ├─ Reconciliation case
│  └─ Refund requests
├─ Loyalty
│  ├─ Overview
│  ├─ Rules and tiers
│  ├─ Rewards
│  └─ Account adjustments
├─ Advertising
│  ├─ Advertisers
│  ├─ Advertiser detail
│  ├─ Placements and carousel banners
│  ├─ Creative library
│  └─ Referral links
├─ Campaigns
│  ├─ Campaign list
│  ├─ Campaign detail
│  ├─ Campaign editor
│  ├─ Schedule
│  └─ Campaign statistics
├─ Reports
│  ├─ Report library
│  ├─ Revenue
│  ├─ Inventory
│  ├─ Operator performance
│  ├─ Machine utilization
│  ├─ Failures
│  ├─ Maintenance
│  ├─ Advertising
│  ├─ Customer analytics
│  ├─ Loyalty
│  └─ Exports
├─ Analytics
│  ├─ Overview
│  ├─ Sales and product
│  ├─ Customer cohorts
│  ├─ Fleet trends
│  └─ Funnel builder (future)
├─ Audit
│  ├─ Event log
│  ├─ Event detail
│  ├─ Access review
│  └─ Export activity
├─ Notifications
│  ├─ Notification center
│  ├─ Notification detail
│  └─ Rules and subscriptions
├─ System Settings
│  ├─ Users
│  ├─ Roles and permissions
│  ├─ Scopes
│  ├─ Sessions
│  ├─ Integrations
│  ├─ Feature flags
│  └─ Audit and retention
└─ Platform Settings
   ├─ Organizations
   ├─ Regions and locations
   ├─ Business calendar
   ├─ Units, currency and tax display
   ├─ Dictionaries
   └─ Branding and channels
```

## 3. Operator workspace hierarchy

```text
Operator Workspace
├─ Today
│  ├─ Today's route
│  └─ Assigned machines
├─ Tasks
│  ├─ Task detail
│  ├─ Maintenance checklist
│  ├─ Inventory refill
│  ├─ Cleaning
│  ├─ Test dispense
│  ├─ Photo confirmation
│  ├─ Digital signature
│  └─ Submit completion
└─ History
   └─ Submitted service report
```

Operators do not navigate the general Admin Console. Administrator oversight opens the same task facts in read/review mode without impersonation.

## 4. Executive Console hierarchy

```text
Executive Console (Owner only)
├─ Executive Overview
├─ Commercial Performance
├─ Operations and Fleet
├─ Finance and Cash Flow
├─ Inventory and Waste
├─ Customer and Growth
├─ Risk and Compliance
├─ Machine Network Map
├─ Business Health
└─ AI Supervisor (future)
   ├─ Observations
   ├─ Predictions and risks
   └─ Recommendations
```

Executive Console has separate routes, session context and navigation. It contains no create/edit/approve/command controls.

## 5. Cross-navigation rules

- Dashboard widgets deep-link with their period, scope and filter context.
- Customer purchases link to orders/payments; payment detail links back to the customer with privacy checks.
- Machine detail links to inventory, incidents, tasks, service reports and location.
- Operator work links to the exact immutable checklist version, evidence and inventory movements.
- Product detail links to recipes, sales reports and Media Library references.
- Campaign detail links to advertiser, creative, placement, segments and attributed statistics.
- Every privileged record links to filtered Audit when permission allows.
- Back navigation restores list query, selection and scroll position.

## 6. URL conventions

Routes below are UI identifiers, not API contracts:

```text
/admin/{section}
/admin/{section}/{resourceId}
/admin/{section}/{resourceId}/{tab}
/operator/today
/operator/tasks/{taskId}/{step}
/executive/{dashboard}
```

Identifiers are opaque. Sensitive values such as phone numbers, emails, provider tokens or customer names never appear in URLs. Filters use allow-listed query parameters and must not include secrets or unmasked personal data.

## 7. Navigation states

- **Unavailable:** feature not delivered; show approved roadmap language.
- **No permission:** omit from menu; direct link uses denied state.
- **Out of scope:** show scope selector and permitted alternatives.
- **Stale/partial:** retain route with freshness warning.
- **Critical attention:** count badge reflects unresolved permitted items, not all platform items.
- **Unsaved work:** route change requires discard/save-draft confirmation.
