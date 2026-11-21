import React, { useEffect, useMemo, useState } from 'react';
import { DataTable, ErrorState, Skeleton, StatisticCard, StatusBadge } from './components';
import { getInventoryProjection } from './api/inventoryClient';

export function InventoryPage({ client = getInventoryProjection }) {
  const [state, setState] = useState({ status: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    client({ signal: controller.signal }).then((data) => setState({ status: 'ready', data })).catch((error) => {
      if (error.name !== 'AbortError') setState({ status: 'error' });
    });
    return () => controller.abort();
  }, [client]);
  if (state.status === 'loading') return <Skeleton />;
  if (state.status === 'error') return <ErrorState />;
  return <InventoryProjection data={state.data} />;
}

export function InventoryProjection({ data }) {
  const itemById = useMemo(() => Object.fromEntries(data.items.map((item) => [item.id, item])), [data.items]);
  const locationById = useMemo(() => Object.fromEntries(data.locations.map((location) => [location.id, location])), [data.locations]);
  const metrics = data.reservationMetrics || { active: data.reservations.filter((entry) => ['ACTIVE','PENDING','RESERVED'].includes(entry.status)).length, expired: 0, released: 0, consumed: 0, failed: 0, insufficientStock: 0 };
  const lowStock = data.balances.filter((entry) => entry.available <= 0).length;
  const balances = data.balances.map((row) => ({ ...row, id: `${row.itemId}:${row.locationId}`, item: itemById[row.itemId]?.name || row.itemId, location: locationById[row.locationId]?.name || row.locationId }));
  const movements = data.movements.map((row) => ({ ...row, item: itemById[row.itemId]?.name || row.itemId, location: locationById[row.locationId]?.name || row.locationId }));
  return <div className="dashboard">
    <section className="statistics" aria-label="Статистика складского учёта">
      <StatisticCard label="Складские позиции" value={data.items.length} />
      <StatisticCard label="Места хранения" value={data.locations.length} />
      <StatisticCard label="Активные резервы" value={metrics.active} />
      <StatisticCard label="Истёкшие" value={metrics.expired} />
      <StatisticCard label="Освобождённые" value={metrics.released} />
      <StatisticCard label="Списанные" value={metrics.consumed} />
      <StatisticCard label="Ошибки резерва" value={metrics.failed} tone={metrics.failed ? 'warning' : 'success'} />
      <StatisticCard label="Недостаточный остаток" value={metrics.insufficientStock} tone={metrics.insufficientStock ? 'warning' : 'success'} />
      <StatisticCard label="Недоступные остатки" value={lowStock} tone={lowStock ? 'warning' : 'success'} />
    </section>
    <DataTable title="Резервы" rows={data.reservations.map((row) => ({ ...row, id: row.reservationId || row.id, order: row.orderId || '—', machine: row.machineId || '—', location: locationById[row.locationId]?.name || row.locationId, organization: row.organizationId || '—', composition: (row.items || []).map((item) => `${item.ingredientType}: ${item.quantity} ${item.unit}`).join(', ') || '—' }))} columns={[
      { key: 'reservationId', label: 'Резерв' }, { key: 'order', label: 'Заказ' }, { key: 'machine', label: 'Аппарат' }, { key: 'location', label: 'Точка' }, { key: 'organization', label: 'Организация' }, { key: 'operationType', label: 'Тип операции', render: (value) => <StatusBadge status={value} /> }, { key: 'status', label: 'Статус', render: (value) => <StatusBadge status={value} /> }, { key: 'createdAt', label: 'Создан', render: (value) => new Date(value).toLocaleString('ru-RU') }, { key: 'expiresAt', label: 'Истекает', render: (value) => value ? new Date(value).toLocaleString('ru-RU') : '—' }, { key: 'confirmedAt', label: 'Подтверждён', render: (value) => value ? new Date(value).toLocaleString('ru-RU') : '—' }, { key: 'releasedAt', label: 'Освобождён', render: (value) => value ? new Date(value).toLocaleString('ru-RU') : '—' }, { key: 'composition', label: 'Состав' },
    ]} />
    <DataTable title="Текущие остатки" rows={balances} columns={[
      { key: 'item', label: 'Позиция' }, { key: 'location', label: 'Место хранения' },
      { key: 'onHand', label: 'В наличии' }, { key: 'reserved', label: 'В резерве' }, { key: 'available', label: 'Доступно' },
    ]} />
    <DataTable title="Журнал движений" rows={movements} columns={[
      { key: 'occurredAt', label: 'Время', render: (value) => new Date(value).toLocaleString('ru-RU') },
      { key: 'item', label: 'Позиция' }, { key: 'location', label: 'Место хранения' },
      { key: 'movementType', label: 'Тип', render: (value) => <StatusBadge status={value} /> },
      { key: 'delta', label: 'Изменение' }, { key: 'reason', label: 'Причина' },
    ]} />
  </div>;
}
