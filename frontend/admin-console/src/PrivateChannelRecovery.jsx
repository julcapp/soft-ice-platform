import React, { useEffect, useState } from 'react';
import { DataTable, EmptyState, StatusBadge } from './components';
import { expireExhaustedPrivateChannelAccess, getPrivateChannelRecovery, retryPrivateChannelRenewal } from './api/privateChannelRecoveryClient';

const fmt = (value) => value ? new Date(value).toLocaleString('ru-RU') : '—';

export function PrivateChannelRecoveryPage() {
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(null);

  async function load(signal) {
    const data = await getPrivateChannelRecovery({ signal });
    setRows(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).catch((error) => { if (error.name !== 'AbortError') setMessage(error.message); });
    return () => controller.abort();
  }, []);

  async function retry(row) {
    setBusy(row.id); setMessage('');
    try {
      await retryPrivateChannelRenewal(row.id);
      setMessage('Безопасная повторная попытка запущена. Результат платежа подтвердит webhook ЮKassa.');
      await load();
    } catch (error) {
      setMessage(error.message);
    } finally { setBusy(null); }
  }

  async function expireAccess() {
    setBusy('expiry'); setMessage('');
    try {
      const result = await expireExhaustedPrivateChannelAccess();
      setMessage(`Обработано подписок: ${Array.isArray(result) ? result.length : 0}. Физическое удаление участника считается подтверждённым только при доказательстве провайдера.`);
      await load();
    } catch (error) { setMessage(error.message); }
    finally { setBusy(null); }
  }

  const exhausted = rows.filter((row) => row.status === 'EXHAUSTED').length;
  const failed = rows.filter((row) => row.status === 'FAILED').length;

  return <div className="dashboard">
    <section className="statistics" aria-label="Состояние автопродлений">
      <article className="card statistic-card"><p>Ожидают повторной попытки</p><strong>{failed}</strong></article>
      <article className="card statistic-card"><p>Попытки исчерпаны</p><strong>{exhausted}</strong></article>
      <article className="card statistic-card"><p>Всего в recovery</p><strong>{rows.length}</strong></article>
    </section>
    <section className="card">
      <div className="card-heading"><div><h2>Операционное восстановление подписок</h2><p>Telegram и MAX. Финансовый статус и физический доступ контролируются отдельно.</p></div><button type="button" disabled={busy === 'expiry'} onClick={expireAccess}>{busy === 'expiry' ? 'Обрабатываем…' : 'Обработать истёкший доступ'}</button></div>
      {message && <p role="status">{message}</p>}
    </section>
    {rows.length ? <DataTable title="Очередь recovery" rows={rows} columns={[
      { key: 'channelType', label: 'Канал' },
      { key: 'customerName', label: 'Пользователь', render: (value, row) => value || row.customerPhone || row.customerEmail || row.customerId },
      { key: 'planName', label: 'Тариф' },
      { key: 'status', label: 'Статус', render: (value) => <StatusBadge status={value} /> },
      { key: 'attemptCount', label: 'Попыток' },
      { key: 'failureCode', label: 'Последняя ошибка', render: (value, row) => value || row.failureMessage || '—' },
      { key: 'nextRetryAt', label: 'Следующая попытка', render: fmt },
      { key: 'graceUntil', label: 'Grace до', render: fmt },
      { key: 'id', label: 'Действие', render: (_, row) => row.status === 'FAILED' ? <button type="button" disabled={busy === row.id} onClick={() => retry(row)}>{busy === row.id ? 'Повторяем…' : 'Повторить безопасно'}</button> : <span>Нужно действие пользователя</span> },
    ]} /> : <EmptyState title="Очередь восстановления пуста" message="Проблемных автопродлений сейчас нет." />}
  </div>;
}
