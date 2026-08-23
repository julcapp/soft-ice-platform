import React, { useEffect, useState } from 'react';
import { StatusBadge } from './components';
import { getOperationsDispatch, getOperationsHistory, updateOperationsWorkItem } from './api/adminOperationsDispatchClient';

const categoryLabels = { ALL: 'Все', FINANCE: 'Финансы', MACHINES: 'Аппараты', SUBSCRIPTIONS: 'Подписки', CONTENT: 'Контент' };
const statusLabels = { ALL: 'Все', OPEN: 'Открыт', IN_PROGRESS: 'В работе', RESOLVED: 'Решён' };
const severityLabels = { ALL: 'Все', CRITICAL: 'Критичные', WARNING: 'Предупреждения' };

export function AdminOperationsDispatch({ compact = false }) {
  const [filters, setFilters] = useState({ category: 'ALL', severity: 'ALL', status: 'ALL' });
  const [state, setState] = useState({ status: 'loading', data: null });
  const [history, setHistory] = useState(null);
  const [draft, setDraft] = useState({});

  async function load(signal) {
    try {
      const data = await getOperationsDispatch({ ...filters, signal });
      setState({ status: 'ready', data });
    } catch (error) {
      if (error?.name !== 'AbortError') setState({ status: 'error', data: null });
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [filters.category, filters.severity, filters.status]);

  async function apply(item, patch) {
    const values = draft[item.key] || {};
    const payload = { notificationKey: item.key, comment: values.comment, ...patch };
    if (Object.prototype.hasOwnProperty.call(values, 'assigneeSubject')) payload.assigneeSubject = values.assigneeSubject;
    await updateOperationsWorkItem(payload);
    setDraft((current) => ({ ...current, [item.key]: { ...values, comment: '' } }));
    await load();
    if (history?.key === item.key) await openHistory(item.key);
  }
  async function openHistory(key) {
    const data = await getOperationsHistory(key);
    setHistory({ key, ...data });
  }

  const data = state.data;
  return <section className="card" aria-label="Операционная диспетчерская" style={compact ? { marginTop: 12 } : undefined}>
    <div className="card-heading"><div><h2>Операционная диспетчерская</h2><p style={{ margin: '4px 0 0' }}>Рабочая очередь поверх исходных инцидентов. Прочтение не закрывает проблему.</p></div>{data && <StatusBadge status={data.summary.slaOverdue ? 'CRITICAL' : data.summary.critical ? 'CRITICAL' : data.summary.open || data.summary.inProgress ? 'WARNING' : 'CLEAR'} />}</div>
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
      <label>Категория<select value={filters.category} onChange={(e) => setFilters((v) => ({ ...v, category: e.target.value }))}>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Важность<select value={filters.severity} onChange={(e) => setFilters((v) => ({ ...v, severity: e.target.value }))}>{Object.entries(severityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Статус<select value={filters.status} onChange={(e) => setFilters((v) => ({ ...v, status: e.target.value }))}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    {state.status === 'error' && <p>Не удалось загрузить диспетчерскую.</p>}
    {data && <div className="statistics" style={{ marginBottom: 14 }}><div><strong>{data.summary.total}</strong><small> всего</small></div><div><strong>{data.summary.critical}</strong><small> критичных</small></div><div><strong>{data.summary.open}</strong><small> открыто</small></div><div><strong>{data.summary.inProgress}</strong><small> в работе</small></div><div><strong>{data.summary.resolved}</strong><small> решено</small></div><div><strong>{data.summary.slaOverdue || 0}</strong><small> SLA просрочено</small></div><div><strong>{data.summary.escalated || 0}</strong><small> эскалировано</small></div></div>}
    {data?.items?.length === 0 && <p>По выбранным фильтрам инцидентов нет.</p>}
    {data?.items?.map((item) => {
      const values = draft[item.key] || {};
      const assignedLabel = item.work.assigneeDisplayName || item.work.assigneeSubject || 'не назначен';
      const slaCritical = item.work.ackOverdue || item.work.resolveOverdue;
      return <article key={item.key} style={{ borderTop: '1px solid var(--border-color, #ddd)', padding: '14px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><div><small>{categoryLabels[item.category] || item.category} · {item.source}</small><strong style={{ display: 'block', marginTop: 3 }}>{item.title}</strong></div><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><StatusBadge status={item.severity} /><StatusBadge status={item.work.status} />{slaCritical && <StatusBadge status="CRITICAL" />}{item.work.escalationLevel > 0 && <span>Эскалация L{item.work.escalationLevel}</span>}</div></div>
        <p>{item.message}</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '6px 0 10px' }}>
          <small><strong>SLA принятия:</strong> {item.work.acknowledgedAt ? `принято ${formatDate(item.work.acknowledgedAt)}` : item.work.ackDueAt ? `${item.work.ackOverdue ? 'ПРОСРОЧЕНО · ' : ''}${formatDate(item.work.ackDueAt)}` : '—'}</small>
          <small><strong>SLA решения:</strong> {item.work.resolvedAt ? `решено ${formatDate(item.work.resolvedAt)}` : item.work.resolveDueAt ? `${item.work.resolveOverdue ? 'ПРОСРОЧЕНО · ' : ''}${formatDate(item.work.resolveDueAt)}` : '—'}</small>
          {item.work.slaPolicyCode && <small><strong>Политика:</strong> {item.work.slaPolicyCode}</small>}
        </div>
        {item.work.assigneeSubject && <p style={{ margin: '4px 0 10px' }}><strong>Ответственный:</strong> {assignedLabel}{item.work.assignmentMode === 'AUTO' ? ' · назначен автоматически' : item.work.assignmentMode === 'MANUAL' ? ' · назначен вручную' : ''}{item.work.assignmentReason ? ` · ${item.work.assignmentReason}` : ''}</p>}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
          <label>Переназначить<input value={values.assigneeSubject ?? ''} onChange={(e) => setDraft((v) => ({ ...v, [item.key]: { ...(v[item.key] || {}), assigneeSubject: e.target.value } }))} placeholder={item.work.assigneeSubject || 'логин/роль сотрудника'} /></label>
          <label style={{ flex: '1 1 260px' }}>Комментарий<input value={values.comment || ''} onChange={(e) => setDraft((v) => ({ ...v, [item.key]: { ...(v[item.key] || {}), comment: e.target.value } }))} placeholder="Что сделано или что требуется" /></label>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          {item.work.status !== 'IN_PROGRESS' && item.work.status !== 'RESOLVED' && <button type="button" onClick={() => apply(item, { status: 'IN_PROGRESS' })}>Взять в работу</button>}
          {item.work.status !== 'RESOLVED' && <button type="button" onClick={() => apply(item, { status: 'RESOLVED' })}>Решено</button>}
          {item.work.status === 'RESOLVED' && <button type="button" onClick={() => apply(item, { status: 'OPEN' })}>Переоткрыть</button>}
          <button type="button" className="text-button" onClick={() => apply(item, {})}>Сохранить ответственного/комментарий</button>
          <button type="button" className="text-button" onClick={() => openHistory(item.key)}>История</button>
          {item.deepLink && <a className="text-button" href={item.deepLink}>Открыть источник</a>}
        </div>
        {history?.key === item.key && <div style={{ marginTop: 12, padding: 10, background: 'rgba(0,0,0,.03)' }}><strong>История обработки</strong>{history.events?.length ? <ul>{history.events.map((event) => <li key={event.id}>{formatDate(event.createdAt)} · {event.actorSubject} · {event.eventType}{event.fromStatus || event.toStatus ? ` · ${event.fromStatus || '—'} → ${event.toStatus || '—'}` : ''}{event.assigneeSubject ? ` · ответственный: ${event.assigneeSubject}` : ''}{event.comment ? ` · ${event.comment}` : ''}</li>)}</ul> : <p>Действий пока нет.</p>}</div>}
      </article>;
    })}
  </section>;
}

function formatDate(value) { return value ? new Date(value).toLocaleString('ru-RU') : '—'; }
