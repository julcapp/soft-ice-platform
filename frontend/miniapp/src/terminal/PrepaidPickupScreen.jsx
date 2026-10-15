import React, { useEffect, useRef, useState } from 'react';
import { redeemPrepaidOrder, getPrepaidPickupStatus } from './PrepaidPickupApi.js';
import { PickupCameraReader } from './PickupCameraReader.jsx';

const FAILED = new Set(['FAILED', 'TIMED_OUT', 'REQUIRES_RECONCILIATION', 'CANCELLED']);
export function PrepaidPickupScreen({ machineId, onBack }) {
  const [code, setCode] = useState(''), [qr, setQr] = useState(''), [mode, setMode] = useState('code');
  const [busy, setBusy] = useState(false), [attempt, setAttempt] = useState(null), [status, setStatus] = useState(null), [error, setError] = useState('');
  const locked = useRef(false), scanner = useRef(null), controller = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { if (mode === 'qr') scanner.current?.focus(); }, [mode]);
  useEffect(() => {
    if (busy || (attempt && status !== 'DISPENSED' && !FAILED.has(status))) return undefined;
    const timer = window.setTimeout(onBack, 30000);
    return () => window.clearTimeout(timer);
  }, [busy, attempt, status, code, qr, mode, onBack]);
  useEffect(() => {
    if (!attempt || status === 'DISPENSED' || FAILED.has(status)) return undefined;
    const abort = new AbortController(); let timer;
    const poll = async () => {
      try {
        const result = await getPrepaidPickupStatus(machineId, attempt, { signal: abort.signal });
        if (abort.signal.aborted) return;
        setStatus(result.status); setError('');
        if (result.status === 'DISPENSED' || FAILED.has(result.status)) return;
      } catch (failure) { if (abort.signal.aborted) return; setError('Связь прервалась. Продолжаем проверять выдачу; повторно вводить код не нужно.'); }
      timer = window.setTimeout(poll, 2000);
    };
    poll();
    return () => { abort.abort(); window.clearTimeout(timer); };
  }, [attempt, machineId, status]);
  const submit = async (chosenMode = mode) => {
    if (locked.current || attempt || (chosenMode === 'code' ? code.length !== 6 : !qr.trim())) return;
    locked.current = true; setBusy(true); setError('');
    controller.current = new AbortController();
    try {
      const result = await redeemPrepaidOrder(machineId, chosenMode === 'qr' ? { qrPayload: qr.trim() } : { code }, { signal: controller.current.signal });
      if (controller.current.signal.aborted) return;
      if (!result.dispense_attempt_id) throw new Error('Операция получения не подтверждена сервером.');
      setAttempt(result.dispense_attempt_id); setStatus(result.dispense_status); setCode(''); setQr('');
    } catch (failure) { if (failure.name !== 'AbortError') setError(failure.message); }
    finally { locked.current = false; setBusy(false); }
  };
  if (attempt) return <section className="display-prepaid" aria-live="polite"><p className="display-kicker">Оплаченный заказ</p><h1>{status === 'DISPENSED' ? 'Ваше мороженое готово!' : FAILED.has(status) ? 'Нужна помощь с получением' : ['ACCEPTED','DISPENSING'].includes(status) ? 'Готовим ваше мороженое' : 'Передаём заказ аппарату'}</h1><p>{status === 'DISPENSED' ? 'Заберите заказ. Спасибо за покупку!' : FAILED.has(status) ? 'Не удалось подтвердить выдачу. Повторная оплата не требуется. Обратитесь в поддержку.' : 'Оплата подтверждена. Дождитесь завершения приготовления.'}</p>{error && <p role="status">{error}</p>}{(status === 'DISPENSED' || FAILED.has(status)) && <button className="display-primary" onClick={onBack}>Завершить</button>}</section>;
  return <section className="display-prepaid pickup-screen" aria-labelledby="pickup-title"><div className="pickup-screen-heading"><p className="display-kicker">Оплаченный заказ</p><h1 id="pickup-title">Получите своё мороженое</h1><p>Откройте заказ в Mini App и нажмите «Я у аппарата — получить код».</p></div>
    <div className="pickup-layout">
    <div className="pickup-manual-panel"><h2>Введите 6 цифр</h2><input aria-label="Код получения" inputMode="numeric" autoComplete="off" maxLength={6} value={code} disabled={busy} onChange={event => { setMode('code'); setCode(event.target.value.replace(/\D/g,'').slice(0,6)); }} onKeyDown={event => { if (event.key === 'Enter') submit('code'); }} style={{width:'100%',fontSize:'clamp(32px,4vw,52px)',letterSpacing:'.2em',textAlign:'center',padding:16,border:'2px solid #eadfd7',borderRadius:22}} /><div className="display-keys pickup-keys">{['1','2','3','4','5','6','7','8','9','0'].map(key => <button key={key} disabled={busy || code.length === 6} onClick={() => { setMode('code'); setCode(value => (value+key).slice(0,6)); }}>{key}</button>)}<button disabled={busy} aria-label="Удалить цифру" onClick={() => setCode(value => value.slice(0,-1))}>⌫</button></div><button className="display-primary" disabled={busy || code.length !== 6} onClick={() => submit('code')}>Получить по коду</button></div>
    <div className="pickup-camera-panel"><h2>Или покажите QR-код</h2><PickupCameraReader disabled={busy || Boolean(attempt)} onRead={value => { setQr(value); setMode('qr'); }} /><p style={{fontSize:18}}>Сканер: {qr ? 'QR-код получен' : 'ожидаем ввод от устройства'}</p><input ref={scanner} aria-label="Данные QR-кода со сканера" value={qr} maxLength={4096} disabled={busy} onChange={event => { setMode('qr'); setQr(event.target.value); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); submit('qr'); } }} placeholder="Данные от QR-сканера" style={{width:'100%',fontSize:18,border:'2px solid #eadfd7',borderRadius:18,padding:16}} /><button className="display-secondary" disabled={busy} onClick={() => { setMode('qr'); scanner.current?.focus(); }}>Включить приём от сканера</button><button className="display-primary" disabled={busy || !qr.trim()} onClick={() => submit('qr')}>Получить по QR</button></div>
    </div>
    {error && <p role="alert">{error}</p>}<div className="display-phone-actions pickup-footer-actions"><button className="display-secondary" disabled={busy} onClick={onBack}>Назад</button><span role="status">{busy ? 'Проверяем заказ…' : 'Повторная оплата не требуется.'}</span></div></section>;
}
