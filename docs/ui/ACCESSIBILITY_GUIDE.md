# Soft ICE Platform Accessibility Guide v1

Status: Approved  
Version: 1.0  
Date: 2026-07-23  
Classification: DOCUMENTED_ONLY

## Standard

All future platform interfaces target WCAG 2.2 AA. Accessibility is a component acceptance criterion, not a later visual review.

- Text contrast is at least 4.5:1; large text and non-text UI are at least 3:1.
- All console workflows are keyboard operable with visible focus and logical order.
- Touch targets are at least 44 by 44 px, and 48 by 48 px in Operator and Customer apps.
- Names, roles, values, validation and expanded/selected/loading states are programmatic.
- Status and chart meaning uses text plus icon, shape, pattern or table—not color alone.
- Charts provide a summary and accessible data table.
- Content reflows at 400% zoom and text remains usable at 200%.
- Motion respects `prefers-reduced-motion`; no critical information depends on animation.
- Modals trap focus, close predictably and return focus to the trigger.
- Live regions announce async results without repeatedly interrupting the user.
- Images have purposeful alternative text; decorative imagery is ignored.

## Field and hostile conditions

Operator flows must tolerate glare, gloves, intermittent connectivity and divided attention. Customer flows must support screen readers and platform font scaling. Offline, stale, test and financial states require explicit text. Evidence capture instructions describe required content without demanding inaccessible precision.

## Verification

Each implementation increment must include automated checks, keyboard review, screen-reader smoke tests, contrast verification, zoom/reflow review and application-specific task testing. Exceptions require an owner, rationale, remediation date and Product Owner visibility.

