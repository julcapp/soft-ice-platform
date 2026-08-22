import React, { useEffect, useState } from 'react';
import { getMyPhotoPublications } from './PhotoPublicationApi.js';

const LABELS = {
  confirmed: 'Опубликовано',
  pending: 'Ожидает публикации',
  publishing: 'Публикуется',
  failed: 'Ошибка публикации',
  not_configured: 'Канал ещё не настроен',
};

function ChannelStatus({ name, publication }) {
  const status = publication?.status || 'pending';
  return <div className="action-card" style={{ cursor: 'default', gridTemplateColumns: '48px 1fr' }}>
    <span className="action-icon">{name === 'VK' ? 'VK' : name === 'TELEGRAM' ? '✈' : 'M'}</span>
    <span className="action-content">
      <strong className="action-title">{name === 'TELEGRAM' ? 'Telegram' : name}</strong>
      <span className="action-description">{LABELS[status] || status}</span>
      {publication?.publishedAt && <span className="action-description">{new Date(publication.publishedAt).toLocaleString('ru-RU')}</span>}
      {publication?.publicationUrl && <a href={publication.publicationUrl} target="_blank" rel="noreferrer">Посмотреть публикацию</a>}
    </span>
  </div>;
}

export function PhotoPublicationHistory({ client = getMyPhotoPublications, onBack, onCamera }) {
  const [state, setState] = useState({ status: 'loading', rows: [] });

  useEffect(() => {
    const controller = new AbortController();
    client({ signal: controller.signal })
      .then((rows) => setState({ status: 'ready', rows }))
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ status: 'error', rows: [] });
      });
    return () => controller.abort();
  }, [client]);

  return <main className="app-shell">
    <section className="hero-card">
      <p className="eyebrow">Личный кабинет</p>
      <h2>Мои фотографии</h2>
      <p>Здесь сохраняется история модерации и публикаций даже после удаления исходного файла.</p>
      <div className="photo-camera-actions">
        {onBack && <button className="button secondary" type="button" onClick={onBack}>← Назад</button>}
        {onCamera && <button className="button primary" type="button" onClick={onCamera}>Сделать фото</button>}
      </div>
    </section>

    {state.status === 'loading' && <section className="hero-card"><p>Загружаем историю…</p></section>}
    {state.status === 'error' && <section className="hero-card"><p>Не удалось загрузить историю фотографий.</p></section>}
    {state.status === 'ready' && !state.rows.length && <section className="hero-card"><p>У вас пока нет фотографий на модерации или публикации.</p></section>}

    {state.rows.map((row) => <section className="hero-card" key={row.photoChallengeId}>
      <p className="eyebrow">{new Date(row.createdAt).toLocaleDateString('ru-RU')}</p>
      <h2 style={{ fontSize: 22 }}>Фото</h2>
      <p>Модерация: <strong>{row.moderationStatus || 'на проверке'}</strong></p>
      <div className="card-grid">
        <ChannelStatus name="VK" publication={row.publications?.VK} />
        <ChannelStatus name="TELEGRAM" publication={row.publications?.TELEGRAM} />
        <ChannelStatus name="MAX" publication={row.publications?.MAX} />
      </div>
      <p style={{ marginTop: 16 }}><strong>{row.allRequiredPublished ? 'Опубликовано во всех обязательных каналах ✓' : 'Публикация ещё не завершена'}</strong></p>
      {row.sourceFileDeleted && <p>Исходный файл удалён из хранения после подтверждённой публикации.</p>}
    </section>)}
  </main>;
}
