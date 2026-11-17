# TimoPOS — checkpoint 2026-11-17

Branch: feature/timopos-service-auth-20261117 (derived from fiscal UI v0.9).
Scope: isolated policy and cashier preview. Production/payment/hardware untouched.

## Existing code
- SellerMaxAuthService + PrismaSellerMaxAuthRepository: verified MAX OTP for seller, point and terminal binding, session.
- TimoPosAccessPolicy: server-time hours, shift and seller/session checks.
- Shift, journal, basket, prepayment and settlement policies and migrations exist.
- Initially inspected API v1 had no TimoPOS seller auth route. This branch adds an opt-in route, disabled until durable runtime dependencies are wired; it is not deployed.
- v0.9 cashier is a standalone offline demonstration, NOT a real KKT or payment frontend.

## Added
- TimoPosServiceAccessPolicy with TECHNICIAN, MASTER, PLATFORM_ADMIN, scoped permissions, server-verified sessions, point/terminal binding, step-up approval and offline fail-closed rules.
- Cashier v0.9 terminal POS-001 triple-tap access to locked service dialog. All credentials and device controls disabled until backend connected.
- Offline self-contained cashier.html preserved.

## Seller HTTP authentication adapter (same isolated branch)
- New `backend/src/api/v1/timoPosSellerAuthRoutes.js`: MAX challenge, verification, session query, logout.
- Secure `__Host-` HttpOnly/Secure/SameSite=Strict cookie; server-controlled origin and TLS requirements.
- Mandatory pluggable rate limiter. Missing repository/service/origin/limiter prevents router construction.
- Mounted in API v1 only when `dependencies.timoPosSellerAuthRuntime` is explicitly injected; current `createRuntimeDependencies` does NOT provide it. Thus not live in production.
- 4 HTTP tests passed with isolated fake services and local test transport. No real MAX delivery or DB used.

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
