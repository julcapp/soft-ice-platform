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
};

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { Accept: 'application/json', ...(options.headers || {}) } });
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || 'Не удалось получить данные.');
  return body.data;
}

function when(value) {
  return value ? new Date(value).toLocaleString('ru-RU') : '—';
}

function deviceLabel(value) {
  if (!value) return 'Не определён';
  if (/Edg/i.test(value)) return 'Microsoft Edge';
  if (/Chrome/i.test(value)) return 'Chrome';
  if (/Firefox/i.test(value)) return 'Firefox';
  if (/Safari/i.test(value)) return 'Safari';
  return value.slice(0, 42);
}

export function AccountSecurityPage() {
  const auth = useAdminAuth();
  const user = auth?.user || {};
  const roles = user.roles || [];
  const [sessions, setSessions] = useState([]);
  const [audit, setAudit] = useState([]);
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', repeatPassword: '', channel: 'MAX' });
  const [passwordMessage, setPasswordMessage] = useState('');

  async function load() {
    setStatus('loading');
    try {
      const [sessionRows, auditRows] = await Promise.all([
        api('/api/v1/admin/auth/sessions'),
        api('/api/v1/admin/auth/audit'),
      ]);
      setSessions(sessionRows || []);
      setAudit(auditRows || []);
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
    } catch (error) {
      setMessage(error.message);
    }
  }

  function updatePasswordField(key, value) {
    setPasswordForm((current) => ({ ...current, [key]: value }));
    setPasswordMessage('');
  }

  function beginPasswordConfirmation(event) {
    event.preventDefault();
    const { currentPassword, newPassword, repeatPassword, channel } = passwordForm;
    if (!currentPassword) return setPasswordMessage('Введите текущий пароль.');
    if (newPassword.length < 6 || newPassword.length > 12) return setPasswordMessage('Новый пароль должен содержать от 6 до 12 символов.');
    if (newPassword !== repeatPassword) return setPasswordMessage('Повтор нового пароля не совпадает.');
    setPasswordMessage(`Данные проверены. Следующий шаг — отправка одноразового кода через ${channel === 'MAX' ? 'MAX' : 'электронную почту'}. Канал подтверждения должен быть предварительно привязан и подтверждён.`);
  }

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
    <section className="card">
      <div className="card-heading">
        <div>
          <h2>Личный кабинет владельца</h2>
          <p style={{ margin: '6px 0 0' }}>Учётная запись, безопасность, подтверждения и административные сессии.</p>
        </div>
        <StatusBadge status={user.status || 'ACTIVE'} />
      </div>
      {message && <p>{message}</p>}
    </section>

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
        <button className="text-button" type="button" onClick={() => { setPasswordOpen((value) => !value); setPasswordMessage(''); }}>{passwordOpen ? 'Отменить смену пароля' : 'Сменить пароль'}</button>
        {passwordOpen && <form onSubmit={beginPasswordConfirmation} style={{ display: 'grid', gap: 12, marginTop: 16, maxWidth: 520 }}>
          <label>Текущий пароль<input type="password" autoComplete="current-password" value={passwordForm.currentPassword} onChange={(event) => updatePasswordField('currentPassword', event.target.value)} required /></label>
          <label>Новый пароль<input type="password" minLength={6} maxLength={12} autoComplete="new-password" value={passwordForm.newPassword} onChange={(event) => updatePasswordField('newPassword', event.target.value)} required /></label>
          <label>Повторите новый пароль<input type="password" minLength={6} maxLength={12} autoComplete="new-password" value={passwordForm.repeatPassword} onChange={(event) => updatePasswordField('repeatPassword', event.target.value)} required /></label>
          <label>Канал подтверждения<select value={passwordForm.channel} onChange={(event) => updatePasswordField('channel', event.target.value)}><option value="MAX">MAX</option><option value="EMAIL">Электронная почта</option></select></label>
          <button type="submit" className="text-button">Продолжить и получить код</button>
          {passwordMessage && <p role="status" style={{ margin: 0 }}>{passwordMessage}</p>}
        </form>}
      </section>

      <section className="card">
        <div className="card-heading"><h2>Каналы подтверждения</h2></div>
        <p>MAX — основной канал безопасности.</p>
        <p>Электронная почта — резервный канал.</p>
        <p style={{ marginBottom: 0 }}>До подтверждения канала пароль не изменяется. Это защищает учётную запись даже при открытой административной сессии.</p>
      </section>
    </section>

    {status === 'error' ? <section className="card"><p>Не удалось загрузить сведения безопасности.</p></section> : <>
      <section className="card">
        <div className="card-heading"><div><h2>Активные административные сессии</h2><p style={{ margin: '6px 0 0' }}>IP, браузер, начало и последняя активность фиксируются сервером.</p></div><button type="button" className="text-button" onClick={revokeOthers}>Завершить все другие сессии</button></div>
      </section>
      <DataTable title="Сессии" rows={sessions.map((row) => ({ ...row, id: row.id }))} columns={sessionColumns} />
      <DataTable title="Журнал входов и действий" rows={audit.map((row) => ({ ...row, id: row.id }))} columns={auditColumns} emptyTitle="Записей аудита пока нет" />
    </>}

    <section className="card">
      <div className="card-heading"><h2>Выход</h2></div>
      <p>Выход завершит текущую административную сессию и запишет событие в журнал аудита.</p>
      <button type="button" className="text-button" onClick={() => auth?.logout?.()}>Выйти из личного кабинета</button>
    </section>
  </div>;
}
