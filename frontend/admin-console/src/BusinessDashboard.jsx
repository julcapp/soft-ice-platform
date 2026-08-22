import React, { useEffect, useMemo, useState } from 'react';
import { ErrorState, Skeleton, StatisticCard, StatusBadge } from './components';
import { getBusinessDashboard } from './api/businessDashboardClient';

const money = (value) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(Number(value || 0));
const pct = (value) => `${Number(value || 0).toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%`;

function defaultRange() {
  const now = new Date();
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const from = new Date(to); from.setUTCDate(from.getUTCDate() - 29);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export function BusinessDashboardPage({ client = getBusinessDashboard }) {
  const initial = useMemo(defaultRange, []);
  const [filters, setFilters] = useState(initial);
  const [applied, setApplied] = useState(initial);
  const [state, setState] = useState({ status: 'loading', data: null });

  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, status: 'loading' }));
    client({ signal: controller.signal, ...applied })
      .then((data) => setState({ status: 'ready', data }))
      .catch((error) => { if (error.name !== 'AbortError') setState({ status: 'error', data: null }); });
    return () => controller.abort();
  }, [client, applied]);

  if (state.status === 'loading' && !state.data) return <Skeleton />;
  if (state.status === 'error') return <ErrorState />;
  const data = state.data;
  if (!data) return null;

  return <div className="dashboard">
    <section className="card" aria-label="Период бизнес-статистики">
      <div className="card-heading"><div><h2>Период</h2><p style={{ margin: '6px 0 0' }}>Выберите даты и примените фильтр ко всем показателям ниже.</p></div><StatusBadge status="LIVE" /></div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
        <label>С<input type="date" value={filters.from} onChange={(e) => setFilters((v) => ({ ...v, from: e.target.value }))} /></label>
        <label>По<input type="date" value={filters.to} onChange={(e) => setFilters((v) => ({ ...v, to: e.target.value }))} /></label>
        <button type="button" onClick={() => setApplied(filters)}>Показать</button>
      </div>
      <small>Фактический диапазон: {data.period.from} — {data.period.to} · {data.period.days} дн.</small>
    </section>

    <section className="statistics" aria-label="Ключевые бизнес-показатели">
      <StatisticCard label="Пользователей в системе" value={data.users.total} detail={`Новых за период: ${data.users.newInPeriod}`} />
      <StatisticCard label="Участников Клуба" value={data.club.membersTotal} detail={`Вступили за период: ${data.club.joinedInPeriod}`} />
      <StatisticCard label="Пополнений / взносов" value={data.club.paidTopupsInPeriod} detail={money(data.club.topupAmountRubInPeriod)} />
      <StatisticCard label="Оплаченных покупок" value={data.sales.paidOrdersInPeriod} detail={`Завершено выдач: ${data.sales.completedOrdersInPeriod}`} />
      <StatisticCard label="Выручка за период" value={money(data.sales.revenueRubInPeriod)} />
      <StatisticCard label="Оплачено, но не забрали" value={data.sales.awaitingPickupCount} detail={money(data.sales.awaitingPickupAmountRub)} tone={data.sales.awaitingPickupCount ? 'warning' : 'neutral'} />
      <StatisticCard label="Принято рефералов" value={data.referrals.acceptedTotal} detail={`Активных с первой покупкой: ${data.referrals.activeTotal}`} />
      <StatisticCard label="Конверсия рефералов" value={pct(data.referrals.conversionToFirstPurchasePct)} />
    </section>

    <section className="card">
      <div className="card-heading"><div><h2>Продажи по дням</h2><p style={{ margin: '6px 0 0' }}>Оплаченные покупки и выручка по календарным дням выбранного периода.</p></div><StatusBadge status="LIVE" /></div>
      <div className="table-scroll"><table><thead><tr><th>Дата</th><th>Покупок</th><th>Выручка</th></tr></thead><tbody>{data.sales.byDay.map((row) => <tr key={row.date}><td>{row.date}</td><td>{row.purchases}</td><td>{money(row.revenueRub)}</td></tr>)}</tbody></table></div>
    </section>

    <section className="statistics" aria-label="Подписки на публичные каналы">
      <StatisticCard label="Подписаны VK" value={data.channels.VK?.subscribed || 0} />
      <StatisticCard label="Подписаны Telegram" value={data.channels.TELEGRAM?.subscribed || 0} />
      <StatisticCard label="Подписаны MAX" value={data.channels.MAX?.subscribed || 0} />
      <StatisticCard label="Лучший реферал" value={data.referrals.topReferrer?.displayName || '—'} detail={data.referrals.topReferrer ? `Активных приглашений за период: ${data.referrals.topReferrer.activeReferrals}` : 'За период активных рефералов нет'} />
    </section>

    <section className="card">
      <div className="card-heading"><div><h2>Реферальная воронка</h2><p style={{ margin: '6px 0 0' }}>Разделяем факт распространения ссылки, принятие приглашения и первую покупку.</p></div><StatusBadge status={data.referrals.linksDistributedStatus} /></div>
      <p><strong>Ссылок роздано:</strong> {data.referrals.linksDistributed ?? 'источник ещё не подключён'}</p>
      <p><strong>Принято приглашений:</strong> {data.referrals.acceptedTotal}</p>
      <p><strong>Стали активными после первой покупки:</strong> {data.referrals.activeTotal}</p>
      {data.referrals.linksDistributedStatus === 'BLOCKED' && <small>Чтобы считать реальные «раздачи», нужно фиксировать отдельное событие share/copy/send referral link. Регистрация по коду не равна факту раздачи ссылки.</small>}
    </section>

    <section className="card">
      <div className="card-heading"><div><h2>Приватный платный канал</h2><p style={{ margin: '6px 0 0' }}>Подписчики, оплаченная сумма и прогноз продлений.</p></div><StatusBadge status={data.privateChannel.status} /></div>
      {data.privateChannel.status === 'BLOCKED' ? <p>Отдельный billing-контур приватной подписки пока не реализован. Поэтому количество платных подписчиков, выручку и прогноз система намеренно не вычисляет из косвенных данных.</p> : <div className="statistics"><StatisticCard label="Платных подписчиков" value={data.privateChannel.subscribers} /><StatisticCard label="Оплачено за период" value={money(data.privateChannel.paidAmountRubInPeriod)} /><StatisticCard label="Прогноз на 30 дней" value={money(data.privateChannel.forecastNext30DaysRub)} /></div>}
    </section>
  </div>;
}
