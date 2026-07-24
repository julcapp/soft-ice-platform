import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RuntimeDetail } from './RuntimeMonitor';
import { DataTable, EmptyState, ErrorState, Skeleton } from './components';
describe('Runtime and event read-only screens', () => {
  it('renders runtime state, session, transition, signal and foundation mode', () => {
    const html = renderToStaticMarkup(<RuntimeDetail machine={{ machineId: 'm1', currentState: 'READY', dataMode: 'IN_MEMORY_FOUNDATION', activeSession: { sessionId: 's1', sessionType: 'OPERATOR_TEST', startedAt: new Date().toISOString(), correlationId: 'c1', testRunId: 't1' }, transitions: [{ transitionId: 'tr1', occurredAt: new Date(), fromState: 'IDLE', toState: 'READY', reason: 'boot', correlationId: 'c1' }], recentSignals: [{ signalType: 'MACHINE_CONNECTED', occurredAt: new Date(), source: 'SIMULATOR' }] }} />);
    for (const text of ['READY','OPERATOR_TEST','t1','MACHINE_CONNECTED','SIMULATOR','Данные в памяти']) expect(html).toContain(text);
    expect(html).not.toContain('<button');
  });
  it('covers event rows and loading, empty, unavailable and denied states', () => {
    expect(renderToStaticMarkup(<DataTable title="Platform Event Stream" rows={[{ id: 'e1', eventType: 'MACHINE_RUNTIME_STATE_CHANGED' }]} columns={[{ key: 'eventType', label: 'Event' }]} />)).toContain('MACHINE_RUNTIME_STATE_CHANGED');
    expect(renderToStaticMarkup(<EmptyState title="Данные о состоянии автоматов отсутствуют" />)).toContain('Данные о состоянии автоматов отсутствуют');
    expect(renderToStaticMarkup(<Skeleton />)).toContain('Загрузка панели управления');
    expect(renderToStaticMarkup(<ErrorState />)).toContain('Панель управления недоступна');
    expect(renderToStaticMarkup(<ErrorState kind="denied" />)).toContain('Доступ запрещён');
  });
});
