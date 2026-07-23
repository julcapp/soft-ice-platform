function toConsentDto(consent) {
  return {
    type: 'customer_consent', id: consent.id,
    attributes: {
      consent_type: consent.consentType,
      is_granted: consent.isGranted,
      source_channel: consent.sourceChannel,
      consented_at: consent.consentedAt.toISOString(),
      revoked_at: consent.revokedAt ? consent.revokedAt.toISOString() : null,
      decision_id: consent.decisionId,
      document_type: consent.document.documentType,
      document_version: consent.document.version,
    },
  };
}

module.exports = { toConsentDto };
