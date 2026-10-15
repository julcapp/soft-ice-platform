import React, { useEffect, useState } from 'react';
import { useAdminAuth } from './AdminAuthGate';
import { MainMenuButton, useBeforeNavigation, useNavigation } from './NavigationSave';
import { AccountSecurityPage } from './AccountSecurity';

async function request(path, options = {}) {
  const response = await fetch(`/api/v1/service-workspace${path}`, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.message || 'Не удалось выполнить действие.');
  return body.data;
}

function Photo({ photo }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let active = true, objectUrl;
    fetch(`/api/v1/service-workspace/photos/${photo.id}`).then(async (response) => {
      if (!response.ok) return;
      objectUrl = URL.createObjectURL(await response.blob());
      if (active) setUrl(objectUrl); else URL.revokeObjectURL(objectUrl);
    }).catch(() => {});
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [photo.id]);
  return url ? <img src={url} alt={photo.stage === 'BEFORE' ? 'До обслуживания' : 'После обслуживания'} /> : <span>Фотография недоступна</span>;
}

export function ServiceWorkspace() {
  const auth = useAdminAuth();
  const navigation = useNavigation();
  const staff = ['tehnik.utimoshi.ru', 'master.utimoshi.ru'].includes(window.location.hostname) || !(auth.user?.roles || []).some((role) => ['PLATFORM_OWNER', 'ADMIN', 'ORGANIZATION_ADMIN'].includes(role));
  const [data, setData] = useState(null), [visit, setVisit] = useState(null);
  const [summary, setSummary] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [diagnostics, setDiagnostics] = useState(null);
  useBeforeNavigation(() => ({ block: busy ? 'Дождитесь загрузки фотографий или сохранения.' : visit && summary !== (visit.summary || '') ? 'Сохраните отчёт кнопкой «Завершить обслуживание» перед переходом. Текст остаётся на странице.' : '' }));
  const returnToList = () => { setVisit(null); setSecurityOpen(false); setDiagnostics(null); };
  const refresh = async () => setData(await request('/'));
  useEffect(() => { refresh().catch((e) => setError(e.message)); }, []);
  async function run(action) {
    setBusy(true); setError('');
    try { await action(); await refresh(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function upload(stage, file) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { setError('Выберите фотографию размером не больше 8 МБ.'); return; }
    await run(async () => setVisit(await request(`/visits/${visit.id}/photos?stage=${stage}`, { method: 'POST', headers: { 'Content-Type': file.type }, body: file })));
  }
  return <main className="service-workspace">
    <header><div><p>У Тимоши</p><h1>Обслуживание аппаратов</h1></div><MainMenuButton onReturn={staff ? returnToList : undefined} /><button onClick={() => securityOpen && navigation ? navigation.leave(() => setSecurityOpen(false)) : setSecurityOpen(!securityOpen)}>Безопасность</button><button onClick={() => navigation ? navigation.leave(() => auth.logout()) : auth.logout()}>Выйти</button></header>
    {securityOpen && <AccountSecurityPage />}
    {diagnostics && <section className="card"><h2>Техническое состояние</h2><p>{diagnostics.machineCode} · {diagnostics.status}</p><p>Обновлено: {new Date(diagnostics.updatedAt).toLocaleString('ru-RU')}</p><button onClick={() => setDiagnostics(null)}>Закрыть</button></section>}
    {error && <p role="alert" className="admin-auth-error">{error}</p>}
    {!data && !error && <p>Загружаем назначенные аппараты…</p>}
    {data && !visit && <>
      {!data.machines.length && <p>Нет назначенных аппаратов. Обратитесь к администратору проекта.</p>}
      <section className="service-machine-grid">{data.machines.map((machine) => <article className="card" key={machine.id}><h2>{machine.name || machine.machineCode}</h2><p>{machine.machineCode}</p><p>{machine.location}</p><button disabled={busy} onClick={() => run(async () => { const opened = await request(`/machines/${machine.id}/visits`, { method: 'POST' }); const current = await request(`/visits/${opened.id}`); setVisit(current); setSummary(current.summary || ''); })}>Начать / продолжить обслуживание</button>{data.capabilities?.technicalDiagnostics && <button disabled={busy} onClick={() => run(async () => setDiagnostics(await request(`/machines/${machine.id}/diagnostics`)))}>Техническое состояние</button>}</article>)}</section>
      <h2>Мои фотоотчёты</h2>{data.visits.map((item) => <article className="card" key={item.id}><p>{item.machineId} · {new Date(item.createdAt).toLocaleString('ru-RU')}</p><p>{item.status === 'COMPLETED' ? 'Завершено' : 'В работе'}</p><button disabled={busy} onClick={() => run(async () => { const current = await request(`/visits/${item.id}`); setVisit(current); setSummary(current.summary || ''); })}>Открыть</button></article>)}
    </>}
    {visit && <section className="card"><button disabled={busy} onClick={() => navigation ? navigation.leave(returnToList) : returnToList()}>К списку аппаратов</button><h2>Фотоотчёт обслуживания</h2><p>{visit.status === 'COMPLETED' ? 'Завершено' : 'В работе'}</p>
      {['BEFORE', 'AFTER'].map((stage) => <section key={stage}><h3>{stage === 'BEFORE' ? 'До обслуживания' : 'После обслуживания'}</h3><div className="service-photo-grid">{visit.photos?.filter((photo) => photo.stage === stage && !photo.deletedAt).map((photo) => <Photo key={photo.id} photo={photo} />)}</div>{visit.status === 'IN_PROGRESS' && <label>Добавить фотографию<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(e) => { const file = e.target.files[0]; e.target.value = ''; upload(stage, file); }} /></label>}</section>)}
      <label>Выполненные работы<textarea value={summary} maxLength={4000} disabled={busy || visit.status === 'COMPLETED'} onChange={(e) => setSummary(e.target.value)} /></label>
      {visit.status === 'IN_PROGRESS' && <button disabled={busy || !summary.trim()} onClick={() => run(async () => setVisit(await request(`/visits/${visit.id}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ summary }) })))}>{busy ? 'Сохраняем…' : 'Завершить обслуживание'}</button>}
    </section>}
  </main>;
}

export function ServiceConsoleRoot({ children }) {
  const { user } = useAdminAuth();
  const roles = user?.roles || [];
  const staffDomain = ['tehnik.utimoshi.ru', 'master.utimoshi.ru'].includes(window.location.hostname);
  if (staffDomain || !roles.some((role) => ['PLATFORM_OWNER', 'ADMIN', 'ORGANIZATION_ADMIN'].includes(role))) return <ServiceWorkspace />;
  return children;
}
