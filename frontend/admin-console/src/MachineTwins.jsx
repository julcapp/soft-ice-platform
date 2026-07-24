import React, { useEffect, useState } from 'react';
import { getMachineTwin, getMachineConnectivity, listMachineTwins } from './api/machineTwinClient';
import { EmptyState, ErrorState, Skeleton, StatusBadge } from './components';
import { ComponentList, ConnectivityCard, FaultTimeline, FreshnessIndicator, MachineTwinCard, MachineTwinDiagram, PredictionSummaryCard, SnapshotHistory, SourceStatusPanel, TwinSummaryPanel } from './machineTwinComponents';
import { CameraSurveillancePanel } from './VideoSurveillance';
import { EventFeed } from './EventCenter';

export function MachineTwinsList({ data, onOpen }) {
  if (!data.length) return <EmptyState title="Цифровых двойников нет" message="Нет доступных автоматов для построения проекции." />;
  return <div className="twin-grid">{data.map((twin) => <MachineTwinCard key={twin.machineId} twin={twin} onOpen={onOpen} />)}</div>;
}
export function MachineTwinDetail({ twin, section = 'overview' }) {
  const sections = {
    overview: <><FreshnessIndicator freshness={twin.freshness} /><TwinSummaryPanel twin={twin} /><ConnectivityCard connectivity={twin.connectivity} /><div className="detail-grid"><Identity twin={twin} /><SourceStatusPanel sources={twin.sourceStatus} /></div><MachineTwinDiagram components={twin.components} /><PredictionSummaryCard prediction={twin.predictionSummary} /></>,
    components: <ComponentList components={twin.components} />,
    events: <EventFeed events={(twin.events || []).map((event) => ({ ...event, eventId: event.eventId || event.id, title: event.title || event.type || 'Событие автомата', summary: event.summary || event.description || '', severity: event.severity || 'INFO', correlationId: event.correlationId || twin.machineId }))} />,
    snapshots: <SnapshotHistory snapshots={twin.snapshots || []} />,
    health: <><ComponentList components={twin.components} /><PredictionSummaryCard prediction={twin.predictionSummary} /></>,
    camera: <CameraSurveillancePanel machineId={twin.machineId} />,
  };
  return <div className="dashboard">{twin.dataMode === 'DEMO' && <div className="demo-marker"><StatusBadge status="DEMO" /> Симулятор автомата · сформировано {new Date(twin.generatedAt).toLocaleString('ru-RU')}</div>}<DetailTabs machineId={twin.machineId} />{sections[section] || sections.overview}</div>;
}
function Identity({ twin }) { return <section className="card"><div className="card-heading"><h2>Идентификация автомата</h2><StatusBadge status={twin.operationalStatus} /></div><dl className="identity-list"><dt>Название</dt><dd>{twin.name}</dd><dt>Внешний идентификатор</dt><dd>{twin.externalMachineId || '—'}</dd><dt>Модель</dt><dd>{twin.model || '—'}</dd><dt>Серийный номер</dt><dd>{twin.serialNumber || '—'}</dd><dt>Расположение</dt><dd>{twin.location || '—'}</dd><dt>Последний сигнал</dt><dd>{twin.lastHeartbeatAt ? new Date(twin.lastHeartbeatAt).toLocaleString('ru-RU') : 'Недоступно'}</dd><dt>Меню / цена</dt><dd>{twin.currentMenu?.name || 'Недоступно'} · {twin.activePrice ? `${twin.activePrice.amount} ${twin.activePrice.currency}` : 'Недоступно'}</dd><dt>Реклама</dt><dd>{twin.activeAdvertisingPlacement?.name || 'Только базовая реализация'}</dd><dt>Назначенный оператор</dt><dd>{twin.assignedOperator?.name || 'Не назначен'}</dd><dt>Последний тест</dt><dd>{twin.recentTestRuns?.[0]?.status || 'Недоступно'}</dd></dl></section>; }
function DetailTabs({ machineId }) { const sections = { overview: 'Обзор', components: 'Компоненты', events: 'События', snapshots: 'Снимки', health: 'Состояние', camera: 'Камера и видеонаблюдение' }; return <nav className="detail-tabs" aria-label="Разделы цифрового двойника">{Object.entries(sections).map(([section, label]) => <a key={section} href={`#machine-twins/${machineId}/${section}`}>{label}</a>)}</nav>; }
export function MachineTwinsPage({ listClient = listMachineTwins, detailClient = getMachineTwin, connectivityClient = getMachineConnectivity, route = 'machine-twins' }) {
  const [state, setState] = useState({ status: 'loading' });
  const [, machineId, section = 'overview'] = route.split('/');
  useEffect(() => {
    const controller = new AbortController();
    const work = machineId ? Promise.all([detailClient(machineId, { signal: controller.signal }), connectivityClient(machineId, { signal: controller.signal })]).then(([twin, connectivity]) => ({ ...twin, connectivity })) : listClient({ signal: controller.signal });
    work.then((data) => setState({ status: 'ready', data })).catch((error) => { if (error.name !== 'AbortError') setState({ status: [401, 403].includes(error.status) ? 'denied' : 'unavailable' }); });
    return () => controller.abort();
  }, [detailClient, listClient, connectivityClient, machineId]);
  if (state.status === 'loading') return <Skeleton />;
  if (state.status === 'denied') return <ErrorState kind="denied" />;
  if (state.status === 'unavailable') return <ErrorState />;
  return machineId ? <MachineTwinDetail twin={state.data} section={section} /> : <MachineTwinsList data={state.data} onOpen={(id) => { window.location.hash = `machine-twins/${id}/overview`; }} />;
}
