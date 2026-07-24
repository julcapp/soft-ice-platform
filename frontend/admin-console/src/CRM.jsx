import React, { useEffect, useState } from 'react';
import { getCRMCustomer, getCRMCustomers, getCRMDashboard } from './api/crmClient';
import { DataTable, ErrorState, Skeleton, StatisticCard, StatusBadge } from './components';

const money = (value) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value || 0);
const date = (value) => value ? new Date(value).toLocaleDateString('ru-RU') : 'Нет данных';

export function CRMPage({ route, clients = { getCRMDashboard, getCRMCustomers, getCRMCustomer } }) {
  const customerId = route.split('/')[1];
  const [state, setState] = useState({ status: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    const load = customerId
      ? clients.getCRMCustomer(customerId, { signal: controller.signal })
      : Promise.all([clients.getCRMDashboard({ signal: controller.signal }), clients.getCRMCustomers({ signal: controller.signal })])
        .then(([dashboard, customers]) => ({ dashboard, customers }));
    load.then((data) => setState({ status: 'ready', data })).catch((error) => {
      if (error.name !== 'AbortError') setState({ status: 'error' });
    });
    return () => controller.abort();
  }, [customerId, clients]);
  if (state.status === 'loading') return <Skeleton />;
  if (state.status === 'error') return <ErrorState />;
  return customerId ? <CustomerCard card={state.data} /> : <CRMOverview {...state.data} />;
}

export function CRMOverview({ dashboard, customers }) {
  const summary = dashboard.summary;
  return <div className="crm-workspace">
    <section className="statistics" aria-label="Показатели CRM">
      <StatisticCard label="Клиенты" value={summary.customers} detail={`Активных: ${summary.activeCustomers}`} />
      <StatisticCard label="Покупки" value={summary.purchases} detail={`Выручка: ${money(summary.revenueRub)}`} />
      <StatisticCard label="Бонусы на счетах" value={summary.bonusLiability} detail="Обязательства программы лояльности" />
      <StatisticCard label="Активные акции" value={summary.campaigns} detail={`Уведомлений в очереди: ${summary.queuedNotifications}`} />
    </section>
    <div className="crm-toolbar"><div><h2>Клиенты</h2><p>Единое рабочее место программы «Клуб у Тимоши»</p></div><input aria-label="Поиск клиентов" placeholder="Имя, телефон или почта" /></div>
    <DataTable title="Клиентская база" rows={customers} columns={[
      { key: 'name', label: 'Клиент', render: (value, row) => <a href={`#crm/${row.id}`}>{value}</a> },
      { key: 'phone', label: 'Телефон', render: (value) => value || 'Не указан' },
      { key: 'status', label: 'Статус', render: (value) => <StatusBadge status={String(value).toUpperCase()} /> },
      { key: 'clubBalanceRub', label: 'Клубный счёт', render: money },
      { key: 'bonusBalance', label: 'Бонусы' },
      { key: 'lastPurchaseAt', label: 'Последняя покупка', render: date },
    ]} />
  </div>;
}

export function CustomerCard({ card }) {
  return <div className="crm-workspace customer-card">
    <a className="back-link" href="#crm">← Все клиенты</a>
    <a className="text-button" href={`#customer-360/${card.id}`}>Открыть единый профиль Customer 360</a>
    <section className="card customer-identity"><div><p>Карточка клиента</p><h2>{card.name}</h2><span>{card.phone || 'Телефон не указан'} · {card.email || 'Почта не указана'}</span></div><StatusBadge status={String(card.status).toUpperCase()} /></section>
    <section className="statistics">
      <StatisticCard label="Клубный счёт" value={money(card.loyalty.clubAccount?.availableBalanceRub)} detail={card.loyalty.clubAccount?.status || 'Счёт не открыт'} />
      <StatisticCard label="Бонусный счёт" value={card.loyalty.bonusAccount?.balanceBonus || 0} detail="Бонусов доступно" />
      <StatisticCard label="Покупки" value={card.purchases.length} detail="Последние 50 операций" />
      <StatisticCard label="Рекомендации" value={card.referrals.invited.length} detail="Приглашённых клиентов" />
    </section>
    <section className="crm-grid">
      <DataTable title="История покупок" rows={card.purchases} columns={[
        { key: 'createdAt', label: 'Дата', render: date }, { key: 'status', label: 'Статус', render: (value) => <StatusBadge status={value} /> },
        { key: 'amountPaidRub', label: 'Сумма', render: money }, { key: 'bonusEarned', label: 'Начислено бонусов' },
      ]} />
      <DataTable title="История операций" rows={card.operations} columns={[
        { key: 'postedAt', label: 'Дата', render: date }, { key: 'reason', label: 'Основание' },
        { key: 'direction', label: 'Направление', render: (value) => value === 'credit' ? 'Пополнение' : 'Списание' },
        { key: 'amountRub', label: 'Сумма', render: money },
      ]} />
      <DataTable title="История начислений" rows={card.accruals} columns={[
        { key: 'postedAt', label: 'Дата', render: date }, { key: 'source', label: 'Источник' },
        { key: 'amountBonus', label: 'Бонусы' }, { key: 'reason', label: 'Основание' },
      ]} />
      <DataTable title="Уведомления" rows={card.notifications} columns={[
        { key: 'createdAt', label: 'Дата', render: date }, { key: 'channel', label: 'Канал' },
        { key: 'body', label: 'Сообщение' }, { key: 'status', label: 'Статус', render: (value) => <StatusBadge status={value} /> },
      ]} emptyTitle="Уведомлений ещё нет" />
    </section>
  </div>;
}
