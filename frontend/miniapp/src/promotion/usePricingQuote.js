import { useEffect, useMemo, useState } from 'react';
import { createPricingQuote } from './PricingQuoteApi.js';

function millisecondsLeft(until, nowMs) {
  const target = new Date(until).getTime();
  if (!Number.isFinite(target)) return 0;
  return Math.max(0, target - nowMs);
}

export function formatCountdown(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

export function usePricingQuote({ machineId, channel, productId, productName, refreshKey = '' }) {
  const [state, setState] = useState({ status: 'idle', quote: null, error: null });
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!machineId || !productId || !channel) {
      setState({ status: 'unavailable', quote: null, error: null });
      return undefined;
    }

    const controller = new AbortController();
    setState((current) => ({ status: 'loading', quote: current.quote, error: null }));
    createPricingQuote({
      machineId,
      channel,
      productId,
      name: productName,
      signal: controller.signal,
    }).then((quote) => {
      setState({ status: 'ready', quote, error: null });
      setNowMs(Date.now());
    }).catch((error) => {
      if (error?.name === 'AbortError') return;
      setState({ status: 'error', quote: null, error });
    });

    return () => controller.abort();
  }, [machineId, channel, productId, productName, refreshKey]);

  useEffect(() => {
    if (!state.quote?.lockedUntil) return undefined;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [state.quote?.lockedUntil]);

  const lockRemainingMs = useMemo(
    () => state.quote?.lockedUntil ? millisecondsLeft(state.quote.lockedUntil, nowMs) : 0,
    [state.quote?.lockedUntil, nowMs],
  );

  return {
    ...state,
    lockRemainingMs,
    lockCountdown: formatCountdown(lockRemainingMs),
    lockExpired: Boolean(state.quote) && lockRemainingMs <= 0,
  };
}
