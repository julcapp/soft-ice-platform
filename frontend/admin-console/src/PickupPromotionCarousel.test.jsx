/** @vitest-environment jsdom */
import React, { act } from '../../miniapp/node_modules/react/index.js';
import { createRoot } from '../../miniapp/node_modules/react-dom/client.js';
import { it, expect, vi } from 'vitest';
import { PickupPromotionCarousel } from '../../miniapp/src/terminal/PickupPromotionCarousel.jsx';
import { CompletionCountdown } from '../../miniapp/src/terminal/CompletionCountdown.jsx';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
it('rotates, pauses on selection, resumes, and never extends the exit deadline', () => {
  vi.useFakeTimers(); const host = document.createElement('div'), root = createRoot(host), back = vi.fn();
  try {
    act(() => root.render(<><PickupPromotionCarousel /><CompletionCountdown onComplete={back} /></>));
    expect(host.querySelector('img:not([hidden])').alt).toContain('сливочного');
    act(() => vi.advanceTimersByTime(5000));
    expect(host.querySelector('img:not([hidden])').alt).toContain('ягодное');
    act(() => host.querySelector('[aria-label="Фото 3 из 3"]').click());
    act(() => vi.advanceTimersByTime(5000));
    expect(host.querySelector('[aria-label="Фото 3 из 3"]').getAttribute('aria-pressed')).toBe('true');
    act(() => host.querySelector('[aria-label="Продолжить смену фотографий"]').click());
    act(() => vi.advanceTimersByTime(5000));
    expect(host.querySelector('img:not([hidden])').alt).toContain('сливочного');
    expect(host.querySelector('figcaption').textContent).toContain('по вашему выбору');
    act(() => vi.advanceTimersByTime(15000)); expect(back).toHaveBeenCalledTimes(1);
  } finally { act(() => root.unmount()); vi.useRealTimers(); }
});
it('respects reduced motion without disabling manual selection', () => {
  vi.useFakeTimers(); const original = window.matchMedia;
  window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  const host = document.createElement('div'), root = createRoot(host);
  try {
    act(() => root.render(<PickupPromotionCarousel />));
    act(() => vi.advanceTimersByTime(10000));
    expect(host.querySelector('img:not([hidden])').alt).toContain('сливочного');
    expect(host.querySelector('.pickup-promotion-pause')).toBeNull();
    act(() => host.querySelector('[aria-label="Фото 2 из 3"]').click());
    expect(host.querySelector('img:not([hidden])').alt).toContain('ягодное');
  } finally { act(() => root.unmount()); window.matchMedia = original; vi.useRealTimers(); }
});
