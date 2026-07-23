import React from 'react';
import { AppHeader } from '../components/organisms/AppHeader/AppHeader.jsx';
import { BottomNavigation } from '../components/organisms/BottomNavigation/BottomNavigation.jsx';
import { ConsentPanel } from '../consent/ConsentPanel.jsx';
import { ActionCard } from '../components/molecules/ActionCard/ActionCard.jsx';
import { trackEvent } from '../analytics/trackEvent.js';

export function MiniAppHomePage({ onConsentAccepted, onBuy }) {
  function openProduct() {
    trackEvent('ProductOpened', { product_id: 'soft_ice_cup' });
    onBuy();
  }

  return (
    <main className="app-shell">
      <AppHeader />
      <section className="hero-card">
        <p className="eyebrow">Добро пожаловать</p>
        <h2>Соберите своё мягкое мороженое</h2>
        <p>Сегодня доступен вкус дня: ванильное мягкое мороженое.</p>
      </section>
      <section className="card-grid" aria-label="Главные действия">
        <ActionCard icon="🍦" title="Купить мороженое" description="Вкус дня, сироп и топпинг на выбор" badge="130 ₽" onClick={openProduct} />
        <ActionCard icon="🎁" title="Клуб Тимоши" description="Скидка 20%, бонусы и специальные предложения" badge="300 ₽" onClick={() => trackEvent('ClubOfferShown')} />
        <ActionCard icon="⭐" title="Бонусы" description="Копите и используйте бонусы в следующих покупках" onClick={() => trackEvent('BonusSectionOpened')} />
        <ActionCard icon="📍" title="Где купить" description="Найдите ближайший автомат или точку продаж" onClick={() => trackEvent('LocationSectionOpened')} />
      </section>
      <BottomNavigation />
      <ConsentPanel onAccepted={onConsentAccepted} />
    </main>
  );
}
