import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { EventCenterPage, EventFeed } from './EventCenter';

const sample = [{ eventId: 'evt_1', occurredAt: '2026-07-24T10:00:00Z', title: 'Автомат отключён', summary: 'Нет связи более пяти минут.', severity: 'WARNING', category: 'CONNECTIVITY', correlationId: 'operation_1' }];

describe('Центр событий', () => {
  it('показывает русскоязычное состояние загрузки списка', () => {
    const html = renderToStaticMarkup(<EventCenterPage client={{ listEvents: () => new Promise(() => {}) }} />);
    expect(html).toContain('Все события'); expect(html).toContain('Требуют внимания'); expect(html).toContain('Загрузка');
    expect(html).not.toContain('REGISTERED_NOT_EMITTED');
  });
  it('EventFeed группирует события и переводит важность', () => {
    const html = renderToStaticMarkup(<EventFeed events={sample} groupBy="correlation" />);
    expect(html).toContain('Операция operation_1'); expect(html).toContain('Автомат отключён'); expect(html).toContain('Предупреждение');
  });
  it('EventFeed поддерживает empty, error, forbidden и stale states', () => {
    expect(renderToStaticMarkup(<EventFeed />)).toContain('Событий пока нет');
    expect(renderToStaticMarkup(<EventFeed status="error" />)).toContain('недоступна');
    expect(renderToStaticMarkup(<EventFeed status="forbidden" />)).toContain('Доступ запрещён');
    expect(renderToStaticMarkup(<EventFeed status="stale" />)).toContain('устареть');
  });
});
