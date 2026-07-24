import React from 'react';

export function StatusBadge({ status }) {
  const labels = {
    ACTIVE: 'Активно', APPROVED: 'Одобрено', AVAILABLE: 'Доступно', CLEAR: 'Нет предупреждений',
    COMPLETED: 'Завершено', CONNECTED: 'Подключено', CRITICAL: 'Критично', DELIVERED: 'Доставлено',
    DEMO: 'Демонстрационные данные', FAILED: 'Ошибка', FOUNDATION_ONLY: 'Базовая реализация',
    HEALTHY: 'Исправно', IMMUTABLE: 'Неизменяемая запись', IN_MEMORY_FOUNDATION: 'Данные в памяти',
    LIVE: 'Рабочие данные', OFFLINE: 'Не в сети', ONLINE: 'В сети', PENDING: 'Ожидает',
    READ_ONLY: 'Только чтение', RESERVED: 'Зарезервировано', RUNNING: 'Выполняется',
    STALE: 'Устарело', SUCCESS: 'Успешно', UNAVAILABLE: 'Недоступно', UNKNOWN: 'Неизвестно',
    WARNING: 'Предупреждение',
  };
  return <span className={`status-badge status-${String(status).toLowerCase()}`}>{labels[status] || String(status).replaceAll('_', ' ')}</span>;
}

export function FreshnessIndicator({ freshness }) {
  if (!freshness) return null;
  return <div className="freshness" role="status"><StatusBadge status={freshness.status} /><span>{freshness.message}</span></div>;
}

export function StatisticCard({ label, value, detail, tone = 'neutral' }) {
  return <article className={`card statistic-card tone-${tone}`}><p>{label}</p><strong>{value}</strong>{detail && <small>{detail}</small>}</article>;
}

export function AlertPanel({ alerts = [] }) {
  return <section className="card alert-panel" aria-labelledby="alerts-title"><div className="card-heading"><h2 id="alerts-title">Критические предупреждения</h2><StatusBadge status={alerts.length ? 'CRITICAL' : 'CLEAR'} /></div>{alerts.length ? alerts.map((alert) => <div className="alert-row" key={alert.id}><span>{alert.description || alert.item}</span><StatusBadge status={alert.severity} /></div>) : <EmptyState title="Критических предупреждений нет" />}</section>;
}

function Sparkline({ values = [], label }) {
  if (!values.length) return <EmptyState title="Нет данных для графика" />;
  const max = Math.max(...values, 1);
  const points = values.map((value, index) => `${(index / Math.max(values.length - 1, 1)) * 100},${42 - (value / max) * 36}`).join(' ');
  return <svg className="sparkline" viewBox="0 0 100 48" role="img" aria-label={label}><polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" /></svg>;
}

export function ChartCard({ title, values, summary }) {
  return <section className="card chart-card"><div className="card-heading"><h2>{title}</h2><span>{summary}</span></div><Sparkline values={values} label={`${title}: ${summary}`} /></section>;
}

export function DistributionChart({ items = [] }) {
  const total = items.reduce((sum, item) => sum + item.count, 0) || 1;
  return <section className="card distribution"><div className="card-heading"><h2>Состояние автоматов</h2><span>Автоматов: {total}</span></div>{items.map((item) => <div className="bar-row" key={item.status}><div><StatusBadge status={item.status} /><strong>{item.count}</strong></div><span className="bar"><i style={{ width: `${item.count / total * 100}%` }} /></span></div>)}</section>;
}

export function DataTable({ title, columns, rows = [], emptyTitle = 'В этом разделе пока нет записей' }) {
  return <section className="card table-card"><div className="card-heading"><h2>{title}</h2><span>Записей: {rows.length}</span></div>{rows.length ? <div className="table-scroll"><table><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id}>{columns.map((column) => <td key={column.key}>{column.render ? column.render(row[column.key], row) : row[column.key]}</td>)}</tr>)}</tbody></table></div> : <EmptyState title={emptyTitle} />}</section>;
}

export function EmptyState({ title = 'За выбранный период данных нет', message = 'Здесь пока нечего отображать.' }) {
  return <div className="state empty-state"><span aria-hidden="true">○</span><h2>{title}</h2><p>{message}</p></div>;
}

export function ErrorState({ kind = 'unavailable' }) {
  const copy = {
    denied: ['Доступ запрещён', 'У вашей роли нет разрешения admin.dashboard.read.'],
    unavailable: ['Панель управления недоступна', 'Не удалось получить данные для чтения. Остальные данные платформы не изменены.'],
  }[kind];
  return <div className="state error-state" role="alert"><span aria-hidden="true">!</span><h2>{copy[0]}</h2><p>{copy[1]}</p></div>;
}

export function Skeleton() {
  return <div className="dashboard" aria-label="Загрузка панели управления"><div className="skeleton skeleton-banner" /> <div className="statistics">{Array.from({ length: 8 }, (_, index) => <div className="skeleton skeleton-card" key={index} />)}</div><div className="skeleton skeleton-chart" /></div>;
}

export function PermissionGate({ allowed, children }) {
  return allowed ? children : <ErrorState kind="denied" />;
}

export function Sidebar({ open, onClose }) {
  const items = [{ label: 'Панель управления', href: '#dashboard' }, { label: 'Парк автоматов', href: '#machines' }, { label: 'Цифровой двойник автомата', href: '#machine-twins' }, { label: 'Контур управления автоматами', href: '#machine-runtime' }, { label: 'Складской учёт', href: '#inventory' }, { label: 'Рабочее место оператора', href: '#operators' }, { label: 'Техническое обслуживание', href: '#maintenance' }, { label: 'Платежи', href: '#payments' }, { label: 'Журнал событий', href: '#platform-events' }, { label: 'Хранилище событий', href: '#dead-letter' }];
  return <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}><div className="brand"><span>SI</span><div><strong>Soft ICE</strong><small>Консоль администратора</small></div></div><nav aria-label="Основная навигация"><small className="nav-group">Автоматы</small>{items.map((item, index) => <a href={item.href} key={item.label} onClick={onClose}><span aria-hidden="true">◇</span>{item.label}{![0,2].includes(index) && <small>Базовая версия</small>}</a>)}</nav><div className="readonly-mark">Рабочая область только для чтения</div></aside>;
}

export function Header({ onMenu }) {
  return <header className="header"><button className="menu-button" onClick={onMenu} aria-label="Открыть навигацию">☰</button><label className="search"><span aria-hidden="true">⌕</span><input aria-label="Глобальный поиск" placeholder="Поиск (скоро)" disabled /></label><div className="header-actions"><button className="notification" aria-label="2 уведомления">♢<i>2</i></button><div className="user-menu"><span>АИ</span><div><strong>Александр Ильин</strong><small>Владелец платформы</small></div></div></div></header>;
}

export function PageHeader() {
  return <div className="page-header"><div><p>Обзор работы</p><h1>Панель управления</h1><span>Рабочие интеграции ещё не подключены; раздел доступен только для чтения.</span></div><StatusBadge status="READ_ONLY" /></div>;
}

export function AppShell({ children, navOpen, setNavOpen }) {
  return <div className="app-shell"><a className="skip-link" href="#main">Перейти к панели управления</a><Sidebar open={navOpen} onClose={() => setNavOpen(false)} /><div className="main-column"><Header onMenu={() => setNavOpen(true)} /><main id="main">{children}</main></div>{navOpen && <button className="scrim" aria-label="Закрыть навигацию" onClick={() => setNavOpen(false)} />}</div>;
}
