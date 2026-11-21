import React from 'react';
import './promotion.css';

function minutesLabel(seconds) {
  const minutes = Math.max(1, Math.ceil(Number(seconds || 0) / 60));
  return minutes === 1 ? '1 минуту' : `${minutes} минут`;
}

export function PromotionPreStartBanner({ awareness, terminal = false }) {
  const upcoming = awareness?.data?.upcoming;
  if (!upcoming || awareness.secondsUntilStart === null || awareness.secondsUntilStart <= 0) return null;
  const discount = Number(upcoming.discountPercent || 0);
  return (
    <section className={terminal ? 'promo-prestart is-terminal' : 'promo-prestart'} aria-live="polite">
      <div>
        <span>🍦 Скоро начнётся «{upcoming.name || 'Час выгоды'}»</span>
        <strong>Через {minutesLabel(awareness.secondsUntilStart)} скидка {discount}% начнёт действовать.</strong>
      </div>
      <b>−{discount}%</b>
    </section>
  );
}
