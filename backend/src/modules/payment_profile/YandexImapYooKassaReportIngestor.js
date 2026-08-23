const tls = require('tls');
const { TextDecoder } = require('util');

const DEFAULT_FOLDER = 'юкасса отчеты';
const DEFAULT_SENDER = 'reports@yoomoney.ru';
const MAX_MESSAGES_PER_RUN = 50;

class YandexImapYooKassaReportIngestor {
  constructor({ reportReconciliationService, config = process.env, clientFactory = null, logger = console }) {
    if (!reportReconciliationService) throw new Error('reportReconciliationService is required');
    this.reportReconciliationService = reportReconciliationService;
    this.config = config;
    this.clientFactory = clientFactory || ((options) => new SimpleImapClient(options));
    this.logger = logger;
  }

  isConfigured() {
    return Boolean(this.config.YOOKASSA_REPORT_IMAP_USER && this.config.YOOKASSA_REPORT_IMAP_APP_PASSWORD);
  }

  async run() {
    if (!this.isConfigured()) return { status: 'BLOCKED', reason: 'YANDEX_IMAP_CREDENTIALS_MISSING', processed: 0, skipped: 0, failed: 0 };
    const folder = this.config.YOOKASSA_REPORT_IMAP_FOLDER || DEFAULT_FOLDER;
    const sender = this.config.YOOKASSA_REPORT_IMAP_SENDER || DEFAULT_SENDER;
    const client = this.clientFactory({
      host: this.config.YOOKASSA_REPORT_IMAP_HOST || 'imap.yandex.ru',
      port: Number(this.config.YOOKASSA_REPORT_IMAP_PORT || 993),
      user: this.config.YOOKASSA_REPORT_IMAP_USER,
      password: this.config.YOOKASSA_REPORT_IMAP_APP_PASSWORD,
      rejectUnauthorized: this.config.YOOKASSA_REPORT_IMAP_TLS_REJECT_UNAUTHORIZED !== 'false',
    });
    let processed = 0; let skipped = 0; let failed = 0;
    try {
      await client.connect();
      await client.select(folder);
      const uids = await client.searchFrom(sender);
      const selected = uids.slice(-MAX_MESSAGES_PER_RUN);
      for (const uid of selected) {
        try {
          const raw = await client.fetchRaw(uid);
          const mail = parseMimeMessage(raw);
          if (normalizeAddress(mail.from) !== sender.toLowerCase()) { skipped += 1; continue; }
          const reportType = classifySubject(mail.subject);
          if (!reportType) { skipped += 1; continue; }
          const csvAttachments = mail.attachments.filter((item) => /\.csv$/i.test(item.filename || '') || /text\/csv/i.test(item.contentType || ''));
          if (!csvAttachments.length) { skipped += 1; continue; }
          for (const attachment of csvAttachments) {
            await this.reportReconciliationService.importCsv({
              reportType,
              filename: attachment.filename || `yookassa-${reportType.toLowerCase()}-${uid}.csv`,
              content: attachment.content,
              source: 'YANDEX_IMAP',
              sourceMessageUid: String(uid),
            });
            processed += 1;
          }
        } catch (error) {
          failed += 1;
          this.logger.error?.('YooKassa IMAP report processing failed', { uid, code: error.code || error.message });
        }
      }
      return { status: failed ? 'DEGRADED' : 'READY', folder, sender, messagesFound: uids.length, processed, skipped, failed };
    } finally {
      await client.close().catch(() => {});
    }
  }
}

class SimpleImapClient {
  constructor({ host, port, user, password, rejectUnauthorized = true }) {
    this.host = host; this.port = port; this.user = user; this.password = password; this.rejectUnauthorized = rejectUnauthorized;
    this.socket = null; this.buffer = ''; this.tag = 0; this.waiters = [];
  }

  async connect() {
    await new Promise((resolve, reject) => {
      const socket = tls.connect({ host: this.host, port: this.port, servername: this.host, rejectUnauthorized: this.rejectUnauthorized }, resolve);
      socket.setEncoding('utf8'); socket.on('data', (chunk) => { this.buffer += chunk; this.#flush(); }); socket.on('error', reject); this.socket = socket;
    });
    await this.#waitForGreeting();
    await this.command(`LOGIN ${quote(this.user)} ${quote(this.password)}`);
  }

  async select(folder) { await this.command(`SELECT ${quote(encodeModifiedUtf7(folder))}`); }
  async searchFrom(sender) {
    const response = await this.command(`UID SEARCH FROM ${quote(sender)}`);
    const line = response.lines.find((item) => item.startsWith('* SEARCH')) || '* SEARCH';
    return line.replace('* SEARCH', '').trim().split(/\s+/).filter(Boolean).map(Number).filter(Number.isFinite);
  }
  async fetchRaw(uid) {
    const response = await this.command(`UID FETCH ${uid} (BODY.PEEK[])`, { literal: true });
    return response.literal || '';
  }
  async close() { if (!this.socket) return; try { await this.command('LOGOUT'); } catch {} this.socket.end(); this.socket = null; }

  async command(text, { literal = false } = {}) {
    const tag = `A${String(++this.tag).padStart(4, '0')}`;
    const promise = new Promise((resolve, reject) => this.waiters.push({ tag, resolve, reject, lines: [], literal: literal ? '' : null, expectedLiteral: 0 }));
    this.socket.write(`${tag} ${text}\r\n`); this.#flush(); return promise;
  }
  async #waitForGreeting() {
    if (this.buffer.includes('\r\n')) { const line = this.#takeLine(); if (!line.startsWith('* OK')) throw new Error(`IMAP greeting failed: ${line}`); return; }
    await new Promise((resolve, reject) => this.waiters.push({ tag: '*GREETING*', resolve, reject, lines: [] }));
  }
  #takeLine() { const index = this.buffer.indexOf('\r\n'); if (index < 0) return null; const line = this.buffer.slice(0, index); this.buffer = this.buffer.slice(index + 2); return line; }
  #flush() {
    if (this.waiters[0]?.tag === '*GREETING*' && this.buffer.includes('\r\n')) {
      const waiter = this.waiters.shift(); const line = this.#takeLine(); if (line.startsWith('* OK')) waiter.resolve(); else waiter.reject(new Error(`IMAP greeting failed: ${line}`));
    }
    const waiter = this.waiters[0]; if (!waiter || waiter.tag === '*GREETING*') return;
    while (true) {
      if (waiter.expectedLiteral > 0) {
        if (Buffer.byteLength(this.buffer, 'utf8') < waiter.expectedLiteral) return;
        const bytes = Buffer.from(this.buffer, 'utf8'); const literalBytes = bytes.subarray(0, waiter.expectedLiteral); waiter.literal += literalBytes.toString('binary'); this.buffer = bytes.subarray(waiter.expectedLiteral).toString('utf8'); waiter.expectedLiteral = 0; continue;
      }
      const line = this.#takeLine(); if (line === null) return;
      waiter.lines.push(line);
      const literalMatch = line.match(/\{(\d+)\}$/); if (literalMatch) { waiter.expectedLiteral = Number(literalMatch[1]); continue; }
      if (line.startsWith(`${waiter.tag} `)) {
        this.waiters.shift();
        if (/^A\d+ OK\b/.test(line)) waiter.resolve({ lines: waiter.lines, literal: waiter.literal ? Buffer.from(waiter.literal, 'binary').toString('utf8') : null });
        else waiter.reject(new Error(`IMAP command failed: ${line}`));
        return;
      }
    }
  }
}

function classifySubject(subject) {
  const value = decodeMimeWords(subject || '').toLowerCase().replace(/ё/g, 'е');
  if (value.includes('реестр') && value.includes('возврат')) return 'REFUNDS';
  if (value.includes('реестр') && value.includes('платеж')) return 'PAYMENTS';
  return null;
}

function parseMimeMessage(raw) {
  const normalized = String(raw || '').replace(/\r\n/g, '\n');
  const split = normalized.indexOf('\n\n');
  const headersText = split >= 0 ? normalized.slice(0, split) : normalized;
  const body = split >= 0 ? normalized.slice(split + 2) : '';
  const headers = parseHeaders(headersText);
  const contentType = headers['content-type'] || '';
  const boundary = parameter(contentType, 'boundary');
  const attachments = [];
  if (boundary) {
    for (const part of body.split(`--${boundary}`).slice(1)) {
      if (part.startsWith('--')) break;
      const clean = part.replace(/^\n|\n$/g, ''); const partSplit = clean.indexOf('\n\n'); if (partSplit < 0) continue;
      const partHeaders = parseHeaders(clean.slice(0, partSplit)); const partBody = clean.slice(partSplit + 2).replace(/\n--$/, '');
      const disposition = partHeaders['content-disposition'] || ''; const partType = partHeaders['content-type'] || 'application/octet-stream';
      const filename = decodeMimeWords(parameter(disposition, 'filename') || parameter(partType, 'name') || '');
      if (!filename && !/attachment/i.test(disposition)) continue;
      const transfer = (partHeaders['content-transfer-encoding'] || '').toLowerCase();
      let content;
      if (transfer === 'base64') content = Buffer.from(partBody.replace(/\s+/g, ''), 'base64').toString('utf8');
      else if (transfer === 'quoted-printable') content = decodeQuotedPrintable(partBody);
      else content = partBody;
      attachments.push({ filename, contentType: partType.split(';')[0].trim(), content });
    }
  }
  return { from: headers.from || '', subject: headers.subject || '', attachments };
}

function parseHeaders(text) {
  const unfolded = text.replace(/\n[ \t]+/g, ' '); const result = {};
  for (const line of unfolded.split('\n')) { const index = line.indexOf(':'); if (index < 1) continue; result[line.slice(0, index).trim().toLowerCase()] = line.slice(index + 1).trim(); }
  return result;
}
function parameter(value, name) { const match = String(value || '').match(new RegExp(`${name}=(?:"([^"]+)"|([^;\\s]+))`, 'i')); return match ? (match[1] || match[2]) : null; }
function normalizeAddress(value) { const match = String(value || '').match(/<([^>]+)>/); return (match ? match[1] : value).trim().toLowerCase(); }
function quote(value) { return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`; }
function decodeQuotedPrintable(value) { return String(value).replace(/=\n/g, '').replace(/=([0-9A-F]{2})/gi, (_m, hex) => String.fromCharCode(parseInt(hex, 16))); }
function decodeMimeWords(value) {
  return String(value || '').replace(/=\?([^?]+)\?([BQ])\?([^?]+)\?=/gi, (_m, charset, encoding, data) => {
    let bytes; if (encoding.toUpperCase() === 'B') bytes = Buffer.from(data, 'base64'); else bytes = Buffer.from(data.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (_x, h) => String.fromCharCode(parseInt(h, 16))), 'binary');
    try { return new TextDecoder(charset.toLowerCase()).decode(bytes); } catch { return bytes.toString('utf8'); }
  });
}
function encodeModifiedUtf7(value) {
  return String(value).replace(/[^\x20-\x7e]+/g, (chunk) => `&${Buffer.from(chunk, 'utf16le').swap16().toString('base64').replace(/\//g, ',').replace(/=+$/g, '')}-`).replace(/&/g, (match, offset, whole) => whole.slice(offset).startsWith('&') ? match : '&-');
}

module.exports = { YandexImapYooKassaReportIngestor, SimpleImapClient, classifySubject, parseMimeMessage, encodeModifiedUtf7, DEFAULT_FOLDER, DEFAULT_SENDER };
