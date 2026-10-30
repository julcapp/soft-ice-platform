import React, { useEffect, useState } from 'react';
import { DataTable, EmptyState, ErrorState, Skeleton, StatisticCard, StatusBadge } from './components';
import { createTestDispense, getEquipmentSandbox } from './api/equipmentIntegrationClient';

const MACHINE_ID = 'TEST-MACHINE-001';

export function EquipmentSandboxPage({ machineId = MACHINE_ID, client = getEquipmentSandbox, commandClient = createTestDispense }) {
  const [state, setState] = useState({ status: 'loading' });
  const [commandState, setCommandState] = useState('idle');

  const load = async (signal) => {
    try {
      const data = await client(machineId, { signal });
      setState({ status: 'ready', data });
    } catch (error) {
      if (error.name !== 'AbortError') setState({ status: error.status === 401 || error.status === 403 ? 'denied' : 'unavailable' });
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    const timer = window.setInterval(() => load(controller.signal), 5000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [client, machineId]);

  const sendTestDispense = async () => {
    setCommandState('sending');
    try {
      await commandClient(machineId, { product_code: 'ICE_CREAM_BASE', topping_code: 'CHOCOLATE' });
      setCommandState('sent');
      await load();
    } catch (_) {
      setCommandState('failed');
    }
  };

  if (state.status === 'loading') return <Skeleton />;
  if (state.status === 'denied') return <ErrorState kind="denied" />;
  if (state.status === 'unavailable') return <ErrorState />;

  const { data } = state;
  const machine = data.machine;
  const telemetry = data.telemetry?.values || {};
  const events = (data.recent_events || []).map((event) => ({
    id: event.event_id,
    type: event.event_type,
    severity: event.severity,
    error: event.error_code || '—',
    occurredAt: event.timestamp,
  }));

  return <div className="dashboard">
    <section className="card alert-panel" aria-label="Режим данных">
      <div className="card-heading"><h2>Интеграционный стенд оборудования</h2><StatusBadge status="SANDBOX" /></div>
      <p>Тестовые данные контроллера. Не являются производственными показателями и не участвуют в CRM, платежах или программе лояльности.</p>
    </section>

    <section className="statistics" aria-label="Состояние тестового автомата">
      <StatisticCard label="Автомат" value={machine.machine_id} detail={machine.controller_model || 'Модель контроллера не передана'} />
      <StatisticCard label="Состояние" value={machine.status} tone={machine.online ? 'success' : 'warning'} detail={machine.online ? 'Связь установлена' : 'Нет подтверждённой связи'} />
      <StatisticCard label="Успешных выдач" value={data.counters.dispense_success} tone="success" />
      <StatisticCard label="Ошибок выдачи" value={data.counters.dispense_failed} tone="warning" />
      <StatisticCard label="Техническая успешность" value={data.counters.technical_success_rate_percent === null ? '—' : `${data.counters.technical_success_rate_percent}%`} />
      <StatisticCard label="Стаканы" value={telemetry.cups_remaining ?? '—'} detail="Фактическое значение, если контроллер поддерживает датчик/счётчик" />
      <StatisticCard label="Смесь" value={telemetry.mix_level_percent === undefined ? '—' : `${telemetry.mix_level_percent}%`} />
      <StatisticCard label="Температура" value={telemetry.temperature_c === undefined ? '—' : `${telemetry.temperature_c} °C`} />
    </section>

    <section className="card alert-panel">
      <div className="card-heading"><h2>Проверка команды выдачи</h2><StatusBadge status={commandState === 'failed' ? 'FAILED' : data.pending_commands.length ? 'PENDING' : 'CLEAR'} /></div>
      <p>Команда создаётся только из административного контура. Поставщик видит её через Equipment API и возвращает ACK и фактический результат.</p>
      <button type="button" onClick={sendTestDispense} disabled={commandState === 'sending'}>{commandState === 'sending' ? 'Создаём команду…' : 'Создать тестовую выдачу'}</button>
      {commandState === 'sent' && <small>Команда создана. Ожидаем получение контроллером.</small>}
      {commandState === 'failed' && <small>Не удалось создать тестовую команду.</small>}
    </section>

    {events.length ? <DataTable title="Последние события оборудования" rows={events} columns={[
      { key: 'type', label: 'Событие' },
      { key: 'severity', label: 'Важность', render: (value) => <StatusBadge status={value} /> },
      { key: 'error', label: 'Код ошибки' },
      { key: 'occurredAt', label: 'Время', render: (value) => new Date(value).toLocaleString('ru-RU') },
    ]} /> : <EmptyState title="Событий оборудования пока нет" message="После heartbeat, выдачи или ошибки события появятся здесь." />}
  </div>;
}
