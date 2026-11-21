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
    const sender = (this.config.YOOKASSA_REPORT_IMAP_SENDER || DEFAULT_SENDER).toLowerCase();
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
      for (const uid of uids.slice(-MAX_MESSAGES_PER_RUN)) {
        try {
          const raw = await client.fetchRaw(uid);
          const mail = parseMimeMessage(raw);
          if (normalizeAddress(mail.from) !== sender) { skipped += 1; continue; }
          const reportType = classifySubject(mail.subject);
          if (!reportType) { skipped += 1; continue; }
          const csvAttachments = mail.attachments.filter((item) => /\.csv$/i.test(item.filename || '') || /text\/csv/i.test(item.contentType || ''));
          if (!csvAttachments.length) { skipped += 1; continue; }
          for (const attachment of csvAttachments) {
            const reportDate = extractReportDate(`${mail.subject} ${attachment.filename || ''}`);
            if (!reportDate) throw taggedError('YOOKASSA_REPORT_DATE_NOT_DETECTED', 'Не удалось определить дату реестра из темы письма или имени CSV-файла.');
            await this.reportReconciliationService.importCsv({
              csvText: attachment.content,
              reportType,
              reportDate,
              fileName: attachment.filename || `yookassa-${reportType.toLowerCase()}-${reportDate}.csv`,
              actorId: 'yandex-imap-ingestor',
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
    this.socket = null; this.buffer = Buffer.alloc(0); this.tag = 0; this.waiters = [];
  }
  async connect() {
    await new Promise((resolve, reject) => {
      const socket = tls.connect({ host: this.host, port: this.port, servername: this.host, rejectUnauthorized: this.rejectUnauthorized }, resolve);
      socket.on('data', (chunk) => { this.buffer = Buffer.concat([this.buffer, chunk]); this.#flush(); }); socket.on('error', reject); this.socket = socket;
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
    const promise = new Promise((resolve, reject) => this.waiters.push({ tag, resolve, reject, lines: [], literal: literal ? Buffer.alloc(0) : null, expectedLiteral: 0 }));
    this.socket.write(`${tag} ${text}\r\n`); this.#flush(); return promise;
  }
  async #waitForGreeting() {
    const line = this.#takeLine(); if (line !== null) { if (!line.startsWith('* OK')) throw new Error(`IMAP greeting failed: ${line}`); return; }
    await new Promise((resolve, reject) => this.waiters.push({ tag: '*GREETING*', resolve, reject, lines: [] }));
  }
  #takeLine() { const marker = this.buffer.indexOf(Buffer.from('\r\n')); if (marker < 0) return null; const line = this.buffer.subarray(0, marker).toString('utf8'); this.buffer = this.buffer.subarray(marker + 2); return line; }
  #flush() {
    if (this.waiters[0]?.tag === '*GREETING*') { const line = this.#takeLine(); if (line === null) return; const waiter = this.waiters.shift(); if (line.startsWith('* OK')) waiter.resolve(); else waiter.reject(new Error(`IMAP greeting failed: ${line}`)); }
    const waiter = this.waiters[0]; if (!waiter || waiter.tag === '*GREETING*') return;
    while (true) {
      if (waiter.expectedLiteral > 0) {
        if (this.buffer.length < waiter.expectedLiteral) return;
        waiter.literal = Buffer.concat([waiter.literal, this.buffer.subarray(0, waiter.expectedLiteral)]); this.buffer = this.buffer.subarray(waiter.expectedLiteral); waiter.expectedLiteral = 0; continue;
      }
      const line = this.#takeLine(); if (line === null) return;
      waiter.lines.push(line);
      const literalMatch = line.match(/\{(\d+)\}$/); if (literalMatch) { waiter.expectedLiteral = Number(literalMatch[1]); continue; }
      if (line.startsWith(`${waiter.tag} `)) {
        this.waiters.shift();
        if (line.startsWith(`${waiter.tag} OK`)) waiter.resolve({ lines: waiter.lines, literal: waiter.literal ? waiter.literal.toString('utf8') : null });
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
function extractReportDate(value) {
  const decoded = decodeMimeWords(String(value || ''));
  let match = decoded.match(/(20\d{2})[-_.](\d{2})[-_.](\d{2})(?!\d)/); if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  match = decoded.match(/(?:^|[^0-9])(\d{2})[.\/_-](\d{2})[.\/_-](20\d{2})(?!\d)/); if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  return null;
}
function parseMimeMessage(raw) {
  const normalized = String(raw || '').replace(/\r\n/g, '\n'); const split = normalized.indexOf('\n\n'); const headersText = split >= 0 ? normalized.slice(0, split) : normalized; const body = split >= 0 ? normalized.slice(split + 2) : '';
  const headers = parseHeaders(headersText); const boundary = parameter(headers['content-type'] || '', 'boundary'); const attachments = [];
  if (boundary) {
    for (const part of body.split(`--${boundary}`).slice(1)) {
      if (part.startsWith('--')) break; const clean = part.replace(/^\n|\n$/g, ''); const partSplit = clean.indexOf('\n\n'); if (partSplit < 0) continue;
      const partHeaders = parseHeaders(clean.slice(0, partSplit)); const partBody = clean.slice(partSplit + 2).replace(/\n--$/, ''); const disposition = partHeaders['content-disposition'] || ''; const partType = partHeaders['content-type'] || 'application/octet-stream'; const filename = decodeMimeWords(parameter(disposition, 'filename') || parameter(partType, 'name') || '');
      if (!filename && !/attachment/i.test(disposition)) continue; const transfer = (partHeaders['content-transfer-encoding'] || '').toLowerCase();
      let content; if (transfer === 'base64') content = Buffer.from(partBody.replace(/\s+/g, ''), 'base64').toString('utf8'); else if (transfer === 'quoted-printable') content = decodeQuotedPrintable(partBody); else content = partBody;
      attachments.push({ filename, contentType: partType.split(';')[0].trim(), content });
    }
  }
  return { from: headers.from || '', subject: decodeMimeWords(headers.subject || ''), attachments };
}
function parseHeaders(text) { const unfolded = text.replace(/\n[ \t]+/g, ' '); const result = {}; for (const line of unfolded.split('\n')) { const index = line.indexOf(':'); if (index < 1) continue; result[line.slice(0, index).trim().toLowerCase()] = line.slice(index + 1).trim(); } return result; }
function parameter(value, name) { const match = String(value || '').match(new RegExp(`${name}=(?:"([^"]+)"|([^;\\s]+))`, 'i')); return match ? (match[1] || match[2]) : null; }
function normalizeAddress(value) { const match = String(value || '').match(/<([^>]+)>/); return (match ? match[1] : value).trim().toLowerCase(); }
function quote(value) { return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`; }
function decodeQuotedPrintable(value) { const bytes = []; const input = String(value).replace(/=\n/g, ''); for (let i=0;i<input.length;i++){ if(input[i]==='=' && /^[0-9A-F]{2}$/i.test(input.slice(i+1,i+3))){bytes.push(parseInt(input.slice(i+1,i+3),16));i+=2;} else bytes.push(input.charCodeAt(i)&255); } return Buffer.from(bytes).toString('utf8'); }
function decodeMimeWords(value) { return String(value || '').replace(/=\?([^?]+)\?([BQ])\?([^?]+)\?=/gi, (_m, charset, encoding, data) => { let bytes; if (encoding.toUpperCase() === 'B') bytes = Buffer.from(data, 'base64'); else { const qp=data.replace(/_/g,' '); const arr=[]; for(let i=0;i<qp.length;i++){if(qp[i]==='='&&/^[0-9A-F]{2}$/i.test(qp.slice(i+1,i+3))){arr.push(parseInt(qp.slice(i+1,i+3),16));i+=2;}else arr.push(qp.charCodeAt(i)&255);} bytes=Buffer.from(arr);} try{return new TextDecoder(charset.toLowerCase()).decode(bytes);}catch{return bytes.toString('utf8');} }); }
function encodeModifiedUtf7(value) { let out=''; let pending=''; const flush=()=>{if(!pending)return; out+=`&${Buffer.from(pending,'utf16le').swap16().toString('base64').replace(/\//g,',').replace(/=+$/,'')}-`; pending='';}; for(const char of String(value)){const code=char.codePointAt(0);if(code>=0x20&&code<=0x7e){flush();out+=char==='&'?'&-':char;}else pending+=char;} flush(); return out; }
function taggedError(code, message) { const error = new Error(message); error.code = code; return error; }
module.exports = { YandexImapYooKassaReportIngestor, SimpleImapClient, classifySubject, extractReportDate, parseMimeMessage, encodeModifiedUtf7, DEFAULT_FOLDER, DEFAULT_SENDER };
