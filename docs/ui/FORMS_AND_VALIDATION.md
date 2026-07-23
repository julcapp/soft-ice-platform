# Soft ICE Platform Forms and Validation v1

Status: Approved  
Version: 1.0  
Date: 2026-07-23  
Classification: DOCUMENTED_ONLY

## Form contract

Forms group fields by user intent, use visible labels and explain required/optional status. A placeholder is an example, not a label. Read-only facts use text or definition lists instead of disabled inputs.

Validation occurs at three layers:

1. immediate format guidance where it prevents avoidable error;
2. submit-time client feedback for completeness;
3. authoritative backend validation and authorization.

Client validation never claims that a price, payment, permission, inventory movement or machine operation is accepted.

## Error behavior

- Associate error text with the field and place focus on a form-level summary after a failed multi-field submit.
- Preserve safe input after recoverable errors.
- Explain how to correct the problem; do not expose stack traces or provider secrets.
- Detect conflicts through expected versions and offer reload/compare, never silent overwrite.
- Protect plausible unsaved work.
- Offline Operator forms show local, queued, syncing, failed and conflict states; queued is not completed.

## Confirmation

Routine reversible edits may save directly. Destructive and commercial actions name the target and consequence, require a reason when policy demands it, and may require step-up or dual approval from the backend. Payment, price, loyalty, permission, machine-setting and operator-assignment changes are never authorized solely by the form.

Accessible forms support keyboard operation, programmatic labels, error announcements, logical focus order, autocomplete where appropriate and 200% zoom without loss.

