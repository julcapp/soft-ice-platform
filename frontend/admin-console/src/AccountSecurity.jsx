import React, { useEffect, useState } from 'react';
import { useAdminAuth } from './AdminAuthGate';
import { DataTable, StatusBadge } from './components';

const roleLabels = {
  PLATFORM_OWNER: 'Владелец платформы',
  ADMIN: 'Администратор',
  MANAGER: 'Менеджер',
  OPERATOR: 'Оператор',
};

const eventLabels = {
  'Admin.LoginSucceeded': 'Успешный вход',
  'Admin.LoginFailed': 'Неудачная попытка входа',
  'Admin.SessionRevoked': 'Завершение сессии',
  'Admin.OtherSessionsRevoked': 'Завершение других сессий',
  'Admin.PasswordChangeCodeSent': 'Код смены пароля отправлен',
  'Admin.PasswordChangeCodeRejected': 'Неверный код смены пароля',
  'Admin.PasswordChangeCodeDeliveryFailed': 'Ошибка отправки кода',
  'Admin.PasswordChangeRejected': 'Смена пароля отклонена',
  'Admin.PasswordChanged': 'Пароль изменён',
  'Admin.MaxSecurityLinked': 'MAX подключён к безопасности',
};

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { Accept: 'application/json', ...(options.headers || {}) } });
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || 'Не удалось выполнить операцию.');
  return body.data;
}

function when(value) { return value ? new Date(value).toLocaleString('ru-RU') : '—'; }
function deviceLabel(value) {
  if (!value) return 'Не определён';
  if (/Edg/i.test(value)) return 'Microsoft Edge';
  if (/Chrome/i.test(value)) return 'Chrome';
  if (/Firefox/i.test(value)) return 'Firefox';
  if (/Safari/i.test(value)) return 'Safari';
  return value.slice(0, 42);
}
function maxIdentity(candidate) {
  const name = [candidate.firstName, candidate.lastName].filter(Boolean).join(' ').trim();
  const username = candidate.username ? `@${candidate.username}` : '';
  return [name, username].filter(Boolean).join(' · ') || `MAX ID ${candidate.maxUserId}`;
}

export function AccountSecurityPage() {
  const auth = useAdminAuth();
  const user = auth?.user || {};
  const roles = user.roles || [];
  const [sessions, setSessions] = useState([]);
  const [audit, setAudit] = useState([]);
  const [securityProfile, setSecurityProfile] = useState({ channels: {} });
  const [maxCandidates, setMaxCandidates] = useState([]);
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const [maxLinkBusy, setMaxLinkBusy] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', repeatPassword: '', channel: 'MAX' });
  const [passwordMessage, setPasswordMessage] = useState('');
  const [challenge, setChallenge] = useState(null);
  const [otpCode, setOtpCode] = useState('');

  async function load() {
    setStatus('loading');
    try {
      const [sessionRows, auditRows, profile, candidates] = await Promise.all([
        api('/api/v1/admin/auth/sessions'),
        api('/api/v1/admin/auth/audit'),
        api('/api/v1/admin/auth/security-profile'),
        api('/api/v1/admin/max-security/candidates'),
      ]);
      setSessions(sessionRows || []);
      setAudit(auditRows || []);
      setSecurityProfile(profile || { channels: {} });
      setMaxCandidates(candidates || []);
      setStatus('ready');
    } catch (error) {
      setMessage(error.message);
      setStatus('error');
    }
  }

  useEffect(() => { load(); }, []);

  async function revokeOthers() {
    setMessage('');
    try {
      await api('/api/v1/admin/auth/sessions/revoke-others', { method: 'POST' });
      setMessage('Все другие административные сессии завершены.');
      await load();
    } catch (error) { setMessage(error.message); }
  }

  async function confirmMaxCandidate(candidate) {
    const identity = maxIdentity(candidate);
    if (!window.confirm(`Подтвердить привязку MAX к учётной записи владельца?\n\n${identity}`)) return;
    setMaxLinkBusy(true);
    setMessage('');
    try {
      await api('/api/v1/admin/max-security/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: candidate.id }),
      });
      setMessage(`MAX успешно подключён: ${identity}.`);
      await load();
    } catch (error) { setMessage(error.message); }
    finally { setMaxLinkBusy(false); }
  }

  function updatePasswordField(key, value) {
    setPasswordForm((current) => ({ ...current, [key]: value }));
    setPasswordMessage('');
  }

  async function requestPasswordCode(event) {
    event.preventDefault();
    const { currentPassword, newPassword, repeatPassword, channel } = passwordForm;
    if (!currentPassword) return setPasswordMessage('Введите текущий пароль.');
    if (newPassword.length < 6 || newPassword.length > 12) return setPasswordMessage('Новый пароль должен содержать от 6 до 12 символов.');
    if (newPassword !== repeatPassword) return setPasswordMessage('Повтор нового пароля не совпадает.');
    setPasswordBusy(true);
    setPasswordMessage('');
    try {
      const data = await api('/api/v1/admin/auth/password-change/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, channel }),
      });
      setChallenge(data);
      setOtpCode('');
      setPasswordMessage(`Код отправлен через ${data.channel === 'MAX' ? 'MAX' : 'электронную почту'}: ${data.destination}. Код действует до ${when(data.expiresAt)}.`);
    } catch (error) { setPasswordMessage(error.message); }
    finally { setPasswordBusy(false); }
  }

  async function confirmPasswordCode(event) {
    event.preventDefault();
    if (!/^\d{6}$/.test(otpCode)) return setPasswordMessage('Введите шестизначный код подтверждения.');
    setPasswordBusy(true);
    try {
      await api('/api/v1/admin/auth/password-change/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId: challenge.challengeId, code: otpCode }),
      });
      setPasswordMessage('Пароль изменён. Все другие административные сессии завершены.');
      setChallenge(null);
      setOtpCode('');
      setPasswordForm({ currentPassword: '', newPassword: '', repeatPassword: '', channel: 'MAX' });
      await load();
    } catch (error) { setPasswordMessage(error.message); }
    finally { setPasswordBusy(false); }
  }

  const channels = securityProfile.channels || {};
  const maxChannel = channels.MAX || {};
  const emailChannel = channels.EMAIL || {};

  const sessionColumns = [
    { key: 'current', label: 'Сессия', render: (value) => value ? <StatusBadge status="ACTIVE" /> : 'Другая' },
    { key: 'ipAddress', label: 'IP-адрес' },
    { key: 'userAgent', label: 'Браузер', render: deviceLabel },
    { key: 'createdAt', label: 'Создана', render: when },
    { key: 'lastSeenAt', label: 'Последняя активность', render: when },
    { key: 'expiresAt', label: 'Истекает', render: when },
    { key: 'revokedAt', label: 'Состояние', render: (value, row) => value ? 'Завершена' : new Date(row.expiresAt) < new Date() ? 'Истекла' : 'Активна' },
  ];
  const auditColumns = [
    { key: 'occurredAt', label: 'Дата и время', render: when },
    { key: 'eventType', label: 'Событие', render: (value) => eventLabels[value] || value },
    { key: 'action', label: 'Действие' },
    { key: 'decision', label: 'Результат', render: (value) => value === 'success' ? 'Успешно' : value === 'deny' ? 'Отклонено' : value },
    { key: 'reasonCode', label: 'Причина' },
  ];

  return <div className="dashboard">
    <section className="card"><div className="card-heading"><div><h2>Личный кабинет владельца</h2><p style={{ margin: '6px 0 0' }}>Учётная запись, безопасность, подтверждения и административные сессии.</p></div><StatusBadge status={user.status || 'ACTIVE'} /></div>{message && <p>{message}</p>}</section>

    <section className="statistics" aria-label="Сведения об учётной записи">
      <article className="card statistic-card"><p>Имя</p><strong>{user.display_name || user.displayName || '—'}</strong></article>
      <article className="card statistic-card"><p>Логин</p><strong>{user.login || '—'}</strong></article>
      <article className="card statistic-card"><p>Роль</p><strong>{roles.map((role) => roleLabels[role] || role).join(', ') || '—'}</strong></article>
      <article className="card statistic-card"><p>Состояние сессии</p><strong>Активна</strong><small>Вход выполнен через защищённую административную сессию</small></article>
    </section>

    <section className="tables" style={{ alignItems: 'start' }}>
      <section className="card">
        <div className="card-heading"><h2>Безопасность</h2></div>
        <p>Пароль: от 6 до 12 символов. Смена пароля подтверждается одноразовым кодом через MAX или электронную почту.</p>
        <p><strong>После подтверждённой смены пароля:</strong> остальные административные сессии будут завершены.</p>
        <button className="text-button" type="button" onClick={() => { setPasswordOpen((value) => !value); setPasswordMessage(''); setChallenge(null); }}>{passwordOpen ? 'Отменить смену пароля' : 'Сменить пароль'}</button>
        {passwordOpen && !challenge && <form onSubmit={requestPasswordCode} style={{ display: 'grid', gap: 12, marginTop: 16, maxWidth: 520 }}>
          <label>Текущий пароль<input type="password" autoComplete="current-password" value={passwordForm.currentPassword} onChange={(event) => updatePasswordField('currentPassword', event.target.value)} required /></label>
          <label>Новый пароль<input type="password" minLength={6} maxLength={12} autoComplete="new-password" value={passwordForm.newPassword} onChange={(event) => updatePasswordField('newPassword', event.target.value)} required /></label>
          <label>Повторите новый пароль<input type="password" minLength={6} maxLength={12} autoComplete="new-password" value={passwordForm.repeatPassword} onChange={(event) => updatePasswordField('repeatPassword', event.target.value)} required /></label>
          <label>Канал подтверждения<select value={passwordForm.channel} onChange={(event) => updatePasswordField('channel', event.target.value)}><option value="MAX" disabled={!maxChannel.verified}>MAX{maxChannel.verified ? ` — ${maxChannel.destination}` : ' — не настроен'}</option><option value="EMAIL" disabled={!emailChannel.verified}>Электронная почта{emailChannel.verified ? ` — ${emailChannel.destination}` : ' — не настроена'}</option></select></label>
          <button type="submit" className="text-button" disabled={passwordBusy || !(maxChannel.verified || emailChannel.verified)}>{passwordBusy ? 'Отправляем…' : 'Получить код'}</button>
        </form>}
        {passwordOpen && challenge && <form onSubmit={confirmPasswordCode} style={{ display: 'grid', gap: 12, marginTop: 16, maxWidth: 420 }}>
          <label>Код подтверждения<input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={otpCode} onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))} autoFocus required /></label>
          <button type="submit" className="text-button" disabled={passwordBusy}>{passwordBusy ? 'Проверяем…' : 'Подтвердить смену пароля'}</button>
          <button type="button" className="text-button" onClick={() => { setChallenge(null); setOtpCode(''); setPasswordMessage(''); }}>Запросить новый код</button>
        </form>}
        {passwordMessage && <p role="status" style={{ marginTop: 12 }}>{passwordMessage}</p>}
      </section>

      <section className="card">
        <div className="card-heading"><h2>Каналы подтверждения</h2></div>
        <p><strong>MAX:</strong> {maxChannel.verified ? `подтверждён (${maxChannel.destination})` : 'не настроен или не подтверждён'}.</p>
        {!maxChannel.verified && <>
          <p>Откройте бота «Soft_ICE Безопасность» в MAX и нажмите «Начать». После получения события ваш профиль появится ниже.</p>
          {maxCandidates.length === 0 ? <p><small>Ожидаем запуск бота из вашего аккаунта MAX.</small></p> : maxCandidates.map((candidate) => <div key={candidate.id} style={{ borderTop: '1px solid var(--border-color, #ddd)', paddingTop: 10, marginTop: 10 }}>
            <p style={{ margin: '0 0 8px' }}><strong>{maxIdentity(candidate)}</strong><br /><small>Запуск: {when(candidate.startedAt || candidate.createdAt)}</small></p>
            <button type="button" className="text-button" disabled={maxLinkBusy} onClick={() => confirmMaxCandidate(candidate)}>{maxLinkBusy ? 'Подтверждаем…' : 'Это мой аккаунт MAX — подключить'}</button>
          </div>)}
        </>}
        <p><strong>Электронная почта:</strong> {emailChannel.verified ? `подтверждена (${emailChannel.destination})` : 'не настроена или не подтверждена'}.</p>
        <p style={{ marginBottom: 0 }}>До подтверждения канала пароль не изменяется. Код действует 10 минут, доступно не более 5 попыток.</p>
      </section>
    </section>

    {status === 'error' ? <section className="card"><p>Не удалось загрузить сведения безопасности.</p></section> : <>
      <section className="card"><div className="card-heading"><div><h2>Активные административные сессии</h2><p style={{ margin: '6px 0 0' }}>IP, браузер, начало и последняя активность фиксируются сервером.</p></div><button type="button" className="text-button" onClick={revokeOthers}>Завершить все другие сессии</button></div></section>
      <DataTable title="Сессии" rows={sessions.map((row) => ({ ...row, id: row.id }))} columns={sessionColumns} />
      <DataTable title="Журнал входов и действий" rows={audit.map((row) => ({ ...row, id: row.id }))} columns={auditColumns} emptyTitle="Записей аудита пока нет" />
    </>}
  </div>;
}
