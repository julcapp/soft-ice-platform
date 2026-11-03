import React, { useEffect, useMemo, useState } from 'react';
import { AppHeader } from '../components/organisms/AppHeader/AppHeader.jsx';
import { BottomNavigation } from '../components/organisms/BottomNavigation/BottomNavigation.jsx';
import { ConsentPanel } from '../consent/ConsentPanel.jsx';
import { ActionCard } from '../components/molecules/ActionCard/ActionCard.jsx';
import { trackEvent } from '../analytics/trackEvent.js';
import { getProfileState } from '../profile/CustomerProfileApi.js';
import {
  getCatalog,
  getClubAccount,
  resolveCatalogSummary,
  resolveHomeMachineId,
} from '../home/HomeDataApi.js';

function formatPrice(price, currency = 'RUB') {
  if (!Number.isFinite(Number(price))) return null;
  if (currency === 'RUB') return String(Number(price)) + ' ₽';
  return String(Number(price)) + ' ' + currency;
}

export function MiniAppHomePage({
  sessionState,
  onConsentAccepted,
  onBuy,
  onPhotos,
  onCamera,
  onProfile,
  onReferral,
  onPrivateChannel,
}) {
  const machineId = useMemo(() => resolveHomeMachineId(), []);
  const personalReady = sessionState?.status === 'ready';
  const [profile, setProfile] = useState(null);
  const [clubAccount, setClubAccount] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [catalogError, setCatalogError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setCatalogError(false);

    getCatalog({ machineId, signal: controller.signal })
      .then(setCatalog)
      .catch((error) => {
        if (error?.name !== 'AbortError') setCatalogError(true);
      });

    if (personalReady) {
      Promise.allSettled([
        getProfileState({ signal: controller.signal }),
        getClubAccount({ signal: controller.signal }),
      ]).then(([profileResult, clubResult]) => {
        if (profileResult.status === 'fulfilled') setProfile(profileResult.value);
        if (clubResult.status === 'fulfilled') setClubAccount(clubResult.value);
      });
    } else {
      setProfile(null);
      setClubAccount(null);
    }

    return () => controller.abort();
  }, [machineId, personalReady]);

  const unreadCount = Number(profile?.unreadNotifications || 0);
  const customer = profile?.customer || null;
  const catalogSummary = resolveCatalogSummary(catalog);
  const priceBadge = formatPrice(catalogSummary.price, catalogSummary.currency);

  function openProduct() {
    trackEvent('ProductOpened', { product_id: 'soft_ice_cup', machine_id: machineId || null });
    onBuy?.();
  }

  function openPhotos() {
    trackEvent('PhotoPublicationHistoryOpened');
    onPhotos?.();
  }

  function openCamera() {
    trackEvent('PhotoCameraOpened');
    onCamera?.();
  }

  const profileDescription = personalReady && customer?.name
    ? customer.name + (customer.phone ? ' · ' + customer.phone : '')
    : 'Доступно после подтверждения номера';

  return (
    <main className="app-shell">
      <AppHeader
        customer={customer}
        clubAccount={clubAccount}
        unreadCount={unreadCount}
        onNotifications={personalReady ? onProfile : undefined}
        onProfile={personalReady ? onProfile : undefined}
      />

      {sessionState?.status === 'guest' && (
        <section className="hero-card" aria-live="polite">
          <p className="eyebrow">Личный кабинет</p>
          <h2>Номер телефона ещё не подтверждён</h2>
          <p>
            Каталог доступен без регистрации. Имя, телефон, бонусы и история появятся
            после подтверждения номера через Клуб «У Тимоши».
          </p>
        </section>
      )}

      {sessionState?.status === 'error' && (
        <section className="hero-card" aria-live="polite">
          <p className="eyebrow">Соединение</p>
          <h2>Не удалось открыть личную сессию</h2>
          <p>
            Публичный каталог остаётся доступен. Персональные данные не показываем,
            пока безопасная сессия не подтверждена.
          </p>
        </section>
      )}

      <section className="hero-card">
        <p className="eyebrow">Клуб «У Тимоши»</p>
        <h2>{catalogSummary.name}</h2>
        {catalogSummary.machineLabel && <p>Аппарат: {catalogSummary.machineLabel}</p>}
        {!catalog && !catalogError && <p>Загружаем актуальный ассортимент и цены…</p>}
        {catalogError && (
          <p>
            Актуальные цены временно недоступны. Устаревшие значения не показываем.
          </p>
        )}
        {priceBadge && <p><strong>Базовая цена: {priceBadge}</strong></p>}
      </section>

      <section className="card-grid" aria-label="Главные действия">
        <ActionCard
          icon="🍦"
          title="Купить мороженое"
          description={catalogError
            ? 'Каталог временно недоступен'
            : 'Актуальный ассортимент и цена из каталога'}
          badge={priceBadge || undefined}
          onClick={openProduct}
        />
        <ActionCard
          icon="👤"
          title="Личный кабинет"
          description={profileDescription}
          badge={personalReady && unreadCount ? String(unreadCount) : undefined}
          onClick={personalReady ? onProfile : undefined}
        />
        <ActionCard
          icon="🤝"
          title="Пригласить друга"
          description={personalReady
            ? 'Персональная реферальная ссылка'
            : 'Доступно после подтверждения номера'}
          onClick={personalReady ? onReferral : undefined}
        />
        <ActionCard
          icon="🔒"
          title="Приватный канал"
          description={personalReady
            ? 'Подписка и управление автопродлением'
            : 'Доступно после подтверждения номера'}
          onClick={personalReady ? onPrivateChannel : undefined}
        />
        <ActionCard
          icon="📸"
          title="Выполнить фотозадание"
          description="Фото на модерацию"
          onClick={personalReady ? openCamera : undefined}
        />
        <ActionCard
          icon="📷"
          title="Мои фотографии"
          description={personalReady
            ? 'История модерации и публикаций'
            : 'Доступно после подтверждения номера'}
          onClick={personalReady ? openPhotos : undefined}
        />
        <ActionCard
          icon="🎁"
          title="Клуб Тимоши"
          description={personalReady
            ? 'Бонусы, подарки и специальные предложения'
            : 'Подтвердите номер для персональных возможностей'}
          onClick={personalReady ? onProfile : undefined}
        />
        <ActionCard
          icon="📍"
          title="Где купить"
          description="Автоматы и точки продаж"
          onClick={() => trackEvent('LocationSectionOpened')}
        />
      </section>

      <BottomNavigation />
      <ConsentPanel onAccepted={onConsentAccepted} />
    </main>
  );
}
