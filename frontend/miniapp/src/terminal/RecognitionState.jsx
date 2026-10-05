import React, { useState } from 'react';

const messengerLabel = { MAX: 'MAX', TELEGRAM: 'Telegram' };

export function RecognitionState({ result, onSkip, onReset }) {
  const [selectedMessenger, setSelectedMessenger] = useState(null);
  const loading = result.state === 'LOADING';
  const returning = result.state === 'RETURNING';
  const isNew = result.state === 'NEW';
  const hasBonusBalance = returning && Number.isFinite(result.bonusBalance);

  return <section className="display-phone display-recognition" data-testid={`recognition-${result.state.toLowerCase()}`}>
    <p className="display-kicker">Клуб Тимоши</p>
    <div role="status" aria-live="polite">
      {loading && <div className="display-spinner" />}
      <h1>{loading ? 'Проверяем номер…' : returning ? 'С возвращением' : isNew ? 'Подтвердите номер' : 'Проверка временно недоступна'}</h1>

      {loading && <p>Это займёт немного времени. Можно продолжить покупку без скидки.</p>}

      {returning && <>
        <p>Рады видеть вас снова! Продолжайте собирать своё мороженое.</p>
        <div className="display-recognition-balance">
          <span>У вас на балансе</span>
          <strong>{hasBonusBalance ? result.bonusBalance.toLocaleString('ru-RU') : '—'} бонусов</strong>
          <small>Потратить их можно только из Личного кабинета.</small>
        </div>
        <div className="display-recognition-messenger">
          <p>В какой мессенджер направить информацию?</p>
          <div>
            <button type="button" className={selectedMessenger === 'MAX' ? 'is-selected' : ''} onClick={() => setSelectedMessenger('MAX')}>MAX</button>
            <button type="button" className={selectedMessenger === 'TELEGRAM' ? 'is-selected' : ''} onClick={() => setSelectedMessenger('TELEGRAM')}>Telegram</button>
          </div>
          {selectedMessenger && <small>Выбран {messengerLabel[selectedMessenger]}. Привязка будет подтверждена уже в мессенджере.</small>}
        </div>
      </>}

      {isNew && <>
        <p>Для вступления в Клуб Тимоши нужно подтвердить номер.</p>
        {result.verification?.status === 'PENDING'
          ? <p>Запрос на подтверждение создан. {result.verification.maxAttempts === 3 && `Осталось попыток: ${result.verification.remainingAttempts}.`} Подтверждение на этом экране пока недоступно.</p>
          : <p data-testid="verification-unavailable">Отправка кода временно недоступна. Попробуйте позже.</p>}
      </>}

      {!loading && !returning && !isNew && <p>Не удалось проверить номер. Попробуйте позже или продолжите покупку без скидки.</p>}
    </div>

    <div className="display-phone-actions">
      <button className="display-secondary" type="button" onClick={onSkip}>Продолжить без скидки</button>
      {!loading && <button className="display-primary" type="button" onClick={returning ? onSkip : onReset}>{returning ? 'Продолжить покупку' : 'Ввести другой номер'}</button>}
    </div>
  </section>;
}
