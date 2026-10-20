(() => {
  const app = document.getElementById('shared-preorder');
  const tg = window.Telegram?.WebApp;
  tg?.ready(); tg?.expand();
  const state = { catalog: null, quote: null, orderId: null, toppingId: null, sprinkleId: null, busy: false };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]));
  const money = (value, currency = 'RUB') => new Intl.NumberFormat('ru-RU', { style: 'currency', currency }).format(Number(value));
  let activeCheckout=null,topupPoll=null;
  function shell(content, tab = 'buy') {
    activeCheckout?.destroy();activeCheckout=null;clearTimeout(topupPoll);
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
        <section class="shared-card"><small>Тестовый клубный счёт</small><h2>${esc(money(data.testClubBalanceRub || 0))}</h2><p>Тестовые пополнения учитываются отдельно от реальных денег.</p></section>
        <section class="shared-card"><small>Бонусный баланс</small><h2>${data.bonusBalance === null ? 'Счёт пока не открыт' : esc(data.bonusBalance)}</h2><p>${esc(catalog.account.bonusNotice || '')}</p></section>
        ${data.clubOffer ? `<section class="shared-card"><h2>Пополнение клубного счёта</h2><p>Первоначальное пополнение: ${esc(money(data.clubOffer.initialTopupRub))}. Вся сумма зачисляется на ваш денежный клубный счёт для будущих покупок.</p><p>Пополнение для всех участников, в том числе по приглашению. Оплата через Mini App.</p><button id="club-topup" ${data.clubOffer.checkoutEnabled ? '' : 'disabled'}>Пополнить на ${esc(money(data.clubOffer.initialTopupRub))}</button><p>Сейчас доступна тестовая оплата.</p></section>` : ''}`, 'club');
      const topupButton=document.getElementById('club-topup');if(topupButton)topupButton.onclick=startClubTopup;
      const savedTopup=localStorage.getItem('softice_club_topup');if(savedTopup&&topupButton){const button=document.createElement('button');button.textContent='Проверить пополнение';button.onclick=()=>showTopupStatus(savedTopup);topupButton.after(button);}
      app.scrollIntoView({ block: 'start' });
    } catch (error) { if (request === accountRequest) notice(error.message); }
  }
  let accountFilter = 'active', accountPage = 0, accountRequest = 0;
  async function account() {
    ++calculation;
    const request = ++accountRequest;
    try {
      const catalog = await api('catalog', { accountFilter, accountPage });
      if (request !== accountRequest) return;
      state.catalog = catalog; state.quote = null;
      const data = catalog.account;
      const labels = { CREATED: 'Создан', PAYMENT_PENDING: 'Ожидает оплаты', PAID: 'Ожидает получения', GIFT_TRANSFERRED: 'Передан в подарок', COMPLETED: 'Получен', CANCELLED: 'Отменён', REFUNDED: 'Платёж возвращён', SUCCEEDED: 'Оплата подтверждена' };
      const status = order => order.paymentStatus === 'REFUNDED' ? labels.REFUNDED : order.status === 'PAID' && order.paymentStatus !== 'SUCCEEDED' ? 'Требует проверки оплаты' : labels[order.status] || order.status;
      shell(`<h1>Ваши заказы</h1><p>${esc(data.customer.name || 'Клуб Тимоши')}</p>
        <p>Клубный счёт: ${data.clubBalance === null ? 'нет данных' : esc(money(data.clubBalance))} · Бонусы: ${data.bonusBalance === null ? 'нет данных' : esc(data.bonusBalance)}</p>
        <label>Показать <select id="history-filter">${[['all','Все заказы'],['active','Оплачены · ждут получения'],['completed','Полученные'],['refunded','Возвраты']].map(([value,label]) => `<option value="${value}" ${value === accountFilter ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
        <div style="margin:16px 0">${data.orders.length ? data.orders.map(order => `<details style="background:white;padding:12px;border-radius:14px;margin:8px 0">
          <summary style="cursor:pointer"><strong>${esc(status(order))} · ${esc(money(order.amount, order.currency))}</strong><br><small>${esc(new Date(order.createdAt).toLocaleString('ru-RU'))}</small></summary>
          <p>Заказ № ${esc(order.id)}</p><p>${esc(order.composition.join(' · ') || 'Состав не сохранён')}</p>
          <p>${esc(labels[order.paymentStatus] || 'Статус оплаты не подтверждён')}</p>
          <p>Аппарат: ${esc(order.machineId)}</p>${order.expiresAt ? `<p>Получить до: ${esc(new Date(order.expiresAt).toLocaleString('ru-RU'))}</p>` : ''}${order.status === 'PAID' && order.paymentStatus === 'SUCCEEDED' ? `<button data-order-id="${esc(order.id)}">Получить заказ</button>` : order.status === 'PAYMENT_PENDING' ? `<button data-order-id="${esc(order.id)}">Проверить оплату</button>` : ''}</details>`).join('') : '<p>Заказов в этом разделе пока нет.</p>'}</div>
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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`/api/tma/shared-preorder/${path}`, { method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, init_data: tg.initData }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || payload.error || 'Сервис временно недоступен.');
      return payload.data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Сервер отвечает дольше обычного. Повторите проверку. Если вы уже оплатили заказ, повторно платить не нужно.');
      throw error;
    } finally { clearTimeout(timer); }
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
      <p>Тестовый клубный остаток: ${esc(money(c.account?.testClubBalanceRub || 0))}</p>
      <button id="club-pay" ${!state.quote || state.busy || Number(c.account?.testClubBalanceRub || 0) < Number(state.quote?.finalAmount || Infinity) ? 'disabled' : ''}>Оплатить клубным остатком · тест</button>
      <button id="sber-pay" ${!state.quote || state.busy || !c.paymentMethods?.some(x => x.id === 'sber_sbp' && x.available === true) ? 'disabled' : ''}><img src="https://display.utimoshi.ru/images/payments/sbp.svg" alt="" aria-hidden="true" width="64" height="31" style="vertical-align:middle;object-fit:contain;margin-right:10px">Оплата по СБП</button><p class="shared-payment-hint">${c.paymentMethods?.some(x => x.id === 'sber_sbp' && x.available === true) ? 'Выберите свой банк на странице СБП после перехода к оплате.' : 'Подключается · скоро будет доступно'}</p>
      <button id="pay" ${!state.quote || state.busy ? 'disabled' : ''}>Оплатить тестовой картой</button><p id="error" role="alert"></p>`);
    document.getElementById('topping').onchange = event => { state.toppingId = event.target.value; state.orderId = null; state.quote = null; calculate(); };
    document.getElementById('sprinkle').onchange = event => { state.sprinkleId = event.target.value; state.orderId = null; state.quote = null; calculate(); };
    document.getElementById('pay').onclick = () => pay();
    document.getElementById('club-pay').onclick = () => pay('club');
    document.getElementById('sber-pay').onclick = () => pay('sber');
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
  async function pay(method = 'card') {
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
      if (method === 'club') {
        const result = await api(`orders/${state.orderId}/club-payment`);
        if (state.catalog?.account) state.catalog.account.testClubBalanceRub = result.balanceRub;
        state.busy = false;
        return checkStatus();
      }
      const payment = await api(`orders/${state.orderId}/${method === 'sber' ? 'sber-payment' : 'payment'}`);
      const url = new URL(payment.confirmationUrl);
      const allowed = method === 'sber' ? url.hostname === 'qr.nspk.ru' && url.searchParams.get('type') === '02' : ['yoomoney.ru', 'yookassa.ru'].includes(url.hostname);
      if (url.protocol !== 'https:' || url.username || url.password || url.port || !allowed) throw new Error('Ссылка оплаты не подтверждена.');
      if (tg.openLink) tg.openLink(url.href); else window.location.href = url.href;
      shell('<h1>Ожидаем оплату</h1><p>Вернитесь сюда после оплаты. Повторно оплачивать не нужно.</p><button id="status">Проверить оплату</button>', 'account');
      document.getElementById('status').onclick = checkStatus;
    } catch (error) { state.busy = false; if (state.catalog) { render(); document.getElementById('error').textContent = error.message; } else notice(error.message); }
  }
  async function checkStatus() {
    try {
      const result = await api(`orders/${state.orderId}/status`);
      if (result.status === 'GIFT_TRANSFERRED') return notice('Этот заказ передан в подарок. Прежний код получения больше не действует.');
      if (result.pickupExpired) return notice('Срок получения заказа истёк. Обратитесь в поддержку для решения по оплате.');
      if (result.waitingPickup) {
        shell(`<h1>Заказ оплачен</h1><p>${esc(money(result.amount, result.currency))}</p><p>Аппарат: ${esc(result.machineId)}</p>
          <p>Получить до ${esc(new Date(result.expiresAt).toLocaleString('ru-RU'))}.</p><p>Заказ ожидает получения.</p>
          <button id="pickup-code">Я у аппарата — получить код</button><button id="make-gift">🎁 Сделать подарок</button>`, 'account');
        document.getElementById('pickup-code').onclick = activatePickupCode;
        document.getElementById('make-gift').onclick = giftForm;
      } else {
        notice(['FAILED', 'CANCELED', 'REFUNDED'].includes(result.paymentStatus) ? 'Заказ не оплачен или платёж возвращён.' : 'Оплата пока не подтверждена.');
        if (result.paymentStatus === 'NOT_STARTED' && result.status === 'PAYMENT_PENDING') {
          const button = document.createElement('button'); button.textContent = 'Оплатить клубным остатком · тест';
          button.onclick = () => { state.busy = false; pay('club'); }; document.getElementById('shared-content').append(button);
        }
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
  let widgetLibrary=null;
  function loadCheckoutWidget(){
    if(window.YooMoneyCheckoutWidget)return Promise.resolve();
    if(widgetLibrary)return widgetLibrary;
    widgetLibrary=new Promise((resolve,reject)=>{
      const script=document.createElement('script'),timer=setTimeout(()=>{script.remove();reject(new Error('Форма оплаты загружается дольше обычного. Проверьте статус пополнения перед повтором.'));},15000);
      script.src='https://yookassa.ru/checkout-widget/v1/checkout-widget.js';
      script.onload=()=>{clearTimeout(timer);window.YooMoneyCheckoutWidget?resolve():reject(new Error('Не удалось открыть форму оплаты.'));};
      script.onerror=()=>{clearTimeout(timer);script.remove();reject(new Error('Не удалось загрузить форму ЮKassa. Проверьте подключение.'));};
      document.head.append(script);
    }).catch(error=>{widgetLibrary=null;throw error;});return widgetLibrary;
  }
  async function showTopupStatus(id){
    try{
      const result=await api(`club/topup/${id}/status`);
      if(result.status==='SUCCEEDED'){
        localStorage.removeItem('softice_club_topup');
        shell(`<h1>Пополнение подтверждено</h1><p>${esc(money(result.amountRub))} зачислено на тестовый клубный счёт. Реальный денежный остаток не изменён.</p><button id="topup-done">В клуб</button>`, 'club');
        document.getElementById('topup-done').onclick=club;
      }else if(result.status==='CANCELED'){
        localStorage.removeItem('softice_club_topup');shell('<h1>Платёж отменён</h1><p>Пополнение не зачислено.</p><button id="topup-done">В клуб</button>','club');document.getElementById('topup-done').onclick=club;
      }else{
        const status=document.getElementById('topup-status');if(status)status.textContent='Оплата пока не подтверждена. Повторно платить не нужно.';
      }
      return result;
    }catch(error){const status=document.getElementById('topup-status');if(status)status.textContent=error.message;else notice(error.message);}
  }
  async function startClubTopup(){
    const button=document.getElementById('club-topup');if(button)button.disabled=true;
    try{
      const result=await api('club/topup');localStorage.setItem('softice_club_topup',result.id);
      if(result.status==='SUCCEEDED'||result.status==='CANCELED')return showTopupStatus(result.id);
      shell(`<h1>Пополнение клубного счёта</h1><p>Тестовая оплата: ${esc(money(result.amountRub))}</p><div id="club-payment-form" style="min-width:288px"></div><p id="topup-status" role="status">Загружаем форму оплаты…</p><button id="topup-check">Проверить оплату</button>`, 'club');
      document.getElementById('topup-check').onclick=()=>showTopupStatus(result.id);
      if(!result.confirmationToken){document.getElementById('topup-status').textContent='Проверяем ранее созданное пополнение. Повторно платить не нужно.';return showTopupStatus(result.id);}
      await loadCheckoutWidget();if(!document.getElementById('club-payment-form'))return;
      activeCheckout=new window.YooMoneyCheckoutWidget({confirmation_token:result.confirmationToken,error_callback:()=>{const status=document.getElementById('topup-status');if(status)status.textContent='Форма оплаты недоступна. Нажмите «Проверить оплату».';}});
      activeCheckout.on('complete',()=>showTopupStatus(result.id));
      await activeCheckout.render('club-payment-form');document.getElementById('topup-status').textContent='После оплаты дождитесь подтверждения сервера.';
      let attempts=0;const poll=async()=>{if(!document.getElementById('club-payment-form'))return;const status=await showTopupStatus(result.id);if(status&&['SUCCEEDED','CANCELED'].includes(status.status))return;if(++attempts<24)topupPoll=setTimeout(poll,5000);};topupPoll=setTimeout(poll,5000);
    }catch(error){notice(error.message);}
  }
  function giftForm() {
    shell(`<h1>Сделать подарок</h1><p>Укажите телефон получателя. После подтверждения право получения передаётся ему, ваш прежний код перестанет действовать. Срок заказа сохраняется.</p>
      <p>Получатель сможет принять подарок в боте. Выдача подарков на аппарате пока проходит интеграцию; для немедленного получения передавать заказ не следует.</p>
      <label>Телефон получателя<div style="display:flex;align-items:center;gap:8px"><span aria-hidden="true" style="font-weight:700">+7</span><input id="gift-phone" aria-label="Телефон получателя: 10 цифр после +7" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="15" placeholder="(999) 123-45-67"></div></label>
      <label><input id="gift-confirm" type="checkbox"> Подтверждаю передачу заказа этому получателю</label>
      <button id="gift-submit" disabled>Передать подарок</button><button id="gift-back">Назад к заказу</button><p id="gift-error" role="alert"></p>`, 'account');
    document.getElementById('gift-back').onclick = checkStatus;
    const phoneInput=document.getElementById('gift-phone'), confirmInput=document.getElementById('gift-confirm');
    let phoneDigits='';
    function updateGiftPhone(value){
      let digits=String(value).replace(/\D/g,'');
      if(digits.length>=11&&/^[78]/.test(digits))digits=digits.slice(1);
      phoneDigits=digits.slice(0,10);
      const d=phoneDigits;
      phoneInput.value=d?`(${d.slice(0,3)}${d.length>=3?') ':''}${d.slice(3,6)}${d.length>6?'-'+d.slice(6,8):''}${d.length>8?'-'+d.slice(8,10):''}`:'';
      document.getElementById('gift-submit').disabled=phoneDigits.length!==10||!confirmInput.checked;
    }
    phoneInput.oninput=()=>updateGiftPhone(phoneInput.value);
    phoneInput.onkeydown=event=>{if(event.key==='Backspace'&&phoneInput.selectionStart===phoneInput.value.length&&phoneInput.selectionStart===phoneInput.selectionEnd){event.preventDefault();updateGiftPhone(phoneDigits.slice(0,-1));}};
    phoneInput.onpaste=event=>{event.preventDefault();updateGiftPhone(event.clipboardData.getData('text'));};
    confirmInput.onchange=()=>updateGiftPhone(phoneDigits);

    document.getElementById('gift-submit').onclick = async () => {
      const button = document.getElementById('gift-submit'), errorBox = document.getElementById('gift-error');
      if (phoneDigits.length!==10) { errorBox.textContent='Введите 10 цифр номера после +7.'; return; }
      if (!document.getElementById('gift-confirm').checked) { errorBox.textContent = 'Подтвердите передачу заказа.'; return; }
      button.disabled = true;
      try {
        const result = await api(`orders/${state.orderId}/gift`, { recipientPhone:'+7'+phoneDigits });
        localStorage.removeItem('softice_shared_preorder'); state.orderId = null;
        shell(`<h1>Подарок создан</h1><p>Номер: ${esc(result.giftId)}</p><p>Получить до ${esc(new Date(result.expiresAt).toLocaleString('ru-RU'))}.</p><p>${result.status === 'WAITING_FOR_REGISTRATION' ? 'Ожидается регистрация получателя с указанным телефоном.' : 'Подарок доступен получателю для принятия в боте.'}</p><p>${result.deliveryQueued ? 'Уведомление поставлено в очередь; доставка ещё не подтверждена.' : 'Доставка уведомления не подтверждена.'}</p><button id="gift-done">Мои заказы</button>`, 'account');
        document.getElementById('gift-done').onclick = account;
      } catch (error) { errorBox.textContent = error.message + ' Если запрос прервался, проверьте статус заказа перед повтором.'; button.disabled = false; }
    };
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
