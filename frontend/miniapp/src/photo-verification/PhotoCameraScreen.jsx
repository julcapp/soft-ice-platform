import React, { useEffect, useRef, useState } from 'react';
import { getActivePhotoChallenge, submitChallengePhoto } from './PhotoPublicationApi.js';
import './photoCamera.css';

const MAX_IMAGE_SIDE = 1600;
const JPEG_QUALITY = 0.85;

function stampCaptureCode(canvas, code) {
  if (!code) return;
  const context = canvas.getContext('2d');
  const fontSize = Math.max(24, Math.round(canvas.width * 0.035));
  const padding = Math.max(16, Math.round(fontSize * 0.65));
  context.font = `700 ${fontSize}px sans-serif`;
  const textWidth = context.measureText(code).width;
  const boxWidth = Math.min(canvas.width, textWidth + padding * 2);
  const boxHeight = fontSize + padding * 2;
  const x = Math.max(0, canvas.width - boxWidth - padding);
  const y = Math.max(0, canvas.height - boxHeight - padding);
  context.fillStyle = 'rgba(0, 0, 0, 0.72)';
  context.fillRect(x, y, boxWidth, boxHeight);
  context.fillStyle = '#ffffff';
  context.textBaseline = 'middle';
  context.fillText(code, x + padding, y + boxHeight / 2);
}

function canvasToJpeg(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Не удалось подготовить фотографию.')), 'image/jpeg', JPEG_QUALITY);
  });
}

async function prepareFallbackPhoto(file, captureCode) {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    stampCaptureCode(canvas, captureCode);
    return canvasToJpeg(canvas);
  } finally {
    bitmap.close?.();
  }
}

export function PhotoCameraScreen({ onBack, onSubmitted }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [state, setState] = useState({ status: 'loading' });
  const [previewUrl, setPreviewUrl] = useState(null);
  const [blob, setBlob] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    getActivePhotoChallenge({ signal: controller.signal })
      .then((challenge) => setState(challenge ? { status: 'ready', challenge } : { status: 'empty' }))
      .catch((error) => { if (error.name !== 'AbortError') setState({ status: 'error', error }); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (state.status !== 'ready' || previewUrl) return undefined;
    if (!navigator.mediaDevices?.getUserMedia) {
      setState((current) => ({ ...current, cameraUnavailable: true }));
      return undefined;
    }
    let cancelled = false;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then((stream) => {
        if (cancelled) return stream.getTracks().forEach((track) => track.stop());
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setState((current) => ({ ...current, cameraUnavailable: true })));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [state.status, previewUrl]);

  async function capture() {
    const video = videoRef.current;
    if (!video?.videoWidth || !video?.videoHeight || state.status !== 'ready') return;
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    stampCaptureCode(canvas, state.challenge.captureChallenge?.code);
    try {
      const nextBlob = await canvasToJpeg(canvas);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setBlob(nextBlob);
      setPreviewUrl(URL.createObjectURL(nextBlob));
    } catch (error) {
      setState((current) => ({ ...current, submitError: error.message }));
    }
  }

  function retake() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setBlob(null);
  }

  async function submit() {
    if (!blob || state.status !== 'ready') return;
    setState((current) => ({ ...current, submitting: true, submitError: null }));
    try {
      const result = await submitChallengePhoto(state.challenge.id, blob, {
        captureCode: state.challenge.captureChallenge?.code,
      });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      onSubmitted?.(result);
    } catch (error) {
      setState((current) => ({ ...current, submitting: false, submitError: error.message }));
    }
  }

  async function selectFallback(event) {
    const file = event.target.files?.[0];
    if (!file || state.status !== 'ready') return;
    try {
      const prepared = await prepareFallbackPhoto(file, state.challenge.captureChallenge?.code);
      setBlob(prepared);
      setPreviewUrl(URL.createObjectURL(prepared));
    } catch (error) {
      setState((current) => ({ ...current, submitError: error.message }));
    }
  }

  if (state.status === 'loading') return <main className="app-shell photo-camera-screen"><button className="button secondary" onClick={onBack}>Назад</button><p>Проверяем активное фотозадание…</p></main>;
  if (state.status === 'empty') return <main className="app-shell photo-camera-screen"><button className="button secondary" onClick={onBack}>Назад</button><section className="hero-card"><h2>Нет активного задания</h2><p>Когда появится фотозадание, здесь откроется камера для его выполнения.</p></section></main>;
  if (state.status === 'error') return <main className="app-shell photo-camera-screen"><button className="button secondary" onClick={onBack}>Назад</button><p role="alert">{state.error.message}</p></main>;

  const captureCode = state.challenge.captureChallenge?.code;
  return <main className="app-shell photo-camera-screen">
    <div className="photo-camera-header"><button className="button secondary" onClick={onBack}>Назад</button><div><p className="eyebrow">Фотозадание</p><strong>Сделайте фото сейчас</strong></div></div>
    <section className="hero-card photo-task-card">
      <p>Сфотографируйте выполнение задания. Одноразовый Код Тимоши автоматически добавится на снимок.</p>
      {captureCode && <div className="photo-capture-code"><span>Код Тимоши</span><strong>{captureCode}</strong></div>}
      {state.challenge.captureChallenge?.expiresAt && <small>Код действует до {new Date(state.challenge.captureChallenge.expiresAt).toLocaleTimeString('ru-RU')}</small>}
      {state.challenge.deadlineAt && <small>Задание действительно до {new Date(state.challenge.deadlineAt).toLocaleString('ru-RU')}</small>}
    </section>
    <section className="photo-camera-stage">
      {previewUrl ? <img src={previewUrl} alt="Предпросмотр сделанной фотографии" /> : <video ref={videoRef} autoPlay playsInline muted />}
    </section>
    {state.cameraUnavailable && !previewUrl && <div className="photo-camera-fallback"><p>Встроенная камера недоступна в этом WebView. Откройте системную камеру.</p><label className="button primary">Открыть камеру<input type="file" accept="image/*" capture="environment" hidden onChange={selectFallback} /></label></div>}
    {!state.cameraUnavailable && !previewUrl && <button className="button primary photo-shutter" onClick={capture}>Сфотографировать</button>}
    {previewUrl && <div className="photo-camera-actions"><button className="button secondary" disabled={state.submitting} onClick={retake}>Переснять</button><button className="button primary" disabled={state.submitting} onClick={submit}>{state.submitting ? 'Отправляем…' : 'Отправить на проверку'}</button></div>}
    {state.submitError && <p role="alert" className="photo-error">{state.submitError}</p>}
  </main>;
}
