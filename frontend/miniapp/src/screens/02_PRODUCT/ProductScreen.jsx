import React, { useEffect, useMemo, useRef, useState } from 'react';
import { trackEvent } from '../../analytics/trackEvent.js';
import { DESIGN_RULES } from '../../shared/design/index.js';
import { MiniAppPromotionAwareness } from '../../promotion/PromotionAwareness.jsx';
import { PromotionPreStartBanner } from '../../promotion/PromotionPreStartBanner.jsx';
import { PromotionPricePanel } from '../../promotion/PromotionPricePanel.jsx';
import { trackPromotionEngagement } from '../../promotion/PromotionAttribution.js';
import { usePricingQuote } from '../../promotion/usePricingQuote.js';
import { usePromotionAwareness } from '../../promotion/usePromotionAwareness.js';
import { getCatalog, resolveHomeMachineId } from '../../home/HomeDataApi.js';

function formatRub(value) {
  return Number.isFinite(Number(value)) ? String(Number(value)) + ' ₽' : '—';
}

function optionIcon(item) {
  if (item.systemItem) return '○';
  if (item.category === 'TOPPING') return '●';
  if (item.category === 'SPRINKLE') return '✦';
  return '🍦';
}

function OptionCard({ item, selected, onSelect }) {
  return (
    <button
      className={selected ? 'option-card selected' : 'option-card'}
      type="button"
      onClick={onSelect}
    >
      <span className="option-icon">{optionIcon(item)}</span>
      <span>
        <strong>{item.nameRu}</strong>
        <small style={{ display: 'block' }}>
          {item.basePrice === 0 ? 'Без доплаты' : '+' + formatRub(item.basePrice)}
        </small>
      </span>
    </button>
  );
}

function chooseDefault(items = []) {
  return items.find((item) => item.systemItem)
    || items.find((item) => item.freeItem)
    || items[0]
    || null;
}

export function ProductScreen({ onBack }) {
  const machineId = useMemo(() => resolveHomeMachineId(), []);
  const pricingRef = useRef(null);
  const openedTracked = useRef(false);
  const [catalog, setCatalog] = useState(null);
  const [catalogState, setCatalogState] = useState(machineId ? 'loading' : 'machine-required');
  const [selectedTopping, setSelectedTopping] = useState(null);
  const [selectedSprinkle, setSelectedSprinkle] = useState(null);
  const [quoteRefreshKey, setQuoteRefreshKey] = useState(0);

  useEffect(() => {
    if (!machineId) return undefined;
    const controller = new AbortController();
    setCatalogState('loading');
    getCatalog({ machineId, signal: controller.signal })
      .then((value) => {
        setCatalog(value);
        setSelectedTopping(chooseDefault(value.toppings)?.id || null);
        setSelectedSprinkle(chooseDefault(value.sprinkles)?.id || null);
        setCatalogState('ready');
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') setCatalogState('error');
      });
    return () => controller.abort();
  }, [machineId]);

  const currentFlavor = catalog?.currentFlavor || null;
  const toppings = catalog?.toppings || [];
  const sprinkles = catalog?.sprinkles || [];
  const selectedToppingItem = toppings.find((item) => item.id === selectedTopping) || null;
  const selectedSprinkleItem = sprinkles.find((item) => item.id === selectedSprinkle) || null;

  const selectedItems = useMemo(() => [
    currentFlavor?.sku ? { sku: currentFlavor.sku } : null,
    selectedToppingItem?.sku ? { sku: selectedToppingItem.sku } : null,
    selectedSprinkleItem?.sku ? { sku: selectedSprinkleItem.sku } : null,
  ].filter(Boolean), [currentFlavor, selectedToppingItem, selectedSprinkleItem]);

  const pricing = usePricingQuote({
    machineId,
    channel: 'MINI_APP',
    items: selectedItems,
    refreshKey: quoteRefreshKey,
  });
  const awareness = usePromotionAwareness({ machineId, channel: 'MINI_APP' });

  const catalogTotal = selectedItems.length
    ? Number(currentFlavor?.basePrice || 0)
      + Number(selectedToppingItem?.basePrice || 0)
      + Number(selectedSprinkleItem?.basePrice || 0)
    : null;
  const currentPrice = pricing.status === 'ready' && pricing.quote && !pricing.lockExpired
    ? Number(pricing.quote.finalAmount)
    : catalogTotal;

  useEffect(() => {
    if (openedTracked.current || !machineId) return;
    openedTracked.current = true;
    trackPromotionEngagement('OPENED', { machineId });
  }, [machineId]);

  function selectTopping(id) {
    setSelectedTopping(id);
    trackEvent('ToppingSelected', { topping_id: id, machine_id: machineId });
  }

  function selectSprinkle(id) {
    setSelectedSprinkle(id);
    trackEvent('SprinkleSelected', { sprinkle_id: id, machine_id: machineId });
  }

  function refreshQuote() {
    setQuoteRefreshKey((value) => value + 1);
    trackEvent('PricingQuoteRefreshRequested', { machine_id: machineId, channel: 'MINI_APP' });
  }

  function focusPricing() {
    pricingRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    trackEvent('PromotionAwarenessCtaPressed', { machine_id: machineId, channel: 'MINI_APP' });
    trackPromotionEngagement('CLICKED', { machineId });
  }

  function continueOrder() {
    if (pricing.status !== 'ready' || pricing.lockExpired || !currentFlavor) return;
    trackEvent('ContinuePressed', {
      product_id: currentFlavor.sku,
      topping_id: selectedToppingItem?.sku || null,
      sprinkle_id: selectedSprinkleItem?.sku || null,
      machine_id: machineId,
      quote_id: pricing.quote.id,
      final_amount: Number(pricing.quote.finalAmount),
      campaign_id: pricing.quote.campaignId || null,
      gift_applied: Number(pricing.quote.giftAmount || 0) > 0,
    });
  }

  if (!machineId) {
    return (
      <main className="app-shell">
        <header className="screen-header">
          <button className="back-button" type="button" onClick={onBack}>‹</button>
          <div>
            <p className="eyebrow">Шаг 1</p>
            <h1>Выберите аппарат</h1>
          </div>
        </header>
        <section className="hero-card">
          <h2>Для заказа нужен конкретный аппарат</h2>
          <p>
            Цена и доступные ингредиенты зависят от выбранного аппарата.
            Мы не подставляем тестовый аппарат и не показываем устаревшие цены.
          </p>
          <button className="button primary" type="button" onClick={onBack}>Вернуться на главную</button>
        </section>
      </main>
    );
  }

  if (catalogState === 'loading') {
    return (
      <main className="app-shell">
        <header className="screen-header">
          <button className="back-button" type="button" onClick={onBack}>‹</button>
          <div><p className="eyebrow">Шаг 2</p><h1>Загружаем меню…</h1></div>
        </header>
      </main>
    );
  }

  if (catalogState === 'error' || !currentFlavor) {
    return (
      <main className="app-shell">
        <header className="screen-header">
          <button className="back-button" type="button" onClick={onBack}>‹</button>
          <div><p className="eyebrow">Меню</p><h1>Каталог временно недоступен</h1></div>
        </header>
        <section className="hero-card">
          <p>Старые цены не показываем. Попробуйте открыть меню ещё раз позже.</p>
        </section>
      </main>
    );
  }

  const checkoutEnabled = pricing.status === 'ready' && !pricing.lockExpired;

  return (
    <main className="app-shell">
      <MiniAppPromotionAwareness pricing={pricing} onCta={focusPricing} />
      {!pricing.quote?.promotionRuntime && <PromotionPreStartBanner awareness={awareness} />}

      <header className="screen-header">
        <button className="back-button" type="button" onClick={onBack}>‹</button>
        <div>
          <p className="eyebrow">Соберите заказ</p>
          <h1>{currentFlavor.nameRu}</h1>
        </div>
      </header>

      <section className="product-hero">
        <div className="product-photo">🍦</div>
        <div>
          <span className="badge">Текущий вкус аппарата</span>
          <h2>{currentFlavor.nameRu}</h2>
          {currentFlavor.descriptionRu && <p>{currentFlavor.descriptionRu}</p>}
          <strong className="price">{formatRub(currentFlavor.basePrice)}</strong>
        </div>
      </section>

      <div ref={pricingRef}>
        <PromotionPricePanel pricing={pricing} onRefresh={refreshQuote} />
      </div>

      <section className="selector-section">
        <h2>Топпинг</h2>
        <div className="option-grid">
          {toppings.map((item) => (
            <OptionCard
              key={item.id}
              item={item}
              selected={selectedTopping === item.id}
              onSelect={() => selectTopping(item.id)}
            />
          ))}
        </div>
      </section>

      <section className="selector-section">
        <h2>Посыпка</h2>
        <div className="option-grid">
          {sprinkles.map((item) => (
            <OptionCard
              key={item.id}
              item={item}
              selected={selectedSprinkle === item.id}
              onSelect={() => selectSprinkle(item.id)}
            />
          ))}
        </div>
      </section>

      <footer className="order-bar">
        <div>
          <span>Итого</span>
          <strong>{formatRub(currentPrice)}</strong>
        </div>
        <button
          className="button primary"
          type="button"
          onClick={continueOrder}
          disabled={!checkoutEnabled}
        >
          {pricing.status === 'loading'
            ? 'Проверяем цену'
            : pricing.lockExpired
              ? 'Пересчитать цену'
              : DESIGN_RULES.microcopy.cta}
        </button>
      </footer>
    </main>
  );
}
