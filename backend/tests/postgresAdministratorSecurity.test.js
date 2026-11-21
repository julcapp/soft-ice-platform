const assert = require('node:assert/strict');
const { test } = require('node:test');
const { PrismaClient } = require('@prisma/client');
const { AdministratorSecurityService } = require('../src/platform/security/AdministratorSecurity');
const enabled = Boolean(process.env.DATABASE_URL); const pg = enabled ? test : test.skip; const prisma = enabled ? new PrismaClient() : null;
const ids = { organization: 'org_admin_security_pg', member: 'member_admin_security_pg', administrator: 'admin_security_pg' };

async function reset() {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('soft_ice.audit_maintenance', 'on', true)`;
    await tx.transactionalOutboxEvent.deleteMany({ where: { organizationId: ids.organization } });
    await tx.auditEvent.deleteMany({ where: { organizationId: ids.organization } });
  });
  await prisma.administratorSession.deleteMany({ where: { organizationId: ids.organization } });
  await prisma.administratorPermissionBinding.deleteMany({ where: { organizationId: ids.organization } });
  await prisma.administratorRoleBinding.deleteMany({ where: { organizationId: ids.organization } });
  await prisma.administratorBreakGlassGrant.deleteMany({ where: { organizationId: ids.organization } });
  await prisma.administratorApproval.deleteMany({ where: { organizationId: ids.organization } });
  await prisma.administrator.deleteMany({ where: { organizationId: ids.organization } });
  await prisma.organizationMember.deleteMany({ where: { organizationId: ids.organization } });
  await prisma.organization.deleteMany({ where: { id: ids.organization } });
  await prisma.organization.create({ data: { id: ids.organization, fullName: 'Security test organization', shortName: 'Security test', organizationType: 'TEST' } });
  await prisma.organizationMember.create({ data: { id: ids.member, organizationId: ids.organization, fullName: 'Security Tester', position: 'Administrator' } });
  await prisma.administrator.create({ data: { id: ids.administrator, organizationId: ids.organization, memberId: ids.member, roleBindings: { create: { role: 'ACCESS_ADMINISTRATOR', grantedBy: 'fixture' } } } });
}

pg('PostgreSQL session creation and revocation are durable, tenant scoped, audited and outboxed', async () => {
  await reset(); const service = new AdministratorSecurityService({ prisma, tokenFactory: () => 'pg-opaque-token' });
  const created = await service.createSession({ administratorId: ids.administrator, authenticationMethod: 'test_verified_identity', correlationId: 'corr-admin-pg' });
  const principal = await service.validateToken(created.token, { organizationId: ids.organization, requiredPermission: 'admin:session:revoke' });
  await assert.rejects(service.validateToken(created.token, { organizationId: 'org-other' }), { code: 'ADMIN_TENANT_SCOPE_DENIED' });
  await service.revokeSession({ sessionId: created.session.id, actor: principal, correlationId: 'corr-admin-revoke-pg' });
  assert.equal(await prisma.auditEvent.count({ where: { organizationId: ids.organization } }), 3);
  assert.equal(await prisma.transactionalOutboxEvent.count({ where: { organizationId: ids.organization } }), 2);
  await assert.rejects(service.validateToken(created.token), { code: 'ADMIN_SESSION_INVALID' });
});

pg('PostgreSQL enforces tenant membership and approval separation of duties', async () => {
  await reset();
  await assert.rejects(prisma.administrator.create({ data: { organizationId: ids.organization, memberId: 'missing-member' } }));
  await assert.rejects(prisma.administratorApproval.create({ data: { organizationId: ids.organization, requesterAdministratorId: ids.administrator, approverAdministratorId: ids.administrator, action: 'TEST', targetType: 'test', targetId: 'x', requestFingerprint: 'self-approval', reason: 'test', expiresAt: new Date(Date.now()+60000) } }));
  await assert.rejects(prisma.administratorApproval.create({ data: { organizationId: ids.organization, requesterAdministratorId: ids.administrator, action: 'TEST', targetType: 'test', targetId: 'x', requestFingerprint: 'approved-without-decision', reason: 'test', status: 'APPROVED', expiresAt: new Date(Date.now()+60000) } }));
});

pg('PostgreSQL rejects update and delete of administrator security audit events', async () => {
  await reset(); const service = new AdministratorSecurityService({ prisma, tokenFactory: () => 'pg-audit-token' });
  await service.createSession({ administratorId: ids.administrator, authenticationMethod: 'test_verified_identity' });
  const audit = await prisma.auditEvent.findFirstOrThrow({ where: { organizationId: ids.organization, eventType: 'administrator.session.created' } });
  await assert.rejects(prisma.auditEvent.update({ where: { id: audit.id }, data: { action: 'TAMPERED' } }));
  await assert.rejects(prisma.auditEvent.delete({ where: { id: audit.id } }));
});

test.after(async () => { if (prisma) { await reset(); await prisma.administratorRoleBinding.deleteMany({ where: { organizationId: ids.organization } }); await prisma.administrator.deleteMany({ where: { organizationId: ids.organization } }); await prisma.organizationMember.deleteMany({ where: { organizationId: ids.organization } }); await prisma.organization.deleteMany({ where: { id: ids.organization } }); await prisma.$disconnect(); } });
