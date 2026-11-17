import React, { useEffect, useRef, useState } from 'react';
import { PickupQrDetector, isPickupQr } from './PickupQrDetector.js';

export function PickupCameraReader({ onRead, disabled = false }) {
  const [availability, setAvailability] = useState('Нажмите кнопку и разрешите доступ к камере.');
  const [running, setRunning] = useState(false), [starting, setStarting] = useState(false);
  const video = useRef(null), stream = useRef(null), timer = useRef(null), mounted = useRef(false), generation = useRef(0);
  const read = useRef(onRead), blocked = useRef(disabled), pending = useRef(false);
  read.current = onRead; blocked.current = disabled;
  const stop = () => {
    generation.current++; pending.current = false; window.clearTimeout(timer.current);
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
    if (video.current) video.current.srcObject = null;
    if (mounted.current) { setRunning(false); setStarting(false); }
  };
  useEffect(() => {
    mounted.current = true;
    if (!navigator.mediaDevices?.getUserMedia) setAvailability('Камера недоступна. Откройте экран по HTTPS или введите код вручную.');
    return () => { mounted.current = false; stop(); };
  }, []);
  useEffect(() => { if (disabled) stop(); }, [disabled]);
  const start = async () => {
    if (pending.current || stream.current || blocked.current) return;
    if (!navigator.mediaDevices?.getUserMedia) { setAvailability('Этот браузер не предоставляет доступ к камере. Введите код вручную.'); return; }
    pending.current = true; const lease = ++generation.current;
    setStarting(true); setAvailability('Ожидаем разрешение на камеру…');
    try {
      const camera = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      if (!mounted.current || blocked.current || lease !== generation.current) { camera.getTracks().forEach(track => track.stop()); return; }
      stream.current = camera; video.current.srcObject = camera;
      await video.current.play();
      if (!mounted.current || blocked.current || lease !== generation.current) return;
      setRunning(true); setAvailability('Покажите QR-код заказа с экрана телефона.');
      const detector = new PickupQrDetector();
      const scan = async () => {
        if (!mounted.current || !stream.current || lease !== generation.current) return;
        try {
          const results = await detector.detect(video.current);
          if (!mounted.current || !stream.current || lease !== generation.current) return;
          const raw = results.find(result => isPickupQr(result.rawValue))?.rawValue?.trim();
          if (raw) { stop(); setAvailability('QR-код прочитан. Проверяем заказ…'); read.current(raw); return; }
          if (results.length) setAvailability('Это не QR-код получения. Откройте код оплаченного заказа в Mini App.');
        } catch { /* Try a later video frame; never issue an order from a decode failure. */ }
        if (lease === generation.current) timer.current = window.setTimeout(scan, 250);
      };
      timer.current = window.setTimeout(scan, 250);
    } catch (failure) {
      if (!mounted.current || lease !== generation.current) return;
      stop();
      setAvailability(failure.name === 'NotAllowedError' ? 'Разрешите камеру в настройках браузера или введите код вручную.' : failure.name === 'NotFoundError' ? 'Камера не найдена. Подключите её или введите код вручную.' : failure.name === 'NotReadableError' ? 'Камера занята другим приложением. Закройте его и повторите.' : 'Не удалось запустить камеру. Повторите или введите код вручную.');
    } finally { if (lease === generation.current) { pending.current = false; setStarting(false); } }
  };
  return <div className="pickup-camera-reader">
    <div className="pickup-camera-frame">
      <video ref={video} autoPlay playsInline muted aria-label="Камера для QR-кода" className={running ? 'is-running' : ''} />
      {!running && <div className="pickup-camera-placeholder"><span aria-hidden="true">▣</span><strong>Я тут</strong><span>Покажите QR-код с телефона</span></div>}
      {running && <div className="pickup-camera-guide" aria-hidden="true" />}
      <button className="pickup-camera-toggle" type="button" disabled={disabled || starting} onClick={running ? () => { stop(); setAvailability('Камера выключена. Можно включить снова или ввести код.'); } : start}>{starting ? 'Подключаем камеру…' : running ? 'Выключить камеру' : 'Сканировать QR-код'}</button>
    </div>
    <p className="pickup-camera-status" role="status">{availability}</p>
  </div>;
}
