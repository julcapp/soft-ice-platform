import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Engagement, ExternalChannels } from './Customer360';
import { ConnectivityCard } from './machineTwinComponents';
describe('Customer 360 и связь автомата', () => {
  it('показывает VK, ручное предупреждение и недоступную интеграцию', () => {
    const html = renderToStaticMarkup(<ExternalChannels channels={[{ channelType: 'VK', profiles: [{ source: 'MANUAL' }], subscriptions: [{}], integrationStatus: 'BLOCKED_EXTERNAL' }]} />);
    expect(html).toContain('Внешние каналы'); expect(html).toContain('Ручные данные'); expect(html).toContain('Интеграция недоступна');
  });
  it('показывает объяснимый индекс вовлечённости', () => {
    const html = renderToStaticMarkup(<Engagement summary={{ score: 42, level: 'MEDIUM', dataCompleteness: 50, calculatedAt: '2026-07-24T00:00:00Z', modelVersion: 'deterministic-v1', factors: [{ code: 'phone', explanation: 'Телефон подтверждён', contribution: 12 }] }} />);
    expect(html).toContain('42 / 100'); expect(html).toContain('Телефон подтверждён');
  });
  it('показывает маскированный телефон и предупреждения SIM', () => {
    const html = renderToStaticMarkup(<ConnectivityCard connectivity={{ simCard: { carrierName: 'МТС', phoneNumber: '+7 *** ***-12-34' }, mobilePlan: { tariffName: 'Телематика', tariffStatus: 'SUSPENDED' }, warnings: [{ code: 'LOW_BALANCE', label: 'Низкий баланс' }], integrationStatus: 'BLOCKED_EXTERNAL' }} />);
    expect(html).toContain('Связь и SIM-карта'); expect(html).toContain('+7 *** ***-12-34'); expect(html).toContain('Низкий баланс');
  });
});
