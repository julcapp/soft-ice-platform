import React, { useEffect, useMemo, useState } from 'react';
import { MiniAppHomePage } from '../pages/MiniAppHomePage.jsx';
import { ProductScreen } from '../screens/02_PRODUCT/ProductScreen.jsx';
import { readUserSettings } from '../consent/userSettingsStorage.js';
import { getInitialSource } from '../analytics/source.js';
import { trackEvent } from '../analytics/trackEvent.js';

export function App() {
  const source = useMemo(() => getInitialSource(), []);
  const [settings, setSettings] = useState(() => readUserSettings());
  const [screen, setScreen] = useState('home');

  useEffect(() => {
    trackEvent('MiniAppOpened', { source, settings_version: settings?.version || null });
  }, [source, settings]);

  if (screen === 'product') {
    return <ProductScreen onBack={() => setScreen('home')} />;
  }

  return <MiniAppHomePage onConsentAccepted={setSettings} onBuy={() => setScreen('product')} />;
}
