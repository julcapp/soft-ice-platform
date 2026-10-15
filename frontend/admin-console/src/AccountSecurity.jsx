import { useBeforeNavigation } from './NavigationSave';
import { PasswordInput } from './PasswordInput';
import React, { useEffect, useState } from 'react';
import { useAdminAuth } from './AdminAuthGate';

async function api(path, payload) {
  const response = await fetch(`/api/v1/admin/auth/${path}`, payload ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : {});
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.message || 'Не удалось выполнить действие.');
  return body.data;
}

export function AccountSecurityPage() {
  const auth = useAdminAuth();
  const [profile, setProfile] = useState(null), [error, setError] = useState('');
  const [currentPassword, setCurrent] = useState(''), [newPassword, setNew] = useState(''), [repeat, setRepeat] = useState('');
  const [channel, setChannel] = useState(''), [challenge, setChallenge] = useState(null), [code, setCode] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { api('security-profile').then((data) => { setProfile(data); setChannel(data.channels.MAX?.verified ? 'MAX' : data.channels.EMAIL?.verified ? 'EMAIL' : ''); }).catch((e) => setError(e.message)); }, []);
  useBeforeNavigation(() => ({ block: busy || currentPassword || newPassword || repeat || code || challenge ? 'Завершите изменение пароля или проверку учётной записи перед переходом.' : '' }));
  async function submit(event) {
    event.preventDefault(); setError('');
    if (!challenge && (newPassword.length < 9 || newPassword.length > 128 || newPassword !== repeat)) { setError('Введите совпадающие пароли длиной от 9 до 128 символов.'); return; }
    setBusy(true);
    try {
      if (challenge) { await api('password-change/confirm', { challengeId: challenge.challengeId, code }); setCurrent(''); setNew(''); setRepeat(''); setCode(''); setChallenge(null); setError('Пароль изменён. Другие сессии завершены.'); }
      else { const next = await api('password-change/request', { currentPassword, newPassword, channel }); setChallenge(next); setCurrent(''); setNew(''); setRepeat(''); }
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <section className="card"><h2>Безопасность учётной записи</h2><p>{auth?.user?.login}</p><p>Новый пароль — от 9 до 128 символов. Подтверждение через привязанный MAX или электронную почту.</p>
    {profile && !channel && <p role="status">Нет подтверждённого канала для самостоятельной смены пароля. Обратитесь к администратору.</p>}
    <form onSubmit={submit} className="service-workspace">
      {!challenge ? <><label>Текущий пароль<PasswordInput autoComplete="current-password" required value={currentPassword} onChange={(e) => setCurrent(e.target.value)} /></label><label>Новый пароль<PasswordInput autoComplete="new-password" required minLength={9} maxLength={128} value={newPassword} onChange={(e) => setNew(e.target.value)} /></label><label>Повтор нового пароля<PasswordInput autoComplete="new-password" required minLength={9} maxLength={128} value={repeat} onChange={(e) => setRepeat(e.target.value)} /></label><label>Канал подтверждения<select required value={channel} onChange={(e) => setChannel(e.target.value)}><option value="">Выберите канал</option>{['MAX', 'EMAIL'].filter((item) => profile?.channels[item]?.verified).map((item) => <option key={item} value={item}>{item === 'MAX' ? 'MAX' : 'Электронная почта'}</option>)}</select></label></> : <label>Код подтверждения<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} /></label>}
      <button disabled={busy || !channel}>{busy ? 'Сохраняем…' : challenge ? 'Подтвердить смену пароля' : 'Получить код подтверждения'}</button>
      {error && <p role="status">{error}</p>}
    </form></section>;
}
