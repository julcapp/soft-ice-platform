import React, { useEffect, useMemo, useState } from 'react';
import { createCustomerRefund, getCustomerPaymentProfile } from './api/customer360Client';
import { DataTable, ErrorState, Skeleton, StatusBadge } from './components';

const money = (value) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(Number(value || 0));
const dateTime = (value) => value ? new Date(value).toLocaleString('ru-RU') : '—';
const channelLabel = (value) => ({ TELEGRAM: 'Telegram', MAX: 'MAX', VK: 'VK' }[String(value || '').toUpperCase()] || value || '—');
const methodLabel = (value) => ({ SBP: 'СБП', BANK_CARD: 'Банковская карта', CLUB_BALANCE: 'Внутренний баланс', SBERBANK: 'SberPay', TINKOFF_BANK: 'T-Pay', MOBILE_BALANCE: 'Баланс телефона', UNKNOWN: 'Не зафиксирован' }[String(value || 'UNKNOWN').toUpperCase()] || value || 'Не зафиксирован');
const entityLabel = (entity) => entity ? `${({ ORDER: 'Заказ', CLUB_TOPUP: 'Пополнение клуба', PRIVATE_CHANNEL_SUBSCRIPTION: 'Подписка' }[entity.type] || entity.type)} · ${entity.id}` : '—';

export function UserPaymentProfile({ customerId, client = getCustomerPaymentProfile, refundClient = createCustomerRefund }) {
  const [state, setState] = useState({ status: 'loading' });
  const [refundTarget, setRefundTarget] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundState, setRefundState] = useState({ status: 'idle', message: '' });

  async function load(signal) {
    const data = await client(customerId, { signal });
    setState({ status: 'ready', data });
  }

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).catch((error) => error.name !== 'AbortError' && setState({ status: 'error' }));
    return () => controller.abort();
  }, [customerId, client]);

  const refundable = useMemo(() => {
    if (state.status !== 'ready') return [];
    const refundedBySource = new Map();
    for (const row of state.data.refundHistory || []) {
      if (!['PENDING', 'SUCCEEDED'].includes(String(row.status).toUpperCase())) continue;
      const key = `${row.sourceType}:${row.sourceId}`;
      refundedBySource.set(key, (refundedBySource.get(key) || 0) + Number(row.amountRub || 0));
    }
    return (state.data.paymentHistory || []).filter((row) => ['PAID', 'CONFIRMED', 'SUCCEEDED'].includes(String(row.status).toUpperCase())).map((row) => ({
      ...row,
      remainingRefundRub: Math.max(0, Number(row.amountRub || 0) - Number(refundedBySource.get(`${row.source}:${row.paymentId}`) || 0)),
    })).filter((row) => row.remainingRefundRub > 0);
  }, [state]);

  function chooseRefund(row) {
    setRefundTarget(row);
    setRefundAmount(String(row.remainingRefundRub));
    setRefundReason('');
    setRefundState({ status: 'idle', message: '' });
  }

  async function submitRefund() {
    const amount = Number(refundAmount);
    if (!refundTarget || !(amount > 0) || amount > refundTarget.remainingRefundRub || refundReason.trim().length < 3) return;
    setRefundState({ status: 'sending', message: '' });
    try {
      const result = await refundClient(customerId, { sourceType: refundTarget.source, sourcePaymentId: refundTarget.paymentId, amountRub: amount, reason: refundReason.trim() }, { idempotencyKey: `admin-refund:${customerId}:${refundTarget.source}:${refundTarget.paymentId}:${amount.toFixed(2)}:${Date.now()}` });
      setRefundState({ status: 'success', message: result.status === 'SUCCEEDED' ? 'Возврат выполнен.' : 'Возврат принят в обработку.' });
      setRefundTarget(null); setRefundAmount(''); setRefundReason('');
      await load();
    } catch (error) {
      setRefundState({ status: 'error', message: error.code === 'PAYMENT_REFUND_EXCEEDS_REMAINING' ? 'Сумма превышает доступный остаток возврата. Обновите профиль.' : 'Возврат не выполнен. Проверьте данные и состояние платёжного провайдера.' });
    }
  }

  if (state.status === 'loading') return <section className="card"><h2>Платёжный профиль</h2><Skeleton /></section>;
  if (state.status === 'error') return <section className="card"><h2>Платёжный профиль</h2><ErrorState /></section>;

  const data = state.data;
  return <section className="card" aria-label="Платёжный профиль пользователя">
    <div className="card-heading">
      <div><h2>Платёжный профиль</h2><p style={{ margin: '6px 0 0' }}>Способы оплаты, история платежей, чеки, возвраты, рекуррентные подписки и доказательства согласия. Бонусы не смешиваются с рублями.</p></div>
      <StatusBadge status="ACTIVE" />
    </div>

    <div className="crm-grid" style={{ marginTop: 14 }}>
      <DataTable title="Сохранённые способы оплаты" rows={(data.paymentMethods || []).map((item) => ({ id: item.fingerprint, ...item }))} columns={[
        { key: 'provider', label: 'Провайдер' }, { key: 'type', label: 'Тип', render: () => 'Сохранённый способ оплаты' }, { key: 'maskedReference', label: 'Provider reference' }, { key: 'fingerprint', label: 'Внутренний fingerprint' },
      ]} emptyTitle="Сохранённых способов оплаты нет" />
      <DataTable title="Рекуррентные подписки" rows={data.recurringSubscriptions || []} columns={[
        { key: 'channelType', label: 'Канал', render: channelLabel }, { key: 'planName', label: 'Тариф' }, { key: 'priceRub', label: 'Стоимость', render: money }, { key: 'status', label: 'Статус', render: (value) => <StatusBadge status={String(value || '').toUpperCase()} /> }, { key: 'recurringEnabled', label: 'Автопродление', render: (value) => <StatusBadge status={value ? 'ACTIVE' : 'INACTIVE'} /> }, { key: 'currentPeriodEnd', label: 'Оплачено до', render: dateTime },
      ]} emptyTitle="Рекуррентных подписок нет" />
    </div>

    <DataTable title="Согласия на рекуррентные платежи" rows={(data.recurringSubscriptions || []).filter((item) => item.recurringConsent).map((item) => ({ id: `consent:${item.id}`, channelType: item.channelType, version: item.recurringConsent.version, grantedAt: item.recurringConsent.grantedAt, savedMethod: item.recurringConsent.hasSavedPaymentMethod ? 'VERIFIED' : 'UNKNOWN', recurring: item.recurringEnabled ? 'ACTIVE' : 'INACTIVE' }))} columns={[
      { key: 'channelType', label: 'Канал', render: channelLabel }, { key: 'version', label: 'Версия согласия' }, { key: 'grantedAt', label: 'Дата и время согласия', render: dateTime }, { key: 'savedMethod', label: 'Способ оплаты сохранён', render: (value) => <StatusBadge status={value} /> }, { key: 'recurring', label: 'Автопродление сейчас', render: (value) => <StatusBadge status={value} /> },
    ]} emptyTitle="Согласий на рекуррентные платежи нет" />

    <DataTable title="История платежей" rows={data.paymentHistory || []} columns={[
      { key: 'occurredAt', label: 'Дата', render: dateTime }, { key: 'source', label: 'Источник', render: (value, row) => row.channelType ? `${value} · ${channelLabel(row.channelType)}` : value }, { key: 'kind', label: 'Вид платежа', render: (value) => ({ ONE_TIME: 'Разовый', INITIAL: 'Первичный', RENEWAL: 'Продление' }[value] || value) }, { key: 'paymentMethodType', label: 'Способ оплаты', render: methodLabel }, { key: 'linkedEntity', label: 'Связь', render: entityLabel }, { key: 'provider', label: 'Провайдер' }, { key: 'providerPaymentRef', label: 'Payment reference' }, { key: 'amountRub', label: 'Сумма', render: money }, { key: 'status', label: 'Статус', render: (value) => <StatusBadge status={String(value || '').toUpperCase()} /> },
    ]} emptyTitle="Платежей пока нет" />

    <section className="card" style={{ marginTop: 14 }} aria-label="Оформить возврат"><div className="card-heading"><div><h3>Оформить возврат</h3><p style={{ margin: '6px 0 0' }}>Возврат выполняется только по выбранному платежу, с явной суммой и причиной. Частичные возвраты учитываются отдельно.</p></div><StatusBadge status={refundable.length ? 'AVAILABLE' : 'BLOCKED'} /></div>{refundable.length ? <><select aria-label="Платёж для возврата" value={refundTarget?.id || ''} onChange={(e) => chooseRefund(refundable.find((row) => row.id === e.target.value))}><option value="">Выберите платёж</option>{refundable.map((row) => <option key={row.id} value={row.id}>{dateTime(row.occurredAt)} · {money(row.amountRub)} · доступно {money(row.remainingRefundRub)} · {entityLabel(row.linkedEntity)}</option>)}</select>{refundTarget && <div style={{ display: 'grid', gap: 10, marginTop: 10 }}><label>Сумма возврата<input type="number" min="0.01" step="0.01" max={refundTarget.remainingRefundRub} value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} /></label><small>Максимально доступно: {money(refundTarget.remainingRefundRub)}</small><label>Причина<textarea rows={3} value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder="Причина возврата" /></label><button type="button" disabled={refundState.status === 'sending' || !(Number(refundAmount) > 0) || Number(refundAmount) > refundTarget.remainingRefundRub || refundReason.trim().length < 3} onClick={submitRefund}>{refundState.status === 'sending' ? 'Отправляем…' : 'Подтвердить возврат'}</button></div>}</> : <p>Нет платежей с доступным остатком для возврата.</p>}{refundState.message && <p role="status"><strong>{refundState.message}</strong></p>}</section>

    <div className="crm-grid" style={{ marginTop: 14 }}>
      <DataTable title="Электронные чеки" rows={data.receiptHistory || []} columns={[
        { key: 'issuedAt', label: 'Дата чека', render: dateTime }, { key: 'receiptType', label: 'Тип', render: (value) => value === 'REFUND' ? 'Возврат' : 'Оплата' }, { key: 'linkedEntity', label: 'Связь', render: entityLabel }, { key: 'provider', label: 'Провайдер' }, { key: 'providerReceiptRef', label: 'Receipt reference' }, { key: 'amountRub', label: 'Сумма', render: money }, { key: 'status', label: 'Статус', render: (value) => <StatusBadge status={String(value || '').toUpperCase()} /> }, { key: 'receiptUrl', label: 'Чек', render: (value) => value ? <a href={value} target="_blank" rel="noreferrer">Открыть</a> : '—' },
      ]} emptyTitle="Электронные чеки пока не зафиксированы" />
      <DataTable title="Возвраты" rows={data.refundHistory || []} columns={[
        { key: 'requestedAt', label: 'Запрошен', render: dateTime }, { key: 'linkedEntity', label: 'Связь', render: entityLabel }, { key: 'provider', label: 'Провайдер' }, { key: 'providerRefundRef', label: 'Refund reference' }, { key: 'amountRub', label: 'Сумма возврата', render: money }, { key: 'reason', label: 'Причина' }, { key: 'status', label: 'Статус', render: (value) => <StatusBadge status={String(value || '').toUpperCase()} /> }, { key: 'succeededAt', label: 'Завершён', render: dateTime },
      ]} emptyTitle="Возвратов нет" />
    </div>
  </section>;
}
