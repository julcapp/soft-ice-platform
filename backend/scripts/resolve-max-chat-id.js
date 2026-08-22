#!/usr/bin/env node

const API_BASE = 'https://platform-api2.max.ru';
const token = process.env.MAX_BOT_TOKEN;
const expectedPublicUrl = process.env.MAX_PUBLIC_CHANNEL_URL || 'https://max.ru/channel_soft_icecream';

if (!token) {
  console.error('MAX_BOT_TOKEN is required.');
  process.exitCode = 1;
  return;
}

async function main() {
  const url = new URL(`${API_BASE}/updates`);
  url.searchParams.set('limit', '100');
  url.searchParams.set('timeout', '0');

  const response = await fetch(url, {
    headers: { Authorization: token },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.message || `MAX API HTTP ${response.status}`);
  }

  const candidates = [];
  for (const update of body.updates || []) {
    const chatIds = collectValues(update, 'chat_id');
    const links = collectValues(update, 'link').filter((value) => typeof value === 'string');
    for (const chatId of chatIds) {
      candidates.push({
        chatId: String(chatId),
        updateType: update.update_type || update.type || 'unknown',
        links,
        exactPublicUrlMatch: links.includes(expectedPublicUrl),
      });
    }
  }

  const unique = [...new Map(candidates.map((item) => [item.chatId, item])).values()];
  if (!unique.length) {
    console.log('MAX chat_id was not found in retained updates.');
    console.log('Add the bot as an administrator to the public MAX channel (or remove and add it again), then run this command again.');
    console.log(`Expected public channel: ${expectedPublicUrl}`);
    return;
  }

  const exact = unique.filter((item) => item.exactPublicUrlMatch);
  const output = exact.length ? exact : unique;
  console.log(JSON.stringify({ expectedPublicUrl, candidates: output }, null, 2));
  if (output.length === 1) {
    console.log(`\nSet deployment secret: MAX_CHANNEL_CHAT_ID=${output[0].chatId}`);
  } else {
    console.log('\nSeveral chat_id values were found. Verify the target channel before setting MAX_CHANNEL_CHAT_ID.');
  }
}

function collectValues(value, key) {
  const result = [];
  if (Array.isArray(value)) {
    for (const item of value) result.push(...collectValues(item, key));
    return result;
  }
  if (!value || typeof value !== 'object') return result;
  for (const [name, child] of Object.entries(value)) {
    if (name === key && child !== null && child !== undefined) result.push(child);
    result.push(...collectValues(child, key));
  }
  return result;
}

main().catch((error) => {
  console.error(`Failed to resolve MAX chat_id: ${error.message}`);
  process.exitCode = 1;
});
