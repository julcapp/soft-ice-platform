(() => {
  const app = document.getElementById('shared-preorder');
  const tg = window.Telegram?.WebApp;
  tg?.ready(); tg?.expand();
  const state = { catalog: null, quote: null, orderId: null, toppingId: null, sprinkleId: null, busy: false };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]));
  const money = (value, currency = 'RUB') => new Intl.NumberFormat('ru-RU', { style: 'currency', currency }).format(Number(value));
  function shell(content, tab = 'buy') {
    const name = state.catalog?.account?.customer?.name || 'Участник клуба';
    app.innerHTML = `<header class="app-header"><button class="back" id="shared-back" aria-label="Назад в кабинет">‹</button><a class="brand" href="#" id="shared-brand"><span style="background:var(--berry);color:white;border-radius:50%;width:32px;height:32px;display:grid;place-items:center;font-family:Georgia,serif">У</span> Тимоши</a><button class="profile" id="shared-profile" aria-label="Личный кабинет">${esc(name.slice(0,1).toUpperCase())}</button></header>
      <section id="shared-content"><p class="shared-eyebrow">${tab === 'account' ? 'Личный кабинет' : tab === 'club' ? 'Клуб Тимоши' : 'У Тимоши'}</p>${content}</section>
      <nav class="bottom-nav" aria-label="Разделы приложения"><button id="buy-tab" ${tab === 'buy' ? 'aria-current="page"' : ''}><i>⌂</i>Главная</button><button id="account-tab" ${tab === 'account' ? 'aria-current="page"' : ''}><i>▣</i>Кабинет</button><button id="club-tab" ${tab === 'club' ? 'aria-current="page"' : ''}><i>★</i>Клуб</button></nav>`;
    document.getElementById('buy-tab').onclick = () => { ++accountRequest; state.busy = false; state.orderId = null; state.quote = null; localStorage.removeItem('softice_shared_preorder'); if (state.catalog) { state.toppingId ||= state.catalog.toppings.find(x => x.systemItem && x.available)?.id; state.sprinkleId ||= state.catalog.sprinkles.find(x => x.systemItem && x.available)?.id; calculate(); } else load({ resume: false }); };
    document.getElementById('account-tab').onclick = account;
    document.getElementById('shared-back').onclick = account;
    document.getElementById('shared-profile').onclick = account;
    document.getElementById('shared-brand').onclick = event => { event.preventDefault(); document.getElementById('buy-tab').click(); };
    document.getElementById('club-tab').onclick = club;
  }
  async function club() {
    ++calculation;
    const request = ++accountRequest;
    try {
      const catalog = await api('catalog');
      if (request !== accountRequest) return;
      state.catalog = catalog; state.quote = null;
      const data = catalog.account;
      shell(`<h1>Ваши балансы</h1><p>Денежный и бонусный балансы учитываются отдельно.</p>
        <section class="shared-card"><small>Денежный баланс</small><h2>${data.clubBalance === null ? 'Нет данных' : esc(money(data.clubBalance))}</h2></section>
        <section class="shared-card"><small>Бонусный баланс</small><h2>${data.bonusBalance === null ? 'Нет данных' : esc(data.bonusBalance)}</h2></section>`, 'club');
      app.scrollIntoView({ block: 'start' });
    } catch (error) { if (request === accountRequest) notice(error.message); }
  }
  let accountFilter = 'all', accountPage = 0, accountRequest = 0;
  async function account() {
    ++calculation;
    const request = ++accountRequest;
    try {
      const catalog = await api('catalog', { accountFilter, accountPage });
      if (request !== accountRequest) return;
      state.catalog = catalog; state.quote = null;
      const data = catalog.account;
      const labels = { CREATED: 'Создан', PAYMENT_PENDING: 'Ожидает оплаты', PAID: 'Ожидает получения', COMPLETED: 'Получен', CANCELLED: 'Отменён', REFUNDED: 'Платёж возвращён', SUCCEEDED: 'Оплата подтверждена' };
      const status = order => order.paymentStatus === 'REFUNDED' ? labels.REFUNDED : order.status === 'PAID' && order.paymentStatus !== 'SUCCEEDED' ? 'Требует проверки оплаты' : labels[order.status] || order.status;
      shell(`<h1>Ваши заказы</h1><p>${esc(data.customer.name || 'Клуб Тимоши')}</p>
        <p>Клубный счёт: ${data.clubBalance === null ? 'нет данных' : esc(money(data.clubBalance))} · Бонусы: ${data.bonusBalance === null ? 'нет данных' : esc(data.bonusBalance)}</p>
        <label>Показать <select id="history-filter">${[['all','Все заказы'],['active','Активные'],['completed','Полученные'],['refunded','Возвраты']].map(([value,label]) => `<option value="${value}" ${value === accountFilter ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
        <div style="margin:16px 0">${data.orders.length ? data.orders.map(order => `<details style="background:white;padding:12px;border-radius:14px;margin:8px 0">
          <summary style="cursor:pointer"><strong>${esc(status(order))} · ${esc(money(order.amount, order.currency))}</strong><br><small>${esc(new Date(order.createdAt).toLocaleString('ru-RU'))}</small></summary>
          <p>Заказ № ${esc(order.id)}</p><p>${esc(order.composition.join(' · ') || 'Состав не сохранён')}</p>
          <p>${esc(labels[order.paymentStatus] || 'Статус оплаты не подтверждён')}</p>
          <p>Аппарат: ${esc(order.machineId)}</p>${order.status === 'PAID' && order.paymentStatus === 'SUCCEEDED' ? `<button data-order-id="${esc(order.id)}">Получить заказ</button>` : order.status === 'PAYMENT_PENDING' ? `<button data-order-id="${esc(order.id)}">Проверить оплату</button>` : ''}</details>`).join('') : '<p>Заказов в этом разделе пока нет.</p>'}</div>
        <nav style="display:flex;align-items:center;justify-content:space-between;gap:8px"><button id="history-prev" ${accountPage === 0 ? 'disabled' : ''}>Назад</button><span>Страница ${accountPage + 1}</span><button id="history-next" ${!data.hasMore ? 'disabled' : ''}>Далее</button></nav>`, 'account');
      document.querySelectorAll('[data-order-id]').forEach(button => { button.onclick = () => { ++accountRequest; state.orderId = button.dataset.orderId; localStorage.setItem('softice_shared_preorder', state.orderId); checkStatus(); }; });
      document.getElementById('history-filter').onchange = event => { accountFilter = event.target.value; accountPage = 0; account(); };
      document.getElementById('history-prev').onclick = () => { if (accountPage > 0) { accountPage--; account(); } };
      document.getElementById('history-next').onclick = () => { if (data.hasMore) { accountPage++; account(); } };
      app.scrollIntoView({ block: 'start' });
    } catch (error) { if (request === accountRequest) notice(error.message); }
  }
  async function api(path, data = {}) {
    if (!tg?.initData) throw new Error('Откройте эту страницу кнопкой в тестовом Telegram-боте.');
    const response = await fetch(`/api/tma/shared-preorder/${path}`, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, init_data: tg.initData }) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message || payload.error || 'Сервис временно недоступен.');
    return payload.data;
  }
  function notice(text) { shell(`<h1>У Тимоши</h1><p role="status">${esc(text)}</p><button id="retry">Повторить</button>`, 'account'); document.getElementById('retry').onclick = load; }
  function render() {
    const c = state.catalog;
    const options = (items, selected) => items.map(x => `<option value="${esc(x.id)}" ${x.id === selected ? 'selected' : ''} ${x.available ? '' : 'disabled'}>${esc(x.nameRu)} · ${esc(money(x.basePrice))}</option>`).join('');
    shell(`<h1>Купить для получения позже</h1><p>${esc(c.machine.name)} · ${esc(c.machine.location)}</p>
      <h2>${esc(c.currentFlavor.nameRu)}</h2><label>Топпинг <select id="topping">${options(c.toppings, state.toppingId)}</select></label>
      <p><label>Посыпка <select id="sprinkle">${options(c.sprinkles, state.sprinkleId)}</select></label></p>
      <p id="price">${state.quote ? `Итого: ${esc(money(state.quote.finalAmount, state.quote.currency))}` : 'Рассчитываем цену…'}</p>
      <p>После подтверждения оплаты заказ будет ждать получения на этом аппарате.</p>
      <button id="pay" ${!state.quote || state.busy ? 'disabled' : ''}>Оплатить тестовой картой</button><p id="error" role="alert"></p>`);
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
      shell('<h1>Ожидаем оплату</h1><p>Вернитесь сюда после оплаты. Повторно оплачивать не нужно.</p><button id="status">Проверить оплату</button>', 'account');
      document.getElementById('status').onclick = checkStatus;
    } catch (error) { state.busy = false; if (state.catalog) { render(); document.getElementById('error').textContent = error.message; } else notice(error.message); }
  }
  async function checkStatus() {
    try {
      const result = await api(`orders/${state.orderId}/status`);
      if (result.pickupExpired) return notice('Срок получения заказа истёк. Обратитесь в поддержку для решения по оплате.');
      if (result.waitingPickup) {
        shell(`<h1>Заказ оплачен</h1><p>${esc(money(result.amount, result.currency))}</p><p>Аппарат: ${esc(result.machineId)}</p>
          <p>Получить до ${esc(new Date(result.expiresAt).toLocaleString('ru-RU'))}.</p><p>Заказ ожидает получения.</p>
          <button id="pickup-code">Я у аппарата — получить код</button>`, 'account');
        document.getElementById('pickup-code').onclick = activatePickupCode;
      } else {
        notice(['FAILED', 'CANCELED', 'REFUNDED'].includes(result.paymentStatus) ? 'Заказ не оплачен или платёж возвращён.' : 'Оплата пока не подтверждена.');
        if (['NOT_STARTED', 'CREATED', 'PENDING', 'AUTHORIZED'].includes(result.paymentStatus)) {
          const button = document.createElement('button'); button.textContent = 'Открыть оплату этого заказа'; button.onclick = () => { state.busy = false; pay(); }; document.getElementById('shared-content').append(button);
        } else {
          const button = document.createElement('button'); button.textContent = 'Вернуться к выбору'; button.onclick = () => { localStorage.removeItem('softice_shared_preorder'); state.orderId = null; state.busy = false; load(); }; document.getElementById('shared-content').append(button);
        }
      }
    } catch (error) { notice(error.message); }
  }
  async function load({ resume = true } = {}) {
    try {
      state.orderId = resume ? localStorage.getItem('softice_shared_preorder') : null;
      if (resume && !state.orderId) {
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
  async function activatePickupCode() {
    try {
      const result = await api(`orders/${state.orderId}/pickup-code`);
      shell(`<h1>Код получения</h1><p class="pickup-code-value">${esc(result.code)}</p>
        <p>Введите этот код на экране аппарата «Получить оплаченный заказ».</p>
        <p>Или покажите QR-код сканеру аппарата.</p>
        <p>Код действует до ${esc(new Date(result.expiresAt).toLocaleString('ru-RU'))}.</p>
        <button id="show-qr">Показать QR-код</button>
        <div id="pickup-qr" hidden><img alt="QR-код получения заказа" src="${esc(result.qrDataUrl)}" style="max-width:320px;width:100%;height:auto;background:#fff;padding:12px;border-radius:18px" /></div>
        <button id="refresh-code">Получить новый код</button>`, 'account');
      document.getElementById('show-qr').onclick = () => { const box = document.getElementById('pickup-qr'); box.hidden = !box.hidden; document.getElementById('show-qr').textContent = box.hidden ? 'Показать QR-код' : 'Скрыть QR-код'; };
      document.getElementById('refresh-code').onclick = activatePickupCode;
    } catch (error) { notice(error.message); }
  }
  app.textContent = 'Загружаем меню…'; load();
})();
