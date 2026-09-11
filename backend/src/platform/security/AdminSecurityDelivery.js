const tls = require('tls');

class AdminSecurityDelivery {
  constructor({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
    this.env = env;
    this.fetch = fetchImpl;
  }

  async send({ channel, destination, code }) {
    if (channel === 'MAX') return this.sendMax(destination, code);
    if (channel === 'EMAIL') return this.sendEmail(destination, code);
    throw new Error('Unsupported admin security delivery channel.');
  }

  async sendMax(userId, code) {
    const token = this.env.ADMIN_SECURITY_MAX_BOT_TOKEN || this.env.MAX_BOT_TOKEN || this.env.MAX_TEST_BOT_TOKEN;
    const baseUrl = String(this.env.MAX_API_BASE_URL || 'https://platform-api2.max.ru').replace(/\/$/, '');
    if (!token || !userId) throw new Error('MAX security channel is not configured.');
    if (!this.fetch) throw new Error('Fetch is unavailable for MAX security delivery.');
    const response = await this.fetch(`${baseUrl}/messages?user_id=${encodeURIComponent(userId)}`, {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ text: `Код подтверждения Soft ICE: ${code}. Код действует 10 минут. Никому его не сообщайте.` }),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`MAX security delivery failed (${response.status}): ${text.slice(0, 160)}`);
    }
  }

  async sendEmail(email, code) {
    const host = this.env.ADMIN_SECURITY_SMTP_HOST;
    const port = Number(this.env.ADMIN_SECURITY_SMTP_PORT || 465);
    const user = this.env.ADMIN_SECURITY_SMTP_USER;
    const password = this.env.ADMIN_SECURITY_SMTP_PASSWORD;
    const from = this.env.ADMIN_SECURITY_SMTP_FROM || user;
    if (!host || !user || !password || !from || !email) throw new Error('Email security channel is not configured.');
    if (port !== 465) throw new Error('Admin security SMTP currently requires implicit TLS on port 465.');
    const subject = 'Код подтверждения Soft ICE';
    const body = `Код подтверждения: ${code}\r\n\r\nКод действует 10 минут. Никому его не сообщайте.`;
    await sendSmtpTls({ host, port, user, password, from, to: email, subject, body });
  }
}

function sendSmtpTls({ host, port, user, password, from, to, subject, body }) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host, port, servername: host, rejectUnauthorized: true });
    let buffer = '';
    const queue = [];
    let current = null;
    let done = false;

    const fail = (error) => {
      if (done) return;
      done = true;
      socket.destroy();
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    const finish = () => {
      if (done) return;
      done = true;
      socket.end();
      resolve();
    };

    function runNext() {
      if (current || !queue.length || done) return;
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
      if (!item.accepted.includes(code)) item.reject(new Error(`SMTP error ${code}: ${line}`));
      else item.resolve(line);
      runNext();
    }

    socket.setTimeout(15000, () => fail(new Error('SMTP timeout.')));
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
        await expect(`EHLO soft-ice-platform\r\n`, [250]);
        await expect('AUTH LOGIN\r\n', [334]);
        await expect(`${Buffer.from(user).toString('base64')}\r\n`, [334]);
        await expect(`${Buffer.from(password).toString('base64')}\r\n`, [235]);
        await expect(`MAIL FROM:<${from}>\r\n`, [250]);
        await expect(`RCPT TO:<${to}>\r\n`, [250, 251]);
        await expect('DATA\r\n', [354]);
        const safeBody = String(body).replace(/\r?\n\./g, '\r\n..');
        const message = [
          `From: <${from}>`,
          `To: <${to}>`,
          `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
          'MIME-Version: 1.0',
          'Content-Type: text/plain; charset=UTF-8',
          'Content-Transfer-Encoding: 8bit',
          '',
          safeBody,
          '.',
          '',
        ].join('\r\n');
        await expect(message, [250]);
        await expect('QUIT\r\n', [221]);
        finish();
      } catch (error) { fail(error); }
    });
  });
}

module.exports = { AdminSecurityDelivery, sendSmtpTls };
