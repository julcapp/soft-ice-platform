const ALLOWED_SOURCES = new Set(['direct', 'referral', 'machine_qr', 'website', 'vk', 'telegram', 'max', 'campaign', 'partner']);

function sanitizeToken(value, maxLength = 128) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  if (normalized.length > maxLength) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(normalized)) return null;
  return normalized;
}

function parseStartPayload(payload) {
  const raw = sanitizeToken(payload, 128);
  if (!raw) {
    return {
      source: 'direct',
      raw: null,
      referralCode: null,
      machineId: null,
      campaignId: null,
      partnerId: null,
    };
  }

  const [prefix, ...rest] = raw.split('_');
  const value = rest.join('_') || null;

  const context = {
    source: ALLOWED_SOURCES.has(prefix) ? prefix : 'direct',
    raw,
    referralCode: null,
    machineId: null,
    campaignId: null,
    partnerId: null,
  };

  switch (prefix) {
    case 'ref':
    case 'referral':
      context.source = 'referral';
      context.referralCode = sanitizeToken(value, 64);
      break;
    case 'm':
    case 'machine':
    case 'machine_qr':
      context.source = 'machine_qr';
      context.machineId = sanitizeToken(value, 64);
      break;
    case 'c':
    case 'campaign':
      context.source = 'campaign';
      context.campaignId = sanitizeToken(value, 64);
      break;
    case 'p':
    case 'partner':
      context.source = 'partner';
      context.partnerId = sanitizeToken(value, 64);
      break;
    default:
      context.source = ALLOWED_SOURCES.has(prefix) ? prefix : 'direct';
  }

  return context;
}

module.exports = {
  parseStartPayload,
};
