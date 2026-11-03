import React, { useState } from 'react';
import { trackEvent } from '../analytics/trackEvent.js';
import { readUserSettings, saveUserSettings } from './userSettingsStorage.js';

export function ConsentPanel({ onAccepted }) {
  const [isOpen, setIsOpen] = useState(() => !readUserSettings());

  if (!isOpen) return null;

  function acceptAll() {
    const record = saveUserSettings(
      { necessary: true, analytics: true, personalization: true, marketing: false },
      'accepted_all',
    );
    trackEvent('CookieConsentAcceptedAll', { version: record.version });
    setIsOpen(false);
    onAccepted?.(record);
  }

  function declineOptional() {
    const record = saveUserSettings(
      { necessary: true, analytics: false, personalization: false, marketing: false },
      'declined_optional',
    );
    setIsOpen(false);
    onAccepted?.(record);
  }

  return (
    <section className="consent-panel" aria-label="Согласие на использование cookie" role="dialog" aria-live="polite">
      <div>
        <h2>Файлы cookie</h2>
        <p>
          Мы используем файлы cookie для корректной работы сервисов utimoshi.ru,
          анализа взаимодействия пользователей и персонализации контента.
          Нажимая «Принять», вы соглашаетесь на использование cookie.
          Подробнее о том, как мы обрабатываем данные, читайте в нашей{' '}
          <a href="https://utimoshi.ru/privacy" target="_blank" rel="noopener noreferrer">
            Политике обработки персональных данных
          </a>.
          {' '}Вы можете отключить сохранение cookie в настройках вашего браузера.
        </p>
      </div>
      <div className="consent-actions">
        <button className="button secondary" onClick={declineOptional} type="button">Не принимать</button>
        <button className="button primary" onClick={acceptAll} type="button">Принять</button>
      </div>
    </section>
  );
}
