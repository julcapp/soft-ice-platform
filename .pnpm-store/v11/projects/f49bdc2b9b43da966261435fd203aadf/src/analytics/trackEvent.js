export function trackEvent(eventName, payload = {}) {
  const event = {
    event_name: eventName,
    occurred_at: new Date().toISOString(),
    source: 'telegram_mini_app',
    payload
  };

  // MVP: local logging. Backend Analytics API will replace this transport later.
  console.info('[analytics]', event);
}
