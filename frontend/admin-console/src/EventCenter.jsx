import React, { useEffect, useMemo, useState } from 'react';
import { EmptyState, ErrorState, Skeleton, StatusBadge } from './components';
import * as api from './api/eventCenterClient';

const labels = {
  INFO: 'Информация', BUSINESS: 'Бизнес-событие', WARNING: 'Предупреждение', INCIDENT: 'Инцидент', CRITICAL: 'Критическое', EMERGENCY: 'Аварийное',
  SYSTEM: 'Система', MACHINE: 'Автомат', CUSTOMER: 'Клиент', PAYMENT: 'Платёж', INVENTORY: 'Склад', MAINTENANCE: 'Обслуживание', CONNECTIVITY: 'Связь', VIDEO_SURVEILLANCE: 'Видеонаблюдение', SECURITY: 'Безопасность',
  NEW: 'Новое', SEEN: 'Просмотрено', ACKNOWLEDGED: 'Подтверждено', IN_PROGRESS: 'В работе', RESOLVED: 'Решено', IGNORED: 'Игнорируется', ARCHIVED: 'В архиве',
};
const label = (value) => labels[value] || value;
const views = [{ id: 'all', title: 'Все события' }, { id: 'attention', title: 'Требуют внимания', filters: { acknowledgementRequired: true, acknowledged: false } }, { id: 'critical', title: 'Критические', filters: { severity: 'CRITICAL' } }, { id: 'incidents', title: 'Инциденты', filters: { severity: 'INCIDENT' } }, { id: 'business', title: 'Бизнес-события', filters: { category: 'BUSINESS' } }, { id: 'connectivity', title: 'Связь', filters: { category: 'CONNECTIVITY' } }, { id: 'video', title: 'Видеонаблюдение', filters: { category: 'VIDEO_SURVEILLANCE' } }, { id: 'maintenance', title: 'Обслуживание', filters: { category: 'MAINTENANCE' } }, { id: 'payments', title: 'Платежи', filters: { category: 'PAYMENT' } }, { id: 'saved', title: 'Мои фильтры', placeholder: true }];

export function EventCenterPage({ client = api, route = 'event-center' }) {
  const eventId = route.split('/')[1];
  return eventId ? <EventDetail eventId={eventId} client={client} /> : <EventList client={client} />;
}
export function EventList({ client }) {
  const [state, setState] = useState({ status: 'loading', items: [] }); const [filters, setFilters] = useState({}); const [view, setView] = useState('all');
  const effective = useMemo(() => ({ ...filters, ...(views.find((item) => item.id === view)?.filters || {}) }), [filters, view]);
  useEffect(() => { const controller = new AbortController(); setState((value) => ({ ...value, status: 'loading' })); client.listEvents(effective, { signal: controller.signal }).then((data) => setState({ status: 'ready', items: data.items, nextCursor: data.nextCursor })).catch((error) => error.name !== 'AbortError' && setState({ status: error.status === 403 ? 'forbidden' : 'error', items: [] })); return () => controller.abort(); }, [client, effective]);
  if (state.status === 'error') return <ErrorState />;
  if (state.status === 'forbidden') return <ErrorState kind="denied" />;
  return <div className="event-center">
    <nav className="event-views" aria-label="Представления Центра событий">{views.map((item) => <button key={item.id} disabled={item.placeholder} className={view === item.id ? 'active' : ''} onClick={() => setView(item.id)}>{item.title}</button>)}</nav>
    <EventFilters value={filters} onChange={setFilters} />
    {state.status === 'loading' ? <Skeleton /> : state.items.length ? <div className="event-list" aria-label="Список событий">{state.items.map((item) => <EventRow key={item.eventId} event={item} />)}</div> : <EmptyState title="Событий не найдено" message="Измените фильтры или период поиска." />}
    {state.nextCursor && <button className="secondary-button" onClick={() => setFilters((value) => ({ ...value, cursor: state.nextCursor }))}>Показать ещё</button>}
  </div>;
}
function EventFilters({ value, onChange }) {
  const field = (key) => ({ value: value[key] || '', onChange: (event) => onChange({ ...value, [key]: event.target.value, cursor: undefined }) });
  return <section className="card event-filters" aria-label="Фильтры событий">
    <label>Поиск<input placeholder="Заголовок, описание, субъект" {...field('text')} /></label><label>С<input type="date" {...field('dateFrom')} /></label><label>По<input type="date" {...field('dateTo')} /></label>
    <label>Категория<select {...field('category')}><option value="">Все</option>{['MACHINE', 'CUSTOMER', 'PAYMENT', 'INVENTORY', 'MAINTENANCE', 'CONNECTIVITY', 'VIDEO_SURVEILLANCE', 'SECURITY'].map((x) => <option key={x} value={x}>{label(x)}</option>)}</select></label>
    <label>Важность<select {...field('severity')}><option value="">Любая</option>{['INFO', 'BUSINESS', 'WARNING', 'INCIDENT', 'CRITICAL', 'EMERGENCY'].map((x) => <option key={x} value={x}>{label(x)}</option>)}</select></label>
    <label>Статус<select {...field('status')}><option value="">Любой</option>{['NEW', 'SEEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED'].map((x) => <option key={x} value={x}>{label(x)}</option>)}</select></label>
  </section>;
}
function EventRow({ event }) {
  return <article className={`card event-row severity-${event.severity.toLowerCase()}`}><time>{new Date(event.occurredAt).toLocaleString('ru-RU')}</time><div><div className="event-row-badges"><StatusBadge status={event.severity} /><span>{label(event.category)}</span></div><a href={`#event-center/${event.eventId}`}><h2>{event.title}</h2></a><p>{event.summary}</p><small>{event.subjectDisplayName} · {event.sourceDomain}</small></div><div><StatusBadge status={event.processingState?.status || 'NEW'} /><span>{event.acknowledged ? 'Подтверждено' : event.acknowledgementRequired ? 'Требует подтверждения' : 'Подтверждение не требуется'}</span><span>Материалов: {event.evidenceCount || 0}</span></div></article>;
}
export function EventDetail({ eventId, client }) {
  const [state, setState] = useState({ status: 'loading' }); const [comment, setComment] = useState(''); const [tag, setTag] = useState('');
  const load = () => Promise.all([client.getEvent(eventId), client.getEvidence(eventId), client.getComments(eventId)]).then(([event, evidence, comments]) => client.getCorrelation(event.correlationId).then((chain) => setState({ status: 'ready', event, evidence, comments, chain: chain.items })));
  useEffect(() => { load().catch((error) => setState({ status: error.status === 403 ? 'forbidden' : 'error' })); }, [eventId, client]);
  if (state.status === 'loading') return <Skeleton />; if (state.status === 'forbidden') return <ErrorState kind="denied" />; if (state.status === 'error') return <ErrorState />;
  const { event } = state; const action = (work) => work.then(load);
  return <div className="event-detail"><a className="back-link" href="#event-center">← Вернуться к событиям</a><section className="card event-hero"><div><div className="event-row-badges"><StatusBadge status={event.severity} /><span>{label(event.category)}</span></div><h1>{event.title}</h1><p>{event.summary}</p></div><StatusBadge status={event.processingState?.status || 'NEW'} /></section>
    <section className="event-actions"><button onClick={() => action(client.acknowledgeEvent(eventId, 'Подтверждено в консоли'))}>Подтвердить</button><button onClick={() => action(client.setProcessingState(eventId, 'IN_PROGRESS'))}>Взять в работу</button><button onClick={() => action(client.setProcessingState(eventId, 'RESOLVED'))}>Отметить решённым</button><button onClick={() => action(client.setLegalHold(eventId, !event.processingState?.legalHold, 'Решение администратора'))}>{event.processingState?.legalHold ? 'Снять запрет удаления' : 'Установить запрет удаления'}</button></section>
    <section className="detail-grid"><Facts event={event} /><section className="card"><h2>Цепочка операции</h2><EventFeed events={state.chain} groupBy="correlation" compact /></section></section>
    <section className="card"><h2>Связанные материалы</h2>{state.evidence.length ? state.evidence.map((item) => <article key={item.id}><strong>{item.title}</strong><p>{item.description || label(item.evidenceType)}</p></article>) : <EmptyState title="Материалов нет" />}</section>
    <section className="card"><h2>Комментарии</h2>{state.comments.map((item) => <p key={item.id}>{item.body}</p>)}<form onSubmit={(e) => { e.preventDefault(); action(client.addEventComment(eventId, comment)); setComment(''); }}><label>Новый комментарий<textarea value={comment} onChange={(e) => setComment(e.target.value)} required /></label><button>Добавить комментарий</button></form><form onSubmit={(e) => { e.preventDefault(); action(client.addEventTag(eventId, tag)); setTag(''); }}><label>Тег<input value={tag} onChange={(e) => setTag(e.target.value)} required /></label><button>Добавить тег</button></form></section>
    {event.payload && <details className="card"><summary>Технические данные</summary><pre>{JSON.stringify(event.payload, null, 2)}</pre></details>}
  </div>;
}
function Facts({ event }) { return <section className="card"><h2>Сведения о событии</h2><dl className="identity-list"><dt>Время события</dt><dd>{new Date(event.occurredAt).toLocaleString('ru-RU')}</dd><dt>Время получения</dt><dd>{new Date(event.receivedAt).toLocaleString('ru-RU')}</dd><dt>Источник</dt><dd>{event.sourceDomain} / {event.sourceService || 'не указан'}</dd><dt>Основной субъект</dt><dd>{event.subjectDisplayName}</dd><dt>Инициатор</dt><dd>{event.actorDisplayName || event.actorId}</dd><dt>Код события</dt><dd>{event.eventCode}.v{event.eventVersion}</dd><dt>Корреляция</dt><dd>{event.correlationId}</dd></dl></section>; }
export function EventFeed({ events = [], status = 'ready', compact = false, groupBy = 'date' }) {
  if (status === 'loading') return <Skeleton />; if (status === 'error') return <ErrorState />; if (status === 'forbidden') return <ErrorState kind="denied" />; if (status === 'stale') return <div role="status">Данные могли устареть. Обновите страницу.</div>; if (!events.length) return <EmptyState title="Событий пока нет" />;
  const groups = events.reduce((result, event) => { const key = groupBy === 'correlation' ? (event.correlationId || 'Без корреляции') : event.occurredAt.slice(0, 10); (result[key] ||= []).push(event); return result; }, {});
  return <div className={compact ? 'event-feed compact' : 'event-feed'}>{Object.entries(groups).map(([key, items]) => <section key={key}><h3>{groupBy === 'date' ? new Date(key).toLocaleDateString('ru-RU') : `Операция ${key}`}</h3>{items.map((event) => <article key={event.eventId || event.id}><time>{new Date(event.occurredAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</time><div><strong>{event.title}</strong>{!compact && <p>{event.summary}</p>}</div><StatusBadge status={event.severity} /></article>)}</section>)}</div>;
}
