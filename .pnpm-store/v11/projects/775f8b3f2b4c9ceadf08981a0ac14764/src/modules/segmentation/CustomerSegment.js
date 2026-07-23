class CustomerSegment {
  constructor(record) {
    if (!record || !record.customerId || !record.segmentId || !(record.assignedAt instanceof Date)) {
      throw new TypeError('Customer segment assignment is invalid.');
    }
    Object.assign(this, record);
  }

  get active() { return this.unassignedAt == null; }
}

module.exports = { CustomerSegment };
