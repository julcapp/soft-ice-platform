const tls = require('tls');
const { randomUUID } = require('crypto');

function cleanHeader(value, field) {
  const text = String(value || '').trim();
  if (!text || /[\r\n]/.test(text)) throw new Error(`Invalid SMTP ${field} header.`);
  return text;
}

function wrapBase64(value) {
  return Buffer.from(String(value), 'utf8')
    .toString('base64')
    .replace(/.{1,76}/g, '$&\r\n')
    .trimEnd();
}

function sendSmtpTlsMail({
  host,
  port = 465,
  user,
  password,
  from,
  to,
  replyTo = null,
  subject,
  body,
  timeoutMs = 15000,
  ehloName = 'soft-ice-platform',
}) {
  host = cleanHeader(host, 'host');
  user = cleanHeader(user, 'user');
  password = String(password || '');
  from = cleanHeader(from, 'from');
  to = cleanHeader(to, 'to');
  subject = cleanHeader(subject || 'У Тимоши', 'subject');
  if (!password) throw new Error('SMTP password is required.');
  if (Number(port) !== 465) throw new Error('SMTP transport currently requires implicit TLS on port 465.');
  if (replyTo) replyTo = cleanHeader(replyTo, 'reply-to');

  return new Promise((resolve, reject) => {
    const socket = tls.connect({
      host,
      port: Number(port),
      servername: host,
      rejectUnauthorized: true,
    });

    let buffer = '';
    const queue = [];
    let current = null;
    let finished = false;

    const fail = (error) => {
      if (finished) return;
      finished = true;
      socket.destroy();
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    const finish = (result) => {
      if (finished) return;
      finished = true;
      socket.end();
      resolve(result);
    };

    function runNext() {
      if (current || !queue.length || finished) return;
      current = queue.shift();
      if (current.command) socket.write(current.command);
    }

    function expect(command, accepted) {
      return new Promise((res, rej) => {
        queue.push({ command, accepted, resolve: res, reject: rej });
        runNext();
      });
    }

    function handleLine(line) {
      if (!current) return;
      const match = /^(\d{3})([ -])/.exec(line);
      if (!match || match[2] === '-') return;

      const code = Number(match[1]);
      const item = current;
      current = null;

      if (!item.accepted.includes(code)) {
        item.reject(new Error(`SMTP error ${code}: ${line}`));
      } else {
        item.resolve({ code, line });
      }
      runNext();
    }

    socket.setTimeout(timeoutMs, () => fail(new Error('SMTP timeout.')));
    socket.on('error', fail);
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      let index;
      while ((index = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, index + 1).trimEnd();
        buffer = buffer.slice(index + 1);
        handleLine(line);
      }
    });

    socket.once('secureConnect', async () => {
      try {
        await expect(null, [220]);
        await expect(`EHLO ${ehloName}\r\n`, [250]);
        await expect('AUTH LOGIN\r\n', [334]);
        await expect(`${Buffer.from(user).toString('base64')}\r\n`, [334]);
        await expect(`${Buffer.from(password).toString('base64')}\r\n`, [235]);
        await expect(`MAIL FROM:<${from}>\r\n`, [250]);
        await expect(`RCPT TO:<${to}>\r\n`, [250, 251]);
        await expect('DATA\r\n', [354]);

        const domain = from.includes('@') ? from.split('@').pop() : 'utimoshi.ru';
        const messageId = `<${randomUUID()}@${domain}>`;
        const headers = [
          `Date: ${new Date().toUTCString()}`,
          `Message-ID: ${messageId}`,
          `From: <${from}>`,
          `To: <${to}>`,
          replyTo ? `Reply-To: <${replyTo}>` : null,
          `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
          'MIME-Version: 1.0',
          'Content-Type: text/plain; charset=UTF-8',
          'Content-Transfer-Encoding: base64',
        ].filter(Boolean);

        const message = [
          ...headers,
          '',
          wrapBase64(body),
          '.',
          '',
        ].join('\r\n');

        const accepted = await expect(message, [250]);
        await expect('QUIT\r\n', [221]);

        finish({
          messageId,
          providerResponse: accepted.line,
          providerCode: accepted.code,
        });
      } catch (error) {
        fail(error);
      }
    });
  });
}

module.exports = { sendSmtpTlsMail };
