import { useBeforeNavigation } from './NavigationSave';
import { normalizePersonName } from './personName';
import React, { useEffect, useState } from 'react';
const empty = () => ({ fullName: '', shortName: '', organizationType: 'ООО', inn: '', kpp: '', ogrn: '', legalAddress: '', directorName: '', directorPosition: '', phone: '', email: '', website: '' });
async function request(path = '', method = 'GET', body) {
  const response = await fetch(`/api/v1/organizations${path}`, { method, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error?.message || 'Не удалось получить данные организации.');
  return result.data;
}
export function OrganizationCreate({ organizations, initialOrganizationId = '', onSelect, onSaved }) {
  const [loaded, setLoaded] = useState([]), [selected, setSelected] = useState(initialOrganizationId), [editing, setEditing] = useState(false), [existingId, setExistingId] = useState('');
  const [form, setForm] = useState(empty), [busy, setBusy] = useState(false), [error, setError] = useState(''), [confirm, setConfirm] = useState(false), [notice, setNotice] = useState(''), [lookupInfo, setLookupInfo] = useState(null), [configured, setConfigured] = useState(null);
  const items = (organizations ?? loaded).map((item) => loaded.find((org) => org.id === item.id) || item);
  const chosen = items.find((item) => item.id === selected);
  useEffect(() => { request().then((data) => setLoaded(Array.isArray(data) ? data : [])).catch((e) => setError(e.message)); }, [organizations]);
  useEffect(() => { request('/lookup/config').then((data) => setConfigured(Boolean(data.configured))).catch(() => setConfigured(false)); }, []);
  const change = (key, value) => { setConfirm(false); setLookupInfo(null); setForm({ ...form, [key]: value }); };
  function start(org) { setExistingId(org?.id || ''); setForm(Object.fromEntries(Object.keys(empty()).map((key) => [key, org?.[key] ?? empty()[key]]))); setConfirm(false); setLookupInfo(null); setError(''); setEditing(true); }
  useBeforeNavigation(() => ({ block: busy ? 'Дождитесь проверки или сохранения организации.' : editing ? 'Подтвердите сохранение организации или отмените редактирование.' : '' }));
  async function lookup() {
    setBusy(true); setError(''); setConfirm(false);
    try {
      const duplicate = items.find((item) => item.inn === form.inn && item.id !== existingId);
      if (duplicate) { setSelected(duplicate.id); onSelect?.(duplicate.id); setEditing(false); setNotice('Организация уже есть в базе. Выбрана существующая карточка.'); return; }
      const data = await request('/lookup/inn', 'POST', { inn: form.inn });
      setForm({ ...form, ...Object.fromEntries(Object.entries(data.organization).filter(([,value]) => value !== '')) }); setLookupInfo(data);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function save() {
    setBusy(true); setError('');
    try {
      const duplicate = items.find((item) => form.inn && item.inn === form.inn && item.id !== existingId);
      if (duplicate) throw new Error('Организация с этим ИНН уже есть в базе. Выберите её из списка.');
      const values = Object.fromEntries(Object.entries(form).map(([key,value]) => [key, value.trim() || null]));
      const data = await request(existingId ? `/${existingId}` : '', existingId ? 'PATCH' : 'POST', values);
      setEditing(false); setConfirm(false); setSelected(data.id); onSelect?.(data.id); setNotice('Реквизиты организации сохранены.');
      const refreshed = await request(); setLoaded(Array.isArray(refreshed) ? refreshed : []);
      await onSaved?.(data);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <section className="card organization-create"><h2>Организация</h2><label>Выберите организацию из базы<select value={selected} disabled={busy || editing} onChange={(e) => { setSelected(e.target.value); onSelect?.(e.target.value); setNotice(''); }}><option value="">Выберите организацию</option>{items.map((item) => <option key={item.id} value={item.id}>{item.shortName}{item.inn ? ` · ИНН ${item.inn}` : ''}</option>)}</select></label>{chosen && !editing && <><p><strong>{chosen.fullName}</strong></p><dl className="organization-contact-grid"><div><dt>Директор / предприниматель</dt><dd>{chosen.directorName || 'Не указан'}</dd></div><div><dt>Телефон</dt><dd>{chosen.phone || 'Не указан'}</dd></div><div><dt>Электронная почта</dt><dd>{chosen.email || 'Не указана'}</dd></div></dl><button disabled={busy} onClick={() => start(chosen)}>Изменить реквизиты и контакты</button><a href={`#organizations/${chosen.id}/overview`}>Карточка организации</a></>}{!editing && <button onClick={() => start(null)} disabled={busy}>+ Добавить организацию</button>}{notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}</p>}{editing && <form onSubmit={(e) => { e.preventDefault(); setConfirm(true); }}><h2>{existingId ? 'Реквизиты организации' : 'Новая организация'}</h2><label>ИНН<input disabled={busy} inputMode="numeric" pattern="[0-9]{10}|[0-9]{12}" maxLength={12} value={form.inn} onChange={(e) => change('inn', e.target.value.replace(/\D/g, ''))} /></label><button type="button" disabled={busy || configured !== true || !/^(\d{10}|\d{12})$/.test(form.inn)} onClick={lookup}>Найти по ИНН и заполнить</button>{configured === false && <p>Автозаполнение пока не подключено. Реквизиты можно заполнить вручную.</p>}{lookupInfo && <p role="status">Реквизиты получены из DaData. Статус в реестре: {({ ACTIVE: 'действует', LIQUIDATING: 'ликвидируется', LIQUIDATED: 'ликвидирована', BANKRUPT: 'банкротство', REORGANIZING: 'реорганизация' })[lookupInfo.registryStatus] || 'не указан'}. Проверьте данные перед сохранением.</p>}<div className="organization-form-grid">{[['fullName','Полное наименование',true],['shortName','Краткое наименование',true],['organizationType','Организационно-правовая форма',true],['kpp','КПП'],['ogrn','ОГРН / ОГРНИП'],['legalAddress','Юридический адрес'],['directorName','ФИО директора / предпринимателя',true],['directorPosition','Должность руководителя'],['phone','Телефон для связи',true,'tel'],['email','Электронная почта',true,'email'],['website','Сайт']].map(([key,label,required,type]) => <label key={key}>{label}<input disabled={busy} required={required} type={type || 'text'} maxLength={key === 'legalAddress' ? 1000 : 250} spellCheck={key === 'directorName'} lang={key === 'directorName' ? 'ru' : undefined} autoCapitalize={key === 'directorName' ? 'words' : undefined} onBlur={() => { if (key === 'directorName') change(key, normalizePersonName(form[key])); }} value={form[key]} onChange={(e) => change(key, e.target.value)} /></label>)}</div>{confirm ? <div><p>Сохранить реквизиты и контакты организации «{form.shortName}»?</p><button type="button" disabled={busy} onClick={save}>Подтвердить и сохранить</button><button type="button" disabled={busy} onClick={() => setConfirm(false)}>Вернуться к форме</button></div> : <button type="submit" disabled={busy}>Сохранить</button>}<button type="button" disabled={busy} onClick={() => { setEditing(false); setConfirm(false); }}>Отмена</button></form>}</section>;
}
