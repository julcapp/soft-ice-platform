const test = require('node:test');
const assert = require('node:assert/strict');
const {
  YandexImapYooKassaReportIngestor,
  classifySubject,
  extractReportDate,
  parseMimeMessage,
  encodeModifiedUtf7,
} = require('../src/modules/payment_profile/YandexImapYooKassaReportIngestor');

test('classifies YooKassa payment and refund registry subjects', () => {
  assert.equal(classifySubject('Реестр платежей за 22.08.2026'), 'PAYMENTS');
  assert.equal(classifySubject('Реестр возвратов за 22.08.2026'), 'REFUNDS');
  assert.equal(classifySubject('Другое письмо'), null);
});

test('extracts report date from subject or filename', () => {
  assert.equal(extractReportDate('Реестр платежей 22.08.2026'), '2026-08-22');
  assert.equal(extractReportDate('payments_2026-08-22.csv'), '2026-08-22');
  assert.equal(extractReportDate('без даты'), null);
});

test('parses base64 CSV attachment from MIME message', () => {
  const csv = 'Идентификатор платежа;Сумма платежа\npay-1;100.00\n';
  const raw = [
    'From: reports@yoomoney.ru',
    'Subject: =?UTF-8?B?0KDQtdC10YHRgtGAINC/0LvQsNGC0LXQttC10LkgMjIuMDguMjAyNg==?=',
    'Content-Type: multipart/mixed; boundary="abc"',
    '',
    '--abc',
    'Content-Type: text/csv; name="payments_2026-08-22.csv"',
    'Content-Disposition: attachment; filename="payments_2026-08-22.csv"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(csv).toString('base64'),
    '--abc--',
    '',
  ].join('\r\n');
  const parsed = parseMimeMessage(raw);
  assert.equal(parsed.from, 'reports@yoomoney.ru');
  assert.equal(parsed.attachments.length, 1);
  assert.equal(parsed.attachments[0].filename, 'payments_2026-08-22.csv');
  assert.equal(parsed.attachments[0].content, csv);
});

test('ingestor only reads configured folder/sender and imports matching csv', async () => {
  const calls = [];
  const client = {
    connect: async () => calls.push(['connect']),
    select: async (folder) => calls.push(['select', folder]),
    searchFrom: async (sender) => { calls.push(['searchFrom', sender]); return [101]; },
    fetchRaw: async () => [
      'From: YooMoney <reports@yoomoney.ru>',
      'Subject: Реестр платежей 22.08.2026',
      'Content-Type: multipart/mixed; boundary="abc"',
      '',
      '--abc',
      'Content-Type: text/csv; name="payments_2026-08-22.csv"',
      'Content-Disposition: attachment; filename="payments_2026-08-22.csv"',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from('Идентификатор платежа;Сумма платежа\npay-1;100.00\n').toString('base64'),
      '--abc--',
      '',
    ].join('\r\n'),
    close: async () => calls.push(['close']),
  };
  const imported = [];
  const ingestor = new YandexImapYooKassaReportIngestor({
    reportReconciliationService: { importCsv: async (input) => imported.push(input) },
    config: {
      YOOKASSA_REPORT_IMAP_USER: 'julcapp@yandex.ru',
      YOOKASSA_REPORT_IMAP_APP_PASSWORD: 'test-app-password',
      YOOKASSA_REPORT_IMAP_FOLDER: 'юкасса отчеты',
      YOOKASSA_REPORT_IMAP_SENDER: 'reports@yoomoney.ru',
    },
    clientFactory: () => client,
    logger: { error() {} },
  });
  const result = await ingestor.run();
  assert.equal(result.status, 'READY');
  assert.equal(result.processed, 1);
  assert.deepEqual(calls[1], ['select', 'юкасса отчеты']);
  assert.deepEqual(calls[2], ['searchFrom', 'reports@yoomoney.ru']);
  assert.equal(imported[0].reportType, 'PAYMENTS');
  assert.equal(imported[0].reportDate, '2026-08-22');
  assert.equal(imported[0].actorId, 'yandex-imap-ingestor');
});

test('Russian folder is encoded to IMAP modified UTF-7', () => {
  const encoded = encodeModifiedUtf7('юкасса отчеты');
  assert.match(encoded, /^&.+-/);
  assert.equal(encoded.includes('ю'), false);
});
