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
  const activeReservations = data.reservations.filter((entry) => entry.status === 'ACTIVE').length;
  const lowStock = data.balances.filter((entry) => entry.available <= 0).length;
  const balances = data.balances.map((row) => ({ ...row, id: `${row.itemId}:${row.locationId}`, item: itemById[row.itemId]?.name || row.itemId, location: locationById[row.locationId]?.name || row.locationId }));
  const movements = data.movements.map((row) => ({ ...row, item: itemById[row.itemId]?.name || row.itemId, location: locationById[row.locationId]?.name || row.locationId }));
  return <div className="dashboard">
    <section className="statistics" aria-label="Статистика складского учёта">
      <StatisticCard label="Складские позиции" value={data.items.length} />
      <StatisticCard label="Места хранения" value={data.locations.length} />
      <StatisticCard label="Активные резервы" value={activeReservations} />
      <StatisticCard label="Недоступные остатки" value={lowStock} tone={lowStock ? 'warning' : 'success'} />
    </section>
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
