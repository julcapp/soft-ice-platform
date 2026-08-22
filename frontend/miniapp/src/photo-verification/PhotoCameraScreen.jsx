import React, { useEffect, useRef, useState } from 'react';
import { getActivePhotoChallenge, submitChallengePhoto } from './PhotoPublicationApi.js';
import './photoCamera.css';

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

  function capture() {
    const video = videoRef.current;
    if (!video?.videoWidth || !video?.videoHeight) return;
    const canvas = document.createElement('canvas');
    const maxWidth = 1600;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((nextBlob) => {
      if (!nextBlob) return;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setBlob(nextBlob);
      setPreviewUrl(URL.createObjectURL(nextBlob));
    }, 'image/jpeg', 0.9);
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
      const result = await submitChallengePhoto(state.challenge.id, blob);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      onSubmitted?.(result);
    } catch (error) {
      setState((current) => ({ ...current, submitting: false, submitError: error.message }));
    }
  }

  function selectFallback(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBlob(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  if (state.status === 'loading') return <main className="app-shell photo-camera-screen"><button className="button secondary" onClick={onBack}>Назад</button><p>Проверяем активное фотозадание…</p></main>;
  if (state.status === 'empty') return <main className="app-shell photo-camera-screen"><button className="button secondary" onClick={onBack}>Назад</button><section className="hero-card"><h2>Нет активного задания</h2><p>Когда появится фотозадание, здесь откроется камера для его выполнения.</p></section></main>;
  if (state.status === 'error') return <main className="app-shell photo-camera-screen"><button className="button secondary" onClick={onBack}>Назад</button><p role="alert">{state.error.message}</p></main>;

  return <main className="app-shell photo-camera-screen">
    <div className="photo-camera-header"><button className="button secondary" onClick={onBack}>Назад</button><div><p className="eyebrow">Фотозадание</p><strong>Сделайте фото сейчас</strong></div></div>
    <section className="hero-card photo-task-card">
      <p>Сфотографируйте выполнение задания. Для бонусных заданий используется режим только камеры.</p>
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
