import { useEffect, useMemo, useState } from 'react';
import { createPricingQuote } from './PricingQuoteApi.js';

function safeTimestamp(value) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function monotonicNow() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function initialDurationMs(start, end) {
  const startMs = safeTimestamp(start);
  const endMs = safeTimestamp(end);
  if (startMs === null || endMs === null) return 0;
  return Math.max(0, endMs - startMs);
}

export function formatCountdown(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

export function promotionUrgency(remainingMs) {
  if (remainingMs <= 0) return 'ENDED';
  if (remainingMs <= 10 * 60 * 1000) return 'LAST_10_MINUTES';
  if (remainingMs <= 30 * 60 * 1000) return 'LAST_30_MINUTES';
  if (remainingMs <= 60 * 60 * 1000) return 'LAST_HOUR';
  return 'ACTIVE';
}

export function usePricingQuote({ machineId, channel, productId, productName, refreshKey = '' }) {
  const [state, setState] = useState({ status: 'idle', quote: null, error: null, receivedAt: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!machineId || !productId || !channel) {
      setState({ status: 'unavailable', quote: null, error: null, receivedAt: null });
      return undefined;
    }

    const controller = new AbortController();
    setState((current) => ({ ...current, status: 'loading', error: null }));
    createPricingQuote({
      machineId,
      channel,
      productId,
      name: productName,
      signal: controller.signal,
    }).then((quote) => {
      setState({ status: 'ready', quote, error: null, receivedAt: monotonicNow() });
      setTick(0);
    }).catch((error) => {
      if (error?.name === 'AbortError') return;
      setState({ status: 'error', quote: null, error, receivedAt: null });
    });

    return () => controller.abort();
  }, [machineId, channel, productId, productName, refreshKey]);

  useEffect(() => {
    if (!state.quote || state.receivedAt === null) return undefined;
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [state.quote, state.receivedAt]);

  const elapsedMs = useMemo(() => {
    if (!state.quote || state.receivedAt === null) return 0;
    return Math.max(0, monotonicNow() - state.receivedAt);
  }, [state.quote, state.receivedAt, tick]);

  const lockRemainingMs = useMemo(() => {
    if (!state.quote?.lockedUntil) return 0;
    const serverTime = state.quote?.promotionRuntime?.serverTime || state.quote?.createdAt;
    const initial = initialDurationMs(serverTime, state.quote.lockedUntil);
    return Math.max(0, initial - elapsedMs);
  }, [state.quote, elapsedMs]);

  const promotionRemainingMs = useMemo(() => {
    if (!state.quote?.promotionRuntime) return 0;
    const seconds = Number(state.quote.promotionRuntime.remainingSeconds);
    const initial = Number.isFinite(seconds)
      ? Math.max(0, seconds * 1000)
      : initialDurationMs(state.quote.promotionRuntime.serverTime, state.quote.promotionRuntime.endsAt);
    return Math.max(0, initial - elapsedMs);
  }, [state.quote, elapsedMs]);

  return {
    ...state,
    lockRemainingMs,
    lockCountdown: formatCountdown(lockRemainingMs),
    lockExpired: Boolean(state.quote) && lockRemainingMs <= 0,
    promotionRemainingMs,
    promotionCountdown: formatCountdown(promotionRemainingMs),
    promotionEnded: Boolean(state.quote?.promotionRuntime) && promotionRemainingMs <= 0,
    promotionUrgency: promotionUrgency(promotionRemainingMs),
  };
}
