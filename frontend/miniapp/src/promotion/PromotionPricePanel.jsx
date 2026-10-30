import React from 'react';
import './promotion.css';

function rub(value) {
  const amount = Number(value || 0);
  return `${amount.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`;
}

function urgencyCopy(urgency) {
  if (urgency === 'LAST_10_MINUTES') return 'Последние 10 минут «Часа выгоды»';
  if (urgency === 'LAST_30_MINUTES') return 'Осталось меньше 30 минут';
  if (urgency === 'LAST_HOUR') return 'До конца меньше часа';
  return 'Час выгоды идёт — −20%';
}

export function PromotionPricePanel({ pricing, compact = false, variant = 'default', onRefresh }) {
  if (!pricing) return null;
  const {
    status,
    quote,
    error,
    lockCountdown,
    lockExpired,
    promotionCountdown,
    promotionEnded,
    promotionUrgency,
  } = pricing;

  const className = `promo-price-panel${compact ? ' is-compact' : ''}${variant === 'terminal' ? ' is-terminal' : ''}`;

  if (status === 'unavailable') {
    return (
      <div className={`${className} is-neutral`}>
        <strong>Цена будет подтверждена сервером</strong>
        <span>Выберите конкретный автомат, чтобы проверить действующие акции.</span>
      </div>
    );
  }

  if (status === 'loading' && !quote) {
    return <div className={`${className} is-neutral`}><strong>Проверяем лучшую цену…</strong></div>;
  }

  if (status === 'error') {
    return (
      <div className={`${className} is-error`}>
        <strong>Не удалось подтвердить цену</strong>
        <span>{error?.message || 'Повторите расчёт.'}</span>
        {onRefresh && <button type="button" onClick={onRefresh}>Пересчитать цену</button>}
      </div>
    );
  }

  if (!quote) return null;

  const hasGift = Number(quote.giftAmount) > 0;
  const hasPromotion = Number(quote.promotionDiscountAmount) > 0;
  const saved = Number(quote.giftAmount || 0) + Number(quote.promotionDiscountAmount || 0);
  const discountPercent = Number(quote.promotionRuntime?.benefitValue || 20);

  return (
    <section className={`${className}${hasPromotion ? ' is-active' : ''}${hasGift ? ' has-gift' : ''}`} aria-live="polite">
      {hasPromotion && (
        <>
          <div className="promo-heading">
            <span>🔥 {quote.promotionRuntime?.name || 'Час выгоды'}</span>
            <strong>−{discountPercent}%</strong>
          </div>

          <div className={`promo-campaign-timer urgency-${String(promotionUrgency || 'ACTIVE').toLowerCase()}`}>
            {promotionEnded ? (
              <>
                <strong>«Час выгоды» завершён</strong>
                {!lockExpired && <span>Но ваша акционная цена сохранена ещё <b>{lockCountdown}</b>.</span>}
              </>
            ) : (
              <>
                <span>{urgencyCopy(promotionUrgency)}</span>
                <strong>До окончания: <b>{promotionCountdown}</b></strong>
              </>
            )}
          </div>
        </>
      )}

      {hasGift && <div className="promo-gift">🎁 Это ваша подарочная покупка!</div>}

      <div className="promo-prices">
        {(hasPromotion || hasGift) && <span className="promo-base-price">Обычная цена: <s>{rub(quote.baseAmount)}</s></span>}
        <strong>{hasGift && Number(quote.finalAmount) === 0 ? 'К оплате: 0 ₽' : `Цена сейчас: ${rub(quote.finalAmount)}`}</strong>
        {saved > 0 && <span>Выгода: {rub(saved)}</span>}
      </div>

      {hasPromotion && !quote.partialBonusPaymentAllowed && (
        <p>Во время «Часа выгоды» частичная оплата бонусами недоступна — для заказа уже действует скидка {discountPercent}%.</p>
      )}

      {hasPromotion && !quote.transferAllowed && (
        <p>Передача этого заказа другому человеку недоступна.</p>
      )}

      <div className={`promo-lock${lockExpired ? ' is-expired' : ''}`}>
        {lockExpired ? (
          <>
            <strong>Срок фиксации цены закончился</strong>
            <span>Мы пересчитаем заказ по действующим условиям.</span>
            {onRefresh && <button type="button" onClick={onRefresh}>Пересчитать цену</button>}
          </>
        ) : (
          <>
            <strong>Ваша цена зафиксирована</strong>
            <span>Завершите оформление в течение: <b>{lockCountdown}</b></span>
          </>
        )}
      </div>
    </section>
  );
}
