# ADR-053: Display phone recognition is not authentication

Date: 2026-09-29
Status: Implementation for review, issue #24

## Decision

Canonical `frontend/miniapp` display calls a separate anonymous recognition API.
A verified phone match returns `RETURNING`; an unknown or unverified phone returns
`NEW`. Lookup/abuse infrastructure failure returns `UNAVAILABLE`. No response
contains a phone, customer ID, name, balance, bonuses, orders or identity token.
`RETURNING` is a greeting only. All purchase paths retain anonymous PricingQuote.
No AuthSession, Customer, Club Account, Order, Payment or Machine mutation is
performed by recognition or challenge verification.

## API v1

All endpoints are POST under `/api/v1/auth/display-phone` and return `Cache-Control: no-store`.
Recognition body: `{ "machine_id": "machine-reference", "phone": "+7 (913) 000-00-01" }`.
Accepted number forms: `+7`, `7`, national `8`, or ten national digits, with spaces,
parentheses and hyphens. Only 11-digit +7 numbers with RU numbering prefixes
3/4/8/9 are accepted; +7 Kazakhstan ranges 6/7 and foreign numbers are rejected.
Invalid input returns HTTP 400 with stable `DISPLAY_PHONE_INVALID` and safe Russian
text, never the submitted value. Number validity does not prove ownership.

`POST /recognition` returns HTTP 200 with the standard `data` / `meta` envelope:

```json
{"data":{"type":"display_phone_recognition","attributes":{"state":"RETURNING","retryable":false,"verification":null}},"meta":{"api_version":"v1","correlation_id":"corr_server_generated"}}
```

```json
{"data":{"type":"display_phone_recognition","attributes":{"state":"NEW","retryable":false,"verification":{"challenge_id":null,"status":"UNAVAILABLE","expires_at":null,"max_attempts":3,"remaining_attempts":0,"resend_creates_new_challenge":true}}},"meta":{"api_version":"v1","correlation_id":"corr_server_generated"}}
```

```json
{"data":{"type":"display_phone_recognition","attributes":{"state":"UNAVAILABLE","retryable":true,"verification":null}},"meta":{"api_version":"v1","correlation_id":"corr_server_generated"}}
```

NEW remains NEW if lookup succeeds but delivery is unavailable. No challenge is
stored on a failed delivery. With the explicitly injected test adapter, NEW has
`verification.status=PENDING`, an opaque `challenge_id`, server `expires_at`,
`max_attempts=3`, `remaining_attempts=3` and `resend_creates_new_challenge=true`.

`POST /verification-challenges/:challengeId/verify` body: `{ "code": "123456" }`.
HTTP 200 resource type `display_phone_verification_challenge`, ID and attributes
`challenge_id`, `status`, `expires_at`, `max_attempts`, `remaining_attempts`,
`resend_creates_new_challenge`. Status is PENDING, VERIFIED, INVALIDATED or EXPIRED.
Missing challenge: safe HTTP 404. Every wrong submission, including malformed code,
consumes an attempt. At three failures it is permanently invalidated. Correct
codes at/after expiry or after invalidation do not verify. VERIFIED is only a
challenge fact, never authentication or enrollment.

`POST /verification-challenges/:challengeId/resend` body: `machine_id` and `phone`.
The supplied pair must match the previous challenge. It is invalidated before
another delivery is attempted. HTTP 201 returns a new challenge, or status
UNAVAILABLE with null challenge ID if delivery/abuse infrastructure is unavailable.
The status field is authoritative; 201 alone does not mean delivery succeeded.
Repeated recognition also invalidates prior pending challenges on successful issue.

## Security and provider boundaries

- Runtime uses the unavailable abuse guard by default in every environment. No
  environment flag enables the permissive test/fixture guard. Production recognition
  therefore returns UNAVAILABLE before querying customers. A production shared
  rate limiter, trusted device identity, enumeration protections and monitoring
  require separate integration and security acceptance.
- No real SMS/Exolve provider, credentials or network delivery are included.
  Default verification provider fails closed. Deterministic provider requires
  NODE_ENV=test at construction and delivery, stores no raw delivery/code, and is
  injected only by tests and the loopback acceptance fixture.
- TTL is exactly five minutes from server issue time. A random six-digit code is
  salted and scrypt-hashed; raw code is never persisted, audited or returned.
- Challenge repository is process-local and ephemeral. Restart loses challenges;
  no durable/multi-worker correctness is claimed. Before provider enablement a
  durable repository must enforce atomic attempts, resend invalidation, expiration,
  retention and concurrency. No database migration is added in this increment.
- Internal phone/machine fingerprints use a process-local random HMAC key; audit
  stores no raw phone, raw machine input, caller correlation value or code. Audit
  failure produces a sanitized error. Server responses generate correlation IDs.
- Browser submits phone only in POST body with credentials omitted and retains no
  identity/token in storage. DTO fields are allowlisted. Skip, idle reset and
  unmount cancel in-flight requests; stale responses cannot repopulate the screen.
- NEW UI is a bounded confirmation-required state, with server attempt metadata.
  Interactive OTP entry/enrollment is deferred to provider integration; no local
  timer or pretend verification success is introduced.

## Local evidence

`node --test backend/tests/displayCustomerRecognition.test.js backend/tests/customerIdentityCore.test.js`

`node --test frontend/miniapp/src/terminal/DisplayRecognitionApi.test.js`

`cd frontend/miniapp; npm run build`

For loopback visual acceptance, set NODE_ENV=test and run
`node frontend/miniapp/scripts/display-recognition-acceptance-server.mjs`.
It reuses the catalog/anonymous quote fixture on 4178 and serves the actual
recognition router/service on 4180 with fixture repository data. No server DB is
read or seeded. Use `?mode=terminal&machineId=recognition-normal`,
`recognition-provider`, or `recognition-unavailable`; synthetic known phone
`9130000001`, unknown `9130000002`. Never enter a real phone in the fixture.

Run `node frontend/miniapp/scripts/display-recognition-browser-tests.mjs` with
Playwright available (optional PLAYWRIGHT_MODULE_URL and CHROMIUM_EXECUTABLE).
Artifacts go to ignored `.tmp/issue-24-acceptance`. Four viewports, seven screenshot
states, zero overflow/console errors/warnings, >=72px touch targets and behavioral
idle/skip/late-response checks are asserted. This is local fixture evidence,
not production readiness. No deploy, commit, push or merge is part of acceptance.
