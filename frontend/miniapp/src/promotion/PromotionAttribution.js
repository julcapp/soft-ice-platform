const ENGAGEMENT_ENDPOINT = '/api/v1/pricing/promotion-engagement';

function token() {
  return window.localStorage?.getItem('soft_ice_access_token') || window.sessionStorage?.getItem('soft_ice_access_token') || null;
}

export function readPromotionAttribution() {
  const params = new URLSearchParams(window.location.search);
  const campaignId = params.get('promo_campaign');
  const promotionVersionId = params.get('promo_version');
  const channel = params.get('promo_channel');
  const sourceEvent = params.get('promo_event');
  if (!campaignId || !promotionVersionId || !channel) return null;
  return { campaignId, promotionVersionId, channel: channel.toUpperCase(), sourceEvent };
}

export async function trackPromotionEngagement(eventType, { machineId = null } = {}) {
  const attribution = readPromotionAttribution();
  if (!attribution) return null;
  const headers = { 'Content-Type': 'application/json' };
  const accessToken = token();
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  try {
    const response = await fetch(ENGAGEMENT_ENDPOINT, {
      method: 'POST',
      headers,
      keepalive: true,
      body: JSON.stringify({ ...attribution, eventType, machineId }),
    });
    if (!response.ok) return null;
    return response.json().catch(() => null);
  } catch {
    return null;
  }
}
