import React, { useEffect, useRef, useState } from 'react';
import { getPickupStatus, redeemPickupCode } from './PrepaidPickupApi.js';

const digits = (value) => String(value || '').replace(/\D/g, '').slice(0, 6);
const FINAL_ERROR = new Set(['FAILED','CANCELED','TIMED_OUT','RECONCILIATION_REQUIRED']);

export function PrepaidPickupScreen({ machineId, onBack, onDone }) {
  const [code, setCode] = useState('');
  const [state, setState] = useState({ status: 'input', attemptId: null, error: null });
  const controller = useRef(null);

  useEffect(() => () => controller.current?.abort(), []);

  useEffect(() => {
    if (!state.attemptId || !['transmitting','preparing'].includes(state.status)) return undefined;
    const timer = window.setTimeout(async () => {
      controller.current?.abort();
      const next = new AbortController();
      controller.current = next;
      try {
        const result = await getPickupStatus({ machineId, dispenseAttemptId: state.attemptId, signal: next.signal });
        if (result.status === 'DISPENSED') return setState({ status: 'done', attemptId: state.attemptId, error: null });
        if (FINAL_ERROR.has(result.status)) return setState({ status: 'error', attemptId: state.attemptId, error: pickupError(result.failureCode) });
        if (['ACCEPTED','DISPENSING'].includes(result.status)) return setState({ status: 'preparing', attemptId: state.attemptId, error: null });
        setState({ status: 'transmitting', attemptId: state.attemptId, error: null });
      } catch (error) {
        if (error?.name !== 'AbortError') setState({ status: 'error', attemptId: state.attemptId, error: 'Не удалось проверить состояние выдачи. Заказ не будет запущен повторно.' });
      }
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [state.status, state.attemptId, machineId]);

  const redeem = async () => {
    if (code.length !== 6 || state.status === 'checking') return;
    setState({ status: 'checking', attemptId: null, error: null });
    controller.current?.abort();
    const next = new AbortController(); controller.current = next;
    try {
      const result = await redeemPickupCode({ machineId, code, signal: next.signal });
      setCode('');
      setState({ status: 'transmitting', attemptId: result.dispenseAttemptId, error: null });
    } catch (error) {
      if (error?.name !== 'AbortError') setState({ status: 'input', attemptId: null, error: pickupError(error?.code) });
    }
  };

  if (state.status === 'transmitting') return <section className="display-prepaid"><div className="display-spinner" /><p className="display-kicker">Оплаченный заказ</p><h1>Передаём заказ аппарату</h1><p>Оплата подтверждена. Повторно оплачивать ничего не нужно.</p></section>;
  if (state.status === 'preparing') return <section className="display-prepaid"><div className="display-spinner" /><p className="display-kicker">Оплаченный заказ</p><h1>Ваше мороженое готовится</h1><p>Пожалуйста, дождитесь завершения приготовления.</p></section>;
  if (state.status === 'done') return <section className="display-prepaid"><div className="display-prepaid-icon">✓</div><p className="display-kicker">Готово</p><h1>Заберите мороженое</h1><p>Спасибо за покупку у Тимоши!</p><button className="display-primary" type="button" onClick={onDone}>Завершить</button></section>;
  if (state.status === 'error') return <section className="display-prepaid"><div className="display-prepaid-icon">!</div><p className="display-kicker">Нужна проверка</p><h1>Не удалось завершить выдачу</h1><p>{state.error}</p><button className="display-primary" type="button" onClick={onDone}>Завершить</button></section>;

  const keys = ['1','2','3','4','5','6','7','8','9','0'];
  return <section className="display-prepaid">
    <div className="display-prepaid-icon" aria-hidden="true">⌁</div>
    <p className="display-kicker">Оплаченный заказ</p>
    <h1>Введите код получения</h1>
    <p>Код из 6 цифр показан в Mini App после подтверждённой оплаты.</p>
    <output className="pickup-code-output" aria-label="Код получения">{code.padEnd(6, '•').split('').join(' ')}</output>
    <div className="display-keys pickup-keys">{keys.map((key) => <button key={key} type="button" onClick={() => setCode(digits(code + key))}>{key}</button>)}<button type="button" aria-label="Удалить цифру" onClick={() => setCode(code.slice(0,-1))}>⌫</button></div>
    {state.error ? <p className="display-boundary-note" role="alert">{state.error}</p> : null}
    <div className="display-phone-actions"><button className="display-secondary" type="button" onClick={onBack}>Назад</button><button className="display-primary" type="button" disabled={code.length !== 6 || state.status === 'checking'} onClick={redeem}>{state.status === 'checking' ? 'Проверяем…' : 'Получить заказ'}</button></div>
  </section>;
}

function pickupError(code) {
  const map = {
    PICKUP_CODE_INVALID: 'Введите все 6 цифр кода.',
    PICKUP_CODE_NOT_FOUND: 'Код не найден, истёк или уже использован.',
    PICKUP_CODE_ALREADY_USED: 'Этот код уже использован или был перевыпущен.',
    PICKUP_ORDER_EXPIRED: 'Срок получения заказа истёк.',
    PICKUP_RATE_LIMITED: 'Слишком много попыток. Повторите через минуту.',
    PICKUP_RESERVATION_EXPIRED: 'Резерв заказа недоступен. Обратитесь в поддержку — повторная оплата не требуется.',
  };
  return map[code] || 'Получение сейчас недоступно. Повторная оплата не требуется.';
}
