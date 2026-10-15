"""Read-only adapter from the canonical backend to the legacy Mini App shape.

This module never falls back to demo prices and does not create payments.
"""
import json
from urllib.parse import quote
from urllib.request import Request, urlopen


def catalog_from_backend(data):
    if not isinstance(data, dict) or not data.get("machine", {}).get("id"):
        raise ValueError("Сервер вернул неполный каталог аппарата")
    if data.get("currency") != "RUB":
        raise ValueError("Валюта каталога не поддерживается")

    def item(source):
        price = source.get("basePrice")
        if isinstance(price, bool) or not isinstance(price, (int, float)) or not 0 <= price < float("inf"):
            raise ValueError("Сервер вернул некорректную цену")
        if not source.get("id") or not source.get("sku") or not source.get("nameRu"):
            raise ValueError("Сервер вернул неполную позицию каталога")
        return {"id": source["id"], "sku": source["sku"], "name": source["nameRu"],
                "price": price, "available": source.get("available") is True,
                "system_item": source.get("systemItem") is True}

    base = data.get("currentFlavor")
    if not isinstance(base, dict) or base.get("category") != "ICE_CREAM":
        raise ValueError("Основной вкус аппарата не настроен")
    toppings = [item(x) for x in data.get("toppings", []) if x.get("category") == "TOPPING"]
    additives = [item(x) for x in data.get("sprinkles", []) if x.get("category") == "SPRINKLE"]
    return {"catalog_version": "backend-v1", "currency": data["currency"],
            "machine_id": data["machine"]["id"], "products": [item(base)],
            "toppings": toppings, "additives": additives}


def load_backend_catalog(machine_id, opener=urlopen):
    if not isinstance(machine_id, str) or not machine_id.strip() or len(machine_id) > 128:
        raise ValueError("Выберите аппарат для получения заказа")
    # Fixed loopback origin: client input cannot choose a host or request secrets.
    request = Request("http://127.0.0.1:8800/api/v1/catalog/machines/" + quote(machine_id, safe=""),
                      headers={"Accept": "application/json"})
    with opener(request, timeout=5) as response:
        raw = response.read(1024 * 1024 + 1)
    if len(raw) > 1024 * 1024:
        raise ValueError("Каталог временно недоступен")
    result = catalog_from_backend(json.loads(raw).get("data"))
    if result["machine_id"] != machine_id:
        raise ValueError("Каталог относится к другому аппарату")
    return result
