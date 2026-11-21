import React from 'react';

export function RecognitionState({ result, onSkip, onReset }) {
  const loading = result.state === 'LOADING';
  const returning = result.state === 'RETURNING';
  const isNew = result.state === 'NEW';
  const hasBonusBalance = returning && Number.isFinite(result.bonusBalance);

  return <section className="display-phone display-recognition" data-testid={`recognition-${result.state.toLowerCase()}`}>
    <p className="display-kicker">Клуб Тимоши</p>
    <div role="status" aria-live="polite">
      {loading && <div className="display-spinner" />}
      <h1>{loading ? 'Проверяем номер…' : returning ? 'С возвращением, дорогой друг!' : isNew ? 'Спасибо!' : 'Проверка временно недоступна'}</h1>

      {loading && <p>Это займёт немного времени. Покупка не блокируется.</p>}

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
        <p className="display-returning-lead">Продолжайте покупку на аппарате.</p>
        <div className="display-returning-action">
          <strong>Покупка продолжается</strong>
          <span>Подтверждение номера и подключение каналов связи не блокируют заказ и оплату.</span>
        </div>
      </>}

      {!loading && !returning && !isNew && <p>Не удалось проверить номер. Вы можете продолжить покупку.</p>}
    </div>

    <div className="display-phone-actions">
      {!loading && <button className="display-primary display-primary-wide" type="button" onClick={isNew || returning ? onSkip : onReset}>
        {isNew || returning ? 'Продолжить покупку' : 'Ввести другой номер'}
      </button>}
      {!loading && !returning && !isNew && <button className="display-secondary" type="button" onClick={onSkip}>Продолжить покупку</button>}
    </div>
  </section>;
}
