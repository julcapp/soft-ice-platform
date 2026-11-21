import React, { useEffect, useMemo, useState } from 'react';
import { promotionClient } from './api/promotionClient';
import { moscowLocalToIso } from './promotionTime';

const DAYS = [{ id: 1, label: 'Пн' }, { id: 2, label: 'Вт' }, { id: 3, label: 'Ср' }, { id: 4, label: 'Чт' }, { id: 5, label: 'Пт' }, { id: 6, label: 'Сб' }, { id: 7, label: 'Вс' }];
const CHANNELS = ['MINI_APP', 'WEB', 'TERMINAL', 'TELEGRAM', 'MAX', 'VK'];

function toForm(version) {
  const schedules = version?.schedules || [];
  const byDay = Object.fromEntries(DAYS.map(({ id }) => {
    const row = schedules.find((item) => Number(item.dayOfWeek) === id);
    return [id, { enabled: row ? row.isEnabled !== false : false, startTime: row?.startTime?.slice?.(0, 5) || '17:00', endTime: row?.endTime?.slice?.(0, 5) || '19:00' }];
  }));
  const channels = Object.fromEntries(CHANNELS.map((channel) => {
    const row = version?.channels?.find((item) => item.channel === channel);
    return [channel, { enabled: row?.enabled ?? true, popupEnabled: row?.popupEnabled ?? channel === 'MINI_APP', countdownEnabled: row?.countdownEnabled ?? ['MINI_APP','WEB','TERMINAL'].includes(channel), preNotificationMinutes: Number(row?.preNotificationMinutes || 30) }];
  }));
  const machineTargets = (version?.targets || []).filter((row) => row.targetType === 'MACHINE').map((row) => row.targetId).filter(Boolean);
  const allMachines = (version?.targets || []).some((row) => row.targetType === 'ALL_MACHINES') || machineTargets.length === 0;
  return {
    benefitValue: Number(version?.benefitValue || 20),
    minimumFinalPrice: version?.minimumFinalPrice == null ? '' : Number(version.minimumFinalPrice),
    budgetAmount: version?.budgetAmount == null ? '' : Number(version.budgetAmount),
    budgetAction: version?.budgetAction || 'STOP',
    maxApplications: version?.maxApplications ?? '',
    maxApplicationsPerCustomer: version?.maxApplicationsPerCustomer ?? '',
    priceLockSeconds: Number(version?.priceLockSeconds || 300),
    approvalPolicy: version?.approvalPolicy || 'SINGLE_APPROVAL',
    allMachines,
    machineIds: machineTargets.join(', '),
    schedules: byDay,
    channels,
  };
}

function buildPatch(form) {
  const schedules = DAYS.filter(({ id }) => form.schedules[id].enabled).map(({ id }) => ({ dayOfWeek: id, startTime: form.schedules[id].startTime, endTime: form.schedules[id].endTime, isEnabled: true, windowOrder: 0 }));
  const machineIds = String(form.machineIds || '').split(',').map((value) => value.trim()).filter(Boolean);
  const targets = form.allMachines ? [{ targetType: 'ALL_MACHINES', targetId: null }] : machineIds.map((targetId) => ({ targetType: 'MACHINE', targetId }));
  const channels = CHANNELS.map((channel) => ({ channel, ...form.channels[channel], preNotificationMinutes: Number(form.channels[channel].preNotificationMinutes || 0) || null }));
  return {
    version: {
      benefitType: 'PERCENT_DISCOUNT',
      benefitValue: Number(form.benefitValue),
      minimumFinalPrice: form.minimumFinalPrice === '' ? null : Number(form.minimumFinalPrice),
      budgetAmount: form.budgetAmount === '' ? null : Number(form.budgetAmount),
      budgetAction: form.budgetAction,
      maxApplications: form.maxApplications === '' ? null : Number(form.maxApplications),
      maxApplicationsPerCustomer: form.maxApplicationsPerCustomer === '' ? null : Number(form.maxApplicationsPerCustomer),
      priceLockSeconds: Number(form.priceLockSeconds),
      approvalPolicy: form.approvalPolicy,
      schedules,
      targets,
      channels,
    },
  };
}

export function PromotionEditor({ campaign, approvals = [], onChanged }) {
  const version = campaign?.currentVersion;
  const workingStatus = version?.status || campaign?.status;
  const editable = ['DRAFT', 'VALIDATION_FAILED'].includes(workingStatus);
  const [form, setForm] = useState(() => toForm(version));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [scheduleStart, setScheduleStart] = useState('');
  const [scheduleEnd, setScheduleEnd] = useState('');

  useEffect(() => { setForm(toForm(version)); setMessage(null); }, [version?.id]);
  const approved = useMemo(() => approvals.filter((row) => row.status === 'APPROVED').length, [approvals]);

  function setField(key, value) { setForm((current) => ({ ...current, [key]: value })); }
  function setDay(day, key, value) { setForm((current) => ({ ...current, schedules: { ...current.schedules, [day]: { ...current.schedules[day], [key]: value } } })); }
  function setChannel(channel, key, value) { setForm((current) => ({ ...current, channels: { ...current.channels, [channel]: { ...current.channels[channel], [key]: value } } })); }

  async function perform(label, operation) {
    if (busy) return;
    setBusy(true); setMessage(null);
    try { await operation(); setMessage({ type: 'ok', text: label }); await onChanged?.(); }
    catch (error) { setMessage({ type: 'error', text: `${error.code || 'PROMOTION_ERROR'}: ${error.message}` }); }
    finally { setBusy(false); }
  }

  const createVersion = () => perform('Новая DRAFT-версия создана. Действующая версия продолжает обслуживать покупателей.', () => promotionClient.createVersion(campaign.id, {}));
  const saveDraft = () => perform('Черновик сохранён.', () => promotionClient.updateDraft(campaign.id, buildPatch(form)));
  const validate = () => perform('Валидация выполнена.', () => promotionClient.validate(campaign.id));
  const requestApproval = () => perform('Версия отправлена на согласование.', () => promotionClient.requestApproval(campaign.id, 'Запрос из Promotion Engine Console'));
  const approve = () => perform('Согласование зафиксировано.', () => promotionClient.approve(campaign.id, 'Одобрено в Promotion Engine Console'));
  const schedule = () => perform('Версия запланирована.', () => promotionClient.schedule(campaign.id, moscowLocalToIso(scheduleStart), scheduleEnd ? moscowLocalToIso(scheduleEnd) : null));

  if (!campaign || !version) return null;
  return <section className="pe-card pe-editor">
    <div className="pe-card-title">
      <div><p>Редактор версии</p><h2>Рабочая версия v{version.version}</h2></div>
      <div className="pe-version-pointers"><span>working: {workingStatus}</span><span>effective: {campaign.effectiveVersion ? `v${campaign.effectiveVersion.version}` : 'нет'}</span></div>
    </div>

    {!editable && <div className="pe-editor-lock"><div><strong>Текущая рабочая версия не редактируется напрямую.</strong><span>{campaign.effectiveVersion ? 'Создайте новую DRAFT-версию. Действующая акция продолжит работать без изменений.' : 'Для изменения параметров создайте новую версию.'}</span></div><button disabled={busy || ['ARCHIVED','CANCELLED'].includes(campaign.status)} onClick={createVersion}>＋ Создать новую версию</button></div>}

    {editable && <>
      <div className="pe-editor-grid">
        <label><span>Скидка, %</span><input type="number" min="1" max="100" value={form.benefitValue} onChange={(e) => setField('benefitValue', e.target.value)} /></label>
        <label><span>Минимальная цена, ₽</span><input type="number" min="0" value={form.minimumFinalPrice} onChange={(e) => setField('minimumFinalPrice', e.target.value)} /></label>
        <label><span>Бюджет акции, ₽</span><input type="number" min="0" value={form.budgetAmount} onChange={(e) => setField('budgetAmount', e.target.value)} placeholder="Без лимита" /></label>
        <label><span>При исчерпании бюджета</span><select value={form.budgetAction} onChange={(e) => setField('budgetAction', e.target.value)}><option value="STOP">STOP</option><option value="NOTIFY_ONLY">Только уведомить</option></select></label>
        <label><span>Макс. применений</span><input type="number" min="1" value={form.maxApplications} onChange={(e) => setField('maxApplications', e.target.value)} /></label>
        <label><span>Макс. на клиента</span><input type="number" min="1" value={form.maxApplicationsPerCustomer} onChange={(e) => setField('maxApplicationsPerCustomer', e.target.value)} /></label>
        <label><span>Фиксация цены, сек.</span><input type="number" min="30" value={form.priceLockSeconds} onChange={(e) => setField('priceLockSeconds', e.target.value)} /></label>
        <label><span>Согласование</span><select value={form.approvalPolicy} onChange={(e) => setField('approvalPolicy', e.target.value)}><option value="NONE">Не требуется</option><option value="SINGLE_APPROVAL">Одно согласование</option><option value="DUAL_APPROVAL">Два согласования</option><option value="OWNER_APPROVAL">Владелец</option></select></label>
      </div>

      <div className="pe-editor-section"><h3>Целевые автоматы</h3><label className="pe-check"><input type="checkbox" checked={form.allMachines} onChange={(e) => setField('allMachines', e.target.checked)} /> Все автоматы</label>{!form.allMachines && <label><span>ID автоматов через запятую</span><input value={form.machineIds} onChange={(e) => setField('machineIds', e.target.value)} placeholder="machine-01, machine-02" /></label>}</div>

      <div className="pe-editor-section"><h3>Расписание · Europe/Moscow</h3><div className="pe-day-editor">{DAYS.map(({ id, label }) => <div key={id}><label className="pe-check"><input type="checkbox" checked={form.schedules[id].enabled} onChange={(e) => setDay(id, 'enabled', e.target.checked)} /> {label}</label><input type="time" disabled={!form.schedules[id].enabled} value={form.schedules[id].startTime} onChange={(e) => setDay(id, 'startTime', e.target.value)} /><span>—</span><input type="time" disabled={!form.schedules[id].enabled} value={form.schedules[id].endTime} onChange={(e) => setDay(id, 'endTime', e.target.value)} /></div>)}</div></div>

      <div className="pe-editor-section"><h3>Каналы</h3><div className="pe-channel-editor">{CHANNELS.map((channel) => <div key={channel}><strong>{channel}</strong><label className="pe-check"><input type="checkbox" checked={form.channels[channel].enabled} onChange={(e) => setChannel(channel, 'enabled', e.target.checked)} /> Включён</label><label className="pe-check"><input type="checkbox" checked={form.channels[channel].countdownEnabled} onChange={(e) => setChannel(channel, 'countdownEnabled', e.target.checked)} /> Countdown</label><label><span>Предуведомление, мин</span><select value={form.channels[channel].preNotificationMinutes} onChange={(e) => setChannel(channel, 'preNotificationMinutes', Number(e.target.value))}><option value="15">15</option><option value="30">30</option><option value="60">60</option></select></label></div>)}</div></div>

      <div className="pe-editor-actions"><button className="primary" disabled={busy} onClick={saveDraft}>Сохранить DRAFT</button><button disabled={busy} onClick={validate}>Validate</button></div>
    </>}

    {workingStatus === 'READY' && <div className="pe-workflow"><div><strong>READY</strong><span>Версия прошла валидацию. Следующий шаг — согласование.</span></div>{version.approvalPolicy === 'NONE' ? <span>Согласование не требуется</span> : <><button disabled={busy} onClick={requestApproval}>Запросить согласование</button><button disabled={busy} onClick={approve}>Одобрить</button></>}</div>}

    {workingStatus === 'READY' && (version.approvalPolicy === 'NONE' || approved > 0) && <div className="pe-schedule-editor"><h3>Запланировать запуск · Europe/Moscow</h3><label><span>Начало</span><input type="datetime-local" value={scheduleStart} onChange={(e) => setScheduleStart(e.target.value)} /></label><label><span>Окончание</span><input type="datetime-local" value={scheduleEnd} onChange={(e) => setScheduleEnd(e.target.value)} /></label><button disabled={busy || !scheduleStart} onClick={schedule}>Schedule</button></div>}

    {message && <div className={`pe-editor-message ${message.type}`}>{message.text}</div>}
  </section>;
}
