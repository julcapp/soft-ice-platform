const { test } = require('node:test');
const assert = require('node:assert/strict');
const { AdminAuthService } = require('../src/platform/security/AdminAuthService');
test('new passwords shorter than nine characters are rejected; nine and longer pass policy', async () => {
  const service = new AdminAuthService({ otpSecret: null });
  for (const length of [0, 8, 129]) await assert.rejects(service.requestPasswordChange({}, { channel: 'MAX', currentPassword: 'current', newPassword: 'x'.repeat(length) }), { code: 'ADMIN_PASSWORD_POLICY' });
  for (const length of [9, 24, 128]) await assert.rejects(service.requestPasswordChange({}, { channel: 'MAX', currentPassword: 'current', newPassword: 'x'.repeat(length) }), { code: 'ADMIN_SECURITY_DELIVERY_UNAVAILABLE' });
});
