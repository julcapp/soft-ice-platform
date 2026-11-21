export const USER_SETTINGS_STORAGE_KEY = 'soft_ice_user_settings_v2';
export const USER_SETTINGS_VERSION = '2026-11-02.v2';
export const COOKIE_CONSENT_NAME = 'cookie_consent';
export const COOKIE_CONSENT_DAYS = 365;

function isUtimoshiHost() {
  return window.location.hostname === 'utimoshi.ru' || window.location.hostname.endsWith('.utimoshi.ru');
}

function setConsentCookie(value) {
  const expires = new Date(Date.now() + COOKIE_CONSENT_DAYS * 24 * 60 * 60 * 1000).toUTCString();
  const domain = isUtimoshiHost() ? '; Domain=.utimoshi.ru' : '';
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = COOKIE_CONSENT_NAME + '=' + encodeURIComponent(value)
    + '; Expires=' + expires
    + '; Path=/; SameSite=Lax'
    + domain
    + secure;
}

function getConsentCookie() {
  const prefix = COOKIE_CONSENT_NAME + '=';
  const entry = document.cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return entry ? decodeURIComponent(entry.slice(prefix.length)) : null;
}

export function readUserSettings() {
  try {
    const raw = localStorage.getItem(USER_SETTINGS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
    const cookieValue = getConsentCookie();
    if (!cookieValue) return null;
    return {
      version: USER_SETTINGS_VERSION,
      categories: {
        necessary: true,
        analytics: cookieValue === 'accepted_all',
        personalization: cookieValue === 'accepted_all',
        marketing: false,
      },
      decision: cookieValue,
      source: 'cookie',
    };
  } catch {
    return null;
  }
}

export function saveUserSettings(categories, decision = 'accepted_necessary') {
  const record = {
    version: USER_SETTINGS_VERSION,
    categories,
    decision,
    saved_at: new Date().toISOString(),
    source: 'miniapp_home',
  };

  localStorage.setItem(USER_SETTINGS_STORAGE_KEY, JSON.stringify(record));
  setConsentCookie(decision);
  window.dispatchEvent(new CustomEvent('softice:consent-changed', { detail: record }));
  return record;
}
