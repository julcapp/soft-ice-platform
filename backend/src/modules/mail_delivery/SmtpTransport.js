const net = require('net');
const tls = require('tls');

class SmtpTransport {
  constructor({
    host = process.env.MAIL_SMTP_HOST,
    port = Number(process.env.MAIL_SMTP_PORT || 465),
    user = process.env.MAIL_SMTP_USER,
    password = process.env.MAIL_SMTP_PASSWORD,
    from = process.env.MAIL_FROM || 'no-reply@utimoshi.ru',
    replyTo = process.env.MAIL_REPLY_TO || null,
    mode = process.env.MAIL_SMTP_MODE || (Number(port) === 587 ? 'starttls' : 'implicit_tls'),
    heloName = process.env.MAIL_SMTP_HELO || 'mail.utimoshi.ru',
    timeoutMs = Number(process.env.MAIL_SMTP_TIMEOUT_MS || 20000),
  } = {}) {
    this.host = host;
    this.port = Number(port);
    this.user = user;
    this.password = password;
    this.from = from;
    this.replyTo = replyTo;
    this.mode = String(mode || '').toLowerCase();
    this.heloName = heloName;
    this.timeoutMs = timeoutMs;
  }

  isConfigured() {
    return Boolean(this.host && this.port && this.user && this.password && this.from);
  }

  async send({ to, subject, body, replyTo = this.replyTo }) {
    if (!this.isConfigured()) throw smtpError('SMTP_NOT_CONFIGURED', 'SMTP transport is not configured.');
    if (!to) throw smtpError('SMTP_RECIPIENT_MISSING', 'Recipient address is required.');
    if (this.mode === 'starttls') {
      return sendStartTls({ ...this, to, subject, body, replyTo });
    }
    if (this.mode !== 'implicit_tls') {
      throw smtpError('SMTP_MODE_UNSUPPORTED', `Unsupported SMTP mode: ${this.mode}`);
    }
    return sendImplicitTls({ ...this, to, subject, body, replyTo });
  }
}

async function sendImplicitTls(options) {
  const socket = tls.connect({
    host: options.host,
    port: options.port,
    servername: options.host,
    rejectUnauthorized: true,
  });
  const session = createSession(socket, options.timeoutMs);
  await onceSecure(socket, options.timeoutMs);
  return runConversation(socket, options, { session });
}

async function sendStartTls(options) {
  const socket = net.connect({ host: options.host, port: options.port });
  const plainSession = createSession(socket, options.timeoutMs);
  await onceConnect(socket, options.timeoutMs);
  await plainSession.expect(null, [220]);
  await plainSession.expect(`EHLO ${options.heloName}\r\n`, [250]);
  await plainSession.expect('STARTTLS\r\n', [220]);
  plainSession.detach();

  const secureSocket = tls.connect({
    socket,
    servername: options.host,
    rejectUnauthorized: true,
  });
  const secureSession = createSession(secureSocket, options.timeoutMs);
  await onceSecure(secureSocket, options.timeoutMs);
  return runConversation(secureSocket, options, { greetingAlreadyConsumed: true, session: secureSession });
}

async function runConversation(socket, options, { greetingAlreadyConsumed = false, session = null } = {}) {
  const activeSession = session || createSession(socket, options.timeoutMs);
  try {
    if (!greetingAlreadyConsumed) await activeSession.expect(null, [220]);
    await activeSession.expect(`EHLO ${options.heloName}\r\n`, [250]);
    await activeSession.expect('AUTH LOGIN\r\n', [334]);
    await activeSession.expect(`${Buffer.from(options.user).toString('base64')}\r\n`, [334]);
    await activeSession.expect(`${Buffer.from(options.password).toString('base64')}\r\n`, [235]);
    await activeSession.expect(`MAIL FROM:<${options.from}>\r\n`, [250]);
    await activeSession.expect(`RCPT TO:<${options.to}>\r\n`, [250, 251]);
    await activeSession.expect('DATA\r\n', [354]);
    const message = buildMessage(options);
    const finalResponse = await activeSession.expect(message, [250]);
    const providerMessageId = parseProviderMessageId(finalResponse);
    await activeSession.expect('QUIT\r\n', [221]);
    activeSession.detach();
    socket.end();
    return { messageId: providerMessageId, response: finalResponse };
  } catch (error) {
    activeSession.detach();
    socket.destroy();
    throw error;
  }
}

function createSession(socket, timeoutMs) {
  let buffer = '';
  let current = null;
  const queue = [];
  const responses = [];

  function drain() {
    if (!current || !responses.length) return;
    const response = responses.shift();
    const item = current;
    current = null;
    if (!item.accepted.includes(response.code)) {
      item.reject(smtpError(`SMTP_${response.code}`, response.line));
    } else {
      item.resolve(response.line);
    }
    runNext();
  }

  function runNext() {
    if (current || !queue.length) return;
    current = queue.shift();
    if (current.command) socket.write(current.command);
    drain();
  }

  function expect(command, accepted) {
    return new Promise((resolve, reject) => {
      queue.push({ command, accepted, resolve, reject });
      runNext();
    });
  }

  function onData(chunk) {
    buffer += chunk.toString('utf8');
    let index;
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index + 1).trimEnd();
      buffer = buffer.slice(index + 1);
      const match = /^(\d{3})([ -])/.exec(line);
      if (!match || match[2] === '-') continue;
      responses.push({ code: Number(match[1]), line });
      drain();
    }
  }

  function onError(error) {
    if (!current) return;
    const item = current;
    current = null;
    item.reject(error);
  }

  socket.setTimeout(timeoutMs, () => socket.destroy(smtpError('SMTP_TIMEOUT', 'SMTP timeout.')));
  socket.on('data', onData);
  socket.on('error', onError);

  return {
    expect,
    detach() {
      socket.off('data', onData);
      socket.off('error', onError);
      socket.setTimeout(0);
    },
  };
}

function buildMessage({ from, to, subject, body, replyTo }) {
  const safeBody = String(body || '').replace(/\r?\n\./g, '\r\n..');
  const lines = [
    `From: <${from}>`,
    `To: <${to}>`,
    `Subject: =?UTF-8?B?${Buffer.from(String(subject || '')).toString('base64')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${Date.now()}.${Math.random().toString(36).slice(2)}@utimoshi.ru>`,
  ];
  if (replyTo) lines.push(`Reply-To: <${replyTo}>`);
  lines.push('', safeBody, '.', '');
  return lines.join('\r\n');
}

function parseProviderMessageId(line) {
  const bracketed = /<([^>]+)>/.exec(String(line || ''));
  return bracketed ? bracketed[1] : null;
}

function onceConnect(socket, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(smtpError('SMTP_CONNECT_TIMEOUT', 'SMTP connect timeout.')), timeoutMs);
    socket.once('connect', () => { clearTimeout(timer); resolve(); });
    socket.once('error', (error) => { clearTimeout(timer); reject(error); });
  });
}

function onceSecure(socket, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(smtpError('SMTP_TLS_TIMEOUT', 'SMTP TLS timeout.')), timeoutMs);
    socket.once('secureConnect', () => { clearTimeout(timer); resolve(); });
    socket.once('error', (error) => { clearTimeout(timer); reject(error); });
  });
}

function smtpError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

module.exports = { SmtpTransport, buildMessage, parseProviderMessageId };
