import React, { useEffect, useMemo, useState } from 'react';
import { createTerminalPayment, getTerminalPaymentStatus, terminalPaymentErrorMessage } from './TerminalPaymentApi.js';

const POLL_MS = 2500;
const SAFE_CREATION_ERRORS = new Set(['PAYMENT_CHECKOUT_NOT_AVAILABLE', 'TERMINAL_QUOTE_NOT_FOUND', 'TERMINAL_QUOTE_EXPIRED', 'TERMINAL_QUOTE_SCOPE_MISMATCH', 'TERMINAL_INVENTORY_UNAVAILABLE', 'TERMINAL_MACHINE_CONTEXT_UNRESOLVED', 'TERMINAL_CONTACT_INVALID', 'TERMINAL_CUSTOMER_NOT_FOUND', 'TERMINAL_PAYMENT_METHOD_INVALID']);

export function TerminalPaymentScreen({ machineId, quote, items = [], purchaseToken, onBack, onComplete }) {
  const [state, setState] = useState({ phase: 'creating', payment: null, error: null });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!quote?.id) {
      setState({ phase: 'unavailable', payment: null, error: 'Нет действующей цены заказа.' });
      return undefined;
    }
    const controller = new AbortController();
    setState({ phase: 'creating', payment: null, error: null });
    createTerminalPayment({ machineId, quoteId: quote.id, purchaseToken, signal: controller.signal })
      .then((payment) => {
        if (!controller.signal.aborted) setState({ phase: phaseFor(payment), payment, error: null });
      }).catch((error) => {
        if (controller.signal.aborted) return;
        const safe = SAFE_CREATION_ERRORS.has(error.code);
        setState({ phase: safe ? 'unavailable' : 'unknown', payment: null,
          error: safe ? terminalPaymentErrorMessage(error) : 'Связь прервалась. Результат оплаты пока неизвестен.' });
      });
    return () => controller.abort();
  }, [machineId, quote?.id, purchaseToken, retry]);

  useEffect(() => {
    if (!state.payment?.paymentId || !['pending', 'success'].includes(state.phase) || (state.phase === 'success' && state.payment.fulfillmentState !== 'WAITING')) return undefined;
    const controller = new AbortController();
    let timer;
    const poll = async () => {
      try {
        const payment = await getTerminalPaymentStatus({ machineId, paymentId: state.payment.paymentId, signal: controller.signal });
        if (controller.signal.aborted) return;
        setState({ phase: phaseFor(payment), payment, error: null });
        if (payment.userState === 'PENDING' || (payment.userState === 'SUCCESS' && payment.fulfillmentState === 'WAITING')) timer = window.setTimeout(poll, POLL_MS);
      } catch {
        if (controller.signal.aborted) return;
        setState((current) => ({ ...current, error: 'Связь прервалась. Проверяем оплату — повторно платить не нужно.' }));
        timer = window.setTimeout(poll, POLL_MS);
      }
    };
    timer = window.setTimeout(poll, POLL_MS);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [machineId, state.payment?.paymentId, state.phase]);

  const qrDataUrl = useMemo(() => {
    const url = state.payment?.confirmationUrl;
    if (!url || typeof window.qrcode !== 'function') return null;
    try {
      const code = window.qrcode(0, 'M');
      code.addData(url);
      code.make();
      return code.createDataURL(8, 4 * 8);
    } catch { return null; }
  }, [state.payment?.confirmationUrl]);

  const result = state.phase === 'success' || state.phase === 'error' || state.phase === 'unavailable';
  const title = state.phase === 'success' ? 'Оплата прошла успешно' : state.phase === 'error' ? 'Оплата не прошла' : state.phase === 'unavailable' ? 'Оплата пока недоступна' : 'Оплатите ваше мороженое';
  return <section className={`display-payment display-payment-${state.phase}`} aria-labelledby="terminal-payment-title" data-testid={`terminal-payment-${state.phase}`}>
    <p className="display-kicker">{state.phase === 'success' ? 'Спасибо за покупку' : 'Безналичная оплата'}</p>
    <h1 id="terminal-payment-title">{title}</h1>
    <div className="display-payment-order">
      <div><span>{state.phase === 'success' ? 'Оплачено' : 'К оплате'}</span><strong>{money(state.payment?.amount ?? quote?.finalAmount, state.payment?.currency || quote?.currency)}</strong></div>
      {items.length > 0 && <ul aria-label="Состав заказа">{items.map((item) => <li key={item.sku}>{item.nameRu}</li>)}</ul>}
    </div>
    {result ? <div className={`display-payment-result ${state.phase === 'success' ? 'is-success' : 'is-error'}`} role="status">
      <span aria-hidden="true">{state.phase === 'success' ? '✓' : '!'}</span>
      <strong>{state.phase === 'success' ? (state.payment.fulfillmentState === 'COMPLETED' ? 'Ваше мороженое готово' : state.payment.fulfillmentState === 'ATTENTION_REQUIRED' ? 'Требуется помощь сотрудника' : 'Оплата получена') : state.phase === 'error' ? 'Банк не подтвердил платёж' : state.error}</strong>
      <p>{state.phase === 'success' ? (state.payment.fulfillmentState === 'COMPLETED' ? 'Заберите мороженое из окна выдачи. Приятного аппетита!' : state.payment.fulfillmentState === 'ATTENTION_REQUIRED' ? 'Оплата получена, но выдача требует проверки. Не оплачивайте заказ повторно. Обратитесь к сотруднику с номером заказа.' : 'Ожидайте мороженое у аппарата. Сохраните номер заказа на случай обращения.') : state.phase === 'error' ? 'Можно вернуться к заказу и попробовать снова.' : 'Вернитесь к заказу или обратитесь к сотруднику точки.'}</p>
      {state.phase === 'success' && state.error && <p role="status">Не удалось проверить выдачу. Повторно платить не нужно.</p>}
      {state.payment?.orderId && <p className="display-payment-order-id">Номер заказа: {state.payment.orderId}</p>}
    </div> : <>
      {state.phase === 'pending' && state.payment?.confirmationUrl ? <div className="display-payment-qr">
        {qrDataUrl ? <img src={qrDataUrl} alt="QR-код для оплаты через СБП" /> : <div className="display-payment-qr-fallback" role="status">QR-код не удалось показать. Обратитесь к сотруднику точки.</div>}
        <div><strong>Оплатите через СБП</strong><ol><li>Откройте камеру смартфона или банковское приложение.</li><li>Отсканируйте QR-код и подтвердите оплату.</li><li>Дождитесь подтверждения на этом экране.</li></ol><small>Оплату проверим автоматически.</small></div>
      </div> : <div className="display-payment-placeholder" role="status"><span aria-hidden="true">⌛</span><strong>{state.phase === 'unknown' ? state.error : state.phase === 'creating' ? 'Подготавливаем оплату…' : 'Ожидаем подтверждение оплаты…'}</strong></div>}
      {state.phase === 'pending' && <div className="display-waiting" role="status"><span aria-hidden="true" />{state.error || 'Ожидаем оплату'}</div>}
      <p className="display-payment-note">{state.phase === 'unknown' ? 'Если деньги уже списаны, повторно платить не нужно. Проверьте этот же заказ.' : 'Приготовление начнётся после подтверждения оплаты.'}</p>
    </>}
    <div className="display-payment-actions">
      {state.phase === 'success' && state.payment.fulfillmentState === 'COMPLETED' && <button className="display-primary" type="button" onClick={onComplete}>Завершить</button>}
      {state.phase === 'unknown' && <button className="display-primary" type="button" onClick={() => setRetry((value) => value + 1)}>Проверить оплату</button>}
      {['error', 'unavailable'].includes(state.phase) && <button className="display-secondary" type="button" onClick={onBack}>Вернуться к заказу</button>}
    </div>
  </section>;
}
function phaseFor(payment) {
  if (payment?.userState === 'SUCCESS' && payment.status === 'SUCCEEDED') return 'success';
  if (payment?.userState === 'ERROR' && ['FAILED', 'CANCELED'].includes(payment.status)) return 'error';
  return 'pending';
}
function money(value, currency = 'RUB') {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  try { return new Intl.NumberFormat('ru-RU', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value)); } catch { return '—'; }
}
