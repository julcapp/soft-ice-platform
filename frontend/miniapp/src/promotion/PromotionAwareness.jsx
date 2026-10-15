import React, { useEffect, useMemo, useState } from 'react';
import './promotion.css';

function windowKey(quote) {
  const runtime = quote?.promotionRuntime;
  if (!quote?.campaignId || !runtime?.startsAt) return null;
  return `promotion-awareness:${quote.campaignId}:${quote.promotionVersionId || 'v'}:${runtime.startsAt}`;
}

function urgencyText(urgency) {
  if (urgency === 'LAST_10_MINUTES') return 'Последние 10 минут «Часа выгоды»';
  if (urgency === 'LAST_30_MINUTES') return 'Осталось меньше 30 минут';
  if (urgency === 'LAST_HOUR') return 'До конца меньше часа';
  return 'Час выгоды идёт — −20%';
}

function usePopupState(pricing) {
  const key = useMemo(() => windowKey(pricing?.quote), [pricing?.quote]);
  const active = Boolean(pricing?.quote?.promotionRuntime) && !pricing?.promotionEnded && Number(pricing?.quote?.promotionDiscountAmount || 0) > 0;
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (!active || !key) {
      setDismissed(true);
      return;
    }
    try {
      setDismissed(window.sessionStorage.getItem(key) === 'dismissed');
    } catch {
      setDismissed(false);
    }
  }, [active, key]);

  function dismiss() {
    if (key) {
      try { window.sessionStorage.setItem(key, 'dismissed'); } catch { /* no-op */ }
    }
    setDismissed(true);
  }

  return { active, dismissed, dismiss };
}

export function MiniAppPromotionAwareness({ pricing, onCta }) {
  const { active, dismissed, dismiss } = usePopupState(pricing);
  if (!active) return null;

  if (dismissed) {
    return (
      <button className="promo-compact-banner" type="button" onClick={onCta}>
        <span>🔥 −20%</span>
        <strong>{pricing.promotionCountdown}</strong>
      </button>
    );
  }

  return (
    <div className="promo-popup-backdrop" role="presentation">
      <section className="promo-popup" role="dialog" aria-modal="true" aria-label="Час выгоды">
        <button className="promo-popup-close" type="button" onClick={dismiss} aria-label="Закрыть">×</button>
        <span className="promo-popup-icon" aria-hidden="true">🍦</span>
        <p className="promo-popup-kicker">🔥 Час выгоды</p>
        <h2>Скидка 20%</h2>
        <p className="promo-popup-urgency">{urgencyText(pricing.promotionUrgency)}</p>
        <div className="promo-popup-timer"><span>До окончания</span><strong>{pricing.promotionCountdown}</strong></div>
        <p>Скидка применяется автоматически к платным позициям заказа.</p>
        <button className="promo-popup-cta" type="button" onClick={() => { dismiss(); onCta?.(); }}>Купить со скидкой</button>
      </section>
    </div>
  );
}

export function TerminalPromotionHero({ pricing }) {
  const active = Boolean(pricing?.quote?.promotionRuntime) && !pricing?.promotionEnded && Number(pricing?.quote?.promotionDiscountAmount || 0) > 0;
  if (!active) return null;
  return (
    <section className={`terminal-promo-hero urgency-${String(pricing.promotionUrgency || 'active').toLowerCase()}`} aria-live="polite">
      <div>
        <p>🔥 ЧАС ВЫГОДЫ</p>
        <strong>−20%</strong>
      </div>
      <div className="terminal-promo-copy">
        <h2>{urgencyText(pricing.promotionUrgency)}</h2>
        <span>Скидка применяется автоматически</span>
      </div>
      <div className="terminal-promo-timer">
        <span>До окончания</span>
        <strong>{pricing.promotionCountdown}</strong>
      </div>
    </section>
  );
}
