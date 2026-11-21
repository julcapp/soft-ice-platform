async function loadOperations() {
  const message = document.getElementById("operations-message");
  try {
    const response = await fetch("/api/operations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Не удалось загрузить журнал");
    const machine = data.machine || {};
    document.getElementById("operations-summary").innerHTML = [
      ["Аппарат", machine.id || "—"],
      ["Режим продаж", machine.sales_mode || "—"],
      ["Защитная блокировка", machine.safety_lock ? "Включена" : "Нет"],
      ["Открытые инциденты", (data.incidents || []).filter(item => item.status === "open").length],
      ["Сформировано чеков", (data.receipts || []).length],
      ["Бонусных операций", (data.loyalty_transactions || []).length],
      ["Активных предзаказов", (data.preorders || []).filter(item => item.status === "paid_waiting_pickup").length]
    ].map(([label, value]) => `<article><span>${label}</span><strong>${value}</strong></article>`).join("");
    renderTable("incidents", ["Номер", "Заказ", "Причина", "Статус"], (data.incidents || []).map(item => [item.incident_id, item.order_id, item.error_message || item.error_code, item.status]));
    renderTable("refunds", ["Номер", "Платёж", "Сумма", "Статус"], (data.refunds || []).map(item => [item.refund_id, item.payment_id, `${item.amount || 0} ₽`, item.status]));
    renderTable("receipts", ["Номер", "Заказ", "Сумма", "Статус"], (data.receipts || []).map(item => [item.receipt_number, item.order_id, `${item.amount || 0} ₽`, item.fiscal_status]));
    renderTable("loyalty-transactions", ["Операция", "Заказ", "Изменение", "Баланс"], (data.loyalty_transactions || []).map(item => {
      const sign = item.event === "loyalty.bonus.redeemed" ? "−" : "+";
      return [item.transaction_id, item.order_id || item.payment_id, `${sign}${item.points || 0}`, item.balance_after];
    }));
    renderTable("inventory-movements", ["Заказ", "Тип", "Позиция", "Остаток"], (data.inventory_movements || []).map(item => [item.order_id, item.item_type, item.item_id, `${item.stock_before} → ${item.stock_after}`]));
    renderTable("preorders", ["Предзаказ", "Аппарат", "Сумма", "Статус"], (data.preorders || []).map(item => [item.preorder_id, item.machine_id, `${item.amount || 0} ₽`, item.status]));
    renderTable("preorder-attempts", ["Предзаказ", "Способ", "Результат", "Аппарат"], (data.preorder_attempts || []).map(item => [item.preorder_id, item.mode === "qr" ? "QR-код" : "Цифровой код", item.result === "accepted" ? "Принят" : "Отклонён", item.machine_id]));
    message.textContent = "Журнал обновлён";
  } catch (error) {
    message.textContent = error.message;
    message.classList.add("error");
  }
}

function renderTable(id, headers, rows) {
  const node = document.getElementById(id);
  if (!rows.length) {
    node.innerHTML = `<p class="operations-empty">Записей пока нет</p>`;
    return;
  }
  node.innerHTML = `<div class="operations-table-wrap"><table class="stock-table"><thead><tr>${headers.map(value => `<th>${value}</th>`).join("")}</tr></thead><tbody>${rows.slice().reverse().map(row => `<tr>${row.map(value => `<td>${String(value ?? "—")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

loadOperations();
