'use strict';
const { canStartShift } = require('./TimoPosAccessPolicy');

function shiftError(code) {
  return Object.assign(new Error('Операция со сменой недоступна.'), { code });
}

// The repository contract MUST execute startShiftAtomic and
// closeShiftAndRevokeSessionsAtomic in a database transaction. The latter
// commits shift completion and revokes ALL associated seller terminal
// sessions in the same transaction, before this service returns success.
// The physical tap is represented by an authenticated explicit POST action;
// it is not an automatic scheduled start.
class TimoPosShiftService {
  constructor({ repository, clock = () => new Date() } = {}) {
    if (!repository) throw new Error('shift repository required');
    this.repository = repository;
    this.clock = clock;
  }
  async start({ session, seller, terminal, schedule, devices, requestedBySeller }) {
    if (requestedBySeller !== true) throw shiftError('EXPLICIT_CONFIRMATION_REQUIRED');
    if (!session?.active || session.revokedAt) throw shiftError('AUTH_REQUIRED');
    const shift = await this.repository.findActiveShift(terminal?.id);
    const now = this.clock();
    if (!canStartShift({now, schedule, seller, terminal, shift, session})) {
      throw shiftError('SHIFT_OPEN_NOT_ALLOWED');
    }
    return this.repository.startShiftAtomic({
      sellerId: seller.id, terminalId: terminal.id, pointId: terminal.pointId,
      startedAt: now, startedBySeller: true, sessionTokenHash: session.tokenHash,
    });
  }
  async close({ session, seller, terminal, requestedBySeller }) {
    if (requestedBySeller !== true) throw shiftError('EXPLICIT_CONFIRMATION_REQUIRED');
    if (!session?.active || session.revokedAt || session.sellerId !== seller?.id ||
        session.terminalId !== terminal?.id) throw shiftError('AUTH_REQUIRED');
    const now = this.clock();
    // If transaction fails, do not claim the shift was closed and keep UI
    // in uncertain state until refreshed from backend. No local-only close.
    const result = await this.repository.closeShiftAndRevokeSessionsAtomic({
      sellerId: seller.id, terminalId: terminal.id, pointId: terminal.pointId,
      closedAt: now,
    });
    if (!result || result.status !== 'CLOSED') throw shiftError('CLOSE_NOT_CONFIRMED');
    return {
      shiftId: result.id, status: 'CLOSED', closedAt: now.toISOString(),
      lockDisplayAt: new Date(now.getTime() + 30000).toISOString(),
      sessionRevoked: true, summary: result.summary || null,
    };
  }
}
module.exports = { TimoPosShiftService };
