'use strict';

const API_BASE = process.env.MAX_API_BASE_URL || 'https://platform-api2.max.ru';
const TOKEN = process.env.MAX_BOT_TOKEN;
const SECRET = process.env.MAX_WEBHOOK_SECRET;
const TARGET_URL = process.env.MAX_WEBHOOK_URL || 'https://display.utimoshi.ru/api/webhooks/max';

async function request(path, options = {}) {
  if (!TOKEN) throw new Error('MAX_BOT_TOKEN is required.');
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: TOKEN,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`MAX API ${response.status}: ${body.message || body.error || 'request failed'}`);
  return body;
}

async function main() {
  const mode = process.argv[2] || 'show';
  const current = await request('/subscriptions');
  console.log(JSON.stringify({ targetUrl: TARGET_URL, subscriptions: current.subscriptions || current }, null, 2));

  if (mode !== 'apply') return;
  if (!SECRET) throw new Error('MAX_WEBHOOK_SECRET is required for apply.');

  const result = await request('/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      url: TARGET_URL,
      update_types: ['message_created', 'bot_started'],
      secret: SECRET,
    }),
  });
  console.log(JSON.stringify({ applied: result }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
