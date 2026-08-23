import React, { useEffect, useState } from 'react';
import { recordReferralAction } from './CustomerProfileApi.js';

const authHeaders = () => ({ Authorization: `Bearer ${sessionStorage.getItem('access_token') || ''}` });
async function loadLink() {
  const response = await fetch('/api/v1/customers/me/referral-link', { headers: authHeaders() });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.message || 'Не удалось получить реферальную ссылку.');
  return body.data;
}

export function ReferralCenter({ onBack }) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('');
  useEffect(() => { loadLink().then(setData).catch(() => setStatus('Не удалось получить ссылку.')); }, []);

  async function copy() {
    await navigator.clipboard.writeText(data.referralLink);
    await recordReferralAction('COPY', 'CLIPBOARD');
    setStatus('Ссылка скопирована.');
  }

  async function systemShare() {
    if (navigator.share) {
      await navigator.share({ title: 'Клуб Тимоши', text: 'Присоединяйся к Клубу Тимоши!', url: data.referralLink });
      await recordReferralAction('SHARE', 'SYSTEM_SHARE');
      setStatus('Спасибо! Отправка зафиксирована.');
    } else await copy();
  }

  async function send(destination, baseUrl) {
    await recordReferralAction('SEND', destination);
    window.open(`${baseUrl}${encodeURIComponent(data.referralLink)}`, '_blank', 'noopener,noreferrer');
  }

  return <main className="app-shell">
    <button type="button" onClick={onBack}>← Назад</button>
    <section className="hero-card">
      <p className="eyebrow">Клуб Тимоши</p>
      <h2>Пригласить друга</h2>
      <p>Поделитесь своей персональной ссылкой. Мы отдельно считаем факт отправки, регистрацию друга и его первую покупку.</p>
      {data ? <><input readOnly value={data.referralLink} aria-label="Реферальная ссылка" style={{ width: '100%' }} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <button type="button" onClick={() => copy().catch(() => setStatus('Не удалось скопировать ссылку.'))}>Скопировать</button>
          <button type="button" onClick={() => systemShare().catch(() => setStatus('Отправка отменена или недоступна.'))}>Поделиться</button>
          <button type="button" onClick={() => send('TELEGRAM', 'https://t.me/share/url?url=').catch(() => setStatus('Не удалось открыть Telegram.'))}>Telegram</button>
          <button type="button" onClick={() => send('VK', 'https://vk.com/share.php?url=').catch(() => setStatus('Не удалось открыть VK.'))}>VK</button>
        </div></> : <p>Подготавливаем ссылку…</p>}
      {status && <p role="status">{status}</p>}
    </section>
  </main>;
}
