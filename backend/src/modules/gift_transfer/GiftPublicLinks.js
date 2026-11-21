'use strict';
const crypto = require('node:crypto');

const CHANNELS = new Set(['vk', 'telegram', 'max', 'web', 'qr', 'nfc', 'direct', 'unknown']);
const SAFE_CAMPAIGN = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const SAFE_TOKEN = /^[A-Za-z0-9_-]{32,256}$/;

function normalizeAttribution(input = {}) {
  const raw = typeof input.source === 'string' ? input.source : input.src;
  const source = String(raw || 'unknown').trim().toLowerCase();
  const campaign = String(input.campaign || input.utm_campaign || '').trim();
  return Object.freeze({
    source: CHANNELS.has(source) ? source : 'unknown',
    campaign: SAFE_CAMPAIGN.test(campaign) ? campaign : null,
  });
}

function invitationUrl(baseUrl, token) {
  if (typeof token !== 'string' || !SAFE_TOKEN.test(token)) {
    throw new TypeError('Invalid gift invitation token');
  }
  const base = new URL(baseUrl);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) {
    throw new TypeError('Gift landing URL must use clean HTTPS');
  }
  const url = new URL(base.toString());
  url.pathname = (url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname) + '/' + encodeURIComponent(token);
  return url.toString();
}

function digestToken(token) {
  if (typeof token !== 'string' || !SAFE_TOKEN.test(token)) throw new TypeError('Invalid token');
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = { normalizeAttribution, invitationUrl, digestToken };
