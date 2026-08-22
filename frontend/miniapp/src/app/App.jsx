import React, { useEffect, useMemo, useState } from 'react';
import { MiniAppHomePage } from '../pages/MiniAppHomePage.jsx';
import { ProductScreen } from '../screens/02_PRODUCT/ProductScreen.jsx';
import { readUserSettings } from '../consent/userSettingsStorage.js';
import { getInitialSource } from '../analytics/source.js';
import { trackEvent } from '../analytics/trackEvent.js';
import { OperatorWorkspacePage } from '../operator/OperatorWorkspacePage.jsx';
import { SalesTerminalPage } from '../terminal/SalesTerminalPage.jsx';
import { MyGifts } from '../gift-transfer/GiftTransferScreens.jsx';
import { GiftTransferApi } from '../gift-transfer/GiftTransferApi.js';
import { PhotoPublicationHistory } from '../photo-verification/PhotoPublicationHistory.jsx';
import { PhotoCameraScreen } from '../photo-verification/PhotoCameraScreen.jsx';

export function App() {
  const appMode = useMemo(() => new URLSearchParams(window.location.search).get('mode'), []);
  const source = useMemo(() => getInitialSource(), []);
  const [settings, setSettings] = useState(() => readUserSettings());
  const [screen, setScreen] = useState('home');

  useEffect(() => {
    trackEvent('MiniAppOpened', { source, settings_version: settings?.version || null });
  }, [source, settings]);

  if (appMode === 'operator') return <OperatorWorkspacePage />;
  if (appMode === 'terminal') return <SalesTerminalPage />;
  if (appMode === 'gifts') return <MyGifts gifts={[]} api={GiftTransferApi} />;
  if (appMode === 'photos') return <PhotoPublicationHistory onCamera={() => { window.location.search = '?mode=camera'; }} />;
  if (appMode === 'camera') return <PhotoCameraScreen onBack={() => { window.location.search = '?mode=photos'; }} onSubmitted={() => { window.location.search = '?mode=photos'; }} />;

  if (screen === 'product') return <ProductScreen onBack={() => setScreen('home')} />;
  if (screen === 'photos') return <PhotoPublicationHistory onBack={() => setScreen('home')} onCamera={() => setScreen('camera')} />;
  if (screen === 'camera') return <PhotoCameraScreen onBack={() => setScreen('home')} onSubmitted={() => setScreen('photos')} />;

  return <MiniAppHomePage onConsentAccepted={setSettings} onBuy={() => setScreen('product')} onPhotos={() => setScreen('photos')} onCamera={() => setScreen('camera')} />;
}
