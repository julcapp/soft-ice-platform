import React from 'react'; import { describe, expect, it } from 'vitest'; import { renderToStaticMarkup } from 'react-dom/server'; import { CameraSurveillancePanel } from './VideoSurveillance';
describe('интерфейс видеонаблюдения', () => {
  it('показывает загрузку и русскоязычный фундамент интерфейса', () => { const html = renderToStaticMarkup(<CameraSurveillancePanel machineId="m1" clients={{ listCameras: () => new Promise(() => {}), listVideoFragments: () => new Promise(() => {}), listVideoIncidents: () => new Promise(() => {}) }} />); expect(html).toContain('Загрузка'); });
});
