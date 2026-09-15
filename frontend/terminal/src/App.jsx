import { terminalContent } from './data/terminalContent.js';
import './styles.css';

function IceCreamVisual() {
  return (
    <div className="product-visual" aria-hidden="true">
      <div className="soft-serve">
        <span className="swirl swirl-top" />
        <span className="swirl swirl-middle" />
        <span className="swirl swirl-bottom" />
      </div>
      <div className="cup">
        <div className="cup-brand">У Тимоши</div>
        <div className="cup-heart">♥</div>
      </div>
    </div>
  );
}

export default function App() {
  const startPurchase = () => {
    window.dispatchEvent(new CustomEvent('terminal:navigate', { detail: { screen: 'customize' } }));
  };

  const openClub = () => {
    window.dispatchEvent(new CustomEvent('terminal:navigate', { detail: { screen: 'loyalty' } }));
  };

  return (
    <main className="terminal-shell">
      <header className="brand-header">
        <div className="brand-mark" aria-label={terminalContent.brand}>Т</div>
        <div>
          <div className="brand-name">{terminalContent.brand}</div>
          <div className="brand-caption">{terminalContent.eyebrow}</div>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">Мороженое рядом</div>
          <h1>{terminalContent.title}</h1>
          <p className="subtitle">{terminalContent.subtitle}</p>
        </div>

        <IceCreamVisual />

        <p className="flavor-note">{terminalContent.flavorNote}</p>
      </section>

      <section className="actions" aria-label="Действия">
        <button className="primary-action" type="button" onClick={startPurchase} aria-label={terminalContent.accessibilityLabel}>
          {terminalContent.primaryAction}
          <span aria-hidden="true">→</span>
        </button>

        <button className="club-card" type="button" onClick={openClub}>
          <span className="club-icon" aria-hidden="true">♥</span>
          <span className="club-copy">
            <strong>{terminalContent.clubTitle}</strong>
            <small>{terminalContent.clubText}</small>
          </span>
          <span className="club-cta">{terminalContent.clubAction}</span>
        </button>
      </section>

      <footer className="terminal-footer">
        <span>Оплата картой или СБП</span>
        <span className="status-dot" aria-hidden="true" />
        <span>Аппарат готов к заказу</span>
      </footer>
    </main>
  );
}
