import React, { useEffect, useState } from 'react';
import { ErrorState, Skeleton, StatisticCard, StatusBadge } from './components';
import { getFinancialDayClose } from './api/businessDashboardClient';

const money = (value) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 }).format(Number(value || 0));

function moscowYesterday() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const date = new Date(`${values.year}-${values.month}-${values.day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function FinancialDayClosePanel({ client = getFinancialDayClose }) {
  const [date, setDate] = useState(moscowYesterday);
  const [applied, setApplied] = useState(date);
  const [state, setState] = useState({ status: 'loading', data: null });
  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, status: 'loading' }));
    client({ reportDate: applied, signal: controller.signal }).then((data) => setState({ status: 'ready', data })).catch((error) => { if (error.name !== 'AbortError') setState({ status: 'error', data: null }); });
    return () => controller.abort();
  }, [client, applied]);
  if (state.status === 'loading' && !state.data) return <Skeleton />;
  if (state.status === 'error') return <ErrorState />;
  const data = state.data; if (!data) return null;
  const checks = [
    ['Реестр платежей', data.checks.paymentsReportReceived],
    ['Реестр возвратов', data.checks.refundsReportReceived],
    ['Оба реестра получены в контроле ожиданий', data.checks.expectationsReceived],
    ['Сверка реестров без ошибок', data.checks.reportsReconciledWithoutIssues],
    ['Нет открытых расхождений', data.checks.noOpenIssues],
  ];
  const openAlerts = data.operationsAlerts?.open || [];
  return <section className="card" aria-label="Финансовое закрытие дня">
    <div className="card-heading"><div><h2>Финансовое закрытие дня</h2><p style={{ margin: '6px 0 0' }}>Автоматическое закрытие по официальным реестрам ЮKassa. Ручной override статуса отсутствует.</p></div><StatusBadge status={data.status === 'CLOSED' ? 'READY' : 'WARNING'} /></div>
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', marginBottom: 16 }}><label>Финансовый день<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label><button type="button" onClick={() => setApplied(date)}>Показать</button><strong style={{ marginLeft: 'auto' }}>{data.statusLabel}</strong></div>
    {openAlerts.length > 0 && <div style={{ marginBottom: 16 }}><h3>Требуют внимания</h3>{openAlerts.map((item) => <div className="card" key={item.id} style={{ marginTop: 8 }}><div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}><div><strong>{item.title}</strong><p style={{ margin: '6px 0 0' }}>{item.body}</p></div><StatusBadge status={item.severity} /></div></div>)}</div>}
    <div className="statistics"><StatisticCard label="Списано с клиентов" value={money(data.totals.grossPaymentsRub)} /><StatisticCard label="Комиссия ЮKassa" value={money(data.totals.processorCommissionRub)} /><StatisticCard label="НДС с комиссии" value={money(data.totals.processorCommissionVatRub)} /><StatisticCard label="Расходы провайдера" value={money(data.totals.processorCostTotalRub)} /><StatisticCard label="К зачислению" value={money(data.totals.netSettlementRub)} /><StatisticCard label="Возвраты" value={money(data.totals.refundsRub)} /><StatisticCard label="Денежный остаток" value={money(data.totals.netCashAfterRefundsRub)} /></div>
    <div className="table-scroll"><table><thead><tr><th>Контроль</th><th>Статус</th></tr></thead><tbody>{checks.map(([label, ok]) => <tr key={label}><td>{label}</td><td><StatusBadge status={ok ? 'READY' : 'WARNING'} /></td></tr>)}</tbody></table></div>
    <div className="table-scroll" style={{ marginTop: 16 }}><table><thead><tr><th>Реестр</th><th>Ожидание</th><th>Файл</th><th>Строк</th><th>Совпало</th><th>Нет локально</th><th>Расхождения</th></tr></thead><tbody>{[['Платежи', data.reports.payments], ['Возвраты', data.reports.refunds]].map(([label, row]) => <tr key={label}><td>{label}</td><td>{row.expectationStatus}</td><td>{row.fileName || '—'}</td><td>{row.rowsTotal}</td><td>{row.rowsMatched}</td><td>{row.rowsMissingLocal}</td><td>{row.rowsMismatch}</td></tr>)}</tbody></table></div>
    {data.reconciliation.openIssues > 0 && <div style={{ marginTop: 16 }}><h3>Открытые расхождения: {data.reconciliation.openIssues}</h3><div className="table-scroll"><table><thead><tr><th>Важность</th><th>Тип</th><th>Операция</th><th>Платёж</th><th>Файл</th></tr></thead><tbody>{data.reconciliation.issues.map((item) => <tr key={item.id}><td><StatusBadge status={item.severity} /></td><td>{item.issueType}</td><td>{item.providerOperationId || '—'}</td><td>{item.providerPaymentId || '—'}</td><td>{item.fileName || '—'}</td></tr>)}</tbody></table></div></div>}
  </section>;
}
