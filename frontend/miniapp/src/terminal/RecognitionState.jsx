import React from 'react';

export function RecognitionState({ result, onSkip, onReset }) {
  const loading = result.state === 'LOADING';
  const returning = result.state === 'RETURNING';
  const isNew = result.state === 'NEW';
  return <section className="display-phone display-recognition" data-testid={`recognition-${result.state.toLowerCase()}`}>
    <p className="display-kicker">Клуб Тимоши</p>
    <div role="status" aria-live="polite">
      {loading && <div className="display-spinner" />}
      <h1>{loading ? 'Проверяем номер…' : returning ? 'С возвращением' : isNew ? 'Подтвердите номер' : 'Проверка временно недоступна'}</h1>
      <p>{loading ? 'Это займёт немного времени. Можно продолжить покупку без скидки.' : returning ? 'Рады видеть вас снова! Продолжайте собирать своё мороженое.' : isNew ? 'Для вступления в Клуб Тимоши нужно подтвердить номер.' : 'Не удалось проверить номер. Попробуйте позже или продолжите покупку без скидки.'}</p>
      {isNew && (result.verification?.status === 'PENDING'
        ? <p>Запрос на подтверждение создан. {result.verification.maxAttempts === 3 && `Осталось попыток: ${result.verification.remainingAttempts}.`} Подтверждение на этом экране пока недоступно.</p>
        : <p data-testid="verification-unavailable">Отправка кода временно недоступна. Попробуйте позже.</p>)}
    </div>
    <div className="display-phone-actions">
      <button className="display-secondary" type="button" onClick={onSkip}>Продолжить без скидки</button>
      {!loading && <button className="display-primary" type="button" onClick={returning ? onSkip : onReset}>{returning ? 'Продолжить покупку' : 'Ввести другой номер'}</button>}
    </div>
  </section>;
}
