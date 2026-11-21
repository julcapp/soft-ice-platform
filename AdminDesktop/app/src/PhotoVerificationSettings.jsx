import React, { useEffect, useState } from 'react';
import { ErrorState, Skeleton, StatusBadge } from './components';
import { getPhotoVerificationSettings, updatePhotoVerificationSettings } from './api/photoVerificationClient';

const MODES = [
  ['disabled', 'Выключено'],
  ['manual_only', 'Только ручная проверка'],
  ['ai_assisted', 'AI + ручная проверка'],
];

function Toggle({ label, checked, onChange, hint }) {
  return <label className="card" style={{ display: 'grid', gap: 8 }}>
    <span style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
      <strong>{label}</strong>
      <input type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} />
    </span>
    {hint && <small style={{ color: 'var(--muted)' }}>{hint}</small>}
  </label>;
}

export function PhotoVerificationSettingsPage({ getSettings = getPhotoVerificationSettings, saveSettings = updatePhotoVerificationSettings }) {
  const [state, setState] = useState({ status: 'loading', data: null });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    getSettings({ signal: controller.signal })
      .then((data) => setState({ status: 'ready', data }))
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ status: 'error', data: null });
      });
    return () => controller.abort();
  }, [getSettings]);

  if (state.status === 'loading') return <Skeleton />;
  if (state.status === 'error') return <ErrorState />;

  const data = state.data || {};
  const patch = (key, value) => setState((current) => ({ ...current, data: { ...current.data, [key]: value } }));
  const save = async () => {
    setSaving(true);
    setNotice('');
    try {
      const saved = await saveSettings(data);
      setState({ status: 'ready', data: saved });
      setNotice('Настройки сохранены.');
    } catch {
      setNotice('Не удалось сохранить настройки.');
    } finally {
      setSaving(false);
    }
  };

  const rewardValue = data.rewardBonusUnits == null ? '' : String(data.rewardBonusUnits);

  return <div className="dashboard">
    <section className="card">
      <div className="card-heading">
        <h2>Режим проверки</h2>
        <StatusBadge status={data.enabled ? 'ACTIVE' : 'INACTIVE'} />
      </div>
      <div style={{ display: 'grid', gap: 14 }}>
        <label><strong>Режим</strong><select value={data.mode || 'manual_only'} onChange={(event) => patch('mode', event.target.value)} style={{ display: 'block', marginTop: 8, padding: 10, width: '100%', maxWidth: 420 }}>
          {MODES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <Toggle label="Модуль проверки включён" checked={data.enabled} onChange={(value) => patch('enabled', value)} hint="Без этого переключателя автоматическая обработка фотографий не запускается." />
        <Toggle label="Автоматическая публикация включена" checked={data.publishingEnabled} onChange={(value) => patch('publishingEnabled', value)} hint="Публикация остаётся отдельным этапом после модерации." />
      </div>
    </section>

    <section className="statistics">
      <Toggle label="Проверка дубликатов" checked={data.duplicateChecksEnabled} onChange={(value) => patch('duplicateChecksEnabled', value)} />
      <Toggle label="Проверка метаданных" checked={data.metadataChecksEnabled} onChange={(value) => patch('metadataChecksEnabled', value)} />
      <Toggle label="Код задания" checked={data.challengeCodeEnabled} onChange={(value) => patch('challengeCodeEnabled', value)} />
      <Toggle label="Публикация обязательна для награды" checked={data.publicationRequiredForReward} onChange={(value) => patch('publicationRequiredForReward', value)} />
    </section>

    <section className="card">
      <div className="card-heading"><h2>Награда за фотозадание</h2><StatusBadge status={rewardValue ? 'ACTIVE' : 'INACTIVE'} /></div>
      <label style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
        <strong>Бонусные единицы</strong>
        <input
          type="number"
          min="1"
          step="1"
          inputMode="numeric"
          value={rewardValue}
          placeholder="Не задано"
          onChange={(event) => patch('rewardBonusUnits', event.target.value === '' ? null : Number(event.target.value))}
          style={{ padding: 10, width: '100%' }}
        />
      </label>
      <p style={{ marginBottom: 0 }}>Пустое значение означает: награда не начисляется. Значение применяется только после подтверждённой публикации во всех обязательных каналах.</p>
      <small>Бонусные единицы не являются рублями. Конкретное количество пока не утверждено и по умолчанию не задано.</small>
    </section>

    <section className="card">
      <div className="card-heading"><h2>Публичные каналы</h2><span>UGC-публикация</span></div>
      <p>VK: <strong>club239119350</strong></p>
      <p>Telegram: <strong>@ice_robo_club</strong></p>
      <p>MAX: <strong>https://max.ru/channel_soft_icecream</strong> — API target ID будет задан отдельно</p>
      <small>Приватный Telegram-канал 99 ₽/мес не входит в публичный UGC-контур.</small>
    </section>

    <section className="card" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <button className="text-button" type="button" disabled={saving} onClick={save}>{saving ? 'Сохранение…' : 'Сохранить настройки'}</button>
      {notice && <span role="status">{notice}</span>}
    </section>
  </div>;
}
