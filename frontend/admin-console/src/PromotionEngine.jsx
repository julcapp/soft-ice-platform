import React, { useEffect, useMemo, useState } from 'react';
import { promotionClient } from './api/promotionClient';
import { PromotionEditor } from './PromotionEditor';
import './promotion-engine.css';

const fmtMoney = (value) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(Number(value || 0));
const fmtTime = (value) => value ? new Date(value).toLocaleString('ru-RU') : '—';
const DAY = { 1: 'Пн', 2: 'Вт', 3: 'Ср', 4: 'Чт', 5: 'Пт', 6: 'Сб', 7: 'Вс' };

function Status({ value }) { return <span className={`pe-status pe-${String(value || 'unknown').toLowerCase()}`}>{value || 'UNKNOWN'}</span>; }
function Metric({ label, value, detail }) { return <article className="pe-metric"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</article>; }

export function PromotionEnginePage() {
  const [state, setState] = useState({ status: 'loading', campaigns: [] });
  const [selectedId, setSelectedId] = useState(null);
  const [campaign, setCampaign] = useState(null);
  const [approvals, setApprovals] = useState([]);
  const [funnel, setFunnel] = useState({ channels: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function loadList() {
    try {
      const campaigns = await promotionClient.list();
      setState({ status: 'ready', campaigns });
      setSelectedId((current) => current || campaigns?.[0]?.id || null);
    } catch (e) { setState({ status: 'error', campaigns: [] }); setError(e); }
  }

  async function loadDetail(id = selectedId) {
    if (!id) return;
    try {
      const [nextCampaign, nextApprovals] = await Promise.all([promotionClient.get(id), promotionClient.approvals(id)]);
      const nextFunnel = await promotionClient.funnel(id, nextCampaign?.effectiveVersion?.id || nextCampaign?.currentVersion?.id);
      setCampaign(nextCampaign); setApprovals(nextApprovals || []); setFunnel(nextFunnel || { channels: [] }); setError(null);
    } catch (e) { setError(e); }
  }

  async function reload(id = selectedId) { await loadList(); await loadDetail(id); }
  useEffect(() => { loadList(); }, []);
  useEffect(() => { if (selectedId) loadDetail(selectedId); }, [selectedId]);

  async function act(action, payload) {
    if (!campaign || busy) return;
    setBusy(true); setError(null);
    try { await promotionClient[action](campaign.id, payload); await reload(campaign.id); }
    catch (e) { setError(e); }
    finally { setBusy(false); }
  }

  const version = campaign?.currentVersion;
  const servingVersion = campaign?.effectiveVersion;
  const approved = useMemo(() => approvals.filter((row) => row.status === 'APPROVED').length, [approvals]);
  const schedule = version?.schedules || [];
  const channelRows = funnel?.channels || funnel || [];
  const budget = Number(version?.budgetAmount || 0);
  const spent = channelRows.reduce((sum, row) => sum + Number(row.discountAmount || 0), 0);
  const budgetPct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;

  if (state.status === 'loading') return <div className="pe-loading">Загружаем Promotion Engine…</div>;
  if (state.status === 'error') return <div className="pe-error">Не удалось загрузить кампании Promotion Engine.</div>;
  if (!state.campaigns.length) return <div className="pe-empty"><h2>Акций пока нет</h2><p>Создайте DRAFT через Promotion API, после чего он появится здесь.</p></div>;

  return <div className="pe-shell">
    <aside className="pe-list">
      <div className="pe-list-head"><h3>Кампании</h3><span>{state.campaigns.length}</span></div>
      {state.campaigns.map((item) => <button key={item.id} className={item.id === selectedId ? 'is-active' : ''} onClick={() => setSelectedId(item.id)}>
        <span><strong>{item.name}</strong><small>{item.code}</small></span><Status value={item.status} />
      </button>)}
    </aside>

    <section className="pe-main">
      {campaign && <>
        <header className="pe-hero">
          <div><p>Promotion Engine · working v{version?.version}{servingVersion ? ` · effective v${servingVersion.version}` : ''}</p><h1>{campaign.name}</h1><span>{campaign.description || 'Управление коммерческой акцией и её каналами.'}</span></div>
          <div className="pe-hero-status"><Status value={campaign.status} /><small>Рабочая версия: <b>{version?.status || campaign.status}</b></small><small>Обновлено {fmtTime(campaign.updatedAt)}</small></div>
        </header>

        {error && <div className="pe-alert"><strong>{error.code || 'Ошибка'}</strong><span>{error.message}</span></div>}

        <PromotionEditor campaign={campaign} approvals={approvals} onChanged={() => reload(campaign.id)} />

        <section className="pe-metrics">
          <Metric label="Скидка" value={`${Number(version?.benefitValue || 0)}%`} detail={version?.benefitType} />
          <Metric label="Price lock" value={`${version?.priceLockSeconds || 300} сек`} detail="серверная фиксация цены" />
          <Metric label="Согласование" value={`${approved}`} detail={version?.approvalPolicy || 'NONE'} />
          <Metric label="Минимальная цена" value={version?.minimumFinalPrice == null ? '—' : fmtMoney(version.minimumFinalPrice)} detail="safety floor" />
        </section>

        <section className="pe-grid">
          <article className="pe-card pe-control">
            <div className="pe-card-title"><div><p>Операционный контур</p><h2>Действующая акция</h2></div><Status value={campaign.status} /></div>
            <div className="pe-actions">
              <button disabled={busy || !['READY','SCHEDULED'].includes(version?.status || campaign.status)} onClick={() => act('runNow', 120)}>▶ Run now · 120 мин</button>
              <button disabled={busy || campaign.status !== 'ACTIVE'} onClick={() => act('pause', 'Пауза из админ-панели')}>Ⅱ Пауза</button>
              <button disabled={busy || campaign.status !== 'PAUSED'} onClick={() => act('resume', 'Возобновление из админ-панели')}>Продолжить</button>
              <button disabled={busy || !['SCHEDULED','ACTIVE','PAUSED'].includes(campaign.status)} onClick={() => act('emergencyStop', 'Emergency Stop из Promotion Engine Console')}>■ Emergency Stop</button>
              <button disabled={busy || !['SCHEDULED','ACTIVE','PAUSED','PAUSED_BY_SAFETY','PAUSED_BY_BUDGET'].includes(campaign.status)} onClick={() => act('end', 'Завершено из админ-панели')}>Завершить</button>
              <button disabled={busy} onClick={() => act('safetyCheck')}>Проверить безопасность</button>
            </div>
            <div className="pe-control-note">Коммерческие правки проходят через новую рабочую версию. Действующая effective-версия не меняется до отдельной активации.</div>
          </article>

          <article className="pe-card">
            <div className="pe-card-title"><div><p>Расписание рабочей версии</p><h2>{version?.timezone || 'Europe/Moscow'}</h2></div></div>
            <div className="pe-schedule">{schedule.length ? schedule.map((row) => <div key={row.id || `${row.dayOfWeek}-${row.startTime}`}><strong>{DAY[row.dayOfWeek] || row.dayOfWeek}</strong><span>{String(row.startTime).slice(0,5)}–{String(row.endTime).slice(0,5)}</span><em>{row.isEnabled === false ? 'выкл' : 'активно'}</em></div>) : <p>Используется общее окно версии: {fmtTime(version?.startsAt)} — {fmtTime(version?.endsAt)}</p>}</div>
          </article>

          <article className="pe-card">
            <div className="pe-card-title"><div><p>Бюджет</p><h2>{budget ? fmtMoney(budget) : 'Без лимита'}</h2></div><span>{version?.budgetAction || 'STOP'}</span></div>
            <div className="pe-budget"><div><span style={{ width: `${budgetPct}%` }} /></div><p>Использовано: {budgetPct}%</p></div>
            <dl className="pe-kv"><dt>Макс. применений</dt><dd>{version?.maxApplications ?? '—'}</dd><dt>На клиента</dt><dd>{version?.maxApplicationsPerCustomer ?? '—'}</dd><dt>При 100%</dt><dd>{version?.budgetAction || 'STOP'}</dd></dl>
          </article>

          <article className="pe-card">
            <div className="pe-card-title"><div><p>Согласование working v{version?.version}</p><h2>{version?.approvalPolicy || 'NONE'}</h2></div><strong>{approved}</strong></div>
            <div className="pe-approvals">{approvals.length ? approvals.slice(-5).reverse().map((row) => <div key={row.id}><Status value={row.status} /><span>{row.decidedBy || row.requestedBy}</span><small>{fmtTime(row.decidedAt || row.requestedAt)}</small></div>) : <p>Решений по текущей версии пока нет.</p>}</div>
          </article>
        </section>

        <section className="pe-card pe-funnel-card">
          <div className="pe-card-title"><div><p>Каналы</p><h2>Воронка Telegram / MAX / VK</h2></div><span>{servingVersion ? `effective v${servingVersion.version}` : `working v${version?.version}`}</span></div>
          <div className="pe-funnel-head"><span>Канал</span><span>Доставлено</span><span>Открыто</span><span>Клики</span><span>Покупки</span><span>CTR</span><span>Конверсия</span></div>
          {(Array.isArray(channelRows) ? channelRows : []).map((row) => <div className="pe-funnel-row" key={row.channel}>
            <strong>{row.channel}</strong><span>{row.delivered ?? 0}</span><span>{row.opened ?? 0}</span><span>{row.clicked ?? 0}</span><span>{row.purchase ?? row.purchases ?? 0}</span><span>{Number(row.ctr || 0).toFixed(1)}%</span><span>{Number(row.purchaseConversion || 0).toFixed(1)}%</span>
          </div>)}
          {!channelRows.length && <p className="pe-muted">Канальная аналитика появится после первых уведомлений и покупок.</p>}
        </section>

        <section className="pe-card">
          <div className="pe-card-title"><div><p>Каналы рабочей версии</p><h2>Настройки коммуникаций</h2></div></div>
          <div className="pe-channel-cards">{(version?.channels || []).map((row) => <div key={row.channel}><strong>{row.channel}</strong><Status value={row.enabled ? 'ACTIVE' : 'DISABLED'} /><small>Предуведомление: {row.preNotificationMinutes || 0} мин</small><small>Popup: {row.popupEnabled ? 'да' : 'нет'} · Countdown: {row.countdownEnabled ? 'да' : 'нет'}</small></div>)}</div>
        </section>
      </>}
    </section>
  </div>;
}
