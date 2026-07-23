class SegmentRule {
  constructor(record) {
    if (!record || !record.segmentId || typeof record.ruleType !== 'string' || !record.criteria || Array.isArray(record.criteria)) {
      throw new TypeError('Segment rule is invalid.');
    }
    Object.assign(this, record);
  }
}

module.exports = { SegmentRule };
