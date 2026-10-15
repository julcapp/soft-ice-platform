const message = document.getElementById("warehouse-message");
let warehouse = null;

function safe(value) {
  return String(value || "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[c]);
}

async function api(path, body = {}) {
  const response = await fetch(path, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Сервер недоступен");
  return payload;
}

function draw() {
  drawMix();
  drawCategory("topping", warehouse.toppings, warehouse.topping_slots);
  drawCategory("additive", warehouse.additives, warehouse.additive_slots);
}

function drawMix() {
  const current = warehouse.mixes.find(item => item.id === warehouse.active_mix_id);
  const choices = warehouse.mixes.filter(item => item.stock > 0);
  document.getElementById("mix-active").innerHTML = `<article class="warehouse-slot mix-slot"><div><span class="stock-active">Активный вкус терминала</span><h2>${safe(current?.flavor || current?.name)}</h2><p>${safe(current?.name)} · ${current?.volume_ml || 0} мл · ${current?.price || 0} ₽</p></div><div><label for="active-mix">Сменить смесь и вкус</label><select id="active-mix">${choices.map(item => `<option value="${item.id}" ${item.id === warehouse.active_mix_id ? "selected" : ""}>${safe(item.flavor)} · остаток ${item.stock} ${safe(item.unit)}</option>`).join("")}</select><button type="button" data-replace-mix>Применить новый вкус</button></div></article>`;
  document.getElementById("mix-stock").innerHTML = `<table class="stock-table"><thead><tr><th>Вкус / смесь</th><th>Цена порции</th><th>Остаток</th><th>Минимум</th><th>Статус</th></tr></thead><tbody>${warehouse.mixes.map(item => `<tr><td><b>${safe(item.flavor)}</b><br><small>${safe(item.name)}</small></td><td>${item.price} ₽</td><td>${item.stock} ${safe(item.unit)}</td><td>${item.minimum_stock} ${safe(item.unit)}</td><td class="${item.active ? "stock-active" : item.low_stock ? "stock-low" : ""}">${item.active ? "В аппарате" : item.stock <= 0 ? "Нет в наличии" : item.low_stock ? "Нужно пополнить" : "Резерв"}</td></tr>`).join("")}</tbody></table>`;
  const byId = Object.fromEntries(warehouse.mixes.map(item => [item.id, item]));
  const changes = [...(warehouse.mix_change_log || [])].reverse();
  document.getElementById("mix-log").innerHTML = changes.length ? `<table class="stock-table"><thead><tr><th>Дата и время</th><th>Было</th><th>Стало</th><th>Источник</th></tr></thead><tbody>${changes.map(item => `<tr><td>${new Date(item.changed_at * 1000).toLocaleString("ru-RU")}</td><td>${safe(byId[item.previous_mix_id]?.flavor || item.previous_mix_id)}</td><td><b>${safe(byId[item.new_mix_id]?.flavor || item.new_mix_id)}</b></td><td>Оператор склада</td></tr>`).join("")}</tbody></table>` : `<p class="operations-empty">Смен вкуса пока не было</p>`;
}

function drawCategory(type, items, slots) {
  const grid = document.getElementById(`${type}-grid`);
  const stock = document.getElementById(`${type}-stock`);
  const byId = Object.fromEntries(items.map(item => [item.id, item]));
  const title = type === "topping" ? "топпинга" : "добавки";
  grid.innerHTML = Object.entries(slots).map(([slotId, itemId], index) => {
    const current = byId[itemId];
    const choices = items.filter(item => item.stock > 0 && (!item.active_slot || item.active_slot === slotId));
    return `<article class="warehouse-slot"><h2>Ячейка ${index + 1}</h2><span class="installed">${safe(current.name)}</span><label for="${slotId}">Заменить из складской базы</label><select id="${slotId}" data-slot-select="${slotId}">${choices.map(item => `<option value="${item.id}" ${item.id === itemId ? "selected" : ""}>${safe(item.name)} · ${item.price} ₽ · остаток ${item.stock}</option>`).join("")}</select><button type="button" data-replace-type="${type}" data-replace="${slotId}">Применить замену</button></article>`;
  }).join("");
  stock.innerHTML = `<table class="stock-table"><thead><tr><th>Наименование ${title}</th><th>Цена</th><th>Остаток</th><th>Статус</th></tr></thead><tbody>${items.map(item => `<tr><td>${safe(item.name)}</td><td>${item.price} ₽</td><td>${item.stock}</td><td class="${item.active_slot ? "stock-active" : ""}">${item.active_slot ? "В аппарате" : "Резерв"}</td></tr>`).join("")}</tbody></table>`;
}

async function load(preserveMessage = false) {
  try { warehouse = await api("/api/warehouse"); if (!preserveMessage) message.textContent = ""; draw(); }
  catch (error) { message.className = "warehouse-message error"; message.textContent = error.message; }
}

document.addEventListener("click", async event => {
  const mixButton = event.target.closest("[data-replace-mix]");
  if (mixButton) {
    mixButton.disabled = true;
    try {
      await api("/api/replace-mix", {mix_id: document.getElementById("active-mix").value});
      message.className = "warehouse-message success";
      message.textContent = "Вкус изменён. Терминал и Mini App уже используют новую смесь.";
      await load(true);
    } catch (error) {
      message.className = "warehouse-message error";
      message.textContent = error.message;
    } finally { mixButton.disabled = false; }
    return;
  }
  const button = event.target.closest("[data-replace]");
  if (!button) return;
  const slotId = button.dataset.replace;
  const type = button.dataset.replaceType;
  const itemId = document.querySelector(`[data-slot-select="${slotId}"]`).value;
  button.disabled = true;
  try {
    const path = type === "topping" ? "/api/replace-topping" : "/api/replace-additive";
    const payload = type === "topping" ? {slot_id:slotId, topping_id:itemId} : {slot_id:slotId, additive_id:itemId};
    await api(path, payload);
    message.className = "warehouse-message";
    message.textContent = "Замена сохранена. Меню терминала обновится при следующем открытии каталога.";
    await load();
  } catch (error) {
    message.className = "warehouse-message error";
    message.textContent = error.message;
  } finally { button.disabled = false; }
});

load();
