import { useBeforeNavigation } from './NavigationSave';
import React, { useEffect, useState } from 'react';
import { ServiceDeviceRegister } from './ServiceDeviceRegister';
import { PasswordInput } from './PasswordInput';
import { normalizePersonName } from './personName';
import { OrganizationCreate } from './OrganizationCreate';
const labels = { SERVICE_SPECIALIST: 'Техник', MACHINE_RESPONSIBLE: 'Мастер' };
async function api(path = '', body, method = 'PUT') {
  const response = await fetch(`/api/v1/admin/service-access${path}`, body ? { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error?.message || 'Не удалось изменить доступ.');
  return result.data;
}
export function ServiceAccessPage() {
  const [data, setData] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [selection, setSelection] = useState({}), [creating, setCreating] = useState(null), [notice, setNotice] = useState(''), [organizationId, setOrganizationId] = useState('');
  const refresh = async () => setData(await api());
  useBeforeNavigation(() => ({ block: busy ? 'Дождитесь сохранения служебного доступа.' : creating || Object.entries(selection).some(([id, value]) => value !== (data?.users.find((user) => user.id === id)?.organizationMemberId || '')) ? 'Подтвердите сохранение сотрудника и его роли или отмените изменения.' : '' }));
  useEffect(() => { refresh().catch((e) => setError(e.message)); }, []);
  async function update(action) { setBusy(true); setError(''); try { await action(); await refresh(); } catch (e) { setError(e.message); } finally { setBusy(false); } }
  return <section className="service-workspace"><h1>Служебный доступ</h1><p>Свяжите логин с сотрудником организации и назначьте аппараты. Один сотрудник может совмещать роли техника и мастера: выберите его карточку для обоих логинов.</p><OrganizationCreate organizations={data?.organizations} onSelect={setOrganizationId} onSaved={async () => { await refresh(); setNotice('Организация сохранена.'); }} /><div><button disabled={busy || !data?.organizations.length} onClick={() => setCreating({ role: 'SERVICE_SPECIALIST', organizationId })}>+ Добавить техника</button><button disabled={busy || !data?.organizations.length} onClick={() => setCreating({ role: 'MACHINE_RESPONSIBLE', organizationId })}>+ Добавить мастера</button></div>{data && !data.organizations.length && <p>Сначала добавьте организацию.</p>}{notice && <p role="status">{notice}</p>}{creating && <StaffCreate key={creating.userId || creating.role} initial={creating} organizations={data.organizations} members={data.members} onCancel={() => setCreating(null)} onSaved={async () => { setCreating(null); await refresh(); setNotice('Сотрудник сохранён. Теперь можно назначить аппараты.'); }} />}<p>Карточки сотрудников и их роли: <a href="#organizations">Организации</a>.</p>{error && <p role="alert">{error}</p>}{!data && !error && <p>Загружаем сотрудников…</p>}
    {data && <ServiceDeviceRegister members={data.members} organizations={data.organizations} />}
    {data?.users.map((user) => {
      const role = user.roles[0], member = data.members.find((item) => item.id === user.organizationMemberId && item.roles.includes(role));
      const field = role === 'SERVICE_SPECIALIST' ? 'serviceSpecialistId' : 'responsibleMemberId';
      return <article className="card" key={user.id}><h2>{user.login} · {labels[role]}</h2>{!user.organizationMemberId && <button disabled={busy || !data.organizations.length} onClick={() => setCreating({ role, organizationId, userId: user.id, fullName: user.displayName })}>+ Добавить сотрудника для этого логина</button>}<label>Сотрудник<select value={selection[user.id] ?? user.organizationMemberId ?? ''} onChange={(e) => setSelection({ ...selection, [user.id]: e.target.value })}><option value="">Выберите сотрудника</option>{data.members.map((item) => <option key={item.id} value={item.id}>{item.fullName} · {data.organizations.find((org) => org.id === item.organizationId)?.shortName}</option>)}</select></label><button disabled={busy || !selection[user.id]} onClick={() => { if (window.confirm(`Связать логин «${user.login}» с выбранным сотрудником и назначить роль «${labels[role]}»?`)) update(() => api(`/users/${user.id}/member`, { memberId: selection[user.id], grantRole: true })); }}>Сохранить связь с сотрудником</button>
        {!member && <p>Пока сотрудник не связан с логином, доступ к аппаратам закрыт.</p>}
        {member && <><h3>Аппараты</h3>{data.assignments.filter((a) => a.organizationId === member.organizationId).map((a) => <label key={a.id}><span>{a.machineCode} · {a.name}</span><input type="checkbox" checked={a[field] === member.id} disabled={busy || (a[field] && a[field] !== member.id)} onChange={(e) => { const assigned = e.target.checked; update(() => api(`/users/${user.id}/machines/${a.id}`, { assigned })); }} />{a[field] && a[field] !== member.id && <small>Уже назначен другой сотрудник этой роли.</small>}</label>)}</>}
      </article>;
    })}
  </section>;
}

export function StaffCreate({ initial, organizations, members = [], onCancel, onSaved }) {
  const firstOrg = initial.organizationId || organizations[0]?.id || '';
  const [form, setForm] = useState({ organizationId: firstOrg, memberId: '', fullName: initial.fullName || '', login: '', password: '' });
  const [mode, setMode] = useState(members.some((m) => m.organizationId === firstOrg) ? 'existing' : 'new');
  const [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const available = members.filter((m) => m.organizationId === form.organizationId);
  const chosen = available.find((m) => m.id === form.memberId);
  const change = (key, value) => { setConfirmed(false); setForm({ ...form, [key]: value, ...(key === 'organizationId' ? { memberId: '' } : {}) }); };
  async function save() {
    setBusy(true); setError('');
    try {
      const payload = { organizationId: form.organizationId, role: initial.role, ...(mode === 'existing' ? { memberId: form.memberId } : { fullName: normalizePersonName(form.fullName) }), ...(initial.userId ? { userId: initial.userId } : { login: form.login, password: form.password }) };
      await api('/users', payload, 'POST'); await onSaved();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <form className="card" onSubmit={(e) => { e.preventDefault(); if (mode === 'new') setForm({ ...form, fullName: normalizePersonName(form.fullName) }); setConfirmed(true); }}>
    <h2>Добавить сотрудника · {labels[initial.role]}</h2>
    <label>Организация<select required disabled={busy} value={form.organizationId} onChange={(e) => change('organizationId', e.target.value)}>{organizations.map((org) => <option key={org.id} value={org.id}>{org.shortName}</option>)}</select></label>
    <label>Карточка сотрудника<select disabled={busy} value={mode} onChange={(e) => { setMode(e.target.value); setConfirmed(false); }}><option value="existing">Выбрать сотрудника из базы</option><option value="new">Добавить нового сотрудника</option></select></label>
    {mode === 'existing' ? <><label>Сотрудник<select required disabled={busy} value={form.memberId} onChange={(e) => change('memberId', e.target.value)}><option value="">Выберите сотрудника</option>{available.map((m) => <option key={m.id} value={m.id}>{m.fullName}{m.roles?.length ? ` · ${m.roles.map((role) => labels[role]).join(', ')}` : ''}</option>)}</select></label>{!available.length && <p>В этой организации пока нет сотрудников. Выберите «Добавить нового сотрудника».</p>}<p>Будет использована существующая карточка. При необходимости добавится роль «{labels[initial.role]}».</p></> : <><label>ФИО<input disabled={busy} required maxLength={200} spellCheck lang="ru" autoCapitalize="words" value={form.fullName} onChange={(e) => change('fullName', e.target.value)} onBlur={() => change('fullName', normalizePersonName(form.fullName))} /></label><p>Проверьте написание ФИО перед сохранением. Браузер может подсветить возможные опечатки.</p></>}
    {!initial.userId && <><label>Логин<input disabled={busy} required pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{2,63}" value={form.login} onChange={(e) => change('login', e.target.value)} autoComplete="off" /></label><label>Пароль (не менее 9 символов)<PasswordInput disabled={busy} required minLength={9} maxLength={128} value={form.password} onChange={(e) => change('password', e.target.value)} autoComplete="new-password" /></label></>}
    {initial.userId && <p>Будет использован существующий логин. Сохранённый пароль остаётся действующим.</p>}
    {error && <p role="alert">{error}</p>}
    {confirmed ? <><p>Сохранить сотрудника «{mode === 'existing' ? chosen?.fullName : form.fullName}» с ролью «{labels[initial.role]}»?</p><button type="button" disabled={busy} onClick={save}>Подтвердить и сохранить</button><button type="button" disabled={busy} onClick={() => setConfirmed(false)}>Вернуться к форме</button></> : <button type="submit" disabled={busy}>Сохранить</button>}
    <button type="button" disabled={busy} onClick={onCancel}>Отмена</button>
  </form>;
}
