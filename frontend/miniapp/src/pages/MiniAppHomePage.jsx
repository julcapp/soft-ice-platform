import { AppHeader } from '../components/organisms/AppHeader/AppHeader.jsx';
import { BottomNavigation } from '../components/organisms/BottomNavigation/BottomNavigation.jsx';
import { ConsentPanel } from '../consent/ConsentPanel.jsx';
import { ActionCard } from '../components/molecules/ActionCard/ActionCard.jsx';
import { trackEvent } from '../analytics/trackEvent.js';

export function MiniAppHomePage({ onConsentAccepted }) {
  return (
    <main className="app-shell">
      <AppHeader />
      <section className="hero-card">
        <p className="eyebrow">Добро пожаловать</p>
        <h2>Соберите своё мягкое мороженое</h2>
        <p>Выберите продукт, вступайте в Клуб Тимоши и получайте бонусы за любимый десерт.</p>
      </section>
      <section className="card-grid" aria-label="Главные действия">
        <ActionCard icon="🍦" title="Купить мороженое" description="Вкус дня, сироп и топпинг на выбор" badge="130 ₽" onClick={() => trackEvent('ProductViewed', { product_id: 'flavor_of_day' })} />
        <ActionCard icon="🎁" title="Клуб Тимоши" description="Скидка 20%, бонусы и специальные предложения" badge="300 ₽" onClick={() => trackEvent('ClubOfferShown')} />
        <ActionCard icon="⭐" title="Бонусы" description="Копите и используйте бонусы в следующих покупках" onClick={() => trackEvent('BonusSectionOpened')} />
        <ActionCard icon="📍" title="Где купить" description="Найдите ближайший автомат или точку продаж" onClick={() => trackEvent('LocationSectionOpened')} />
      </section>
      <BottomNavigation />
      <ConsentPanel onAccepted={onConsentAccepted} />
    </main>
  );
}
