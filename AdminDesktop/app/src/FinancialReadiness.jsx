import React, { useEffect, useState } from 'react';
import { ErrorState, Skeleton, StatusBadge } from './components';
import { getFinancialReadiness } from './api/businessDashboardClient';

export function FinancialReadinessPanel({ client = getFinancialReadiness }) {
  const [state, setState] = useState({ status: 'loading', data: null });
  useEffect(() => {
    const controller = new AbortController();
    client({ signal: controller.signal }).then((data) => setState({ status: 'ready', data })).catch((error) => error.name !== 'AbortError' && setState({ status: 'error', data: null }));
    return () => controller.abort();
  }, [client]);
  if (state.status === 'loading') return <section className="card"><h2>Финансовый production-readiness</h2><Skeleton /></section>;
  if (state.status === 'error') return <section className="card"><h2>Финансовый production-readiness</h2><ErrorState /></section>;
  const data = state.data;
  return <section className="card" aria-label="Финансовый production-readiness">
    <div className="card-heading"><div><h2>Финансовый production-readiness</h2><p style={{ margin: '6px 0 0' }}>ЮKassa, чеки, webhook, email и сверка комиссий. READY только когда обязательные контуры подтверждены.</p></div><StatusBadge status={data.status} /></div>
    <div className="table-scroll" style={{ marginTop: 12 }}><table><thead><tr><th>Проверка</th><th>Статус</th><th>Комментарий</th></tr></thead><tbody>{(data.checks || []).map((item) => <tr key={item.code}><td>{item.title}</td><td><StatusBadge status={item.status} /></td><td>{item.detail}</td></tr>)}</tbody></table></div>
    <p><strong>Правило:</strong> комиссия платёжного провайдера учитывается как расход проекта. Автоматическая надбавка к цене клиента и автоматическое удержание комиссии из возврата отключены.</p>
  </section>;
}
