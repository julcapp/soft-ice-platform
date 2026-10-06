import React, { useState } from 'react';

const messengerLabel = { MAX: 'MAX', TELEGRAM: 'Telegram' };

function createQrDataUrl(value) {
  if (!value || typeof window === 'undefined' || typeof window.qrcode !== 'function') return null;
  try {
    const qr = window.qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    return qr.createDataURL(7, 3);
  } catch {
    return null;
  }
}

export function RecognitionState({ result, messengerChallenge = null, previewMessengerStatus = null, onMessengerSelect, onSkip, onReset }) {
  const previewMode = Boolean(previewMessengerStatus);
  const [selectedMessenger, setSelectedMessenger] = useState(previewMode ? 'MAX' : null);
  const [deliveryState, setDeliveryState] = useState(previewMode ? {
    status: 'prepared',
    id: 'preview-max-challenge',
    channel: 'MAX',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    deepLink: null,
    error: null,
  } : {
    status: 'idle',
    id: null,
    channel: null,
    expiresAt: null,
    deepLink: null,
    error: null,
  });
  const loading = result.state === 'LOADING';
  const returning = result.state === 'RETURNING';
  const isNew = result.state === 'NEW';
  const hasBonusBalance = returning && Number.isFinite(result.bonusBalance);

  const chooseMessenger = async (channel) => {
    setSelectedMessenger(channel);
    if (!onMessengerSelect) return;
    setDeliveryState({ status: 'sending', channel, expiresAt: null, deepLink: null, error: null });
    try {
      const challenge = await onMessengerSelect(channel);
      setDeliveryState({
        status: 'prepared',
        id: challenge?.id || null,
        channel,
        expiresAt: challenge?.expiresAt || null,
        deepLink: challenge?.deepLink || null,
        error: null,
      });
    } catch (error) {
      setDeliveryState({
        status: 'error',
        channel,
        expiresAt: null,
        deepLink: null,
        error: error?.message || 'Не удалось подготовить подтверждение.',
      });
    }
  };

  if (deliveryState.status === 'prepared') {
    const label = messengerLabel[deliveryState.channel] || 'мессенджер';
    const liveStatus = previewMessengerStatus || (messengerChallenge?.id === deliveryState.id
      ? messengerChallenge.status
      : 'PENDING');
    const qrDataUrl = createQrDataUrl(deliveryState.deepLink);
    const verified = liveStatus === 'VERIFIED';
    const expired = ['EXPIRED', 'INVALIDATED'].includes(liveStatus);
    const started = liveStatus === 'STARTED';
    const heading = verified
      ? 'Номер подтверждён'
      : expired
        ? 'Время подтверждения истекло'
        : `Откройте ${label} на смартфоне для подтверждения номера`;
    const description = verified
      ? 'Подтверждение получено. Покупку можно продолжать.'
      : expired
        ? 'Подтверждение не получено. Это не мешает продолжить текущую покупку.'
        : `В чате «Клуб У Тимоши» нажмите «Поделиться номером и подтвердить».`;
    return <section className="display-phone display-recognition display-recognition-sent" data-testid="recognition-message-prepared">
      <p className="display-kicker">Клуб Тимоши</p>
      <div role="status" aria-live="polite" className="display-recognition-sent-content">
        <div className="display-recognition-sent-icon" aria-hidden="true">{verified ? '✓' : started ? '↗' : expired ? '!' : '✓'}</div>
        <h1>{heading}</h1>
        <p>{description}</p>
        {qrDataUrl && <div className="display-recognition-qr">
          <img src={qrDataUrl} alt={`QR-код для открытия ${label}`} />
          <div>
            <strong>Наведите камеру телефона на QR-код</strong>
            <span>После открытия бота нажмите «Поделиться номером и подтвердить».</span>
          </div>
        </div>}
        {!qrDataUrl && <div className="display-recognition-balance display-recognition-info">
          <span>Ссылка для подтверждения подготовлена.</span>
          <small>Откройте её на телефоне, чтобы продолжить подтверждение.</small>
        </div>}
        {!verified && !expired && <div className="display-waiting display-recognition-background-wait"><span />Ожидаем подтверждение номера в фоне · до 10 минут</div>}
        <small className="display-recognition-background-note">Покупку можно продолжить прямо сейчас. Подтверждение не блокирует заказ и оплату.</small>
      </div>
      <div className="display-phone-actions">
        <button className="display-secondary" type="button" onClick={() => {
          setDeliveryState({ status: 'idle', id: null, channel: null, expiresAt: null, deepLink: null, error: null });
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
      <h1>{loading ? 'Проверяем номер…' : returning ? 'С возвращением, дорогой друг!' : isNew ? 'Подтвердите номер' : 'Проверка временно недоступна'}</h1>

      {loading && <p>Это займёт немного времени. Можно продолжить покупку без скидки.</p>}

      {returning && <>
        <p className="display-returning-lead">Продолжайте покупку на аппарате.</p>
        <div className="display-recognition-balance">
          <span>У вас на балансе</span>
          <strong>{hasBonusBalance ? result.bonusBalance.toLocaleString('ru-RU') : '—'} бонусов</strong>
          <small>Потратить их можно только из Личного кабинета.</small>
        </div>
        <div className="display-returning-action">
          <strong>Продолжайте покупку на аппарате</strong>
          <span>После завершения покупки мы отправим информацию о покупке и начисленных бонусах в доступные подтверждённые каналы.</span>
        </div>
      </>}

      {isNew && <>
        <p>Для вступления в Клуб Тимоши подтвердите номер через удобный мессенджер.</p>
        <div className="display-recognition-balance display-recognition-info">
          <span>Подтверждение на терминале может быть недоступно без связи.</span>
          <small>Выберите мессенджер — мы подготовим безопасную ссылку для подтверждения.</small>
        </div>
        <div className="display-recognition-messenger">
          <p>Где хотите подтвердить номер?</p>
          <div>
            <button type="button" disabled={deliveryState.status === 'sending'} className={selectedMessenger === 'MAX' ? 'is-selected' : ''} onClick={() => chooseMessenger('MAX')}>MAX</button>
            <button type="button" disabled={deliveryState.status === 'sending'} className={selectedMessenger === 'TELEGRAM' ? 'is-selected' : ''} onClick={() => chooseMessenger('TELEGRAM')}>Telegram</button>
          </div>
          {deliveryState.status === 'sending' && <small>Готовим подтверждение…</small>}
          {deliveryState.status === 'error' && <small className="display-recognition-error">{deliveryState.error} Выберите другой способ.</small>}
        </div>
      </>}

      {!loading && !returning && !isNew && <p>Не удалось проверить номер. Попробуйте позже или продолжите покупку без скидки.</p>}
    </div>

    <div className="display-phone-actions">
      {!returning && <button className="display-secondary" type="button" onClick={onSkip}>Продолжить без скидки</button>}
      {!loading && <button className="display-primary display-primary-wide" type="button" onClick={returning ? onSkip : onReset}>{returning ? 'Продолжить покупку' : 'Ввести другой номер'}</button>}
    </div>
  </section>;
}
