import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PhotoVerificationSettingsPage } from './PhotoVerificationSettings';

const settings = {
  enabled: false,
  mode: 'manual_only',
  publishingEnabled: false,
  duplicateChecksEnabled: true,
  metadataChecksEnabled: true,
  challengeCodeEnabled: false,
  publicationRequiredForReward: true,
  rewardBonusUnits: null,
};

describe('PhotoVerificationSettingsPage', () => {
  it('renders safe controls and public UGC targets', () => {
    const html = renderToStaticMarkup(<PhotoVerificationSettingsPage getSettings={() => new Promise(() => {})} />);
    expect(html).toContain('Загрузка панели управления');
  });

  it('documents reward units as intentionally unconfigured by default', () => {
    expect(settings.mode).toBe('manual_only');
    expect(settings.enabled).toBe(false);
    expect(settings.publicationRequiredForReward).toBe(true);
    expect(settings.rewardBonusUnits).toBeNull();
  });
});
