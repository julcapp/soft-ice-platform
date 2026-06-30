import React, { useState } from 'react';
import { flavorOfDay, product, syrups, toppings } from '../../domain/catalog.js';
import { trackEvent } from '../../analytics/trackEvent.js';

function OptionCard({ item, selected, onSelect }) {
  return (
    <button className={selected ? 'option-card selected' : 'option-card'} type="button" onClick={onSelect}>
      <span className="option-icon">{item.icon}</span>
      <span>{item.name}</span>
    </button>
  );
}

export function ProductScreen({ onBack }) {
  const [selectedSyrup, setSelectedSyrup] = useState(syrups[0].id);
  const [selectedTopping, setSelectedTopping] = useState(toppings[0].id);

  function selectSyrup(id) {
    setSelectedSyrup(id);
    trackEvent('SyrupSelected', { syrup_id: id });
  }

  function selectTopping(id) {
    setSelectedTopping(id);
    trackEvent('ToppingSelected', { topping_id: id });
  }

  function continueOrder() {
    trackEvent('ContinuePressed', { product_id: product.id, syrup_id: selectedSyrup, topping_id: selectedTopping });
  }

  return (
    <main className="app-shell">
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
          <strong className="price">{product.price} {product.currency}</strong>
        </div>
      </section>

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
          <strong>{product.price} {product.currency}</strong>
        </div>
        <button className="button primary" type="button" onClick={continueOrder}>Далее</button>
      </footer>
    </main>
  );
}
