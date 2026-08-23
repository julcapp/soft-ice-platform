import React from 'react';

function rub(value) {
  const amount = Number(value || 0);
  return `${amount.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`;
}

export function PromotionPricePanel({ pricing, compact = false, onRefresh }) {
  if (!pricing) return null;
  const { status, quote, error, lockCountdown, lockExpired } = pricing;

  if (status === 'unavailable') {
    return (
      <div className="promo-price-panel is-neutral">
        <strong>Цена будет подтверждена сервером</strong>
        <span>Выберите конкретный автомат, чтобы проверить действующие акции.</span>
      </div>
    );
  }

  if (status === 'loading' && !quote) {
    return <div className="promo-price-panel is-neutral"><strong>Проверяем лучшую цену…</strong></div>;
  }

  if (status === 'error') {
    return (
      <div className="promo-price-panel is-error">
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

  return (
    <section className={`promo-price-panel${compact ? ' is-compact' : ''}${hasPromotion ? ' is-active' : ''}${hasGift ? ' has-gift' : ''}`} aria-live="polite">
      {hasPromotion && (
        <div className="promo-heading">
          <span>🔥 Час выгоды</span>
          <strong>−20%</strong>
        </div>
      )}

      {hasGift && <div className="promo-gift">🎁 Это ваша подарочная покупка!</div>}

      <div className="promo-prices">
        {(hasPromotion || hasGift) && <span className="promo-base-price">Обычная цена: <s>{rub(quote.baseAmount)}</s></span>}
        <strong>{hasGift && Number(quote.finalAmount) === 0 ? 'К оплате: 0 ₽' : `Цена сейчас: ${rub(quote.finalAmount)}`}</strong>
        {saved > 0 && <span>Выгода: {rub(saved)}</span>}
      </div>

      {hasPromotion && !quote.partialBonusPaymentAllowed && (
        <p>Во время «Часа выгоды» частичная оплата бонусами недоступна — для заказа уже действует скидка 20%.</p>
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
