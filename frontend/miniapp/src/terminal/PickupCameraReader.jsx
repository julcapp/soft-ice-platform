import React, { useEffect, useRef, useState } from 'react';

export function PickupCameraReader({ onRead, disabled }) {
  const [availability, setAvailability] = useState('Проверяем камеру…'), [running, setRunning] = useState(false);
  const video = useRef(null), stream = useRef(null), timer = useRef(null), mounted = useRef(true), read = useRef(onRead), starting = useRef(false), blocked = useRef(disabled);
  read.current = onRead;
  blocked.current = disabled;
  const stop = () => { window.clearTimeout(timer.current); stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; if (video.current) video.current.srcObject = null; if (mounted.current) setRunning(false); };
  useEffect(() => {
    mounted.current = true;
    if (!navigator.mediaDevices?.enumerateDevices) setAvailability('Камера недоступна в этом браузере.');
    else navigator.mediaDevices.enumerateDevices().then(devices => { if (mounted.current) setAvailability(devices.some(device => device.kind === 'videoinput') ? 'Камера найдена.' : 'Камера не обнаружена.'); }).catch(() => { if (mounted.current) setAvailability('Не удалось проверить камеру.'); });
    return () => { mounted.current = false; stop(); };
  }, []);
  useEffect(() => { if (disabled) stop(); }, [disabled]);
  const start = async () => {
    if (running || disabled || starting.current) return;
    if (!navigator.mediaDevices?.getUserMedia) { setAvailability('Камера недоступна в этом браузере. Используйте сканер или введите код.'); return; }
    starting.current = true;
    try {
      let detector = null;
      try { const Decoder = window.SoftIceQrDetector || window.BarcodeDetector; if (Decoder) detector = new Decoder({ formats: ['qr_code'] }); } catch { /* Preview remains available without QR support. */ }
      const camera = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if (!mounted.current || blocked.current) { camera.getTracks().forEach(track => track.stop()); return; }
      stream.current = camera; setRunning(true); setAvailability(detector ? 'Наведите QR-код на камеру.' : 'Камера включена. Распознавание QR недоступно; введите код вручную.');
      const scan = async () => {
        if (!stream.current || !mounted.current) return;
        try {
          if (detector && video.current && video.current.readyState >= 2) {
            const results = await detector.detect(video.current);
            if (!stream.current || !mounted.current) return;
            const raw = results.find(result => result.rawValue)?.rawValue;
            if (raw && raw.length <= 4096) { stop(); setAvailability('QR-код прочитан. Нажмите «Получить по QR».'); read.current(raw); return; }
          }
        } catch { /* The next frame can be readable; no order is issued here. */ }
        timer.current = window.setTimeout(scan, 250);
      };
      timer.current = window.setTimeout(scan, 250);
    } catch (failure) { stop(); if (mounted.current) setAvailability(failure.name === 'NotAllowedError' ? 'Доступ к камере запрещён. Используйте сканер или введите код.' : 'Не удалось включить камеру. Используйте ручной ввод.'); }
    finally { starting.current = false; }
  };
  useEffect(() => { if (running && video.current && stream.current) { video.current.srcObject = stream.current; video.current.play().catch(() => {}); } }, [running]);
  return <div><p role="status" style={{fontSize:18}}>{availability}</p><button className="display-secondary" disabled={disabled} onClick={running ? stop : start}>{running ? 'Остановить камеру' : 'Сканировать QR камерой'}</button>{running && <video ref={video} autoPlay playsInline muted aria-label="Камера для QR-кода" style={{display:'block',width:'min(100%,440px)',maxHeight:240,margin:'16px auto',borderRadius:20}} />}</div>;
}
