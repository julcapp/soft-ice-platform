import React, { useEffect, useRef, useState } from 'react';
import { getPickupStatus, redeemPickupCode } from './PrepaidPickupApi.js';

const digits = (value) => String(value || '').replace(/\D/g, '').slice(0, 6);
const FINAL_ERROR = new Set(['FAILED','CANCELED','TIMED_OUT','RECONCILIATION_REQUIRED']);

export function PrepaidPickupScreen({ machineId, onBack, onDone }) {
  const [code, setCode] = useState('');
  const [state, setState] = useState({ status: 'input', attemptId: null, error: null });
  const [camera, setCamera] = useState({ status: 'idle', error: null });
  const controller = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanTimerRef = useRef(null);
  const detectorRef = useRef(null);

  const stopCamera = () => {
    if (scanTimerRef.current) {
      window.clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    detectorRef.current = null;
    setCamera((current) => current.status === 'idle' ? current : { status: 'idle', error: null });
  };

  useEffect(() => () => {
    controller.current?.abort();
    if (scanTimerRef.current) window.clearTimeout(scanTimerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

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

  const submitPickup = async ({ codeValue = null, qrPayload = null } = {}) => {
    if (state.status === 'checking' || !machineId) return;
    if (!qrPayload && String(codeValue || '').length !== 6) return;
    stopCamera();
    setState({ status: 'checking', attemptId: null, error: null });
    controller.current?.abort();
    const next = new AbortController(); controller.current = next;
    try {
      const result = await redeemPickupCode({ machineId, code: codeValue, qrPayload, signal: next.signal });
      setCode('');
      setState({ status: 'transmitting', attemptId: result.dispenseAttemptId, error: null });
    } catch (error) {
      if (error?.name !== 'AbortError') setState({ status: 'input', attemptId: null, error: pickupError(error?.code) });
    }
  };

  const redeem = () => submitPickup({ codeValue: code });

  const scanFrame = async () => {
    if (!detectorRef.current || !videoRef.current || !streamRef.current) return;
    try {
      if (videoRef.current.readyState >= 2) {
        const found = await detectorRef.current.detect(videoRef.current);
        const qr = found.find((item) => String(item.rawValue || '').startsWith('UTP1:'));
        if (qr?.rawValue) {
          await submitPickup({ qrPayload: qr.rawValue });
          return;
        }
      }
    } catch {
      // Keep scanning. Some Android WebViews throw transient detector errors while the camera warms up.
    }
    scanTimerRef.current = window.setTimeout(scanFrame, 250);
  };

  const startCamera = async () => {
    if (camera.status === 'starting' || camera.status === 'active') return;
    setCamera({ status: 'starting', error: null });
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('CAMERA_UNAVAILABLE');
      if (!('BarcodeDetector' in window)) throw new Error('QR_DETECTOR_UNAVAILABLE');
      const formats = await window.BarcodeDetector.getSupportedFormats?.();
      if (Array.isArray(formats) && !formats.includes('qr_code')) throw new Error('QR_DETECTOR_UNAVAILABLE');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamera({ status: 'active', error: null });
      scanTimerRef.current = window.setTimeout(scanFrame, 250);
    } catch (error) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      const message = error?.name === 'NotAllowedError'
        ? 'Доступ к камере запрещён. Разрешите камеру для display.utimoshi.ru или введите код вручную.'
        : error?.message === 'QR_DETECTOR_UNAVAILABLE'
          ? 'Этот браузер пока не умеет распознавать QR с камеры. Введите 6-значный код вручную.'
          : 'Камеру не удалось включить. Введите 6-значный код вручную.';
      setCamera({ status: 'error', error: message });
    }
  };

  useEffect(() => {
    const onQrEvent = (event) => submitPickup({ qrPayload: event?.detail?.payload || event?.detail || null });
    window.softIcePickupQrScan = (payload) => submitPickup({ qrPayload: payload });
    window.addEventListener('softice:pickup-qr', onQrEvent);
    return () => {
      window.removeEventListener('softice:pickup-qr', onQrEvent);
      if (window.softIcePickupQrScan) delete window.softIcePickupQrScan;
    };
  }, [machineId, state.status]);

  if (state.status === 'transmitting') return <section className="display-prepaid"><div className="display-spinner" /><p className="display-kicker">Оплаченный заказ</p><h1>Передаём заказ аппарату</h1><p>Оплата подтверждена. Повторно оплачивать ничего не нужно.</p></section>;
  if (state.status === 'preparing') return <section className="display-prepaid"><div className="display-spinner" /><p className="display-kicker">Оплаченный заказ</p><h1>Ваше мороженое готовится</h1><p>Пожалуйста, дождитесь завершения приготовления.</p></section>;
  if (state.status === 'done') return <section className="display-prepaid"><div className="display-prepaid-icon">✓</div><p className="display-kicker">Готово</p><h1>Заберите мороженое</h1><p>Спасибо за покупку у Тимоши!</p><button className="display-primary" type="button" onClick={onDone}>Завершить</button></section>;
  if (state.status === 'error') return <section className="display-prepaid"><div className="display-prepaid-icon">!</div><p className="display-kicker">Нужна проверка</p><h1>Не удалось завершить выдачу</h1><p>{state.error}</p><button className="display-primary" type="button" onClick={onDone}>Завершить</button></section>;

  const keys = ['1','2','3','4','5','6','7','8','9','0'];
  return <section className="display-prepaid pickup-screen">
    <div className="pickup-screen-heading">
      <p className="display-kicker">Оплаченный заказ</p>
      <h1>Получите своё мороженое</h1>
      <p>Покажите QR-код из Mini App камере или введите 6-значный код вручную.</p>
    </div>

    <div className="pickup-layout">
      <div className="pickup-manual-panel">
        <h2>Введите 6 цифр</h2>
        <output className="pickup-code-output" aria-label="Код получения">{code.padEnd(6, '•').split('').join(' ')}</output>
        <div className="display-keys pickup-keys">{keys.map((key) => <button key={key} type="button" onClick={() => setCode(digits(code + key))}>{key}</button>)}<button type="button" aria-label="Удалить цифру" onClick={() => setCode(code.slice(0,-1))}>⌫</button></div>
        {state.error ? <p className="display-boundary-note" role="alert">{state.error}</p> : null}
        <button className="display-primary pickup-code-submit" type="button" disabled={code.length !== 6 || state.status === 'checking'} onClick={redeem}>
          {state.status === 'checking' ? 'Проверяем…' : 'Получить по коду'}
        </button>
      </div>

      <div className="pickup-camera-panel">
        <h2>Покажите QR-код</h2>
        <div className={`pickup-camera-shell ${camera.status === 'active' ? 'is-active' : ''}`}>
          <video ref={videoRef} className="pickup-camera-video" muted playsInline aria-label="Камера для QR-кода" />
          {camera.status !== 'active' ? <div className="pickup-camera-placeholder"><span>QR</span><p>Нажмите «Я тут», чтобы включить камеру</p></div> : null}
          {camera.status === 'active' ? <div className="pickup-camera-frame" aria-hidden="true" /> : null}
          {camera.status === 'active' ? <p className="pickup-camera-hint">Держите QR внутри рамки — камера считает его сама</p> : null}
        </div>
        <p className="pickup-camera-status">
          {camera.status === 'active' ? 'Камера включена · ищем QR-код автоматически' : camera.status === 'starting' ? 'Включаем камеру…' : camera.status === 'error' ? 'Камера недоступна' : 'Камера готова к запуску'}
        </p>
        <button className="display-primary pickup-camera-start" type="button" onClick={camera.status === 'active' ? stopCamera : startCamera} disabled={camera.status === 'starting'}>
          {camera.status === 'starting' ? 'Включаем камеру…' : camera.status === 'active' ? 'Выключить камеру' : 'Я тут — включить камеру'}
        </button>
        {camera.error ? <p className="display-boundary-note" role="alert">{camera.error}</p> : null}
      </div>
    </div>

    <div className="display-phone-actions pickup-footer-actions">
      <button className="display-secondary" type="button" onClick={() => { stopCamera(); onBack(); }}>Назад</button>
    </div>
  </section>;
}

function pickupError(code) {
  const map = {
    PICKUP_CODE_INVALID: 'Введите все 6 цифр кода.',
    PICKUP_QR_INVALID: 'QR-код заказа недействителен.',
    PICKUP_CODE_NOT_FOUND: 'Код не найден, истёк или уже использован.',
    PICKUP_CODE_ALREADY_USED: 'Этот код уже использован или был перевыпущен.',
    PICKUP_ORDER_EXPIRED: 'Срок получения заказа истёк.',
    PICKUP_RATE_LIMITED: 'Слишком много попыток. Повторите через минуту.',
    PICKUP_RESERVATION_EXPIRED: 'Резерв заказа недоступен. Обратитесь в поддержку — повторная оплата не требуется.',
    PICKUP_INVENTORY_UNAVAILABLE: 'Сейчас не хватает ингредиентов для оплаченного заказа. Повторная оплата не требуется.',
  };
  return map[code] || 'Получение сейчас недоступно. Повторная оплата не требуется.';
}
