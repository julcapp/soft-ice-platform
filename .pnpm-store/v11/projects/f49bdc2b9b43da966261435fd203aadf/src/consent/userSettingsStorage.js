export const USER_SETTINGS_STORAGE_KEY = 'soft_ice_user_settings_v1';
export const USER_SETTINGS_VERSION = '2026-06-26.v1';

export function readUserSettings() {
  try {
    const raw = localStorage.getItem(USER_SETTINGS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveUserSettings(categories) {
  const record = {
    version: USER_SETTINGS_VERSION,
    categories,
    saved_at: new Date().toISOString(),
    source: 'miniapp_home'
  };

  localStorage.setItem(USER_SETTINGS_STORAGE_KEY, JSON.stringify(record));
  return record;
}
