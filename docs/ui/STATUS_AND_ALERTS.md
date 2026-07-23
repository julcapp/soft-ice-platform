# Soft ICE Platform Status and Alerts v1

Status: Approved  
Version: 1.0  
Date: 2026-07-23  
Classification: DOCUMENTED_ONLY

## Vocabulary

Every status uses a semantic token plus a plain-language label and, where useful, an icon or shape. Color alone is forbidden.

| State | Required label pattern | Typical channel |
|---|---|---|
| Normal | `Operating normally` | neutral/success |
| Information | factual explanation | information |
| Warning | risk and next check | warning |
| Critical | impact and required action | critical |
| Success | completed outcome | success |
| Offline | `Offline · last seen …` | offline |
| Maintenance | `In maintenance` | maintenance |
| Operator action | `Operator action required` | operator |
| Administrator action | `Administrator approval required` | administrator |
| Financial data | currency/period/source label | financial |
| AI recommendation | `AI recommendation` + evidence/confidence | AI |
| Test operation | `Test operation · not a sale` | test |
| Inventory shortage | material and servings/time remaining | shortage |
| Payment issue | payment state and safe recovery | payment issue |

## Presentation hierarchy

`StatusBadge` gives compact state. Inline `Alert` explains local impact. Page banner describes cross-view risk. Toast confirms a non-blocking completed result and must not be the only failure record. Critical and action-required alerts persist until resolved or acknowledged according to domain policy.

Machine and payment states must show last update and source freshness. A stale green state becomes `Status unknown/stale`, not normal. Alerts deduplicate by governed incident identity, preserve correlation and link to a permission-scoped drill-down.

