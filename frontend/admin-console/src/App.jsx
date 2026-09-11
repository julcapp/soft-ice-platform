import React, { useEffect, useState } from 'react';
import { getDashboard } from './api/dashboardClient';
import { AlertPanel, AppShell, ChartCard, DataTable, DistributionChart, EmptyState, ErrorState, FreshnessIndicator, PageHeader, PermissionGate, Skeleton, StatisticCard, StatusBadge } from './components';
import { MachineTwinsPage } from './MachineTwins';
import { RuntimeMonitorPage } from './RuntimeMonitor';
import { EventStreamPage } from './EventStream';
import { InventoryPage } from './Inventory';
import { MaintenancePage } from './Maintenance';
import { CRMPage } from './CRM';
import { Customer360Page } from './Customer360';
import { UsersPage } from './Users';
import { EventCenterPage } from './EventCenter';
import { GiftTransfersPage } from './GiftTransfers';
import { EquipmentSandboxPage } from './EquipmentSandbox';
import { getGiftTransfers } from './api/giftTransferClient';
import { OrganizationsPage } from './Organizations';
import { TransactionalOutboxPage } from './TransactionalOutbox';
import { PhotoVerificationSettingsPage } from './PhotoVerificationSettings';
import { PhotoModerationQueuePage } from './PhotoModerationQueue';
import { PhotoVerificationMetricsPage } from './PhotoVerificationMetrics';
import { PhotoVerificationReadinessPage } from './PhotoVerificationReadiness';
import { BusinessDashboardPage } from './BusinessDashboard';
import { PrivateChannelRecoveryPage } from './PrivateChannelRecovery';
import { PromotionEnginePage } from './PromotionEngine';
import { PaymentsPage } from './Payments';
import { MachineDispensesPage } from './MachineDispenses';
import { AccountSecurityPage } from './AccountSecurity';

const money = (value, currency = 'RUB') => new Intl.NumberFormat('ru-RU', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
const statusColumn = { key: 'status', label: 'Статус', render: (value) => <StatusBadge status={value} /> };
const dateColumn = { key: 'occurredAt', label: 'Время', render: (value) => new Date(value).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) };

export function Dashboard({ data }) {
  const s = data.summary;
  const critical = data.recentEvents.filter((event) => event.severity === 'CRITICAL');
  const isEmpty = !s.salesToday && !data.recentEvents.length;
  if (isEmpty) return <EmptyState />;
  return <div className="dashboard">
    <FreshnessIndicator freshness={data.freshness} />
    <section className="card" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}><div><strong>Бизнес-статистика</strong><p style={{ margin: '6px 0 0' }}>Пользователи, клуб, рефералы, подписки, продажи и незабранные заказы.</p></div><a className="text-button" href="#business-analytics">Открыть бизнес-дашборд</a></section>
    <section className="card" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}><div><strong>Пользователи</strong><p style={{ margin: '6px 0 0' }}>Единая таблица пользователей и глубокие карточки Customer 360°.</p></div><a className="text-button" href="#users">Открыть пользователей</a></section>
    <section className="card" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}><div><strong>Приватные подписки</strong><p style={{ margin: '6px 0 0' }}>Recovery автопродлений Telegram / MAX, grace period и проблемы доступа.</p></div><a className="text-button" href="#private-channel-recovery">Открыть recovery</a></section>
    <section className="card" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}><div><strong>Проверка и публикация фотографий</strong><p style={{ margin: '6px 0 0' }}>AI-модерация, антидубли и публикации VK / Telegram / MAX.</p></div><div><a className="text-button" href="#photo-verification">Открыть модерацию</a> <a className="text-button" href="#photo-verification-readiness">Проверить готовность</a></div></section>
    <AlertPanel alerts={critical} />
    <section className="statistics" aria-label="Статистика за сегодня">
      <StatisticCard label="Выручка за сегодня" value={money(s.revenueToday.value, s.revenueToday.currency)} detail="Демонстрационная оценка валовой выручки" />
      <StatisticCard label="Продажи за сегодня" value={s.salesToday} detail="Оплаченные заказы" />
      <StatisticCard label="Автоматы в сети / всего" value={`${s.machinesOnline} / ${s.machinesTotal}`} tone="success" />
      <StatisticCard label="Требуют внимания" value={s.machinesRequiringAttention} tone="warning" />
      <StatisticCard label="Критические предупреждения" value={s.criticalAlerts} tone="critical" />
      <StatisticCard label="Заканчиваются стаканчики" value={s.lowCupStock} tone="warning" />
      <StatisticCard label="Заканчиваются ингредиенты" value={s.lowIngredientStock} tone="warning" />
      <StatisticCard label="Активные операторы" value={data.operatorSummary.active} tone="success" />
      <StatisticCard label="Ожидают согласования" value={data.operatorSummary.pendingServiceApprovals} detail="Очередь только для чтения" />
    </section>
    <section className="charts"><ChartCard title="Динамика продаж" values={data.paymentSummary.salesTrend} summary="Последние 7 периодов" /><ChartCard title="Динамика выручки" values={data.paymentSummary.revenueTrend} summary="Рубли, последние 7 периодов" /><DistributionChart items={data.machineStatus.distribution} /></section>
    <section className="tables"><DataTable title="Требует внимания на складе" rows={data.inventoryAlerts} columns={[{ key: 'machine', label: 'Автомат' }, { key: 'item', label: 'Позиция' }, { key: 'level', label: 'Остаток' }, { key: 'severity', label: 'Важность', render: (value) => <StatusBadge status={value} /> }]} /><DataTable title="Последние работы по обслуживанию" rows={data.maintenanceSummary} columns={[{ key: 'machine', label: 'Автомат' }, { key: 'activity', label: 'Работа' }, statusColumn, dateColumn]} /><DataTable title="Последние платежи" rows={data.paymentSummary.recent} columns={[{ key: 'machine', label: 'Автомат' }, { key: 'amount', label: 'Сумма', render: (value, row) => money(value, row.currency) }, statusColumn, dateColumn]} /><DataTable title="Последние события платформы" rows={data.recentEvents} columns={[{ key: 'type', label: 'Событие' }, { key: 'description', label: 'Описание' }, { key: 'severity', label: 'Важность', render: (value) => <StatusBadge status={value} /> }, dateColumn]} /></section>
  </div>;
}

export function App({ client = getDashboard }) {
  const [state, setState] = useState({ status: 'loading' });
  const [navOpen, setNavOpen] = useState(false);
  const [route, setRoute] = useState(() => window.location.hash.slice(1));
  useEffect(() => { const controller = new AbortController(); client({ signal: controller.signal }).then((data) => setState({ status: 'ready', data })).catch((error) => { if (error.name !== 'AbortError') setState({ status: error.status === 401 || error.status === 403 ? 'denied' : 'unavailable' }); }); return () => controller.abort(); }, [client]);
  useEffect(() => { const update = () => setRoute(window.location.hash.slice(1)); window.addEventListener('hashchange', update); return () => window.removeEventListener('hashchange', update); }, []);
  const twinRoute = route.startsWith('machine-twins');
  const runtimeRoute = route.startsWith('machine-runtime');
  const equipmentSandboxRoute = route === 'equipment-sandbox';
  const eventRoute = route.startsWith('platform-events') || route === 'dead-letter';
  const inventoryRoute = route === 'inventory';
  const maintenanceRoute = route === 'maintenance';
  const usersRoute = route === 'users' || route.startsWith('users/');
  const crmRoute = route === 'crm' || route.startsWith('crm/');
  const customer360Route = route.startsWith('customer-360/');
  const eventCenterRoute = route === 'event-center' || route.startsWith('event-center/');
  const giftTransferRoute = route === 'gift-transfers';
  const organizationRoute = route === 'organizations' || route.startsWith('organizations/');
  const outboxRoute = route === 'transactional-outbox';
  const promotionRoute = route === 'promotions' || route.startsWith('promotions/');
  const machineDispensesRoute = route === 'machine-dispenses';
  const paymentsRoute = route === 'payments';
  const photoVerificationRoute = route === 'photo-verification';
  const photoReadinessRoute = route === 'photo-verification-readiness';
  const businessAnalyticsRoute = route === 'business-analytics';
  const privateChannelRecoveryRoute = route === 'private-channel-recovery';
  const accountSecurityRoute = route === 'account-security';
  if (accountSecurityRoute) return <AppShell navOpen={navOpen} setNavOpen={setNavOpen}><ReadHeader group="Личный кабинет" title="Безопасность учётной записи" copy="Профиль владельца, защита входа, каналы подтверждения и административные сессии." editable /><AccountSecurityPage /></AppShell>;
  if (machineDispensesRoute) return <AppShell navOpen={navOpen} setNavOpen={setNavOpen}><ReadHeader group="Автоматы" title="Выдачи аппаратов" copy="Физические операции, callback и сверка. Только чтение; опасного повтора выдачи нет." /><MachineDispensesPage /></AppShell>;
  if (paymentsRoute) return <AppShell navOpen={navOpen} setNavOpen={setNavOpen}><ReadHeader group="Финансы" title="Платежи" copy="Денежный lifecycle, возвраты и расхождения сверки. Только чтение." /><PaymentsPage /></AppShell>;
  if (promotionRoute) return <AppShell navOpen={navOpen} setNavOpen={setNavOpen}><ReadHeader group="Коммерция" title="Promotion Engine" copy="Управление акциями, безопасностью, согласованием, каналами и аналитикой." editable /><PromotionEnginePage /></AppShell>;
  if (businessAnalyticsRoute) return <AppShell navOpen={navOpen} setNavOpen={setNavOpen}><ReadHeader group="Бизнес" title="Бизнес-статистика" copy="Пользователи, Клуб Тимоши, рефералы, подписки, продажи, пополнения и предоплаченные заказы." /><BusinessDashboardPage /></AppShell>;
  if (privateChannelRecoveryRoute) return <AppShell navOpen={navOpen} setNavOpen={setNavOpen}><ReadHeader group="Подписки" title="Восстановление приватных каналов" copy="Автопродления Telegram / MAX, льготный период, повторные попытки и состояние доступа." editable /><PrivateChannelRecoveryPage /></AppShell>;
  if (usersRoute) return <AppShell navOpen={navOpen} setNavOpen={setNavOpen}><ReadHeader group="Клиенты" title={route.includes('/') ? 'Карточка пользователя' : 'Пользователи'} copy="Единый реестр пользователей: идентификация, клуб, деньги, бонусы, покупки, рефералы, каналы и история." editable={route.includes('/')} /><UsersPage route={route} /></AppShell>;
  if (photoReadinessRoute) return <AppShell navOpen={navOpen} setNavOpen={setNavOpen}><ReadHeader group="Контент и UGC" title="Готовность к работе" copy="Обязательная конфигурация агента проверки фотографий и причины готовности, ограниченной работы или блокировки." /><PhotoVerificationReadinessPage /></AppShell>;
  if (photoVerificationRoute) return <AppShell navOpen={navOpen} setNavOpen={setNavOpen}><ReadHeader group="Контент и UGC" title="Проверка фотографий" copy="Очередь ручной модерации, AI-сигналы, антидубли, публикации и настройки." editable /><section className="card"><a className="text-button" href="#photo-verification-readiness">Проверить готовность →</a></section><PhotoVerificationMetricsPage /><PhotoModerationQueuePage /><PhotoVerificationSettingsPage /></AppShell>;
  if (outboxRoute) return <AppShell navOpen={navOpen} setNavOpen={setNavOpen}><ReadHeader group="Платформа" title="Очередь надёжной доставки событий" copy="Надёжная очередь событий Sale Flow, повторы и диагностика недоставленных событий." /><TransactionalOutboxPage /></AppShell>;
  if (organizationRoute) return <AppShell navOpen={navOpen} setNavOpen={setNavOpen}><ReadHeader group="Организация 360" title={route.includes('/') ? 'Карточка организации' : 'Организации'} copy="Единый организационный контекст подразделений, сотрудников, точек, аппаратов и ответственности." /><OrganizationsPage route={route} /></AppShell>;
  if (giftTransferRoute) return <AppShell navOpen={navOpen} setNavOpen={setNavOpen}><ReadHeader group="Клиенты" title="Подарки и приглашения" copy="Передачи оплаченных заказов, приглашения, получение и реферальная конверсия." /><GiftTransfersPage client={getGiftTransfers} /></AppShell>;
  if (eventCenterRoute) return <AppShell navOpen={navOpen} setNavOpen={setNavOpen}><ReadHeader group="Платформа" title={route.includes('/') ? 'Событие' : 'Центр событий'} copy="Единая нормализованная история событий платформы." /><EventCenterPage route={route} /></AppShell>;
  if (customer360Route) return <AppShell navOpen={navOpen} setNavOpen={setNavOpen}><ReadHeader group="Клиенты" title="Карточка клиента 360°" copy="Единый цифровой профиль и хронологический журнал всех событий клиента." /><Customer360Page customerId={route.split('/')[1]} /></AppShell>;
  if (crmRoute) return <AppShell navOpen={navOpen} setNavOpen={setNavOpen}><ReadHeader group="Клиенты" title="CRM Soft ICE" copy="Клиенты, программа лояльности, сегменты, акции и уведомления." /><CRMPage route={route} /></AppShell>;
  if (equipmentSandboxRoute) return <AppShell navOpen={navOpen} setNavOpen={setNavOpen}><ReadHeader group="Автоматы" title="Тестовый стенд оборудования" copy="Телеметрия, команды и фактические результаты выдачи от внешнего контроллера." /><EquipmentSandboxPage /></AppShell>;
  const page = twinRoute ? <><ReadHeader group="Автоматы" title="Цифровой двойник автомата" copy="Достоверные проекции автоматов только для чтения." /><MachineTwinsPage route={route} /></> : runtimeRoute ? <><ReadHeader group="Автоматы" title="Контур управления автоматами" copy="Состояние, команды и контроль исполнения операций оборудования." /><RuntimeMonitorPage route={route} /></> : eventRoute ? <><ReadHeader group="Платформа" title={route === 'dead-letter' ? 'Хранилище недоставленных событий' : 'Журнал доставки'} copy="Контроль доставки и диагностика событий платформы." /><EventStreamPage route={route} /></> : inventoryRoute ? <><ReadHeader group="Операционная работа" title="Складской учёт" copy="Остатки, пополнения, резервирование и контроль расходных материалов." /><InventoryPage /></> : maintenanceRoute ? <><ReadHeader group="Операционная работа" title="Техническое обслуживание" copy="Плановое и корректирующее обслуживание, согласования, подтверждения и показатели." /><MaintenancePage /></> : <><PageHeader />{state.status === 'loading' ? <Skeleton /> : state.status === 'ready' ? <Dashboard data={state.data} /> : <ErrorState kind={state.status} />}</>;
  return <AppShell navOpen={navOpen} setNavOpen={setNavOpen}>{page}</AppShell>;
}

function ReadHeader({ group, title, copy, editable = false }) {
  return <div className="page-header"><div><p>{group}</p><h1>{title}</h1><span>{copy}</span></div><StatusBadge status={editable ? 'MANAGED' : 'READ_ONLY'} /></div>;
}
