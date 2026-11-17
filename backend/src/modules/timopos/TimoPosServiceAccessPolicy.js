'use strict';

/** Server-side authorization for TimoPOS maintenance operations.
 * Never trust a role, point, terminal or session supplied by the UI.
 * The caller must pass independently verified DB/session context.
 * A three-tap gesture is UI navigation, NOT an authentication factor.
 */
const ROLE_PERMISSIONS = Object.freeze({
  TECHNICIAN: Object.freeze(['diagnostics.read', 'network.read', 'journal.read', 'devices.self_test']),
  MASTER: Object.freeze(['diagnostics.read', 'network.read', 'journal.read', 'devices.self_test',
    'devices.calibrate', 'devices.configure', 'app.restart']),
  PLATFORM_ADMIN: Object.freeze(['diagnostics.read', 'network.read', 'journal.read', 'devices.self_test',
    'devices.calibrate', 'devices.configure', 'app.restart',
    'software.update', 'terminal.assign', 'service.roles.manage']),
});
const SENSITIVE = new Set(['devices.calibrate','devices.configure','app.restart',
  'software.update','terminal.assign','service.roles.manage']);
const LOCAL_SAFE = new Set(['diagnostics.read','network.read','journal.read']);
const REQUIRE_AUDIT = true;
function fail(code) { return Object.freeze({allowed:false,code,requiresAudit:REQUIRE_AUDIT}); }
function evaluateServiceAccess({ now = new Date(), actor, session, terminal, operation,
  approval, connected = true } = {}) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) return fail('INVALID_TIME');
  if (!terminal?.id || !terminal?.pointId || terminal.active !== true) return fail('TERMINAL_NOT_ACTIVE');
  if (!actor?.id || actor.status !== 'ACTIVE') return fail('ACTOR_NOT_ACTIVE');
  if (!session?.id || session.actorId !== actor.id || session.terminalId !== terminal.id
    || session.pointId !== terminal.pointId || session.revokedAt || session.active !== true)
    return fail('SESSION_NOT_VALID');
  const expiry = new Date(session.expiresAt);
  if (!Number.isFinite(expiry.getTime()) || expiry <= now) return fail('SESSION_EXPIRED');
  const role = String(session.serverVerifiedRole || '');
  if (!Object.prototype.hasOwnProperty.call(ROLE_PERMISSIONS,role)) return fail('SERVICE_ROLE_REQUIRED');
  // Server-side assignment, not user-entered point or terminal.
  if (!Array.isArray(actor.assignedTerminalIds) || !actor.assignedTerminalIds.includes(terminal.id)
    || !Array.isArray(actor.assignedPointIds) || !actor.assignedPointIds.includes(terminal.pointId))
    return fail('ASSIGNMENT_REQUIRED');
  if (typeof operation !== 'string' || !ROLE_PERMISSIONS[role].includes(operation))
    return fail('OPERATION_FORBIDDEN');
  if (!connected && !LOCAL_SAFE.has(operation)) return fail('OFFLINE_OPERATION_FORBIDDEN');
  if (SENSITIVE.has(operation)) {
    if (!approval?.confirmedByServer || approval.actorId !== actor.id
      || approval.terminalId !== terminal.id || approval.operation !== operation
      || !approval.id || approval.usedAt) return fail('STEP_UP_REQUIRED');
    const confirmed = new Date(approval.confirmedAt);
    if (!Number.isFinite(confirmed.getTime()) || confirmed > now
      || now.getTime() - confirmed.getTime() > 120000) return fail('STEP_UP_EXPIRED');
  }
  return Object.freeze({allowed:true,code:'AUTHORIZED',role,requiresAudit:REQUIRE_AUDIT});
}
module.exports = { ROLE_PERMISSIONS, SENSITIVE, evaluateServiceAccess };
