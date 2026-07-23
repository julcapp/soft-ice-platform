const SEGMENT_TYPES = Object.freeze(['MANUAL', 'SYSTEM']);
const SEGMENT_STATUSES = Object.freeze(['ACTIVE', 'INACTIVE']);
const SYSTEM_SEGMENT_CODES = Object.freeze([
  'NEW_CUSTOMER', 'ACTIVE_CUSTOMER', 'VIP_CUSTOMER', 'BIRTHDAY_UPCOMING', 'CLUB_MEMBER',
]);

class Segment {
  constructor(record) {
    if (!record || !isCode(record.code) || !SEGMENT_TYPES.includes(record.type) || !SEGMENT_STATUSES.includes(record.status)) {
      throw new TypeError('Segment record is invalid.');
    }
    Object.assign(this, record);
  }
}

function isCode(value) { return typeof value === 'string' && /^[A-Z][A-Z0-9_]{1,63}$/.test(value); }

module.exports = { SEGMENT_STATUSES, SEGMENT_TYPES, SYSTEM_SEGMENT_CODES, Segment, isCode };
