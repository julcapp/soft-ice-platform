export function getInitialSource() {
  const params = new URLSearchParams(window.location.search);

  return {
    utm_source: params.get('utm_source') || 'direct',
    entry_point: params.get('entry_point') || 'miniapp_home',
    referral_code: params.get('ref') || null
  };
}
