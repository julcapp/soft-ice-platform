import React, { useEffect, useMemo, useState } from 'react';
import { getNotifications, getProfileState, markNotificationRead, patchProfile, requestEmailVerification, saveMarketingEmailConsent } from './CustomerProfileApi.js';

export function ProfileCenter({ onBack }) {
  const [state, setState] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [birthday, setBirthday] = useState('');
  const [email, setEmail] = useState('');
  const [marketing, setMarketing] = useState(false);
  const [message, setMessage] = useState('');

  async function refresh() {
    const [profile, items] = await Promise.all([getProfileState(), getNotifications()]);
    setState(profile);
    setNotifications(items || []);
    setBirthday(profile.customer?.birthday ? String(profile.customer.birthday).slice(0, 10) : '');
    setEmail(profile.customer?.email || '');
    setMarketing(Boolean(profile.marketingConsent?.isGranted && !profile.marketingConsent?.revokedAt));
  }

  useEffect(() => { refresh().catch(() => setMessage('Не удалось загрузить личный кабинет.')); }, []);
  const unread = useMemo(() => notifications.filter((item) => !item.readAt).length, [notifications]);

  async function saveBirthday() {
    await patchProfile({ birthday });
    setMessage('Дата рождения сохранена.');
    await refresh();
  }

  async function saveEmail() {
    await patchProfile({ email });
    await requestEmailVerification(email);
    setMessage('Письмо подтверждения поставлено в очередь. Ссылка действует 24 часа.');
    await refresh();
  }

  async function saveConsent(next) {
    await saveMarketingEmailConsent(next, state.rules.version);
    setMarketing(next);
    setMessage(next ? 'Согласие на информационную и рекламную рассылку зафиксировано.' : 'Согласие на рассылку отозвано.');
    await refresh();
  }

  async function read(item) {
    if (!item.readAt) await markNotificationRead(item.id);
    await refresh();
  }

  if (!state) return <main className="app-shell"><button onClick={onBack}>← Назад</button><p>Загрузка профиля…</p>{message && <p>{message}</p>}</main>;
  const verificationStatus = state.emailVerification?.status || (state.customer?.email ? 'NOT_VERIFIED' : 'NOT_SET');

  return <main className="app-shell">
    <button type="button" onClick={onBack}>← Назад</button>
    <section className="hero-card">
      <p className="eyebrow">Личный кабинет</p>
      <h2>Мой профиль</h2>
      <p>Заполните профиль, чтобы получать персональные подарки, чеки и важные уведомления.</p>
    </section>

    <section className="hero-card">
      <h3>Дата рождения</h3>
      {!birthday && <p>Укажите дату рождения — в день рождения мы сможем подготовить для вас подарок.</p>}
      <input aria-label="Дата рождения" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
      <button type="button" disabled={!birthday} onClick={() => saveBirthday().catch(() => setMessage('Не удалось сохранить дату рождения.'))}>Сохранить дату</button>
    </section>

    <section className="hero-card">
      <h3>Электронная почта</h3>
      <p>Нужна для электронных чеков и значимых сервисных сообщений. Рекламная рассылка включается отдельно.</p>
      <input aria-label="Электронная почта" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.ru" />
      <button type="button" disabled={!email} onClick={() => saveEmail().catch(() => setMessage('Не удалось сохранить или отправить подтверждение.'))}>Сохранить и подтвердить</button>
      <p><strong>Статус:</strong> {verificationStatus === 'VERIFIED' ? 'подтверждена' : verificationStatus === 'PENDING' ? 'ожидает подтверждения' : 'не подтверждена'}</p>
    </section>

    <section className="hero-card">
      <h3>Информационная и рекламная рассылка</h3>
      <p>Перед согласием ознакомьтесь с <a href={state.rules.url} target="_blank" rel="noreferrer">правилами подписки</a>.</p>
      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <input type="checkbox" checked={marketing} onChange={(e) => saveConsent(e.target.checked).catch(() => setMessage('Не удалось сохранить согласие.'))} />
        <span>Согласен получать информационные и рекламные сообщения по электронной почте согласно правилам версии {state.rules.version}.</span>
      </label>
      {state.marketingConsent?.createdAt && <small>Последнее решение зафиксировано: {new Date(state.marketingConsent.createdAt).toLocaleString('ru-RU')}</small>}
    </section>

    <section className="hero-card">
      <h3>🔔 Уведомления {unread > 0 ? `(${unread})` : ''}</h3>
      {!notifications.length && <p>Новых сообщений нет.</p>}
      {notifications.map((item) => <button key={item.id} type="button" onClick={() => read(item)} style={{ width: '100%', textAlign: 'left', marginBottom: 10, opacity: item.readAt ? 0.65 : 1 }}>
        <strong>{item.readAt ? '' : '● '}{item.title}</strong><br />
        <span>{item.body}</span><br />
        <small>{new Date(item.createdAt).toLocaleString('ru-RU')}</small>
      </button>)}
    </section>

    {message && <p role="status">{message}</p>}
  </main>;
}
