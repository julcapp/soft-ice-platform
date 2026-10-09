import React, { useEffect, useMemo, useState } from 'react';
import { createTerminalPayment, getTerminalPaymentMethods, getTerminalPaymentStatus, terminalPaymentErrorMessage } from './TerminalPaymentApi.js';

const POLL_MS = 2500;
const SAFE_CREATION_ERRORS = new Set(['RESOURCE_NOT_FOUND', 'PAYMENT_CHECKOUT_NOT_AVAILABLE', 'TERMINAL_QUOTE_NOT_FOUND', 'TERMINAL_QUOTE_EXPIRED', 'TERMINAL_QUOTE_SCOPE_MISMATCH', 'TERMINAL_INVENTORY_UNAVAILABLE', 'TERMINAL_MACHINE_CONTEXT_UNRESOLVED', 'TERMINAL_CONTACT_INVALID', 'TERMINAL_CUSTOMER_NOT_FOUND', 'TERMINAL_PAYMENT_METHOD_INVALID', 'TERMINAL_POS_NOT_CONFIGURED']);

export function TerminalPaymentScreen({ machineId, quote, items = [], purchaseToken, method = null, onSelectMethod, onBack, onComplete }) {
  const [state, setState] = useState({ phase: method ? 'creating' : 'choosing', payment: null, error: null });
  const [retry, setRetry] = useState(0);
  const [selectionError, setSelectionError] = useState(null);
  const [availableMethods, setAvailableMethods] = useState([]);

  useEffect(() => {
    if (method) return undefined;
    const controller = new AbortController();
    getTerminalPaymentMethods({ machineId, signal: controller.signal })
      .then((methods) => setAvailableMethods(methods.filter((item) => item.available)))
      .catch(() => setAvailableMethods([]));
    return () => controller.abort();
  }, [machineId, method]);

  useEffect(() => {
    if (!method) {
      setState({ phase: 'choosing', payment: null, error: null });
      return undefined;
    }
    if (!quote?.id) {
      setState({ phase: 'unavailable', payment: null, error: 'Нет действующей цены заказа.' });
      return undefined;
    }
    const controller = new AbortController();
    setState({ phase: 'creating', payment: null, error: null });
    createTerminalPayment({ machineId, quoteId: quote.id, purchaseToken, method, signal: controller.signal })
      .then((payment) => {
        if (!controller.signal.aborted) setState({ phase: phaseFor(payment), payment, error: null });
      }).catch((error) => {
        if (controller.signal.aborted) return;
        const safe = SAFE_CREATION_ERRORS.has(error.code);
        setState({ phase: safe ? 'unavailable' : 'unknown', payment: null,
          error: safe ? terminalPaymentErrorMessage(error) : 'Связь прервалась. Результат оплаты пока неизвестен.' });
      });
    return () => controller.abort();
  }, [machineId, quote?.id, purchaseToken, method, retry]);

  useEffect(() => {
    if (!state.payment?.paymentId || !['pending', 'success'].includes(state.phase) || (state.phase === 'success' && !['WAITING', 'TRANSMITTING', 'PREPARING'].includes(state.payment.fulfillmentState))) return undefined;
    const controller = new AbortController();
    let timer;
    const poll = async () => {
      try {
        const payment = await getTerminalPaymentStatus({ machineId, paymentId: state.payment.paymentId, signal: controller.signal });
        if (controller.signal.aborted) return;
        setState({ phase: phaseFor(payment), payment, error: null });
        if (payment.userState === 'PENDING' || (payment.userState === 'SUCCESS' && ['WAITING', 'TRANSMITTING', 'PREPARING'].includes(payment.fulfillmentState))) timer = window.setTimeout(poll, POLL_MS);
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
  const title = state.phase === 'choosing' ? 'Выберите способ оплаты' : state.phase === 'success'
    ? state.payment.fulfillmentState === 'COMPLETED' ? 'Готово! Заберите мороженое'
      : state.payment.fulfillmentState === 'PREPARING' ? 'Ваше мороженое готовится'
        : state.payment.fulfillmentState === 'TRANSMITTING' ? 'Передаём заказ аппарату'
          : 'Оплата прошла'
    : state.phase === 'error' ? 'Оплата не прошла' : state.phase === 'unavailable' ? 'Оплата пока недоступна' : 'Оплатите ваше мороженое';
  return <section className={`display-payment display-payment-${state.phase}`} aria-labelledby="terminal-payment-title" data-testid={`terminal-payment-${state.phase}`}>
    <p className="display-kicker">{state.phase === 'success' ? 'Спасибо за покупку' : 'Безналичная оплата'}</p>
    <h1 id="terminal-payment-title">{title}</h1>
    <div className="display-payment-order">
      <div><span>{state.phase === 'success' ? 'Оплачено' : 'К оплате'}</span><strong>{money(state.payment?.amount ?? quote?.finalAmount, state.payment?.currency || quote?.currency)}</strong></div>
      {items.length > 0 && <ul aria-label="Состав заказа">{items.map((item) => <li key={item.sku}>{item.nameRu}</li>)}</ul>}
    </div>
    {state.phase === 'choosing' ? <>
      <div className="display-payment-methods" aria-label="Способы оплаты">
        {[
          { id: 'sbp', title: 'СБП', subtitle: 'По QR-коду со смартфона', icon: 'qr' },
          { id: 'pos', title: 'Банковская карта', subtitle: 'Через POS-терминал аппарата', icon: 'card' },
          ...(availableMethods.some((item) => item.id === 'test_card')
            ? [{ id: 'test_card', title: 'Тестовая карта ЮKassa', subtitle: 'Только для проверки тестового магазина', icon: 'card' }]
            : []),
        ].map((item) => {
          return <button key={item.id} className="display-payment-method" type="button" onClick={() => {
            if (onSelectMethod?.(item.id) === false) setSelectionError('Не удалось открыть оплату. Попробуйте ещё раз.');
          }}>
            <PaymentMethodIcon type={item.icon} />
            <strong>{item.title}</strong><span>{item.subtitle}</span>
          </button>;
        })}
      </div>
      {selectionError && <p role="status" className="display-payment-note">{selectionError}</p>}
    </> : result ? <><div className={`display-payment-result ${state.phase === 'success' ? 'is-success' : 'is-error'}`} role="status">
      <span aria-hidden="true">{state.phase === 'success' ? '✓' : '!'}</span>
      <strong>{state.phase === 'success'
        ? state.payment.fulfillmentState === 'COMPLETED' ? 'Заберите мороженое из окна выдачи'
          : state.payment.fulfillmentState === 'ATTENTION_REQUIRED' ? 'Требуется помощь сотрудника'
            : state.payment.fulfillmentState === 'PREPARING' ? 'Аппарат уже готовит ваш заказ'
              : state.payment.fulfillmentState === 'TRANSMITTING' ? 'Ничего нажимать не нужно'
                : 'Ничего нажимать не нужно'
        : state.phase === 'error' ? 'Банк не подтвердил платёж' : state.error}</strong>
      <p>{state.phase === 'success'
        ? state.payment.fulfillmentState === 'COMPLETED' ? 'Ваш заказ готов. Заберите мороженое. Приятного аппетита!'
          : state.payment.fulfillmentState === 'ATTENTION_REQUIRED' ? 'Оплата получена, но выдача требует проверки. Повторно не оплачивайте. Обратитесь к сотруднику и назовите номер заказа.'
            : state.payment.fulfillmentState === 'PREPARING' ? 'Подождите немного — мороженое готовится автоматически.'
              : state.payment.fulfillmentState === 'TRANSMITTING' ? 'Оплата подтверждена. Мы сами передаём заказ аппарату.'
                : 'Оплата подтверждена. Сейчас заказ автоматически будет передан аппарату.'
        : state.phase === 'error' ? 'Можно вернуться к заказу и попробовать снова.' : 'Вернитесь к заказу или обратитесь к сотруднику точки.'}</p>
      {state.phase === 'success' && state.error && <p role="status">Не удалось проверить выдачу. Повторно платить не нужно.</p>}
      {state.payment?.orderId && <details className="display-payment-order-id"><summary>Номер заказа</summary><p>{state.payment.orderId}</p></details>}
    </div>{state.phase === 'unavailable' && method === 'pos' && <PosPaymentGuide active={false} />}</> : <>
      {method === 'pos' && state.phase !== 'unknown' ? <PosPaymentGuide active={state.phase === 'pending'} />
        : method === 'test_card' && state.phase === 'pending' && state.payment?.confirmationUrl ? <div className="display-payment-placeholder" role="status">
          <span aria-hidden="true">🧪</span>
          <strong>Тестовый платёж ЮKassa создан</strong>
          <button className="display-primary" type="button" onClick={() => { window.location.href = state.payment.confirmationUrl; }}>Открыть тестовую страницу ЮKassa</button>
        </div>
        : state.phase === 'pending' && state.payment?.confirmationUrl ? <div className="display-payment-qr">
        {qrDataUrl ? <img src={qrDataUrl} alt="QR-код для оплаты через СБП" /> : <div className="display-payment-qr-fallback" role="status">QR-код не удалось показать. Обратитесь к сотруднику точки.</div>}
        <div><strong>Оплатите через СБП</strong><ol><li>Откройте камеру смартфона или банковское приложение.</li><li>Отсканируйте QR-код и подтвердите оплату.</li><li>Дождитесь подтверждения на этом экране.</li></ol><small>Оплату проверим автоматически.</small></div>
      </div> : <div className="display-payment-placeholder" role="status"><span aria-hidden="true">⌛</span><strong>{state.phase === 'unknown' ? state.error : state.phase === 'creating' ? 'Подготавливаем оплату…' : 'Ожидаем подтверждение оплаты…'}</strong></div>}
      {state.phase === 'pending' && <div className="display-waiting" role="status"><span aria-hidden="true" />{state.error || 'Ожидаем оплату'}</div>}
      <p className="display-payment-note">{state.phase === 'unknown' ? 'Если деньги уже списаны, повторно платить не нужно. Проверьте этот же заказ.' : 'Приготовление начнётся после подтверждения оплаты.'}</p>
    </>}
    <div className="display-payment-actions">
      {state.phase === 'success' && state.payment.fulfillmentState === 'COMPLETED' && <button className="display-primary" type="button" onClick={onComplete}>Завершить</button>}
      {state.phase === 'unavailable' && <button className="display-primary" type="button" onClick={() => onSelectMethod?.(null)}>Выбрать способ оплаты</button>}
      {state.phase === 'unknown' && <button className="display-primary" type="button" onClick={() => setRetry((value) => value + 1)}>Проверить оплату</button>}
      {['choosing', 'error', 'unavailable'].includes(state.phase) && <button className="display-secondary" type="button" onClick={onBack}>Вернуться к заказу</button>}
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

function PaymentMethodIcon({ type }) {
  return <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
    {type === 'card' ? <><rect x="6" y="13" width="52" height="38" rx="7" /><path d="M6 25h52M15 41h13M42 37c4-4 4-8 0-12" /></> : <><rect x="8" y="8" width="17" height="17" rx="2" /><rect x="39" y="8" width="17" height="17" rx="2" /><rect x="8" y="39" width="17" height="17" rx="2" /><path d="M39 39h8v8h9M39 48v8M48 56h8M32 8v17M8 32h17M32 32h7M32 47v9" /></>}
  </svg>;
}

function PosPaymentGuide({ active }) {
  return <div className="display-payment-pos" aria-label="Оплата банковской картой через POS-терминал">
    <svg viewBox="0 0 440 300" role="img" aria-label="Банковская карта у бесконтактного считывателя POS-терминала">
      <rect x="105" y="32" width="168" height="235" rx="28" fill="#253d3a" />
      <rect x="122" y="51" width="134" height="83" rx="12" fill="#d6eee8" />
      <path d="M181 73q20 20 0 40m12-47q27 27 0 54m-25-34q7 7 0 14" fill="none" stroke="#008d7c" strokeWidth="5" strokeLinecap="round" />
      {[0,1,2].map(row => [0,1,2].map(col => <rect key={`${row}-${col}`} x={132+col*40} y={151+row*29} width="29" height="19" rx="5" fill="#718a85" />))}
      <rect x="213" y="238" width="30" height="12" rx="4" fill="#00ac88" />
      <g className={active ? 'display-pos-card is-active' : 'display-pos-card'}>
        <rect x="242" y="64" width="160" height="100" rx="15" fill="#f02361" />
        <rect x="262" y="91" width="28" height="24" rx="5" fill="#ffe6a4" />
        <path d="M306 92q14 14 0 28m12-35q21 21 0 42M263 142h64" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" />
      </g>
    </svg>
    <div><strong>{active ? 'Приложите банковскую карту' : 'Оплата через POS-терминал'}</strong>
      <p>{active ? 'Приложите карту или смартфон к терминалу на аппарате.' : 'Сумма заказа показана выше. Дождитесь готовности терминала к оплате.'}</p>
      <small>{active ? 'Дождитесь подтверждения оплаты на этом экране.' : 'Если терминал недоступен, выберите СБП или обратитесь к сотруднику.'}</small>
    </div>
  </div>;
}
