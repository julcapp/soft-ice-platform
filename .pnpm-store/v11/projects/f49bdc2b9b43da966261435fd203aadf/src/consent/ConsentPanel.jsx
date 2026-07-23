import React, { useState } from 'react';
import { trackEvent } from '../analytics/trackEvent.js';
import { readUserSettings, saveUserSettings } from './userSettingsStorage.js';

export function ConsentPanel({ onAccepted }) {
  const [isOpen, setIsOpen] = useState(() => !readUserSettings());

  if (!isOpen) {
    return null;
  }

  function acceptNecessary() {
    const record = saveUserSettings({ necessary: true, analytics: false, personalization: false, marketing: false });
    trackEvent('CookieConsentAcceptedNecessary', { version: record.version });
    setIsOpen(false);
    onAccepted(record);
  }

  function acceptAll() {
    const record = saveUserSettings({ necessary: true, analytics: true, personalization: true, marketing: false });
    trackEvent('CookieConsentAcceptedAll', { version: record.version });
    setIsOpen(false);
    onAccepted(record);
  }

  return (
    <section className="consent-panel" aria-label="Cookie consent">
      <div>
        <h2>Настройки удобства и статистики</h2>
        <p>
          Мы используем обязательные cookie для работы сервиса. Аналитику и персонализацию включаем только с вашего согласия.
        </p>
      </div>
      <div className="consent-actions">
        <button className="button secondary" onClick={acceptNecessary} type="button">Только необходимые</button>
        <button className="button primary" onClick={acceptAll} type="button">Принять и продолжить</button>
      </div>
    </section>
  );
}
