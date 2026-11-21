const { hammingDistance } = require('./ImageFingerprintService');

class DuplicateDetector {
  constructor({ repository, maxPHashDistance = 8, maxDHashDistance = 8 } = {}) {
    if (!repository) throw new Error('Photo verification repository is required');
    this.repository = repository;
    this.maxPHashDistance = maxPHashDistance;
    this.maxDHashDistance = maxDHashDistance;
  }

  async analyze({ photoChallengeId, sha256, pHash, dHash }) {
    const candidates = await this.repository.findFingerprintCandidates({
      photoChallengeId,
      sha256,
      pHash,
      dHash,
    });

    let exactDuplicate = null;
    let nearest = null;

    for (const candidate of candidates) {
      if (candidate.sha256 === sha256) {
        exactDuplicate = candidate;
        break;
      }

      const pDistance = pHash && candidate.pHash ? hammingDistance(pHash, candidate.pHash) : null;
      const dDistance = dHash && candidate.dHash ? hammingDistance(dHash, candidate.dHash) : null;
      const isNear = (pDistance != null && pDistance <= this.maxPHashDistance)
        || (dDistance != null && dDistance <= this.maxDHashDistance);

      if (!isNear) continue;
      const score = Math.min(pDistance ?? Number.POSITIVE_INFINITY, dDistance ?? Number.POSITIVE_INFINITY);
      if (!nearest || score < nearest.score) nearest = { candidate, pDistance, dDistance, score };
    }

    return {
      duplicate: Boolean(exactDuplicate),
      nearDuplicate: !exactDuplicate && Boolean(nearest),
      matchedPhotoChallengeId: exactDuplicate?.photoChallengeId || nearest?.candidate?.photoChallengeId || null,
      exactSha256Match: Boolean(exactDuplicate),
      pHashDistance: nearest?.pDistance ?? null,
      dHashDistance: nearest?.dDistance ?? null,
      signals: [
        ...(exactDuplicate ? ['exact_duplicate'] : []),
        ...(!exactDuplicate && nearest ? ['near_duplicate'] : []),
      ],
    };
  }
}

module.exports = { DuplicateDetector };
