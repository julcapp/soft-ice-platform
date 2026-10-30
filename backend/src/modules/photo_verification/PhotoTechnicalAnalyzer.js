class PhotoTechnicalAnalyzer {
  constructor({ metadataAnalyzer, fingerprintService, duplicateDetector, repository }) {
    if (!metadataAnalyzer) throw new Error('metadataAnalyzer is required');
    if (!fingerprintService) throw new Error('fingerprintService is required');
    if (!duplicateDetector) throw new Error('duplicateDetector is required');
    if (!repository) throw new Error('repository is required');
    this.metadataAnalyzer = metadataAnalyzer;
    this.fingerprintService = fingerprintService;
    this.duplicateDetector = duplicateDetector;
    this.repository = repository;
  }

  async analyze({ photoChallengeId, buffer, mimeType, receivedAt }) {
    const metadataResult = this.metadataAnalyzer.analyze({ buffer, mimeType, receivedAt });
    const fingerprint = await this.fingerprintService.fingerprint(buffer);
    const duplicateResult = await this.duplicateDetector.analyze({ photoChallengeId, ...fingerprint });

    await this.repository.upsertFingerprint({ photoChallengeId, ...fingerprint });
    await this.repository.recordEvent({
      photoChallengeId,
      eventType: 'technical_analysis_completed',
      eventSource: 'photo_verification_agent',
      payload: {
        exifPresent: metadataResult.exifPresent,
        metadataRiskSignals: metadataResult.metadataRiskSignals,
        duplicate: duplicateResult.duplicate,
        nearDuplicate: duplicateResult.nearDuplicate,
        perceptualAvailable: fingerprint.perceptualAvailable,
      },
    });

    return {
      metadataResult,
      fingerprint,
      duplicateResult,
      riskSignals: [
        ...metadataResult.metadataRiskSignals,
        ...duplicateResult.signals,
      ],
    };
  }
}

module.exports = { PhotoTechnicalAnalyzer };
