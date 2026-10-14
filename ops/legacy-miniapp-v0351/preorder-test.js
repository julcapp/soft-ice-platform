(() => {
  const app = document.getElementById('shared-preorder');
  const tg = window.Telegram?.WebApp;
  tg?.ready(); tg?.expand();
  const state = { catalog: null, quote: null, orderId: null, toppingId: null, sprinkleId: null, busy: false };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]));
  const money = (value, currency = 'RUB') => new Intl.NumberFormat('ru-RU', { style: 'currency', currency }).format(Number(value));
  async function api(path, data = {}) {
    if (!tg?.initData) throw new Error('Откройте эту страницу кнопкой в тестовом Telegram-боте.');
    const response = await fetch(`/api/tma/shared-preorder/${path}`, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, init_data: tg.initData }) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message || payload.error || 'Сервис временно недоступен.');
    return payload.data;
  }
  function notice(text) { app.innerHTML = `<h1>Предзаказ «У Тимоши»</h1><p role="status">${esc(text)}</p><button id="retry">Повторить</button>`; document.getElementById('retry').onclick = load; }
  function render() {
    const c = state.catalog;
    const options = (items, selected) => items.map(x => `<option value="${esc(x.id)}" ${x.id === selected ? 'selected' : ''} ${x.available ? '' : 'disabled'}>${esc(x.nameRu)} · ${esc(money(x.basePrice))}</option>`).join('');
    app.innerHTML = `<h1>Купить для получения позже</h1><p>${esc(c.machine.name)} · ${esc(c.machine.location)}</p>
      <h2>${esc(c.currentFlavor.nameRu)}</h2><label>Топпинг <select id="topping">${options(c.toppings, state.toppingId)}</select></label>
      <p><label>Посыпка <select id="sprinkle">${options(c.sprinkles, state.sprinkleId)}</select></label></p>
      <p id="price">${state.quote ? `Итого: ${esc(money(state.quote.finalAmount, state.quote.currency))}` : 'Рассчитываем цену…'}</p>
      <p>После подтверждения оплаты заказ будет ждать получения на этом аппарате.</p>
      <button id="pay" ${!state.quote || state.busy ? 'disabled' : ''}>Оплатить тестовой картой</button><p id="error" role="alert"></p>`;
    document.getElementById('topping').onchange = event => { state.toppingId = event.target.value; state.orderId = null; state.quote = null; calculate(); };
    document.getElementById('sprinkle').onchange = event => { state.sprinkleId = event.target.value; state.orderId = null; state.quote = null; calculate(); };
    document.getElementById('pay').onclick = pay;
  }
  let calculation = 0;
  async function calculate() {
    const version = ++calculation;
    state.quote = null; render();
    try {
      const quote = await api('quote', { productId: state.catalog.currentFlavor.id, toppingId: state.toppingId, sprinkleId: state.sprinkleId });
      if (version !== calculation) return;
      state.quote = quote; render();
    } catch (error) { if (version === calculation) document.getElementById('error').textContent = error.message; }
  }
  async function pay() {
    if (state.busy || (!state.quote && !state.orderId)) return;
    if (!state.orderId && new Date(state.quote.lockedUntil) <= new Date()) return calculate();
    state.busy = true; if (state.catalog) render();
    try {
      if (!state.orderId) {
        const key = `miniapp:${state.quote.id}`;
        const order = await api('orders', { quoteId: state.quote.id, idempotencyKey: key });
        state.orderId = order.id;
        localStorage.setItem('softice_shared_preorder', order.id);
      }
      const payment = await api(`orders/${state.orderId}/payment`);
      const url = new URL(payment.confirmationUrl);
      if (url.protocol !== 'https:' || !['yoomoney.ru', 'yookassa.ru'].includes(url.hostname)) throw new Error('Ссылка оплаты не подтверждена.');
      if (tg.openLink) tg.openLink(url.href); else window.location.href = url.href;
      app.innerHTML = '<h1>Ожидаем оплату</h1><p>Вернитесь сюда после оплаты. Повторно оплачивать не нужно.</p><button id="status">Проверить оплату</button>';
      document.getElementById('status').onclick = checkStatus;
    } catch (error) { state.busy = false; if (state.catalog) { render(); document.getElementById('error').textContent = error.message; } else notice(error.message); }
  }
  async function checkStatus() {
    try {
      const result = await api(`orders/${state.orderId}/status`);
      if (result.pickupExpired) return notice('Срок получения заказа истёк. Обратитесь в поддержку для решения по оплате.');
      if (result.waitingPickup) {
        app.innerHTML = `<h1>Заказ оплачен</h1><p>${esc(money(result.amount, result.currency))}</p><p>Аппарат: ${esc(result.machineId)}</p>
          <p>Получить до ${esc(new Date(result.expiresAt).toLocaleString('ru-RU'))}.</p><p>Заказ ожидает получения.</p>
          <button id="pickup-code">Я у аппарата — получить код</button>`;
        document.getElementById('pickup-code').onclick = activatePickupCode;
      } else {
        notice(['FAILED', 'CANCELED', 'REFUNDED'].includes(result.paymentStatus) ? 'Заказ не оплачен или платёж возвращён.' : 'Оплата пока не подтверждена.');
        if (['NOT_STARTED', 'CREATED', 'PENDING', 'AUTHORIZED'].includes(result.paymentStatus)) {
          const button = document.createElement('button'); button.textContent = 'Открыть оплату этого заказа'; button.onclick = () => { state.busy = false; pay(); }; app.append(button);
        } else {
          const button = document.createElement('button'); button.textContent = 'Вернуться к выбору'; button.onclick = () => { localStorage.removeItem('softice_shared_preorder'); state.orderId = null; state.busy = false; load(); }; app.append(button);
        }
      }
    } catch (error) { notice(error.message); }
  }
  async function activatePickupCode() {
    try {
      const result = await api(`orders/${state.orderId}/pickup-code`);
      app.innerHTML = `<h1>Код получения</h1><p class="pickup-code-value">${esc(result.code)}</p>
        <p>Введите этот код на экране аппарата «Получить оплаченный заказ».</p>
        <p>Или покажите QR-код сканеру аппарата.</p>
        <p>Код действует до ${esc(new Date(result.expiresAt).toLocaleString('ru-RU'))}.</p>
        <button id="show-qr">Показать QR-код</button>
        <div id="pickup-qr" hidden><img alt="QR-код получения заказа" src="${esc(result.qrDataUrl)}" style="max-width:320px;width:82vw;height:auto;background:#fff;padding:12px;border-radius:18px" /></div>
        <button id="refresh-code">Получить новый код</button>`;
      document.getElementById('show-qr').onclick = () => { const box = document.getElementById('pickup-qr'); box.hidden = !box.hidden; document.getElementById('show-qr').textContent = box.hidden ? 'Показать QR-код' : 'Скрыть QR-код'; };
      document.getElementById('refresh-code').onclick = activatePickupCode;
    } catch (error) { notice(error.message); }
  }
  async function load() {
    try {
      state.orderId = localStorage.getItem('softice_shared_preorder');
      if (!state.orderId) {
        const recent = await api('orders/recent');
        if (recent?.orderId) {
          state.orderId = recent.orderId;
          localStorage.setItem('softice_shared_preorder', recent.orderId);
        }
      }
      if (state.orderId) return checkStatus();
      state.catalog = await api('catalog');
      state.toppingId = state.catalog.toppings.find(x => x.systemItem && x.available)?.id;
      state.sprinkleId = state.catalog.sprinkles.find(x => x.systemItem && x.available)?.id;
      await calculate();
    } catch (error) { notice(error.message); }
  }
  app.textContent = 'Загружаем меню…'; load();
})();
