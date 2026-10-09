import React, { useEffect, useMemo, useRef, useState } from 'react';
import { refreshOrderPaymentStatus } from './PaymentCheckoutApi.js';
import { getTerminalOrderPaymentStatus } from '../terminal/TerminalPaymentApi.js';

const MAX_AUTO_CHECKS = 24;
const POLL_MS = 2500;

function money(value, currency = 'RUB') {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency }).format(Number(value));
}

function safeFailureMessage(code) {
  const known = {
    PAYMENT_NOT_FOUND: 'Платёж не найден. Проверьте историю заказов или повторите оплату.',
    PAYMENT_PROVIDER_REFERENCE_MISSING: 'Платёж ещё не создан в банке.',
    PAYMENT_PROVIDER_AMOUNT_MISMATCH: 'Платёж требует проверки. Средства не считаются подтверждёнными.',
    PAYMENT_PROVIDER_PAID_FLAG_MISMATCH: 'Банк ещё не подтвердил списание средств.',
    YOOKASSA_TIMEOUT: 'Банк отвечает дольше обычного. Проверьте платёж ещё раз.',
  };
  return known[code] || 'Банк не подтвердил успешную оплату.';
}

export function PaymentResultScreen({ orderId, source = null, machineId = null, onDone, onRetry }) {
  const [state, setState] = useState({ status: 'loading', payment: null, error: null });
  const [checkCount, setCheckCount] = useState(0);
  const controller = useRef(null);

  const load = async () => {
    if (!orderId) {
      setState({ status: 'error', payment: null, error: { code: 'ORDER_ID_MISSING', message: 'Не указан заказ для проверки.' } });
      return;
    }
    if (source === 'terminal' && !machineId) {
      setState({ status: 'error', payment: null, error: { code: 'MACHINE_ID_MISSING', message: 'Не указан аппарат для проверки платежа.' } });
      return;
    }
    controller.current?.abort();
    const next = new AbortController();
    controller.current = next;
    try {
      const payment = source === 'terminal'
        ? await getTerminalOrderPaymentStatus({ machineId, orderId, signal: next.signal })
        : await refreshOrderPaymentStatus(orderId, { signal: next.signal });
      setCheckCount((value) => value + 1);
      if (payment.userState === 'SUCCESS') {
        setState({ status: 'success', payment, error: null });
        return;
      }
      if (payment.userState === 'ERROR') {
        setState({ status: 'error', payment, error: { code: payment.failureCode || payment.status, message: safeFailureMessage(payment.failureCode) } });
        return;
      }
      if (payment.userState === 'REFUNDED') {
        setState({ status: 'refunded', payment, error: null });
        return;
      }
      setState((current) => ({
        status: checkCount + 1 >= MAX_AUTO_CHECKS ? 'pending-manual' : 'pending',
        payment,
        error: null,
      }));
    } catch (error) {
      if (error?.name === 'AbortError') return;
      const retryable = error?.code === 'PAYMENT_CONCURRENT_TRANSITION'
        || error?.code === 'YOOKASSA_TIMEOUT'
        || error?.code === 'PAYMENT_REQUEST_FAILED'
        || Number(error?.status) >= 500
        || Number(error?.status) === 409;
      if (retryable) {
        setCheckCount((value) => value + 1);
        setState((current) => ({
          status: checkCount + 1 >= MAX_AUTO_CHECKS ? 'pending-manual' : 'pending',
          payment: current.payment,
          error: { code: error.code, message: 'Платёж подтверждается. Повторно оплачивать не нужно.' },
        }));
        return;
      }
      setState({ status: 'error', payment: null, error: { code: error.code, message: safeFailureMessage(error.code) } });
    }
  };

  useEffect(() => {
    load();
    return () => controller.current?.abort();
  }, [orderId]);

  useEffect(() => {
    if (state.status !== 'pending') return undefined;
    const timer = window.setTimeout(load, POLL_MS);
    return () => window.clearTimeout(timer);
  }, [state.status, state.payment?.providerStatus, checkCount]);

  const amount = useMemo(() => money(state.payment?.amount, state.payment?.currency), [state.payment]);

  if (state.status === 'loading' || state.status === 'pending') {
    return <main className="app-shell payment-result-screen"><section className="card">
      <p className="eyebrow">Оплата</p>
      <h1>Проверяем оплату…</h1>
      <p>Ждём подтверждение банка. Не закрывайте приложение — это обычно занимает несколько секунд.</p>
      {amount ? <p><strong>Сумма: {amount}</strong></p> : null}
      <div className="display-spinner" aria-label="Проверяем статус платежа" />
    </section></main>;
  }

  if (state.status === 'success') {
    return <main className="app-shell payment-result-screen"><section className="card">
      <p className="eyebrow">Оплата</p>
      <h1>Оплата прошла успешно</h1>
      <p>Банк подтвердил платёж. Заказ оплачен.</p>
      {amount ? <p><strong>{amount}</strong></p> : null}
      <button className="button primary" type="button" onClick={onDone}>Продолжить</button>
    </section></main>;
  }

  if (state.status === 'refunded') {
    return <main className="app-shell payment-result-screen"><section className="card">
      <p className="eyebrow">Оплата</p>
      <h1>Платёж возвращён</h1>
      <p>По этому платежу подтверждён полный возврат средств.</p>
      <button className="button primary" type="button" onClick={onDone}>Вернуться в Клуб</button>
    </section></main>;
  }

  if (state.status === 'pending-manual') {
    return <main className="app-shell payment-result-screen"><section className="card">
      <p className="eyebrow">Оплата</p>
      <h1>Платёж ещё обрабатывается</h1>
      <p>Банк пока не прислал окончательный статус. Мы не считаем заказ оплаченным до подтверждения.</p>
      <button className="button primary" type="button" onClick={load}>Проверить ещё раз</button>
      <button className="button" type="button" onClick={onDone}>Вернуться в Клуб</button>
    </section></main>;
  }

  return <main className="app-shell payment-result-screen"><section className="card">
    <p className="eyebrow">Оплата</p>
    <h1>Оплата не прошла</h1>
    <p>{state.error?.message || 'Банк не подтвердил успешную оплату.'}</p>
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 18 }}>
      <button className="button primary" type="button" onClick={onRetry}>Попробовать ещё раз</button>
      <button className="button" type="button" onClick={onDone}>Вернуться в Клуб</button>
    </div>
  </section></main>;
}
