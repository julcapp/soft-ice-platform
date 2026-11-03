const test = require('node:test');
const assert = require('node:assert/strict');

const { cleanMailbox } = require('../src/platform/mail/SmtpMailTransport');

test('cleanMailbox accepts ordinary transactional mailbox', () => {
  assert.equal(cleanMailbox('no-reply@utimoshi.ru', 'from'), 'no-reply@utimoshi.ru');
  assert.equal(cleanMailbox(' customer+club@example.com ', 'to'), 'customer+club@example.com');
});

test('cleanMailbox rejects header injection and malformed address', () => {
  assert.throws(() => cleanMailbox('a@example.com\r\nBcc: victim@example.com', 'to'));
  assert.throws(() => cleanMailbox('not-an-email', 'to'));
  assert.throws(() => cleanMailbox('a@example.com> RCPT TO:<x@example.com', 'to'));
});
