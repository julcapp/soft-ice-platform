import React, { useEffect, useMemo, useState } from 'react';
import { getCRMCustomer, getCRMCustomers, queueCRMNotification } from './api/crmClient';
import { getCustomer360, getCustomerTimeline, getExternalChannels } from './api/customer360Client';
import { DataTable, ErrorState, Skeleton, StatisticCard, StatusBadge } from './components';
import { EventFeed } from './EventCenter';

const money = (value) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(Number(value || 0));
const date = (value) => value ? new Date(value).toLocaleDateString('ru-RU') : '—';
const dateTime = (value) => value ? new Date(value).toLocaleString('ru-RU') : '—';
const channelLabel = (value) => ({ TELEGRAM: 'Telegram', VK: 'VK', MAX: 'MAX' }[value] || value);

export function UsersPage({ route, clients = { getCRMCustomers, getCRMCustomer, getCustomer360, getCustomerTimeline, getExternalChannels, queueCRMNotification } }) {
  const customerId = route.split('/')[1];
  return customerId ? <UserCard customerId={customerId} clients={clients} /> : <UsersDirectory clients={clients} />;
}

function UsersDirectory({ clients }) {
  const [state, setState] = useState({ status: 'loading', rows: [] });
  const [query, setQuery] = useState('');
  const [clubOnly, setClubOnly] = useState(false);
  const [channel, setChannel] = useState('ALL');

  useEffect(() => {
    const controller = new AbortController();
    clients.getCRMCustomers({ signal: controller.signal, query: '', limit: 100 })
      .then((rows) => setState({ status: 'ready', rows }))
      .catch((error) => error.name !== 'AbortError' && setState({ status: 'error', rows: [] }));
    return () => controller.abort();
  }, [clients]);

  const filtered = useMemo(() => state.rows.filter((row) => {
    const haystack = `${row.name || ''} ${row.phone || ''} ${row.email || ''} ${row.id || ''}`.toLowerCase();
    if (query && !haystack.includes(query.toLowerCase())) return false;
    if (clubOnly && !row.clubActive) return false;
    if (channel !== 'ALL' && !(row.activeChannels || []).includes(channel)) return false;
    return true;
  }), [state.rows, query, clubOnly, channel]);

  if (state.status === 'loading') return <Skeleton />;
  if (state.status === 'error') return <ErrorState />;

  return <div className="crm-workspace">
    <section className="card"><div className="card-heading"><div><h2>Пользователи</h2><p style={{ margin: '6px 0 0' }}>Единый слой идентификации, клуба, покупок, рефералов и каналов связи.</p></div><StatusBadge status="LIVE" /></div>
      <div className="crm-toolbar" style={{ marginTop: 12 }}>
        <input aria-label="Поиск пользователей" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Имя, телефон, email или ID" />
        <label><input type="checkbox" checked={clubOnly} onChange={(event) => setClubOnly(event.target.checked)} /> Только участники клуба</label>
        <select aria-label="Фильтр по каналу" value={channel} onChange={(event) => setChannel(event.target.value)}><option value="ALL">Все каналы</option><option value="TELEGRAM">Telegram</option><option value="VK">VK</option><option value="MAX">MAX</option></select>
      </div>
    </section>
    <DataTable title="Таблица пользователей" rows={filtered} columns={[
      { key: 'name', label: 'Пользователь', render: (value, row) => <div><a href={`#users/${row.id}`}><strong>{value}</strong></a><small style={{ display: 'block' }}>{row.id}</small></div> },
      { key: 'phone', label: 'Контакт', render: (value, row) => <div>{value || '—'}<small style={{ display: 'block' }}>{row.email || '—'}</small></div> },
      { key: 'clubActive', label: 'Клуб', render: (value) => <StatusBadge status={value ? 'ACTIVE' : 'INACTIVE'} /> },
      { key: 'clubBalanceRub', label: 'Деньги', render: money },
      { key: 'bonusBalance', label: 'Бонусы' },
      { key: 'purchasesCount', label: 'Покупки' },
      { key: 'referralsCount', label: 'Рефералы' },
      { key: 'activeChannels', label: 'Активные каналы', render: (value = []) => value.length ? value.map(channelLabel).join(' · ') : '—' },
      { key: 'lastPurchaseAt', label: 'Последняя покупка', render: date },
    ]} emptyTitle="Пользователи не найдены" />
  </div>;
}

function UserCard({ customerId, clients }) {
  const [state, setState] = useState({ status: 'loading' });
  const [message, setMessage] = useState('');
  const [channel, setChannel] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      clients.getCRMCustomer(customerId, { signal: controller.signal }),
      clients.getCustomer360(customerId, { signal: controller.signal }),
      clients.getCustomerTimeline(customerId, { signal: controller.signal }),
      clients.getExternalChannels(customerId, { signal: controller.signal }),
    ]).then(([card, profile, timeline, channels]) => {
      const active = [...new Set((card.channelSubscriptions || []).filter((item) => item.isSubscribed).map((item) => String(item.channelType).toUpperCase()).filter((item) => ['TELEGRAM', 'VK', 'MAX'].includes(item)))];
      setState({ status: 'ready', card, profile, timeline, channels, active });
      setChannel(active[0] || '');
    }).catch((error) => error.name !== 'AbortError' && setState({ status: 'error' }));
    return () => controller.abort();
  }, [customerId, clients]);

  if (state.status === 'loading') return <Skeleton />;
  if (state.status === 'error') return <ErrorState />;
  const { card, profile, timeline, active } = state;
  const identities = profile.identification?.identities || card.identities || [];
  const subscriptions = card.channelSubscriptions || [];
  const externalProfiles = card.externalProfiles || [];
  const invited = profile.referrals?.invited || card.referrals?.invited || [];

  async function send() {
    if (!channel || !message.trim()) return;
    setSending(true); setNotice('');
    try {
      await clients.queueCRMNotification(customerId, { channel, body: message.trim() }, { idempotencyKey: `admin-user-message:${customerId}:${channel}:${Date.now()}` });
      setMessage('');
      setNotice(`Сообщение поставлено в очередь CRM: ${channelLabel(channel)}.`);
    } catch (error) {
      setNotice(error.code === 'CRM_CHANNEL_NOT_ACTIVE' ? 'Канал уже не активен. Обновите карточку пользователя.' : 'Не удалось поставить сообщение в очередь.');
    } finally { setSending(false); }
  }

  return <div className="crm-workspace">
    <a className="back-link" href="#users">← Все пользователи</a>
    <section className="card customer-identity"><div><p>Карточка пользователя 360°</p><h2>{profile.identification?.name || card.name || 'Имя не указано'}</h2><span>{profile.identification?.phone || card.phone || 'Телефон не указан'} · {profile.identification?.email || card.email || 'Email не указан'}</span><small style={{ display: 'block', marginTop: 6 }}>Customer ID: {customerId}</small></div><StatusBadge status={String(profile.identification?.status || card.status).toUpperCase()} /></section>

    <section className="statistics" aria-label="Сводка пользователя">
      <StatisticCard label="Денег на клубном счёте" value={money(card.loyalty?.clubAccount?.availableBalanceRub)} detail={`Резерв: ${money(card.loyalty?.clubAccount?.reservedBalanceRub)}`} />
      <StatisticCard label="Бонусов" value={card.loyalty?.bonusAccount?.balanceBonus || 0} />
      <StatisticCard label="Покупок" value={profile.purchaseSummary?.count || card.purchases?.length || 0} detail={`Потрачено: ${money(profile.purchaseSummary?.spentRub)}`} />
      <StatisticCard label="Рефералов" value={invited.length} detail={`Активных: ${invited.filter((item) => item.firstPurchaseAt).length}`} />
      <StatisticCard label="Клуб" value={card.loyalty?.clubAccount?.clubActive ? 'Участник' : 'Не активен'} detail={`С ${date(card.loyalty?.clubAccount?.activatedAt)}`} />
      <StatisticCard label="Активные каналы" value={active.length} detail={active.map(channelLabel).join(' · ') || 'Нет'} />
    </section>

    <section className="crm-grid">
      <DataTable title="Идентификация и ID" rows={identityRows(card, identities, externalProfiles)} columns={[{ key: 'type', label: 'Система' }, { key: 'id', label: 'ID / логин' }, { key: 'status', label: 'Статус', render: (value) => <StatusBadge status={value} /> }, { key: 'verifiedAt', label: 'Подтверждено', render: dateTime }]} emptyTitle="Дополнительные идентификаторы не зафиксированы" />
      <DataTable title="Каналы и подписки" rows={subscriptions.map((item) => ({ id: item.id, channel: channelLabel(String(item.channelType).toUpperCase()), target: item.targetName || item.targetExternalId || '—', subscribed: item.isSubscribed ? 'ACTIVE' : 'INACTIVE', checked: item.lastCheckedAt }))} columns={[{ key: 'channel', label: 'Канал' }, { key: 'target', label: 'Цель' }, { key: 'subscribed', label: 'Подписка', render: (value) => <StatusBadge status={value} /> }, { key: 'checked', label: 'Проверено', render: dateTime }]} />
      <DataTable title="Рефералы пользователя" rows={invited.map((item) => ({ ...item, person: item.referredCustomerId || 'Ещё не зарегистрирован', active: item.firstPurchaseAt ? 'ACTIVE' : 'PENDING' }))} columns={[{ key: 'person', label: 'Пользователь / ID' }, { key: 'referralCode', label: 'Код' }, { key: 'active', label: 'Активность', render: (value) => <StatusBadge status={value} /> }, { key: 'firstPurchaseAt', label: 'Первая покупка', render: dateTime }]} emptyTitle="Рефералов пока нет" />
      <DataTable title="История покупок" rows={profile.purchaseHistory || card.purchases || []} columns={[{ key: 'createdAt', label: 'Дата', render: dateTime }, { key: 'id', label: 'Order ID' }, { key: 'status', label: 'Статус', render: (value) => <StatusBadge status={value} /> }, { key: 'amountPaidRub', label: 'Оплачено', render: money }, { key: 'bonusEarned', label: 'Бонусы' }]} />
      <DataTable title="Операции клубного счёта" rows={card.operations || []} columns={[{ key: 'postedAt', label: 'Дата', render: dateTime }, { key: 'reason', label: 'Основание' }, { key: 'direction', label: 'Тип' }, { key: 'amountRub', label: 'Сумма', render: money }]} />
      <DataTable title="История бонусов" rows={card.accruals || []} columns={[{ key: 'postedAt', label: 'Дата', render: dateTime }, { key: 'source', label: 'Источник' }, { key: 'reason', label: 'Основание' }, { key: 'amountBonus', label: 'Бонусы' }]} />
    </section>

    <section className="card" aria-label="Написать пользователю"><div className="card-heading"><div><h2>Написать пользователю</h2><p style={{ margin: '6px 0 0' }}>Отправка только через подтверждённый активный канал. Сообщение проходит через CRM и сохраняется в истории.</p></div><StatusBadge status={active.length ? 'AVAILABLE' : 'BLOCKED'} /></div>
      {active.length ? <><select aria-label="Канал сообщения" value={channel} onChange={(event) => setChannel(event.target.value)}>{active.map((item) => <option key={item} value={item}>{channelLabel(item)}</option>)}</select><textarea aria-label="Текст сообщения" value={message} onChange={(event) => setMessage(event.target.value)} rows={4} placeholder="Введите сообщение" style={{ width: '100%', marginTop: 10 }} /><button type="button" disabled={sending || !message.trim()} onClick={send} style={{ marginTop: 10 }}>{sending ? 'Отправляем…' : 'Поставить в очередь отправки'}</button></> : <p>Нет подтверждённых активных Telegram / VK / MAX каналов для прямой коммуникации.</p>}
      {notice && <p role="status"><strong>{notice}</strong></p>}
    </section>

    <section className="card"><div className="card-heading"><h2>Полная история пользователя</h2><span>Переходы и связи из Customer 360</span></div><EventFeed events={(timeline || []).map((event) => ({ ...event, eventId: event.eventId || event.id, summary: event.summary || event.description || '', severity: event.severity || 'INFO', correlationId: event.correlationId || customerId }))} /></section>
  </div>;
}

function identityRows(card, identities, externalProfiles) {
  const rows = [];
  if (card.phone) rows.push({ id: `phone:${card.phone}`, type: 'Телефон', idValue: card.phone, status: 'VERIFIED', verifiedAt: null });
  if (card.telegramId || card.telegramUsername) rows.push({ id: 'telegram-root', type: 'Telegram', idValue: card.telegramId || card.telegramUsername, status: card.telegramId ? 'VERIFIED' : 'UNKNOWN', verifiedAt: null });
  if (card.vkProfile) rows.push({ id: 'vk-root', type: 'VK', idValue: card.vkProfile, status: 'UNKNOWN', verifiedAt: null });
  for (const item of identities || []) rows.push({ id: `identity:${item.id}`, type: item.provider, idValue: item.externalUsername || item.externalSubjectHash, status: item.status === 'active' ? 'ACTIVE' : 'INACTIVE', verifiedAt: item.verifiedAt });
  for (const item of externalProfiles || []) rows.push({ id: `profile:${item.id}`, type: item.channelType, idValue: item.externalUserId || item.username || item.profileUrl || '—', status: item.isVerified ? 'VERIFIED' : 'UNKNOWN', verifiedAt: item.verifiedAt });
  return rows.map((row) => ({ ...row, id: row.id, idDisplay: row.idValue, idValue: undefined, idField: row.idValue }));
}
