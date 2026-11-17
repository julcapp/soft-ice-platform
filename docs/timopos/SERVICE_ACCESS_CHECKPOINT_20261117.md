# TimoPOS — checkpoint 2026-11-17

Branch: feature/timopos-service-auth-20261117 (derived from fiscal UI v0.9).
Scope: isolated policy and cashier preview. Production/payment/hardware untouched.

## Existing code
- SellerMaxAuthService + PrismaSellerMaxAuthRepository: verified MAX OTP for seller, point and terminal binding, session.
- TimoPosAccessPolicy: server-time hours, shift and seller/session checks.
- Shift, journal, basket, prepayment and settlement policies and migrations exist.
- Inspected backend/src/api/v1/index.js DOES NOT mount seller auth routes; service alone is not a deployed API.
- v0.9 cashier is a standalone offline demonstration, NOT a real KKT or payment frontend.

## Added
- TimoPosServiceAccessPolicy with TECHNICIAN, MASTER, PLATFORM_ADMIN, scoped permissions, server-verified sessions, point/terminal binding, step-up approval and offline fail-closed rules.
- Cashier v0.9 terminal POS-001 triple-tap access to locked service dialog. All credentials and device controls disabled until backend connected.
- Offline self-contained cashier.html preserved.

## Next milestones
1. Database-backed service accounts/sessions, secure credential storage, revocation and point assignments.
2. API endpoints with server-side RBAC, rate limits, CSRF as needed, trusted TLS, no secrets in client.
3. Durable append-only service action audit and test of failed and revoked login.
4. Hardware agent with explicit operation allowlist and mandatory server authorization.
5. PostgreSQL integration tests, hardware simulation, bank sandbox and non-fiscal test receipt workflow.
6. Supported Windows kiosk/desktop packaging after OS upgrade plan.

## Test evidence
Selected Node.js tests 2026-11-17: 51 pass, 0 fail
- existing seller MAX authorization and sales policy
- cashier v0.9 offline and cash/prepayment simulation
- new service authorization and tap detection
Not verified: live HTTP endpoints, PostgreSQL migrations, MAX delivery, real TLS, real KKT, real payments, EXE packaging.
