const crypto = require('crypto');

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function createOpaqueToken(prefix = 'ut_access') {
  return `${prefix}_${crypto.randomBytes(32).toString('base64url')}`;
}

module.exports = {
  createOpaqueToken,
  sha256,
};
