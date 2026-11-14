'use strict';
const crypto = require('node:crypto');
const { normalizeSellerPhone, tokenHash } = require('./SellerMaxAuthService');

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
function maskPhone(phone) {
  return String(phone).replace(/^(\+7\d{3})\d{5}(\d{2})$/, '$1*****$2');
}

// Keep the MAX recipient encrypted in PostgreSQL. decryptRecipient is a
// server-side function backed by the existing bot key service; never send the
// ciphertext/recipient to the browser.
class PrismaSellerMaxAuthRepository {
  constructor({ prisma, secret, decryptRecipient, clock = () => new Date() }) {
    if (!prisma || typeof decryptRecipient !== 'function' || !secret) throw new Error('seller auth repository dependencies');
    this.prisma = prisma;
    this.secret = secret;
    this.decryptRecipient = decryptRecipient;
    this.clock = clock;
  }

  async sellerForPoint(tx, { sellerId, pointId, terminalId }) {
    const [terminal, member, location, assignment, role, identity] = await Promise.all([
      tx.timoPosTerminal.findUnique({ where: { terminalId } }),
      tx.organizationMember.findUnique({ where: { id: sellerId } }),
      tx.organizationLocation.findUnique({ where: { id: pointId } }),
      tx.timoPosSellerPoint.findUnique({ where: { sellerId_pointId: { sellerId, pointId } } }),
      tx.organizationRoleAssignment.findFirst({ where: { memberId: sellerId, role: 'SELLER', revokedAt: null } }),
      tx.timoPosMaxIdentity.findUnique({ where: { sellerId } }),
    ]);
    if (!terminal?.active || terminal.pointId !== pointId ||
      !member || member.status !== 'ACTIVE' || member.archivedAt ||
      !location || location.status !== 'ACTIVE' || location.archivedAt ||
      member.organizationId !== location.organizationId ||
      !assignment?.active || !role || role.organizationId !== member.organizationId ||
      !identity?.verifiedAt || identity.revokedAt ||
      identity.verifiedPhoneHash !== tokenHash(this.secret, 'seller-phone', normalizeSellerPhone(member.phone))) return null;
    return { member, location, identity };
  }

  async resolveSellerWithVerifiedMax({ phone, terminalId }) {
    const terminal = await this.prisma.timoPosTerminal.findUnique({ where: { terminalId } });
    if (!terminal?.active) return null;
    // Legacy OrganizationMember phone has no unique constraint; ambiguous
    // matches fail closed instead of selecting the wrong seller.
    const matches = await this.prisma.organizationMember.findMany({ where: { phone }, take: 2 });
    if (matches.length !== 1) return null;
    const match = await this.sellerForPoint(this.prisma, {
      sellerId: matches[0].id, pointId: terminal.pointId, terminalId,
    });
    if (!match) return null;
    const recipientId = await this.decryptRecipient(match.identity.recipientCiphertext);
    if (!recipientId) return null;
    return { sellerId: match.member.id, pointId: match.location.id, maxRecipientId: recipientId };
  }

  async createChallenge(data) {
    await this.prisma.$transaction(async (tx) => {
      await tx.timoPosLoginChallenge.updateMany({
        where: { sellerId: data.sellerId, terminalId: data.terminalId, status: { in: ['PENDING', 'SENT'] } },
        data: { status: 'INVALIDATED' },
      });
      await tx.timoPosLoginChallenge.create({ data: {
        ...data, status: 'PENDING', attempts: 0,
      } });
    });
  }
  async markSent(id) {
    const result = await this.prisma.timoPosLoginChallenge.updateMany({
      where: { id, status: 'PENDING', expiresAt: { gt: this.clock() } },
      data: { status: 'SENT', sentAt: this.clock() },
    });
    if (result.count !== 1) throw Error('MAX challenge expired before sending completed');
  }
  async invalidate(id) {
    await this.prisma.timoPosLoginChallenge.updateMany({
      where: { id, status: { in: ['PENDING', 'SENT'] } }, data: { status: 'INVALIDATED' },
    });
  }

  async consumeChallenge({ challengeId, codeHash, terminalId, at, sessionHash }) {
    return this.prisma.$transaction(async (tx) => {
      const c = await tx.timoPosLoginChallenge.findUnique({ where: { id: challengeId } });
      if (!c || c.status !== 'SENT' || c.expiresAt <= at ||
          c.terminalId !== terminalId || c.attempts >= c.maxAttempts) return null;
      if (c.codeHash !== codeHash) {
        await tx.timoPosLoginChallenge.updateMany({
          where: { id: challengeId, status: 'SENT', attempts: c.attempts },
          data: { attempts: { increment: 1 } },
        });
        return null;
      }
      const checked = await this.sellerForPoint(tx, {
        sellerId: c.sellerId, pointId: c.pointId, terminalId,
      });
      if (!checked) return null;
      const locked = await tx.timoPosLoginChallenge.updateMany({
        where: { id: challengeId, status: 'SENT', attempts: c.attempts, expiresAt: { gt: at } },
        data: { status: 'CONSUMED', consumedAt: at, attempts: { increment: 1 } },
      });
      if (locked.count !== 1) return null;
      await tx.timoPosSellerSession.create({ data: {
        tokenHash: sessionHash, sellerId: c.sellerId, pointId: c.pointId, terminalId,
        expiresAt: new Date(at.getTime() + SESSION_TTL_MS),
      } });
      return {
        sellerId: c.sellerId, fullName: checked.member.fullName,
        maskedPhone: maskPhone(checked.member.phone), role: 'SELLER',
        point: { id: checked.location.id, name: checked.location.name },
      };
    });
  }

  async revokeSession(tokenHashValue) {
    await this.prisma.timoPosSellerSession.updateMany({
      where: { tokenHash: tokenHashValue, revokedAt: null }, data: { revokedAt: this.clock() },
    });
  }

  async resolveSession(sessionToken) {
    const hash = tokenHash(this.secret, 'seller-session', sessionToken);
    const s = await this.prisma.timoPosSellerSession.findUnique({ where: { tokenHash: hash } });
    if (!s || s.revokedAt || s.expiresAt <= this.clock()) return null;
    const checked = await this.sellerForPoint(this.prisma, s);
    if (!checked) return null;
    return {
      sellerId: s.sellerId, pointId: s.pointId, terminalId: s.terminalId,
      fullName: checked.member.fullName, maskedPhone: maskPhone(checked.member.phone),
      pointName: checked.location.name, role: 'SELLER',
    };
  }
}
module.exports = { PrismaSellerMaxAuthRepository, SESSION_TTL_MS };
