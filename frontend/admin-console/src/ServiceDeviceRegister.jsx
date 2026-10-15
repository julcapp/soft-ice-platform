import { useBeforeNavigation } from './NavigationSave';
import React, { useState } from 'react';

export function ServiceDeviceRegister({ members = [], organizations = [] }) {
  const [memberId, setMemberId] = useState('');
  const [source, setSource] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const member = members.find((item) => item.id === memberId);
  useBeforeNavigation(() => ({ block: busy ? 'Дождитесь регистрации смартфона.' : source || preview ? 'Подтвердите регистрацию смартфона или очистите форму.' : '' }));
  function review(event) {
    event.preventDefault(); setError(''); setNotice('');
    try {
      if (!member) throw new Error('Выберите сотрудника.');
      if (source.length > 8192) throw new Error('Данные смартфона слишком длинные.');
      const input = JSON.parse(source);
      const device = {};
      for (const field of ['manufacturer', 'model', 'androidVersion', 'appVersion', 'publicKey']) {
        if (typeof input?.[field] !== 'string' || !input[field].trim() || input[field].length > (field === 'publicKey' ? 4096 : 120)) throw new Error('Вставьте полные данные из Android-приложения.');
        device[field] = input[field].trim();
      }
      if (!device.publicKey.startsWith('-----BEGIN PUBLIC KEY-----')) throw new Error('Отсутствует публичный ключ смартфона.');
      setPreview({ device, memberId, fullName: member.fullName });
    } catch (e) { setPreview(null); setError(e instanceof SyntaxError ? 'Не удалось прочитать данные. Скопируйте весь текст из приложения.' : e.message); }
  }
  async function save() {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/v1/admin/service-devices/${encodeURIComponent(preview.memberId)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(preview.device) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error?.message || 'Не удалось зарегистрировать смартфон.');
      setNotice(`Смартфон ${preview.device.manufacturer} ${preview.device.model} зарегистрирован для ${preview.fullName}. Теперь сотрудник может войти в приложение.`);
      setPreview(null); setSource('');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <form className="card service-device-register" onSubmit={review}>
    <h2>Смартфон сотрудника</h2>
    <p>В Android-приложении откройте «Подготовить привязку смартфона» → «Передать данные администратору». Выберите сотрудника и вставьте полученный текст. Привязка общая для ролей мастера и техника.</p>
    <label>Сотрудник для привязки<select required disabled={busy} value={memberId} onChange={(e) => { setMemberId(e.target.value); setPreview(null); setNotice(''); }}><option value="">Выберите сотрудника</option>{members.map((item) => <option key={item.id} value={item.id}>{item.fullName} · {organizations.find((org) => org.id === item.organizationId)?.shortName}</option>)}</select></label>
    <label>Данные смартфона из приложения<textarea required disabled={busy} maxLength={8192} rows={6} spellCheck={false} value={source} onChange={(e) => { setSource(e.target.value); setPreview(null); setNotice(''); }} /></label>
    {preview ? <><p>Зарегистрировать {preview.device.manufacturer} {preview.device.model} для сотрудника «{preview.fullName}»?</p><p>Android {preview.device.androidVersion} · приложение {preview.device.appVersion}</p><button type="button" disabled={busy} onClick={save}>Подтвердить привязку смартфона</button><button type="button" disabled={busy} onClick={() => setPreview(null)}>Вернуться к форме</button></> : <button type="submit" disabled={busy || !members.length}>Проверить данные смартфона</button>}
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    <p>Если у сотрудника уже зарегистрирован телефон, сервер отклонит новую привязку. Замена требует отзыва прежнего устройства администратором.</p>
  </form>;
}
