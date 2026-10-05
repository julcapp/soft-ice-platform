import React, { useState } from 'react';

const messengerLabel = { MAX: 'MAX', TELEGRAM: 'Telegram' };

export function RecognitionState({ result, onMessengerSelect, onSkip, onReset }) {
  const [selectedMessenger, setSelectedMessenger] = useState(null);
  const [deliveryState, setDeliveryState] = useState({ status: 'idle', channel: null, expiresAt: null, error: null });
  const loading = result.state === 'LOADING';
  const returning = result.state === 'RETURNING';
  const isNew = result.state === 'NEW';
  const hasBonusBalance = returning && Number.isFinite(result.bonusBalance);

  const chooseMessenger = async (channel) => {
    setSelectedMessenger(channel);
    if (!onMessengerSelect) return;
    setDeliveryState({ status: 'sending', channel, expiresAt: null, error: null });
    try {
      const challenge = await onMessengerSelect(channel);
      setDeliveryState({
        status: 'sent',
        channel,
        expiresAt: challenge?.expiresAt || null,
        error: null,
      });
    } catch (error) {
      setDeliveryState({
        status: 'error',
        channel,
        expiresAt: null,
        error: error?.message || 'Не удалось отправить подтверждение.',
      });
    }
  };

  if (deliveryState.status === 'sent') {
    const label = messengerLabel[deliveryState.channel] || 'мессенджер';
    return <section className="display-phone display-recognition display-recognition-sent" data-testid="recognition-message-sent">
      <p className="display-kicker">Клуб Тимоши</p>
      <div role="status" aria-live="polite" className="display-recognition-sent-content">
        <div className="display-recognition-sent-icon" aria-hidden="true">✓</div>
        <h1>Сообщение отправлено</h1>
        <p>Мы отправили запрос на подтверждение в выбранный вами мессенджер {label}.</p>
        <div className="display-recognition-balance display-recognition-info">
          <span>Откройте {label} на телефоне и нажмите «Поделиться номером и подтвердить».</span>
          <small>Запрос действует 10 минут. Покупку можно продолжить прямо сейчас.</small>
        </div>
        <div className="display-waiting display-recognition-background-wait"><span />Ожидаем подтверждение номера в фоне</div>
      </div>
      <div className="display-phone-actions">
        <button className="display-secondary" type="button" onClick={() => {
          setDeliveryState({ status: 'idle', channel: null, expiresAt: null, error: null });
          setSelectedMessenger(null);
        }}>Выбрать другой мессенджер</button>
        <button className="display-primary" type="button" onClick={onSkip}>Продолжить покупку</button>
      </div>
    </section>;
  }

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
            <button type="button" disabled={deliveryState.status === 'sending'} className={selectedMessenger === 'MAX' ? 'is-selected' : ''} onClick={() => chooseMessenger('MAX')}>MAX</button>
            <button type="button" disabled={deliveryState.status === 'sending'} className={selectedMessenger === 'TELEGRAM' ? 'is-selected' : ''} onClick={() => chooseMessenger('TELEGRAM')}>Telegram</button>
          </div>
          {deliveryState.status === 'sending' && <small>Отправляем запрос…</small>}
          {deliveryState.status === 'error' && <small className="display-recognition-error">{deliveryState.error} Выберите другой способ.</small>}
        </div>
      </>}

      {isNew && <>
        <p>Для вступления в Клуб Тимоши подтвердите номер через удобный мессенджер.</p>
        <div className="display-recognition-balance display-recognition-info">
          <span>Подтверждение на терминале может быть недоступно без связи.</span>
          <small>Выберите мессенджер — мы отправим код или ссылку для подтверждения.</small>
        </div>
        <div className="display-recognition-messenger">
          <p>Куда отправить подтверждение?</p>
          <div>
            <button type="button" disabled={deliveryState.status === 'sending'} className={selectedMessenger === 'MAX' ? 'is-selected' : ''} onClick={() => chooseMessenger('MAX')}>MAX</button>
            <button type="button" disabled={deliveryState.status === 'sending'} className={selectedMessenger === 'TELEGRAM' ? 'is-selected' : ''} onClick={() => chooseMessenger('TELEGRAM')}>Telegram</button>
          </div>
          {deliveryState.status === 'sending' && <small>Отправляем запрос…</small>}
          {deliveryState.status === 'error' && <small className="display-recognition-error">{deliveryState.error} Выберите другой способ.</small>}
        </div>
      </>}

      {!loading && !returning && !isNew && <p>Не удалось проверить номер. Попробуйте позже или продолжите покупку без скидки.</p>}
    </div>

    <div className="display-phone-actions">
      <button className="display-secondary" type="button" onClick={onSkip}>Продолжить без скидки</button>
      {!loading && <button className="display-primary" type="button" onClick={returning ? onSkip : onReset}>{returning ? 'Продолжить покупку' : 'Ввести другой номер'}</button>}
    </div>
  </section>;
}
