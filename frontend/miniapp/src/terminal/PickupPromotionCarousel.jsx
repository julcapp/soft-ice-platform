import React, { useEffect, useState } from 'react';
import { getPickupPromotion } from '../domain/media/pickupPromotion.js';

export function PickupPromotionCarousel() {
  const { slides, intervalMs, caption } = getPickupPromotion();
  const [index, setIndex] = useState(0), [paused, setPaused] = useState(false), [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return undefined;
    const update = () => setReduced(query.matches);
    update(); query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);
  useEffect(() => {
    if (paused || reduced || slides.length < 2) return undefined;
    const timer = window.setInterval(() => setIndex(value => (value + 1) % slides.length), intervalMs);
    return () => window.clearInterval(timer);
  }, [paused, reduced, slides, intervalMs]);
  return <figure className="pickup-promotion" aria-label="Рекламные фотографии мороженого" aria-roledescription="карусель">
    <div className="pickup-promotion-frame">{slides.map((slide, position) => <img key={slide.id} src={slide.src} alt={slide.alt} hidden={position !== index} width="640" height="640" decoding="async" onError={event => { event.currentTarget.style.visibility = 'hidden'; }} />)}</div>
    <div className="pickup-promotion-controls">
      {slides.map((slide, position) => <button type="button" key={slide.id} aria-label={`Фото ${position + 1} из ${slides.length}`} aria-pressed={position === index} onClick={() => { setIndex(position); setPaused(true); }}><span /></button>)}
      {!reduced && <button type="button" className="pickup-promotion-pause" aria-label={paused ? 'Продолжить смену фотографий' : 'Приостановить смену фотографий'} onClick={() => setPaused(value => !value)}>{paused ? '▶' : 'Ⅱ'}</button>}
    </div>
    <figcaption>{caption}</figcaption>
  </figure>;
}
