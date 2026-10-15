// Channel transport only. initData must always be verified by the backend.
export function resolveMiniAppPlatform(surface = window) {
  const telegram = surface.Telegram?.WebApp;
  const max = surface.WebApp;
  const telegramData = typeof telegram?.initData === 'string' ? telegram.initData : '';
  const maxData = typeof max?.initData === 'string' ? max.initData : '';
  if (telegramData && maxData) throw new Error('Не удалось определить мессенджер. Откройте приложение заново.');
  const provider = maxData ? 'max' : telegramData ? 'telegram' : 'browser';
  const sdk = provider === 'max' ? max : provider === 'telegram' ? telegram : null;
  return {
    provider,
    authenticationPayload() {
      if (!sdk) throw new Error('Откройте приложение из Telegram или MAX.');
      return { platform: provider, init_data: provider === 'max' ? maxData : telegramData };
    },
    ready() { sdk?.ready?.(); sdk?.expand?.(); },
    openPayment(url) {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || !['yoomoney.ru', 'yookassa.ru'].includes(parsed.hostname)) {
        throw new Error('Ссылка оплаты не подтверждена.');
      }
      if (sdk?.openLink) sdk.openLink(parsed.href);
      else surface.location.assign(parsed.href);
    },
  };
}
