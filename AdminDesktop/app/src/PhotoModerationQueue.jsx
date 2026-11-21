import React, { useEffect, useMemo, useState } from 'react';
import { ErrorState, Skeleton, StatusBadge } from './components';
import {
  getPhotoOperationalIssues,
  getPhotoReviewPreview,
  getPhotoReviewQueue,
  retryPhotoOperationalIssue,
  submitPhotoReviewDecision,
} from './api/photoVerificationClient';

const ACTIONS = [
  ['approve', 'Одобрить'],
  ['review', 'На доп.проверку'],
  ['reject', 'Отклонить'],
];
const ISSUE_LABELS = {
  publication_pending: 'Публикация выключена',
  publication_incomplete: 'Не все каналы опубликованы',
  reward_pending: 'Награда ожидает',
  source_deletion_pending: 'Удаление исходника ожидает',
};

export function PhotoModerationQueuePage({
  loadQueue = getPhotoReviewQueue,
  loadOperations = getPhotoOperationalIssues,
  loadPreview = getPhotoReviewPreview,
  submitDecision = submitPhotoReviewDecision,
  retryOperation = retryPhotoOperationalIssue,
}) {
  const [state, setState] = useState({ status: 'loading', rows: [] });
  const [operations, setOperations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewStatus, setPreviewStatus] = useState('idle');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [retryingId, setRetryingId] = useState(null);
  const [notice, setNotice] = useState('');

  const refresh = async (signal) => {
    const [rows, operationalRows] = await Promise.all([loadQueue({ signal }), loadOperations({ signal })]);
    setState({ status: 'ready', rows });
    setOperations(operationalRows);
    setSelectedId((current) => rows.some((row) => row.photoChallengeId === current) ? current : (rows[0]?.photoChallengeId || null));
  };

  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal).catch((error) => {
      if (error.name !== 'AbortError') setState({ status: 'error', rows: [] });
    });
    return () => controller.abort();
  }, [loadQueue, loadOperations]);

  const selected = useMemo(() => state.rows.find((row) => row.photoChallengeId === selectedId) || null, [state.rows, selectedId]);

  useEffect(() => {
    if (!selectedId) { setPreviewUrl(''); return undefined; }
    const controller = new AbortController();
    let objectUrl = '';
    setPreviewStatus('loading');
    loadPreview(selectedId, { signal: controller.signal }).then((blob) => {
      objectUrl = URL.createObjectURL(blob);
      setPreviewUrl(objectUrl);
      setPreviewStatus('ready');
    }).catch((error) => { if (error.name !== 'AbortError') setPreviewStatus('error'); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [selectedId, loadPreview]);

  const act = async (action) => {
    if (!selected) return;
    if ((action === 'review' || action === 'reject') && reason.trim().length < 3) {
      setNotice('Укажите причину решения.');
      return;
    }
    setSaving(true); setNotice('');
    try {
      const result = await submitDecision(selected.photoChallengeId, { action, reason: reason.trim() || undefined });
      const message = result.stage === 'completed'
        ? 'Решение сохранено, публикация и награда завершены.'
        : result.stage === 'reward_pending'
          ? 'Решение сохранено. Публикация завершена, награда ожидает настройки.'
          : result.stage === 'publication_incomplete'
            ? 'Решение сохранено. Публикация завершена не во всех обязательных каналах.'
            : result.stage === 'already_decided' ? 'Это решение уже было сохранено.' : 'Решение сохранено.';
      setReason('');
      await refresh();
      setNotice(message);
    } catch (error) {
      setNotice(error.status === 409 ? 'Фото уже обрабатывается другим администратором или решение уже зафиксировано.' : (error.message || 'Не удалось сохранить решение.'));
    } finally { setSaving(false); }
  };

  const retry = async (photoChallengeId) => {
    setRetryingId(photoChallengeId); setNotice('');
    try {
      const result = await retryOperation(photoChallengeId);
      await refresh();
      setNotice(result.stage === 'completed' ? 'Восстановление завершено.' : 'Повтор выполнен. Заявка остаётся в контроле до завершения всех этапов.');
    } catch (error) {
      setNotice(error.message || 'Не удалось повторить операцию.');
    } finally { setRetryingId(null); }
  };

  if (state.status === 'loading') return <Skeleton />;
  if (state.status === 'error') return <ErrorState />;

  return <div className="dashboard">
    <section className="card">
      <div className="card-heading">
        <div><h2>Очередь ручной модерации</h2><p style={{ margin: '6px 0 0' }}>Фото, которым требуется решение администратора.</p></div>
        <StatusBadge status={state.rows.length ? 'PENDING' : 'CLEAR'} />
      </div>
      {notice && <p role="status">{notice}</p>}
      {!state.rows.length && <p>Очередь пуста.</p>}
      {!!state.rows.length && <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 0.8fr) minmax(320px, 1.4fr)', gap: 18 }}>
        <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
          {state.rows.map((row) => <button key={row.photoChallengeId} type="button"
            onClick={() => { setSelectedId(row.photoChallengeId); setReason(''); setNotice(''); }} className="card"
            style={{ textAlign: 'left', cursor: 'pointer', border: row.photoChallengeId === selectedId ? '2px solid currentColor' : undefined }}>
            <strong>{row.customerName || row.customerPhone || 'Покупатель'}</strong>
            <small style={{ display: 'block', marginTop: 4 }}>{new Date(row.createdAt).toLocaleString('ru-RU')}</small>
            <small style={{ display: 'block', marginTop: 4 }}>Причина: {row.reasonCode || 'ручная проверка'}</small>
          </button>)}
        </div>
        {selected && <article className="card" style={{ display: 'grid', gap: 16 }}>
          <div className="card-heading"><h2>Фотография</h2><StatusBadge status="PENDING" /></div>
          {previewStatus === 'loading' && <p>Загружаем превью…</p>}
          {previewStatus === 'error' && <p role="alert">Не удалось загрузить превью.</p>}
          {previewStatus === 'ready' && previewUrl && <img src={previewUrl} alt="Фотография на ручной модерации" style={{ width: '100%', maxHeight: 520, objectFit: 'contain', borderRadius: 16, background: '#f4f4f4' }} />}
          <div className="statistics">
            <div className="card"><strong>AI-решение</strong><p>{selected.decision || 'manual_review'}</p></div>
            <div className="card"><strong>Уверенность</strong><p>{selected.confidence == null ? '—' : `${Math.round(Number(selected.confidence) * 100)}%`}</p></div>
            <div className="card"><strong>Fraud score</strong><p>{selected.fraudScore == null ? '—' : Number(selected.fraudScore).toFixed(2)}</p></div>
          </div>
          <details><summary>Технические и AI-сигналы</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify({
            checks: selected.checks || {}, metadata: selected.metadataResult || {}, antifraud: selected.antifraudResult || {}, provider: selected.provider || null, model: selected.model || null,
          }, null, 2)}</pre></details>
          <label><strong>Причина / комментарий модератора</strong><textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4}
            placeholder="Обязательно для отклонения и дополнительной проверки" style={{ width: '100%', marginTop: 8, padding: 10 }} /></label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {ACTIONS.map(([value, label]) => <button key={value} className="text-button" type="button" disabled={saving} onClick={() => act(value)}>{label}</button>)}
          </div>
        </article>}
      </div>}
    </section>

    <section className="card">
      <div className="card-heading">
        <div><h2>Требует восстановления</h2><p style={{ margin: '6px 0 0' }}>Одобрено модератором, но публикация, награда или retention ещё не завершены.</p></div>
        <StatusBadge status={operations.length ? 'WARNING' : 'CLEAR'} />
      </div>
      {!operations.length && <p>Незавершённых операций нет.</p>}
      {!!operations.length && <div style={{ display: 'grid', gap: 10 }}>
        {operations.map((item) => <div key={item.photoChallengeId} className="card" style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div>
            <strong>{item.customerName || item.customerPhone || 'Покупатель'}</strong>
            <p style={{ margin: '4px 0' }}>{ISSUE_LABELS[item.issueType] || item.issueType}</p>
            {!!item.incompleteChannels?.length && <small>Каналы: {item.incompleteChannels.join(', ')}</small>}
          </div>
          <button type="button" className="text-button" disabled={retryingId === item.photoChallengeId} onClick={() => retry(item.photoChallengeId)}>
            {retryingId === item.photoChallengeId ? 'Повторяем…' : 'Повторить безопасно'}
          </button>
        </div>)}
      </div>}
    </section>
  </div>;
}
