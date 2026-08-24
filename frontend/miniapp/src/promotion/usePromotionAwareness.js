import { useEffect, useState } from 'react';
import { getPromotionAwareness } from './PricingQuoteApi.js';

function monotonicNow() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
}

export function usePromotionAwareness({ machineId, channel }) {
  const [state, setState] = useState({ status: 'idle', data: null, receivedAt: null, tick: 0 });

  useEffect(() => {
    if (!machineId || !channel) return undefined;
    const controller = new AbortController();
    getPromotionAwareness({ machineId, channel, signal: controller.signal })
      .then((data) => setState({ status: 'ready', data, receivedAt: monotonicNow(), tick: 0 }))
      .catch((error) => {
        if (error?.name !== 'AbortError') setState({ status: 'error', data: null, receivedAt: null, tick: 0 });
      });
    return () => controller.abort();
  }, [machineId, channel]);

  useEffect(() => {
    if (!state.data?.upcoming || state.receivedAt === null) return undefined;
    const timer = window.setInterval(() => setState((current) => ({ ...current, tick: current.tick + 1 })), 1000);
    return () => window.clearInterval(timer);
  }, [state.data?.upcoming, state.receivedAt]);

  const elapsed = state.receivedAt === null ? 0 : Math.max(0, monotonicNow() - state.receivedAt);
  const secondsUntilStart = state.data?.upcoming ? Math.max(0, Number(state.data.upcoming.secondsUntilStart || 0) - Math.floor(elapsed / 1000)) : null;
  return { ...state, secondsUntilStart };
}
