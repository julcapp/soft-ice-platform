import React, { useEffect, useState } from 'react';
import { getCustomer360, getCustomerTimeline, getExternalChannels, getCustomerEngagement } from './api/customer360Client';
import { DataTable, ErrorState, Skeleton, StatisticCard, StatusBadge } from './components';
import { EventFeed } from './EventCenter';
const money = (value) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value || 0);
const dateTime = (value) => value ? new Date(value).toLocaleString('ru-RU') : 'Нет данных';
export function Customer360Page({ customerId, clients = { getCustomer360, getCustomerTimeline, getExternalChannels, getCustomerEngagement } }) {
  const [state, setState] = useState({ status: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      clients.getCustomer360(customerId, { signal: controller.signal }),
      clients.getCustomerTimeline(customerId, { signal: controller.signal }),
      clients.getExternalChannels(customerId, { signal: controller.signal }),
      clients.getCustomerEngagement(customerId, { signal: controller.signal }),
    ]).then(([profile, timeline, channels, engagement]) => setState({ status: 'ready', profile, timeline, channels, engagement }))
      .catch((error) => error.name !== 'AbortError' && setState({ status: 'error' }));
    return () => controller.abort();
  }, [customerId, clients]);
  if (state.status === 'loading') return <Skeleton />;
  if (state.status === 'error') return <ErrorState />;
  const { profile, timeline, channels, engagement } = state;
  return <div className="crm-workspace">
    <a className="back-link" href="#crm">← Вернуться к клиентам</a>
    <section className="card customer-identity"><div><p>Единый цифровой профиль</p><h2>{profile.identification.name || 'Имя не указано'}</h2><span>{profile.identification.phone || 'Телефон не указан'} · {profile.identification.email || 'Почта не указана'}</span></div><StatusBadge status={String(profile.identification.status).toUpperCase()} /></section>
    <section className="statistics" aria-label="Сводка по клиенту">
      <StatisticCard label="Клубный счёт" value={money(profile.loyalty.clubAccount?.availableBalanceRub)} />
      <StatisticCard label="Покупки" value={profile.purchaseSummary.count} detail={`Потрачено: ${money(profile.purchaseSummary.spentRub)}`} />
      <StatisticCard label="Предпочтения" value={profile.preferences.length} />
      <StatisticCard label="Коммуникации" value={profile.communications.length} />
    </section>
    <ExternalChannels channels={channels} />
    <Engagement summary={engagement} />
    <section className="crm-grid"><DataTable title="Предпочтения" rows={profile.preferences} columns={[{ key: 'category', label: 'Категория' }, { key: 'key', label: 'Параметр' }, { key: 'source', label: 'Источник' }]} emptyTitle="Предпочтения ещё не зафиксированы" /></section>
    <section className="card"><div className="card-heading"><h2>События клиента</h2><span>Единая хронология</span></div><EventFeed events={timeline.map((event) => ({ ...event, eventId: event.eventId || event.id, summary: event.summary || event.description || '', severity: event.severity || 'INFO', correlationId: event.correlationId || customerId }))} /></section>
  </div>;
}
export function ExternalChannels({ channels = [] }) {
  const names = { VK: 'VK', TELEGRAM: 'Telegram', MAX: 'MAX', EMAIL: 'Email', PHONE: 'Телефон', PUSH: 'Push' };
  return <section className="card"><div className="card-heading"><h2>Внешние каналы</h2><span>Профили, подписки и согласия учитываются раздельно</span></div><div className="channel-grid">{channels.filter((x) => names[x.channelType]).map((channel) => <article key={channel.channelType} className="component-card"><div><strong>{names[channel.channelType]}</strong><small>Профилей: {channel.profiles?.length || 0} · Подписок: {channel.subscriptions?.length || 0}</small>{channel.profiles?.some((x) => x.source === 'MANUAL') && <p role="alert">Ручные данные не подтверждены внешним сервисом</p>}{channel.integrationStatus === 'BLOCKED_EXTERNAL' && <p role="alert">Интеграция недоступна: требуются официальные реквизиты</p>}</div><StatusBadge status={channel.profiles?.some((x) => x.isVerified) ? 'VERIFIED' : 'UNKNOWN'} /></article>)}</div></section>;
}
export function Engagement({ summary }) { return <section className="card"><div className="card-heading"><h2>Индекс вовлечённости</h2><StatusBadge status={summary.level} /></div><div className="engagement-score">{summary.score} / 100</div><p>Полнота данных: {summary.dataCompleteness}% · Расчёт: {dateTime(summary.calculatedAt)} · Модель: {summary.modelVersion}</p><ul>{summary.factors.map((factor) => <li key={factor.code}>{factor.explanation}: +{factor.contribution}</li>)}</ul></section>; }
