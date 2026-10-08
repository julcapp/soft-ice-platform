import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createTerminalPayment, getTerminalPaymentStatus, terminalPaymentErrorMessage } from './TerminalPaymentApi.js';

const POLL_MS = 2500;

export function TerminalPaymentScreen({ machineId, quote, purchaseToken, onBack }) {
  const [state, setState] = useState({ phase: 'creating', payment: null, error: null });
  const controllerRef = useRef(null);

  useEffect(() => {
    if (!quote?.id) {
      setState({ phase: 'error', payment: null, error: 'Нет действующей цены заказа.' });
      return undefined;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ phase: 'creating', payment: null, error: null });

    createTerminalPayment({
      machineId,
      quoteId: quote.id,
      purchaseToken,
      signal: controller.signal,
    }).then((payment) => {
      if (controller.signal.aborted) return;
      setState({ phase: phaseFor(payment), payment, error: null });
    }).catch((error) => {
      if (controller.signal.aborted) return;
      setState({ phase: 'error', payment: null, error: terminalPaymentErrorMessage(error) });
    });

    return () => controller.abort();
  }, [machineId, quote?.id, purchaseToken]);

  useEffect(() => {
    if (!state.payment?.paymentId || !['pending'].includes(state.phase)) return undefined;
    let stopped = false;
    let timer;
    const poll = async () => {
      const controller = new AbortController();
      controllerRef.current = controller;
      try {
        const payment = await getTerminalPaymentStatus({
          machineId,
          paymentId: state.payment.paymentId,
          signal: controller.signal,
        });
        if (stopped) return;
        setState({ phase: phaseFor(payment), payment, error: null });
        if (payment.userState === 'PENDING') timer = window.setTimeout(poll, POLL_MS);
      } catch (error) {
        if (stopped || controller.signal.aborted) return;
        setState((current) => ({
          ...current,
          error: 'Не удалось обновить статус. Продолжаем проверку…',
        }));
        timer = window.setTimeout(poll, POLL_MS);
      }
    };
    timer = window.setTimeout(poll, POLL_MS);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      controllerRef.current?.abort();
    };
  }, [machineId, state.payment?.paymentId, state.phase]);

  const qrDataUrl = useMemo(() => {
    const url = state.payment?.confirmationUrl;
    if (!url || typeof window === 'undefined' || typeof window.qrcode !== 'function') return null;
    try {
      const code = window.qrcode(0, 'M');
      code.addData(url);
      code.make();
      return code.createDataURL(7, 3);
    } catch {
      return null;
    }
  }, [state.payment?.confirmationUrl]);

  const amount = quote?.finalAmount;
  const currency = quote?.currency || 'RUB';

  if (state.phase === 'success') {
    return <section className="display-payment display-payment-success">
      <p className="display-kicker">Оплата подтверждена</p>
      <h1>Оплата прошла успешно</h1>
      <div className="display-payment-result is-success">
        <span aria-hidden="true">✓</span>
        <strong>Оплата получена</strong>
        <p>Команда на приготовление передана только после подтверждения платёжного сервера.</p>
      </div>
      <div className="display-waiting"><span />Готовим ваше мороженое</div>
    </section>;
  }

  if (state.phase === 'error') {
    return <section className="display-payment display-payment-error">
      <p className="display-kicker">Безналичная оплата</p>
      <h1>Оплата не прошла</h1>
      <div className="display-payment-result is-error">
        <span aria-hidden="true">!</span>
        <strong>{state.error || 'Банк не подтвердил платёж.'}</strong>
        <p>Изготовление мороженого не запущено.</p>
      </div>
      <button className="display-secondary" type="button" onClick={onBack}>Вернуться к заказу</button>
    </section>;
  }

  return <section className="display-payment">
    <p className="display-kicker">Безналичная оплата</p>
    <h1>К оплате {money(amount, currency)}</h1>
    {state.phase === 'creating' && <div className="display-payment-placeholder" role="status">
      <span aria-hidden="true">⌛</span>
      <strong>Создаём защищённый платёж</strong>
    </div>}
    {state.phase === 'pending' && state.payment?.confirmationUrl && <div className="display-payment-qr" role="status">
      {qrDataUrl ? <img src={qrDataUrl} alt="QR-код для оплаты через СБП" /> : <div className="display-payment-placeholder"><span>⌛</span><strong>Готовим QR-код</strong></div>}
      <div>
        <strong>Оплатите через СБП</strong>
        <p>Отсканируйте QR-код камерой смартфона или банковским приложением.</p>
        <small>Изготовление начнётся только после подтверждения оплаты ЮKassa.</small>
      </div>
    </div>}
    {state.phase === 'pending' && !state.payment?.confirmationUrl && <div className="display-payment-placeholder" role="status">
      <span aria-hidden="true">⌛</span>
      <strong>Ожидаем подтверждение платёжного сервера</strong>
    </div>}
    <div className="display-waiting"><span />{state.error || 'Проверяем статус оплаты'}</div>
    <button className="display-secondary" type="button" onClick={onBack}>Вернуться к заказу</button>
  </section>;
}

function phaseFor(payment) {
  if (payment?.userState === 'SUCCESS') return 'success';
  if (payment?.userState === 'ERROR') return 'error';
  return 'pending';
}

function money(value, currency = 'RUB') {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
}
