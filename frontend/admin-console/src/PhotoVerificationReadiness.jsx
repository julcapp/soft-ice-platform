import React, { useEffect, useState } from 'react';
import { getPhotoVerificationReadiness } from './api/photoVerificationClient';
import { DataTable, ErrorState, Skeleton, StatusBadge } from './components';

export function PhotoVerificationReadinessPage({ client = getPhotoVerificationReadiness }) {
  const [state, setState] = useState({ status: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    client({ signal: controller.signal }).then((data) => setState({ status: 'ready', data })).catch((error) => error.name !== 'AbortError' && setState({ status: 'error' }));
    return () => controller.abort();
  }, [client]);
  if (state.status === 'loading') return <Skeleton />;
  if (state.status === 'error') return <ErrorState />;
  const data = state.data;
  return <div className="crm-workspace">
    <section className="card"><div className="card-heading"><div><h2>Готовность к эксплуатации</h2><p style={{ margin: '6px 0 0' }}>Проверка обязательной конфигурации перед включением Photo Verification Agent в production.</p></div><StatusBadge status={data.status} /></div>
      <p><strong>Режим:</strong> {data.mode} · <strong>Модуль:</strong> {data.enabled ? 'включён' : 'выключен'} · <strong>Публикация:</strong> {data.publishingEnabled ? 'включена' : 'выключена'}</p>
      {data.reasons?.length ? <ul>{data.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul> : <p>Обязательных блокирующих причин нет.</p>}
    </section>
    <DataTable title="Проверки readiness" rows={(data.checks || []).map((item) => ({ id: item.code, ...item, requiredLabel: item.required ? 'Да' : 'Нет' }))} columns={[
      { key: 'label', label: 'Компонент' },
      { key: 'requiredLabel', label: 'Обязателен сейчас' },
      { key: 'status', label: 'Статус', render: (value) => <StatusBadge status={value} /> },
      { key: 'message', label: 'Причина / состояние' },
    ]} />
  </div>;
}
