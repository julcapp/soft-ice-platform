import React, { useMemo, useRef, useState } from 'react';
import { flavorOfDay, product, syrups, toppings } from '../../domain/catalog.js';
import { trackEvent } from '../../analytics/trackEvent.js';
import { DESIGN_RULES } from '../../shared/design/index.js';
import { MiniAppPromotionAwareness } from '../../promotion/PromotionAwareness.jsx';
import { PromotionPricePanel } from '../../promotion/PromotionPricePanel.jsx';
import { resolveMachineId } from '../../promotion/PricingQuoteApi.js';
import { usePricingQuote } from '../../promotion/usePricingQuote.js';

function OptionCard({ item, selected, onSelect }) {
  return (
    <button className={selected ? 'option-card selected' : 'option-card'} type="button" onClick={onSelect}>
      <span className="option-icon">{item.icon}</span>
      <span>{item.name}</span>
    </button>
  );
}

function quotePrice(pricing) {
  if (pricing.status === 'ready' && pricing.quote && !pricing.lockExpired) return Number(pricing.quote.finalAmount);
  return product.price;
}

export function ProductScreen({ onBack }) {
  const machineId = useMemo(() => resolveMachineId(), []);
  const pricingRef = useRef(null);
  const [selectedSyrup, setSelectedSyrup] = useState(syrups[0].id);
  const [selectedTopping, setSelectedTopping] = useState(toppings[0].id);
  const [quoteRefreshKey, setQuoteRefreshKey] = useState(0);
  const pricing = usePricingQuote({
    machineId,
    channel: 'MINI_APP',
    productId: product.id,
    productName: product.name,
    refreshKey: quoteRefreshKey,
  });
  const currentPrice = quotePrice(pricing);

  function selectSyrup(id) {
    setSelectedSyrup(id);
    trackEvent('SyrupSelected', { syrup_id: id });
  }

  function selectTopping(id) {
    setSelectedTopping(id);
    trackEvent('ToppingSelected', { topping_id: id });
  }

  function refreshQuote() {
    setQuoteRefreshKey((value) => value + 1);
    trackEvent('PricingQuoteRefreshRequested', { machine_id: machineId, channel: 'MINI_APP' });
  }

  function focusPricing() {
    pricingRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    trackEvent('PromotionAwarenessCtaPressed', { machine_id: machineId, channel: 'MINI_APP' });
  }

  function continueOrder() {
    if (pricing.status !== 'ready' || pricing.lockExpired) return;
    trackEvent('ContinuePressed', {
      product_id: product.id,
      syrup_id: selectedSyrup,
      topping_id: selectedTopping,
      machine_id: machineId,
      quote_id: pricing.quote.id,
      final_amount: Number(pricing.quote.finalAmount),
      campaign_id: pricing.quote.campaignId || null,
      gift_applied: Number(pricing.quote.giftAmount || 0) > 0,
    });
  }

  const checkoutEnabled = pricing.status === 'ready' && !pricing.lockExpired;

  return (
    <main className="app-shell">
      <MiniAppPromotionAwareness pricing={pricing} onCta={focusPricing} />
      <header className="screen-header">
        <button className="back-button" type="button" onClick={onBack}>‹</button>
        <div>
          <p className="eyebrow">Купить мороженое</p>
          <h1>{product.name}</h1>
        </div>
      </header>

      <section className="product-hero">
        <div className="product-photo">🍦</div>
        <div>
          <span className="badge">{flavorOfDay.label}</span>
          <h2>{flavorOfDay.name}</h2>
          <p>В стоимость входит один сироп и один топпинг на выбор.</p>
          <strong className="price">{currentPrice} {product.currency}</strong>
        </div>
      </section>

      <div ref={pricingRef}><PromotionPricePanel pricing={pricing} onRefresh={refreshQuote} /></div>

      <section className="selector-section">
        <h2>Выберите сироп</h2>
        <div className="option-grid">
          {syrups.map((item) => <OptionCard key={item.id} item={item} selected={selectedSyrup === item.id} onSelect={() => selectSyrup(item.id)} />)}
        </div>
      </section>

      <section className="selector-section">
        <h2>Выберите топпинг</h2>
        <div className="option-grid">
          {toppings.map((item) => <OptionCard key={item.id} item={item} selected={selectedTopping === item.id} onSelect={() => selectTopping(item.id)} />)}
        </div>
      </section>

      <footer className="order-bar">
        <div>
          <span>Итого</span>
          <strong>{currentPrice} {product.currency}</strong>
        </div>
        <button className="button primary" type="button" onClick={continueOrder} disabled={!checkoutEnabled}>
          {pricing.status === 'loading' ? 'Проверяем цену…' : pricing.lockExpired ? 'Пересчитайте цену' : DESIGN_RULES.microcopy.cta}
        </button>
      </footer>
    </main>
  );
}
