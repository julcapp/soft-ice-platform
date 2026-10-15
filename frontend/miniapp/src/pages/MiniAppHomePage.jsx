import React, { useEffect, useState } from 'react';
import { AppHeader } from '../components/organisms/AppHeader/AppHeader.jsx';
import { BottomNavigation } from '../components/organisms/BottomNavigation/BottomNavigation.jsx';
import { ConsentPanel } from '../consent/ConsentPanel.jsx';
import { ActionCard } from '../components/molecules/ActionCard/ActionCard.jsx';
import { trackEvent } from '../analytics/trackEvent.js';
import { getProfileState } from '../profile/CustomerProfileApi.js';

export function MiniAppHomePage({ onConsentAccepted, onBuy, onPhotos, onCamera, onProfile, onReferral, onPrivateChannel }) {
  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => { getProfileState().then((state) => setUnreadCount(Number(state?.unreadNotifications || 0))).catch(() => {}); }, []);
  function openProduct() { trackEvent('ProductOpened', { product_id: 'soft_ice_cup' }); onBuy(); }
  function openPhotos() { trackEvent('PhotoPublicationHistoryOpened'); onPhotos?.(); }
  function openCamera() { trackEvent('PhotoCameraOpened'); onCamera?.(); }
  return (
    <main className="app-shell">
      <AppHeader unreadCount={unreadCount} onNotifications={onProfile} />
      <section className="hero-card">
        <p className="eyebrow">Добро пожаловать</p>
        <h2>Соберите своё мягкое мороженое</h2>
        <p>Сегодня доступен вкус дня: ванильное мягкое мороженое.</p>
      </section>
      <section className="card-grid" aria-label="Главные действия">
        <ActionCard icon="🍦" title="Купить мороженое" description="Вкус дня, сироп и топпинг на выбор" badge="130 ₽" onClick={openProduct} />
        <ActionCard icon="🔔" title="Личный кабинет" description="Профиль, дата рождения, email и непрочитанные уведомления" badge={unreadCount ? `${unreadCount}` : undefined} onClick={onProfile} />
        <ActionCard icon="🤝" title="Пригласить друга" description="Скопировать или отправить персональную реферальную ссылку" onClick={onReferral} />
        <ActionCard icon="🔒" title="Приватный канал" description="Статус платной подписки и управление автопродлением" onClick={onPrivateChannel} />
        <ActionCard icon="📸" title="Выполнить фотозадание" description="Откроем камеру и отправим фото на модерацию" onClick={openCamera} />
        <ActionCard icon="📷" title="Мои фотографии" description="Модерация и публикации в VK, Telegram и MAX" onClick={openPhotos} />
        <ActionCard icon="🎁" title="Клуб Тимоши" description="Участие в клубе, бонусы и специальные предложения" onClick={() => trackEvent('ClubOfferShown')} />
        <ActionCard icon="⭐" title="Бонусы" description="Копите и используйте бонусы в следующих покупках" onClick={() => trackEvent('BonusSectionOpened')} />
        <ActionCard icon="📍" title="Где купить" description="Найдите ближайший автомат или точку продаж" onClick={() => trackEvent('LocationSectionOpened')} />
      </section>
      <BottomNavigation />
      <ConsentPanel onAccepted={onConsentAccepted} />
    </main>
  );
}
