import React, { useEffect, useRef, useState } from 'react';
import { CompletionCountdown } from './CompletionCountdown.jsx';
import { PickupPromotionCarousel } from './PickupPromotionCarousel.jsx';
import { redeemPrepaidOrder, getPrepaidPickupStatus } from './PrepaidPickupApi.js';
import { PickupCameraReader } from './PickupCameraReader.jsx';
import { isPickupQr } from './PickupQrDetector.js';
import './prepaid-pickup.css';

const FAILED = new Set(['FAILED', 'TIMED_OUT', 'REQUIRES_RECONCILIATION', 'CANCELLED']);
export function PrepaidPickupScreen({ machineId, onBack }) {
  const [code, setCode] = useState(''), [qr, setQr] = useState('');
  const [busy, setBusy] = useState(false), [attempt, setAttempt] = useState(null), [status, setStatus] = useState(null), [error, setError] = useState('');
  const [remaining, setRemaining] = useState(30), [uncertain, setUncertain] = useState(false);
  const locked = useRef(false), controller = useRef(null), mounted = useRef(true), scanner = useRef(null), back = useRef(onBack), idleDeadline = useRef(Date.now() + 30000);
  back.current = onBack;
  const activity = () => { idleDeadline.current = Date.now() + 30000; setRemaining(30); };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); }; }, []);
  useEffect(() => {
    if (busy || attempt) return undefined;
    idleDeadline.current = Date.now() + 30000; setRemaining(30);
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((idleDeadline.current - Date.now()) / 1000));
      setRemaining(seconds);
      if (!seconds) { window.clearInterval(timer); back.current(); }
    };
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [busy, attempt]);
  useEffect(() => {
    if (!attempt) return undefined;
    const abort = new AbortController(); let timer;
    const poll = async () => {
      try {
        const result = await getPrepaidPickupStatus(machineId, attempt, { signal: abort.signal });
        if (abort.signal.aborted) return;
        setStatus(result.status); setError('');
        if (result.status === 'DISPENSED' || FAILED.has(result.status)) return;
      } catch {
        if (abort.signal.aborted) return;
        setError('Связь прервалась. Проверяем выдачу; повторно вводить код и оплачивать заказ не нужно.');
      }
      timer = window.setTimeout(poll, 2000);
    };
    // A terminal initial response needs no additional polling.
    if (status !== 'DISPENSED' && !FAILED.has(status)) poll();
    return () => { abort.abort(); window.clearTimeout(timer); };
  }, [attempt, machineId]);
  const submit = async (method, value) => {
    if (locked.current || attempt || uncertain) return;
    const payload = String(value ?? (method === 'qr' ? qr : code)).trim();
    if (method === 'qr' ? !isPickupQr(payload) : !/^\d{6}$/.test(payload)) { setError(method === 'qr' ? 'Нужен QR-код получения заказа из Mini App.' : 'Введите 6 цифр кода получения.'); return; }
    locked.current = true; setBusy(true); setError('');
    const abort = new AbortController(); controller.current = abort;
    let timedOut = false;
    const timeout = window.setTimeout(() => { timedOut = true; abort.abort(); }, 15000);
    try {
      const result = await redeemPrepaidOrder(machineId, method === 'qr' ? { qrPayload: payload } : { code: payload }, { signal: abort.signal });
      if (!mounted.current || abort.signal.aborted) return;
      if (!result.dispense_attempt_id) throw new Error('Операция получения не подтверждена сервером.');
      setAttempt(result.dispense_attempt_id); setStatus(result.dispense_status); setCode(''); setQr('');
    } catch (failure) {
      if (!mounted.current) return;
      if (timedOut) { setUncertain(true); setError('Сервер не ответил вовремя. Результат запроса пока неизвестен. Проверьте выдачу на аппарате; повторно оплачивать заказ не нужно.'); }
      else if (failure.name !== 'AbortError') setError(failure.message);
    } finally {
      window.clearTimeout(timeout); locked.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const terminal = status === 'DISPENSED' || FAILED.has(status);
  if (attempt) return <section className={`display-prepaid pickup-screen pickup-result${status === 'DISPENSED' ? ' pickup-result-success' : ''}`} aria-live="polite">
    <p className="display-kicker">Оплаченный заказ</p>
    <h1>{status === 'DISPENSED' ? 'Ваше мороженое готово!' : FAILED.has(status) ? 'Нужна помощь с получением' : ['ACCEPTED', 'DISPENSING'].includes(status) ? 'Готовим ваше мороженое' : 'Передаём заказ аппарату'}</h1>
    <p>{status === 'DISPENSED' ? 'Заберите заказ из окна выдачи. Приятного аппетита!' : FAILED.has(status) ? 'Не удалось подтвердить выдачу. Обратитесь в поддержку. Повторная оплата не требуется.' : 'Оплата подтверждена. Дождитесь завершения приготовления.'}</p>
    {status === 'DISPENSED' && <PickupPromotionCarousel />}
    {error && <p role="status">{error}</p>}
    {terminal && <div className="pickup-result-actions"><CompletionCountdown onComplete={() => back.current()} /><button className="display-primary" onClick={() => back.current()}>Завершить</button></div>}
  </section>;
  const disabled = busy || uncertain;
  return <section className="display-prepaid pickup-screen" aria-labelledby="pickup-title" onPointerDownCapture={activity} onKeyDownCapture={activity}>
    <div className="pickup-screen-heading"><p className="display-kicker">Оплаченный заказ</p><h1 id="pickup-title">Получите своё мороженое</h1><p>Покажите QR-код заказа или введите 6 цифр из Mini App.</p></div>
    <div className="pickup-layout">
      <div className="pickup-camera-panel"><h2>Сканировать QR-код</h2><PickupCameraReader disabled={disabled} onRead={value => { setQr(value); submit('qr', value); }} />
        <details className="pickup-scanner"><summary>Использовать отдельный QR-сканер</summary><label htmlFor="pickup-scanner-input">Данные со сканера</label><input id="pickup-scanner-input" ref={scanner} value={qr} maxLength={80} disabled={disabled} autoComplete="off" onChange={event => setQr(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); submit('qr'); } }} /><button className="display-secondary" disabled={disabled || !isPickupQr(qr)} onClick={() => submit('qr')}>Получить по QR</button></details>
      </div>
      <div className="pickup-manual-panel"><h2>Ввести код вручную</h2><label className="pickup-input-label" htmlFor="pickup-code">Код получения · 6 цифр</label><input id="pickup-code" className="pickup-code-input" aria-label="Код получения" inputMode="numeric" autoComplete="off" maxLength={6} value={code} disabled={disabled} placeholder="• • • • • •" onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} onKeyDown={event => { if (event.key === 'Enter') submit('code'); }} />
        <div className="pickup-keys">{['1','2','3','4','5','6','7','8','9'].map(key => <button key={key} type="button" disabled={disabled || code.length === 6} onClick={() => setCode(value => (value + key).slice(0, 6))}>{key}</button>)}<button type="button" disabled={disabled || !code} aria-label="Очистить код" onClick={() => setCode('')}>Сброс</button><button type="button" disabled={disabled || code.length === 6} onClick={() => setCode(value => (value + '0').slice(0, 6))}>0</button><button type="button" disabled={disabled || !code} aria-label="Удалить цифру" onClick={() => setCode(value => value.slice(0, -1))}>⌫</button></div>
        <button className="display-primary pickup-submit" disabled={disabled || code.length !== 6} onClick={() => submit('code')}>{busy ? 'Проверяем заказ…' : 'Получить заказ'}</button>
      </div>
    </div>
    {error && <p className="pickup-error" role="alert">{error}</p>}
    <footer className="pickup-footer"><button className="display-secondary pickup-back" disabled={busy} onClick={() => back.current()}>← Назад</button><p className="pickup-idle-countdown" role="timer" aria-label="До возврата на предыдущий экран">{busy ? 'Проверяем заказ…' : `Возврат через ${remaining} с`}</p><p>Повторная оплата не требуется</p></footer>
  </section>;
}
