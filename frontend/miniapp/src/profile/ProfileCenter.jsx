import React, { useEffect, useMemo, useState } from 'react';
import { disableAutoTopup, getAutoTopup, getNotifications, getProfileState, markNotificationRead, patchProfile, requestEmailVerification, saveMarketingEmailConsent, setupAutoTopup } from './CustomerProfileApi.js';

export function ProfileCenter({ onBack }) {
  const [state, setState] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [birthday, setBirthday] = useState('');
  const [email, setEmail] = useState('');
  const [marketing, setMarketing] = useState(false);
  const [autoTopup, setAutoTopup] = useState(null);
  const [autoTopupAmount, setAutoTopupAmount] = useState('');
  const [autoTopupDay, setAutoTopupDay] = useState('1');
  const [autoTopupBusy, setAutoTopupBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function refresh() {
    const [profile, items, recurring] = await Promise.all([getProfileState(), getNotifications(), getAutoTopup()]);
    setState(profile);
    setNotifications(items || []);
    setAutoTopup(recurring || null);
    setBirthday(profile.customer?.birthday ? String(profile.customer.birthday).slice(0, 10) : '');
    setEmail(profile.customer?.email || '');
    setMarketing(Boolean(profile.marketingConsent?.isGranted && !profile.marketingConsent?.revokedAt));
    if (recurring) {
      setAutoTopupAmount(String(recurring.amountRub || ''));
      setAutoTopupDay(String(recurring.billingDay || 1));
    }
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

  async function saveAutoTopup() {
    const amountRub = Number(autoTopupAmount);
    const billingDay = Number(autoTopupDay);
    if (!(amountRub > 0) || !Number.isInteger(billingDay) || billingDay < 1 || billingDay > 28) {
      setMessage('Укажите сумму больше 0 и день месяца от 1 до 28.');
      return;
    }
    setAutoTopupBusy(true);
    try {
      const result = await setupAutoTopup({ amountRub, billingDay, offerVersion: 'AUTO_TOPUP_OFFER_V1' });
      if (result.setupPayment?.confirmationUrl) {
        window.location.href = result.setupPayment.confirmationUrl;
        return;
      }
      setMessage('Настройки ежемесячного автопополнения сохранены.');
      await refresh();
    } finally {
      setAutoTopupBusy(false);
    }
  }

  async function stopAutoTopup() {
    setAutoTopupBusy(true);
    try {
      await disableAutoTopup();
      setMessage('Ежемесячное автопополнение отключено.');
      await refresh();
    } finally {
      setAutoTopupBusy(false);
    }
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
      <h3>Ежемесячное автопополнение</h3>
      <p>Раз в месяц выбранная сумма автоматически списывается сохранённым способом оплаты и после подтверждения ЮKassa зачисляется на ваш лицевой счёт.</p>
      <label>Сумма, ₽
        <input type="number" min="1" step="1" value={autoTopupAmount} onChange={(e) => setAutoTopupAmount(e.target.value)} placeholder="Например, 500" />
      </label>
      <label>День месяца
        <input type="number" min="1" max="28" step="1" value={autoTopupDay} onChange={(e) => setAutoTopupDay(e.target.value)} />
      </label>
      {autoTopup && <p><strong>Статус:</strong> {autoTopup.status} · <strong>Следующее пополнение:</strong> {autoTopup.nextChargeAt ? new Date(autoTopup.nextChargeAt).toLocaleString('ru-RU') : 'не назначено'} · <strong>Способ оплаты:</strong> {autoTopup.paymentMethodSaved ? 'сохранён' : 'ещё не сохранён'}</p>}
      <p><small>Подключая автопополнение, вы принимаете условия автоплатежей, указанные в оферте. Отдельное подтверждение каждого последующего платежа не требуется. Автопополнение можно отключить в любой момент.</small></p>
      <button type="button" disabled={autoTopupBusy || !(Number(autoTopupAmount) > 0)} onClick={() => saveAutoTopup().catch(() => setMessage('Не удалось настроить автопополнение.'))}>{autoTopupBusy ? 'Сохраняем…' : autoTopup?.status === 'ACTIVE' ? 'Сохранить настройки' : 'Подключить автопополнение'}</button>
      {autoTopup && autoTopup.status !== 'DISABLED' && <button type="button" disabled={autoTopupBusy} onClick={() => stopAutoTopup().catch(() => setMessage('Не удалось отключить автопополнение.'))}>Отключить автопополнение</button>}
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
