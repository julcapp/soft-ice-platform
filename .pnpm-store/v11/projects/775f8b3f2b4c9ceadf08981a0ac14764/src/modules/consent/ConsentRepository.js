class ConsentRepository {
  constructor(prisma) { this.prisma = prisma; }

  async append(customerId, command) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.customerConsent.findUnique({
        where: { customerId_decisionId: { customerId, decisionId: command.decisionId } },
        include: { document: true },
      });
      if (existing) return { consent: existing, created: false };

      const document = await tx.documentVersion.upsert({
        where: { documentType_version: { documentType: command.documentType, version: command.documentVersion } },
        update: {},
        create: {
          documentType: command.documentType,
          version: command.documentVersion,
          title: command.documentTitle,
          filePath: `policy://${command.documentType}/${command.documentVersion}`,
          effectiveFrom: command.consentedAt,
        },
      });
      const consent = await tx.customerConsent.create({
        data: {
          customerId,
          documentId: document.id,
          consentType: command.consentType,
          isGranted: command.isGranted,
          consentedAt: command.consentedAt,
          revokedAt: command.isGranted ? null : command.consentedAt,
          sourceChannel: command.sourceChannel,
          decisionId: command.decisionId,
          correlationId: command.correlationId,
        },
        include: { document: true },
      });
      return { consent, created: true };
    });
  }

  findHistory(customerId) {
    return this.prisma.customerConsent.findMany({
      where: { customerId },
      include: { document: true },
      orderBy: [{ consentedAt: 'desc' }, { id: 'desc' }],
    });
  }
}

module.exports = { ConsentRepository };
