from __future__ import annotations

import hashlib
import hmac
import html
import json
import mimetypes
import os
import re
import secrets
import threading
import time
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qsl, quote, urlencode, urlparse
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parent
DATA_FILE = Path(os.environ.get("SOFT_ICE_DATA_FILE", str(ROOT / "crm_test_data.json"))).expanduser().resolve()
HOST = os.environ.get("SOFT_ICE_HOST", "127.0.0.1").strip() or "127.0.0.1"
PORT = int(os.environ.get("SOFT_ICE_PORT", "8780"))
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
MAX_BOT_TOKEN = os.environ.get("MAX_BOT_TOKEN", "").strip()
TELEGRAM_WEBAPP_URL = os.environ.get("TELEGRAM_WEBAPP_URL", "https://app.utimoshi.ru/").strip()
TELEGRAM_EXPECTED_USERNAME = os.environ.get("TELEGRAM_EXPECTED_USERNAME", "desserty_bot").strip().lstrip("@").lower()
MAX_BOT_USERNAME = os.environ.get("MAX_BOT_USERNAME", "").strip().lstrip("@").lower()
PUBLIC_BASE_URL = os.environ.get("SOFT_ICE_PUBLIC_URL", "https://app.utimoshi.ru").strip().rstrip("/")
DEMO_MODE = os.environ.get("SOFT_ICE_DEMO_MODE", "0").strip().lower() in {"1", "true", "yes"}
TELEGRAM_AUTH_MAX_AGE = 24 * 60 * 60
MAX_AUTH_MAX_AGE = 60 * 60

PUBLIC_GET_ROUTES = {
    "/tma.html",
    "/tma.js",
    "/tma.css",
    "/tma-account.css",
    "/tma-referrals.css",
    "/tma-good.css",
    "/tma-fix-0.30.2.css",
    "/assets/soft_ice_cup_u_timoshi.png",
    "/channels/max.png",
    "/channels/telegram.png",
    "/channels/vk.png",
}
PUBLIC_POST_ROUTES = {
    "/api/catalog",
    "/api/tma/auth",
    "/api/tma/machines",
    "/api/tma/preorder/create",
    "/api/tma/preorder/complete",
    "/api/tma/preorder/status",
    "/api/tma/account",
    "/api/tma/referral",
    "/api/tma/preorder/activate-pickup",
    "/api/tma/preorder/transfer/create",
    "/api/tma/preorder/transfer/preview",
    "/api/tma/preorder/transfer/accept",
    "/api/tma/preorder/transfer/cancel",
    "/api/tma/preorder/transfer/thank",
    "/api/tma/preorder/transfer/share-vk",
}
DEMO_TELEGRAM_USER = {
    "id": 100000001,
    "first_name": "Александр",
    "last_name": "",
    "username": "soft_ice_demo",
    "language_code": "ru",
}
MACHINE_ID = "soft-ice-demo-001"
MACHINES = {
    "soft-ice-demo-001": {"id": "soft-ice-demo-001", "name": "У Тимоши · Центральный", "address": "ул. Центральная, 12", "distance": "350 м", "available": True},
    "soft-ice-demo-002": {"id": "soft-ice-demo-002", "name": "У Тимоши · Парк", "address": "Городской парк, главный вход", "distance": "1,2 км", "available": True},
    "soft-ice-demo-003": {"id": "soft-ice-demo-003", "name": "У Тимоши · Семейный", "address": "ТЦ «Семейный», 1 этаж", "distance": "2,8 км", "available": False},
}
TEST_CODE = "123456"
CODE_TTL_SECONDS = 180
MAX_CODE_ATTEMPTS = 3
LOYALTY_RATE_PERCENT = 5
REFERRAL_INVITEE_BONUS = 50
REFERRAL_INVITER_BONUS = 50
REFERRAL_MILESTONE_SIZE = 3
REFERRAL_MILESTONE_BONUS = 100
LOCK = threading.RLock()
PREORDER_TTL_SECONDS = 48 * 60 * 60
PREORDER_QR_ROTATION_SECONDS = 5 * 60
PREORDER_MANUAL_CODE = "482731"
PREORDER_RECOVERY_CODE = "123456"
PREORDER_MAX_ATTEMPTS = 3
PREORDER_LOCK_SECONDS = 60
ACTIVE_PREORDER_STATUSES = {"paid_waiting_pickup", "pickup_code_active", "in_progress"}


def demo_preorder(now: int | None = None) -> dict:
    created_at = int(now or time.time())
    return {
        "preorder_id": "preorder-demo-001",
        "status": "paid_waiting_pickup",
        "machine_id": MACHINE_ID,
        "phone": "9991234567",
        "phone_last4": "4567",
        "channels": ["telegram", "max"],
        "amount": 260,
        "currency": "RUB",
        "order": {"product_id": "vanilla-180", "topping_id": "chocolate", "additive_id": "nut-mix"},
        "manual_code_hash": hashlib.sha256(PREORDER_MANUAL_CODE.encode("utf-8")).hexdigest(),
        "manual_code_demo": PREORDER_MANUAL_CODE,
        "qr_secret": secrets.token_hex(16),
        "created_at": created_at,
        "expires_at": created_at + PREORDER_TTL_SECONDS,
        "attempts": 0,
        "locked_until": 0,
        "payment_id": "",
    }


def default_inventory() -> dict:
    return {
        "mix_catalog": {
            "vanilla-180": {"id": "vanilla-180", "name": "Ванильное мороженое", "flavor": "Ваниль", "description": "Мягкое сливочное", "volume_ml": 180, "price": 180, "stock": 42, "unit": "порц.", "minimum_stock": 10},
            "banana-180": {"id": "banana-180", "name": "Банановое мороженое", "flavor": "Банан", "description": "Мягкое банановое", "volume_ml": 180, "price": 180, "stock": 28, "unit": "порц.", "minimum_stock": 10},
            "strawberry-mix-180": {"id": "strawberry-mix-180", "name": "Клубничное мороженое", "flavor": "Клубника", "description": "Мягкое клубничное", "volume_ml": 180, "price": 180, "stock": 9, "unit": "порц.", "minimum_stock": 10},
            "chocolate-mix-180": {"id": "chocolate-mix-180", "name": "Шоколадное мороженое", "flavor": "Шоколад", "description": "Мягкое шоколадное", "volume_ml": 180, "price": 190, "stock": 16, "unit": "порц.", "minimum_stock": 10},
        },
        "active_mix_id": "vanilla-180",
        "mix_change_log": [],
        "topping_catalog": {
            "chocolate": {"id": "chocolate", "name": "Шоколадный", "price": 45, "stock": 20, "color": "chocolate"},
            "strawberry": {"id": "strawberry", "name": "Клубничный", "price": 35, "stock": 18, "color": "strawberry"},
            "caramel": {"id": "caramel", "name": "Карамельный", "price": 35, "stock": 16, "color": "caramel"},
            "pistachio": {"id": "pistachio", "name": "Фисташковый", "price": 35, "stock": 12, "color": "pistachio"},
            "berry": {"id": "berry", "name": "Ягодный", "price": 35, "stock": 10, "color": "berry"},
        },
        "topping_slots": {
            "topping-slot-1": "chocolate",
            "topping-slot-2": "strawberry",
            "topping-slot-3": "caramel",
        },
        "topping_change_log": [],
        "additive_catalog": {
            "nut-mix": {"id": "nut-mix", "name": "Ореховый микс", "price": 35, "stock": 18, "color": "nut"},
            "confetti": {"id": "confetti", "name": "Конфетти", "price": 35, "stock": 20, "color": "confetti"},
            "wafer-crumb": {"id": "wafer-crumb", "name": "Вафельная крошка", "price": 35, "stock": 16, "color": "wafer"},
            "chocolate-crumb": {"id": "chocolate-crumb", "name": "Шоколадная крошка", "price": 35, "stock": 12, "color": "choco-crumb"},
            "coconut": {"id": "coconut", "name": "Кокосовая стружка", "price": 35, "stock": 14, "color": "coconut"},
            "crispy-rice": {"id": "crispy-rice", "name": "Воздушный рис", "price": 35, "stock": 10, "color": "rice"},
        },
        "additive_slots": {
            "slot-1": "nut-mix",
            "slot-2": "confetti",
            "slot-3": "wafer-crumb",
        },
        "additive_change_log": [],
    }


def empty_db() -> dict:
    data = {
        "clients": {
            "9991234567": {
                "phone": "9991234567",
                "name": "Александр",
                "accrual_rate_percent": 7,
                "channels": ["telegram", "max"],
                "phone_verified": True,
                "profile_source": "test_crm",
                "bonus_balance": 187,
                "club_balance": 0,
                "money_balance": 0,
                "updated_at": int(time.time()),
            }
        },
        "telegram_users": {},
        "identity_users": {},
        "codes": {},
        "payments": {},
        "dispense_orders": {},
        "refunds": {},
        "receipts": {},
        "loyalty_transactions": [],
        "service_incidents": {},
        "inventory_movements": [],
        "gateway_audit": [],
        "preorders": {"preorder-demo-001": demo_preorder()},
        "preorder_attempts": [],
        "referral_codes": {},
        "referrals": {},
        "referral_settings": {
            "invitee_bonus": REFERRAL_INVITEE_BONUS,
            "inviter_bonus": REFERRAL_INVITER_BONUS,
            "milestone_size": REFERRAL_MILESTONE_SIZE,
            "milestone_bonus": REFERRAL_MILESTONE_BONUS,
        },
        "loyalty_settings": {
            "purchase_accrual_percent": LOYALTY_RATE_PERCENT,
            "status": "demo",
        },
        "machine": {
            "id": MACHINE_ID,
            "connection": "online",
            "sales_mode": "ready",
            "safety_lock": False,
            "active_order_id": None,
            "last_telemetry_at": int(time.time()),
        },
    }
    data.update(default_inventory())
    return data


def load_db() -> dict:
    if not DATA_FILE.exists():
        return empty_db()
    try:
        data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
        data.setdefault("clients", {})
        data.setdefault("telegram_users", {})
        data.setdefault("identity_users", {})
        data.setdefault("codes", {})
        data.setdefault("payments", {})
        data.setdefault("dispense_orders", {})
        data.setdefault("refunds", {})
        data.setdefault("receipts", {})
        data.setdefault("loyalty_transactions", [])
        data.setdefault("service_incidents", {})
        data.setdefault("inventory_movements", [])
        data.setdefault("gateway_audit", [])
        data.setdefault("preorders", {"preorder-demo-001": demo_preorder()})
        data.setdefault("preorder_attempts", [])
        data.setdefault("referral_codes", {})
        data.setdefault("referrals", {})
        data.setdefault("referral_settings", {
            "invitee_bonus": REFERRAL_INVITEE_BONUS,
            "inviter_bonus": REFERRAL_INVITER_BONUS,
            "milestone_size": REFERRAL_MILESTONE_SIZE,
            "milestone_bonus": REFERRAL_MILESTONE_BONUS,
        })
        if "preorder-demo-001" not in data["preorders"]:
            data["preorders"]["preorder-demo-001"] = demo_preorder()
        data.setdefault("loyalty_settings", {
            "purchase_accrual_percent": LOYALTY_RATE_PERCENT,
            "status": "demo",
        })
        for client in data.get("clients", {}).values():
            client.setdefault("bonus_balance", 0)
            client.setdefault("club_balance", 0)
            client.setdefault("money_balance", 0)
            client.setdefault("accrual_rate_percent", int(client.get("discount_percent", LOYALTY_RATE_PERCENT)))
        data.setdefault("machine", {
            "id": MACHINE_ID,
            "connection": "online",
            "sales_mode": "ready",
            "safety_lock": False,
            "active_order_id": None,
            "last_telemetry_at": int(time.time()),
        })
        defaults = default_inventory()
        data.setdefault("mix_catalog", defaults["mix_catalog"])
        data.setdefault("active_mix_id", defaults["active_mix_id"])
        data.setdefault("mix_change_log", [])
        data.setdefault("topping_catalog", defaults["topping_catalog"])
        data.setdefault("topping_slots", defaults["topping_slots"])
        data.setdefault("topping_change_log", [])
        data.setdefault("additive_catalog", defaults["additive_catalog"])
        data.setdefault("additive_slots", defaults["additive_slots"])
        data.setdefault("additive_change_log", [])
        return data
    except (OSError, json.JSONDecodeError):
        return empty_db()


def save_db(data: dict) -> None:
    temporary = DATA_FILE.with_suffix(".tmp")
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(DATA_FILE)


def valid_phone(value: object) -> str:
    phone = "".join(ch for ch in str(value or "") if ch.isdigit())
    if len(phone) != 10:
        raise ValueError("Номер должен содержать 10 цифр после +7")
    return phone


def valid_channels(value: object) -> list[str]:
    allowed = {"telegram", "max", "vk"}
    result = list(dict.fromkeys(str(item) for item in (value or []) if str(item) in allowed))
    if not result:
        raise ValueError("Не выбран канал отправки")
    return result


def code_hash(phone: str, code: str, nonce: str) -> str:
    return hashlib.sha256(f"{phone}:{code}:{nonce}".encode("utf-8")).hexdigest()


def validate_webapp_init_data(init_data: str, bot_token: str, platform: str, max_age: int, now: int | None = None) -> dict:
    """Проверяет WebAppData Telegram или MAX по официальному HMAC-SHA256 алгоритму."""
    platform_name = "MAX" if platform == "max" else "Telegram"
    if not init_data or not bot_token:
        raise ValueError(f"{platform_name}-авторизация не получена")
    pairs = parse_qsl(init_data, keep_blank_values=True)
    keys = [key for key, _ in pairs]
    if len(keys) != len(set(keys)):
        raise ValueError(f"В данных {platform_name} повторяются параметры")
    values = dict(pairs)
    supplied_hash = values.pop("hash", "")
    if not supplied_hash:
        raise ValueError(f"В данных {platform_name} отсутствует подпись")
    data_check_string = "\n".join(f"{key}={values[key]}" for key in sorted(values))
    secret_key = hmac.new(b"WebAppData", bot_token.encode("utf-8"), hashlib.sha256).digest()
    expected_hash = hmac.new(secret_key, data_check_string.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected_hash, supplied_hash):
        raise ValueError(f"Подпись {platform_name} недействительна")
    auth_date = int(values.get("auth_date") or 0)
    current_time = int(now or time.time())
    if auth_date <= 0 or auth_date > current_time + 60 or current_time - auth_date > max_age:
        raise ValueError(f"Сессия {platform_name} устарела. Откройте Mini App заново")
    try:
        user = json.loads(values.get("user") or "{}")
    except json.JSONDecodeError as error:
        raise ValueError(f"Профиль {platform_name} повреждён") from error
    if not isinstance(user, dict) or not isinstance(user.get("id"), int):
        raise ValueError(f"{platform_name} не передал пользователя")
    return user


def validate_telegram_init_data(init_data: str, bot_token: str, now: int | None = None) -> dict:
    return validate_webapp_init_data(init_data, bot_token, "telegram", TELEGRAM_AUTH_MAX_AGE, now)


def validate_max_init_data(init_data: str, bot_token: str, now: int | None = None) -> dict:
    return validate_webapp_init_data(init_data, bot_token, "max", MAX_AUTH_MAX_AGE, now)


def webapp_identity(platform: object, init_data: object) -> tuple[dict, str]:
    provider = str(platform or "").strip().lower()
    raw = str(init_data or "")
    if provider == "max":
        if not MAX_BOT_TOKEN:
            raise ValueError("MAX-авторизация недоступна: токен MAX ещё не настроен на сервере")
        return validate_max_init_data(raw, MAX_BOT_TOKEN), "max"
    if provider == "telegram" and TELEGRAM_BOT_TOKEN:
        return validate_telegram_init_data(raw, TELEGRAM_BOT_TOKEN), "telegram"
    if provider == "telegram":
        raise ValueError("Telegram-авторизация недоступна: сервер запущен без рабочего токена")
    if DEMO_MODE and not raw and provider in {"", "browser", "demo"}:
        return dict(DEMO_TELEGRAM_USER), "demo"
    raise ValueError("Откройте приложение из MAX или Telegram")


def upsert_webapp_profile(user: dict, auth_mode: str) -> dict:
    provider = "telegram" if auth_mode == "demo" else auth_mode
    provider_id = str(user["id"])
    identity_key = f"{provider}:{provider_id}"
    now = int(time.time())
    with LOCK:
        db = load_db()
        links = db.setdefault("identity_users", {})
        legacy_link = db.setdefault("telegram_users", {}).get(provider_id, {}) if provider == "telegram" else {}
        link = links.get(identity_key, {}) or legacy_link
        client_key = str(link.get("client_key") or ("9991234567" if auth_mode == "demo" else identity_key))
        client = db["clients"].get(client_key, {})
        first_name = str(user.get("first_name") or "Покупатель").strip()[:64]
        platform_fields = {
            f"{provider}_user_id": int(user["id"]),
            f"{provider}_username": str(user.get("username") or "")[:64],
            f"{provider}_verified": auth_mode == provider,
        }
        client.update({
            "name": first_name,
            **platform_fields,
            "profile_source": f"{provider}_demo" if auth_mode == "demo" else provider,
            "bonus_balance": int(client.get("bonus_balance", 0)),
            "club_balance": int(client.get("club_balance", 0)),
            "money_balance": int(client.get("money_balance", 0)),
            "accrual_rate_percent": int(client.get("accrual_rate_percent", LOYALTY_RATE_PERCENT)),
            "updated_at": now,
        })
        if client_key.isdigit():
            client.setdefault("phone", client_key)
        db["clients"][client_key] = client
        links[identity_key] = {"client_key": client_key, "linked_at": int(link.get("linked_at") or now), "last_auth_at": now}
        if provider == "telegram":
            db["telegram_users"][provider_id] = dict(links[identity_key])
        save_db(db)
    return {
        "id": int(user["id"]),
        "first_name": first_name,
        "last_name": str(user.get("last_name") or "")[:64],
        "username": str(user.get("username") or "")[:64],
        "language_code": str(user.get("language_code") or "ru")[:12],
        "photo_url": str(user.get("photo_url") or "")[:500],
        "auth_mode": auth_mode,
        "provider": provider,
        "identity_key": identity_key,
        "client_key": client_key,
        "phone": str(client.get("phone") or ""),
        "bonus_balance": int(client.get("bonus_balance", 0)),
        "club_balance": int(client.get("club_balance", 0)),
        "money_balance": int(client.get("money_balance", 0)),
    }


def normalize_referral_code(value: object) -> str:
    code = str(value or "").strip()
    if not re.fullmatch(r"[A-Za-z0-9_-]{8,32}", code):
        return ""
    return code


def normalize_transfer_token(value: object) -> str:
    token = str(value or "").strip()
    if not re.fullmatch(r"[A-Za-z0-9_-]{20,48}", token):
        return ""
    return token


def transfer_start_token(value: object) -> str:
    start_param = str(value or "")[:64]
    return normalize_transfer_token(start_param[5:]) if start_param.startswith("gift_") else ""


def ensure_referral_code(db: dict, client_key: str, now: int | None = None) -> str:
    client = db.setdefault("clients", {}).setdefault(client_key, {})
    existing = normalize_referral_code(client.get("referral_code"))
    codes = db.setdefault("referral_codes", {})
    if existing:
        owner = codes.get(existing)
        owner_key = str(owner.get("client_key") or "") if isinstance(owner, dict) else str(owner or "")
        if not owner_key or owner_key == client_key:
            codes[existing] = {"client_key": client_key, "created_at": int((owner or {}).get("created_at") or now or time.time())} if isinstance(owner, dict) else {"client_key": client_key, "created_at": int(now or time.time())}
            return existing
    while True:
        code = secrets.token_urlsafe(9).replace("-", "").replace("_", "")[:12]
        if code not in codes:
            break
    created_at = int(now or time.time())
    client["referral_code"] = code
    codes[code] = {"client_key": client_key, "created_at": created_at}
    return code


def referral_links(code: str) -> dict:
    telegram_start_param = f"ref_tg_{code}"
    max_start_param = f"ref_max_{code}"
    public_url = f"{PUBLIC_BASE_URL}/r/{quote(code)}"
    telegram_referral_url = f"{PUBLIC_BASE_URL}/r/telegram/{quote(code)}"
    max_referral_url = f"{PUBLIC_BASE_URL}/r/max/{quote(code)}"
    telegram_invite_url = f"https://t.me/{TELEGRAM_EXPECTED_USERNAME}?startapp={quote(telegram_start_param)}"
    max_invite_url = f"https://max.ru/{MAX_BOT_USERNAME}?startapp={quote(max_start_param)}" if MAX_BOT_USERNAME else ""
    text = "Приглашаю тебя в «Клуб Тимоши»! Переходи по моей ссылке и получи 50 приветственных бонусов 🍦"
    telegram_message = f"{text}\n\nСсылка работает только в Telegram."
    max_message = f"{text}\n\nСсылка работает только в MAX.\n{max_referral_url}"
    return {
        "referral_url": public_url,
        "telegram_referral_url": telegram_referral_url,
        "max_referral_url": max_referral_url,
        "telegram_invite_url": telegram_invite_url,
        "max_invite_url": max_invite_url,
        "telegram_share_url": f"https://t.me/share/url?url={quote(telegram_referral_url, safe='')}&text={quote(telegram_message, safe='')}",
        "max_share_url": f"https://max.ru/:share?text={quote(max_message, safe='')}",
        "share_text": text,
    }


def parse_referral_start_param(start_param: str) -> tuple[str, str]:
    value = str(start_param or "")[:64]
    if value.startswith("ref_tg_"):
        return "telegram", normalize_referral_code(value[7:])
    if value.startswith("ref_max_"):
        return "max", normalize_referral_code(value[8:])
    if value.startswith("ref_"):
        return "", normalize_referral_code(value[4:])
    return "", ""


def referral_start_param(payload: dict, auth_mode: str) -> str:
    if auth_mode == "demo":
        return str(payload.get("start_param") or "")[:64]
    values = dict(parse_qsl(str(payload.get("init_data") or ""), keep_blank_values=True))
    return str(values.get("start_param") or "")[:64]


def register_referral(profile: dict, start_param: str) -> dict:
    intended_provider, code = parse_referral_start_param(start_param)
    if not code:
        return {"status": "ignored", "warning": ""}
    actual_provider = str(profile.get("provider") or "")
    if intended_provider and actual_provider != intended_provider:
        intended_name = "Telegram" if intended_provider == "telegram" else "MAX"
        actual_name = "MAX" if actual_provider == "max" else "Telegram"
        return {
            "status": "channel_mismatch",
            "warning": f"Эта реферальная ссылка предназначена для {intended_name}. Откройте её в {intended_name}, а не в {actual_name}.",
        }
    invitee_key = str(profile.get("client_key") or "")
    now = int(time.time())
    with LOCK:
        db = load_db()
        owner = db.setdefault("referral_codes", {}).get(code)
        referrer_key = str(owner.get("client_key") or "") if isinstance(owner, dict) else str(owner or "")
        if not referrer_key or referrer_key == invitee_key:
            return {"status": "rejected", "warning": ""}
        referrals = db.setdefault("referrals", {})
        if invitee_key in referrals:
            return {"status": "already_registered", "warning": ""}
        referral_id = f"referral-{now}-{secrets.token_hex(3)}"
        referrals[invitee_key] = {
            "referral_id": referral_id,
            "code": code,
            "referrer_client_key": referrer_key,
            "invitee_client_key": invitee_key,
            "source_provider": actual_provider,
            "intended_provider": intended_provider or actual_provider,
            "status": "registered",
            "registered_at": now,
            "activated_at": 0,
            "activation_order_id": "",
        }
        db.setdefault("gateway_audit", []).append({
            "event": "referral.registered",
            "referral_id": referral_id,
            "referrer_client_key": referrer_key,
            "invitee_client_key": invitee_key,
            "created_at": now,
        })
        save_db(db)
    return {"status": "registered", "warning": ""}


def authenticate_webapp(payload: dict) -> dict:
    user, auth_mode = webapp_identity(payload.get("platform"), payload.get("init_data"))
    profile = upsert_webapp_profile(user, auth_mode)
    now = int(time.time())
    with LOCK:
        db = load_db()
        ensure_referral_code(db, str(profile["client_key"]), now)
        save_db(db)
    referral_result = register_referral(profile, referral_start_param(payload, auth_mode))
    profile["referral_status"] = referral_result.get("status", "ignored")
    profile["referral_warning"] = referral_result.get("warning", "")
    return profile


class Handler(SimpleHTTPRequestHandler):
    server_version = "SoftICE/0.35.1"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt: str, *args: object) -> None:
        print("[Soft_ICE]", fmt % args)

    def end_headers(self) -> None:
        # Терминал всегда должен загружать интерфейс именно из запущенной сборки.
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def json_response(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def html_response(self, status: int, body: str) -> None:
        encoded = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(encoded)

    def read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > 16_384:
            raise ValueError("Некорректный запрос")
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def do_GET(self) -> None:
        route = urlparse(self.path).path
        if route == "/health":
            telegram_status = "configured" if TELEGRAM_BOT_TOKEN else ("demo" if DEMO_MODE else "not_configured")
            max_status = "configured" if MAX_BOT_TOKEN else "not_configured"
            return self.json_response(200, {"ok": True, "version": "0.35.1", "telegram": telegram_status, "max": max_status})
        if route.startswith("/r/"):
            return self.referral_landing(route.removeprefix("/r/"))
        if route.startswith("/transfer/"):
            return self.transfer_landing(route.removeprefix("/transfer/"))
        if route == "/":
            self.path = "/tma.html"
        elif route not in PUBLIC_GET_ROUTES:
            return self.json_response(404, {"error": "Маршрут не найден"})
        super().do_GET()

    def do_POST(self) -> None:
        try:
            payload = self.read_json()
            route = urlparse(self.path).path
            if route not in PUBLIC_POST_ROUTES:
                return self.json_response(404, {"error": "Маршрут не найден"})
            if route == "/api/tma/auth":
                result = self.tma_auth(payload)
            elif route == "/api/catalog":
                result = self.catalog()
            elif route == "/api/warehouse":
                result = self.warehouse()
            elif route == "/api/replace-topping":
                result = self.replace_topping(payload)
            elif route == "/api/replace-mix":
                result = self.replace_mix(payload)
            elif route == "/api/replace-additive":
                result = self.replace_additive(payload)
            elif route == "/api/customer":
                result = self.customer(payload)
            elif route == "/api/link":
                result = self.link(payload)
            elif route == "/api/send-code":
                result = self.send_code(payload)
            elif route == "/api/verify-code":
                result = self.verify_code(payload)
            elif route == "/api/community-invite":
                result = self.community_invite(payload)
            elif route == "/api/preorder/demo":
                result = self.preorder_demo()
            elif route == "/api/preorder/claim":
                result = self.claim_preorder(payload)
            elif route == "/api/preorder/recover":
                result = self.recover_preorder(payload)
            elif route == "/api/preorder/recover/verify":
                result = self.verify_preorder_recovery(payload)
            elif route == "/api/tma/machines":
                result = self.tma_machines()
            elif route == "/api/tma/preorder/create":
                result = self.create_tma_preorder(payload)
            elif route == "/api/tma/preorder/complete":
                result = self.complete_tma_preorder(payload)
            elif route == "/api/tma/preorder/status":
                result = self.tma_preorder_status(payload)
            elif route == "/api/tma/account":
                result = self.tma_account(payload)
            elif route == "/api/tma/referral":
                result = self.tma_referral(payload)
            elif route == "/api/tma/preorder/activate-pickup":
                result = self.activate_tma_pickup(payload)
            elif route == "/api/tma/preorder/transfer/create":
                result = self.create_preorder_transfer(payload)
            elif route == "/api/tma/preorder/transfer/preview":
                result = self.preview_preorder_transfer(payload)
            elif route == "/api/tma/preorder/transfer/accept":
                result = self.accept_preorder_transfer(payload)
            elif route == "/api/tma/preorder/transfer/cancel":
                result = self.cancel_preorder_transfer(payload)
            elif route == "/api/tma/preorder/transfer/thank":
                result = self.thank_for_preorder_transfer(payload)
            elif route == "/api/tma/preorder/transfer/share-vk":
                result = self.share_preorder_transfer_vk(payload)
            elif route == "/api/payment/create":
                result = self.create_payment(payload)
            elif route == "/api/payment/complete":
                result = self.complete_payment(payload)
            elif route == "/api/machine/status":
                result = self.machine_status()
            elif route == "/api/dispense/start":
                result = self.start_dispense(payload)
            elif route == "/api/dispense/status":
                result = self.dispense_status(payload)
            elif route == "/api/recovery/refund":
                result = self.refund_failed_order(payload)
            elif route == "/api/operations":
                result = self.operations()
            else:
                return self.json_response(404, {"error": "Маршрут не найден"})
            self.json_response(200, result)
        except (ValueError, json.JSONDecodeError) as error:
            self.json_response(400, {"error": str(error)})
        except Exception as error:  # локальный прототип должен показать понятную ошибку
            print("[Soft_ICE] Ошибка:", repr(error))
            self.json_response(500, {"error": "Ошибка тестовой CRM"})

    @staticmethod
    def tma_auth(payload: dict) -> dict:
        profile = authenticate_webapp(payload)
        return {"authenticated": True, "mode": profile["auth_mode"], "provider": profile["provider"], "user": profile}

    def referral_landing(self, raw_path: str) -> None:
        parts = [part for part in str(raw_path or "").split("/") if part]
        intended_provider = parts[0] if len(parts) == 2 and parts[0] in {"telegram", "max"} else ""
        raw_code = parts[1] if intended_provider else (parts[0] if len(parts) == 1 else "")
        code = normalize_referral_code(raw_code)
        with LOCK:
            db = load_db()
            owner = db.get("referral_codes", {}).get(code) if code else None
        owner_key = str(owner.get("client_key") or "") if isinstance(owner, dict) else str(owner or "")
        if not owner_key:
            return self.html_response(404, "<!doctype html><html lang='ru'><meta charset='utf-8'><title>Ссылка не найдена</title><body><p>Реферальная ссылка недействительна.</p></body></html>")
        links = referral_links(code)
        telegram_button = f'<a href="{html.escape(links["telegram_invite_url"], quote=True)}">Продолжить в Telegram</a>'
        max_button = f'<a class="max" href="{html.escape(links["max_invite_url"], quote=True)}">Продолжить в MAX</a>' if links["max_invite_url"] else '<div class="unavailable">MAX-ссылка временно недоступна. Сообщите владельцу приглашения.</div>'
        if intended_provider == "telegram":
            channel_notice = '<div class="channel telegram">Ссылка работает только в Telegram</div>'
            channel_actions = telegram_button
            channel_help = "Если вы открыли ссылку в MAX, не продолжайте регистрацию — попросите отправить вам MAX-ссылку."
        elif intended_provider == "max":
            channel_notice = '<div class="channel max">Ссылка работает только в MAX</div>'
            channel_actions = max_button
            channel_help = "Если вы открыли ссылку в Telegram, не продолжайте регистрацию — попросите отправить вам Telegram-ссылку."
        else:
            channel_notice = '<div class="channel neutral">Выберите свой мессенджер</div>'
            channel_actions = telegram_button + max_button
            channel_help = "Каждая ссылка учитывается только в выбранном мессенджере."
        page = f"""<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Приглашение в Клуб Тимоши</title><style>
*{{box-sizing:border-box}}body{{margin:0;min-height:100vh;display:grid;place-items:center;padding:22px;background:#fff8ee;color:#2e2034;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}}
main{{width:min(100%,430px);padding:30px;border-radius:30px;background:#fff;box-shadow:0 18px 54px rgba(79,50,64,.14);text-align:center}}.mark{{width:64px;height:64px;margin:0 auto 16px;border-radius:50%;display:grid;place-items:center;background:#ca2849;color:#fff;font:800 34px Georgia,serif}}
h1{{margin:0 0 10px;font:800 32px/1.08 Georgia,serif}}p{{color:#786b76;line-height:1.5}}.bonus{{margin:18px 0;padding:15px;border-radius:18px;background:#fff1d4;color:#725018;font-weight:800}}
a{{display:block;margin-top:10px;padding:16px;border-radius:17px;color:#fff;text-decoration:none;font-weight:900;background:#229ed9}}a.max{{background:#5851db}}small{{display:block;margin-top:18px;color:#8b7d86;line-height:1.4}}.channel{{margin:14px 0;padding:12px;border-radius:15px;font-weight:900}}.channel.telegram{{background:#e6f5fc;color:#166b94}}.channel.max{{background:#efedff;color:#463dc2}}.channel.neutral{{background:#f3eee8;color:#675965}}.unavailable{{margin-top:10px;padding:14px;border-radius:15px;background:#fff0f0;color:#9d2033;font-weight:800}}
</style></head><body><main><div class="mark">У</div><h1>Вас приглашают в «Клуб Тимоши»</h1><p>Присоединяйтесь, выбирайте любимое мороженое и получайте клубные бонусы.</p><div class="bonus">После первой покупки — 50 приветственных бонусов</div>
{channel_notice}{channel_actions}<small>{html.escape(channel_help)}<br><br>Бонус начисляется после получения первой оплаченной порции.</small></main></body></html>"""
        self.html_response(200, page)

    def transfer_landing(self, raw_token: str) -> None:
        token = normalize_transfer_token(raw_token)
        with LOCK:
            db = load_db()
            preorder = Handler._find_transfer(db, token) if token else None
        now = int(time.time())
        valid = bool(
            preorder
            and preorder.get("transfer_status") == "offered"
            and preorder.get("status") == "paid_waiting_pickup"
            and int(preorder.get("expires_at", 0)) > now
        )
        if not valid:
            return self.html_response(404, "<!doctype html><html lang='ru'><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Передача недоступна</title><body><p>Эта ссылка уже использована, отменена или срок заказа истёк.</p></body></html>")
        start_param = f"gift_{token}"
        telegram_url = f"https://t.me/{TELEGRAM_EXPECTED_USERNAME}?startapp={quote(start_param)}"
        max_url = f"https://max.ru/{MAX_BOT_USERNAME}?startapp={quote(start_param)}" if MAX_BOT_USERNAME else ""
        max_button = f'<a class="max" href="{html.escape(max_url, quote=True)}">Принять в MAX</a>' if max_url else ""
        page = f"""<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Вам передают заказ</title><style>*{{box-sizing:border-box}}body{{margin:0;min-height:100vh;display:grid;place-items:center;padding:22px;background:#fff8ee;color:#2e2034;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}}main{{width:min(100%,430px);padding:30px;border-radius:30px;background:#fff;box-shadow:0 18px 54px rgba(79,50,64,.14);text-align:center}}.mark{{width:68px;height:68px;margin:0 auto 16px;border-radius:50%;display:grid;place-items:center;background:#fff1d4;font-size:34px}}h1{{margin:0 0 10px;font:800 32px/1.08 Georgia,serif}}p,small{{color:#786b76;line-height:1.5}}.order{{margin:18px 0;padding:16px;border-radius:18px;background:#fff1d4;color:#725018;font-weight:800}}a{{display:block;margin-top:10px;padding:16px;border-radius:17px;color:#fff;text-decoration:none;font-weight:900;background:#229ed9}}a.max{{background:#5851db}}small{{display:block;margin-top:18px}}</style></head><body><main><div class="mark">🍦</div><h1>Вам передают оплаченный заказ</h1><p>Примите его в своём мессенджере. После принятия только вы сможете сформировать код получения у аппарата.</p><div class="order">{html.escape(Handler._preorder_public(preorder).get("description", "Мороженое"))}</div><a href="{html.escape(telegram_url, quote=True)}">Принять в Telegram</a>{max_button}<small>Срок получения заказа не изменится. Ссылка одноразовая.</small></main></body></html>"""
        self.html_response(200, page)

    @staticmethod
    def catalog() -> dict:
        with LOCK:
            db = load_db()
        active_mix = dict(db["mix_catalog"][db["active_mix_id"]])
        active_mix["available"] = int(active_mix.get("stock", 0)) > 0
        topping_catalog = db["topping_catalog"]
        toppings = [{"id": "none", "name": "Без топпинга", "price": 0, "available": True, "color": "plain"}]
        for slot_id, topping_id in db["topping_slots"].items():
            item = dict(topping_catalog[topping_id])
            item["slot_id"] = slot_id
            item["available"] = int(item.get("stock", 0)) > 0
            toppings.append(item)
        additive_catalog = db["additive_catalog"]
        additives = [{"id": "none", "name": "Без добавки", "price": 0, "available": True, "color": "plain"}]
        for slot_id, additive_id in db["additive_slots"].items():
            item = dict(additive_catalog[additive_id])
            item["slot_id"] = slot_id
            item["available"] = int(item.get("stock", 0)) > 0
            additives.append(item)
        return {
            "catalog_version": "demo-0.29",
            "currency": "RUB",
            "products": [active_mix],
            "toppings": toppings,
            "additives": additives,
        }

    @staticmethod
    def warehouse() -> dict:
        with LOCK:
            db = load_db()
        mixes = []
        for item in db["mix_catalog"].values():
            record = dict(item)
            record["active"] = item["id"] == db["active_mix_id"]
            record["low_stock"] = int(item.get("stock", 0)) <= int(item.get("minimum_stock", 0))
            mixes.append(record)
        active_topping_by_id = {value: key for key, value in db["topping_slots"].items()}
        toppings = []
        for item in db["topping_catalog"].values():
            record = dict(item)
            record["active_slot"] = active_topping_by_id.get(item["id"])
            toppings.append(record)
        active_by_id = {value: key for key, value in db["additive_slots"].items()}
        items = []
        for item in db["additive_catalog"].values():
            record = dict(item)
            record["active_slot"] = active_by_id.get(item["id"])
            items.append(record)
        return {
            "mixes": mixes,
            "active_mix_id": db["active_mix_id"],
            "mix_change_log": db["mix_change_log"][-20:],
            "toppings": toppings,
            "topping_slots": db["topping_slots"],
            "topping_change_log": db["topping_change_log"][-20:],
            "additives": items,
            "additive_slots": db["additive_slots"],
            "additive_change_log": db["additive_change_log"][-20:],
            "additive_price_rule": 35,
        }

    @staticmethod
    def replace_mix(payload: dict) -> dict:
        mix_id = str(payload.get("mix_id") or "")
        with LOCK:
            db = load_db()
            item = db["mix_catalog"].get(mix_id)
            if not item:
                raise ValueError("Смесь отсутствует в складской базе")
            if int(item.get("stock", 0)) <= 0:
                raise ValueError("Эта смесь закончилась на складе")
            previous_id = db["active_mix_id"]
            if previous_id != mix_id:
                db["active_mix_id"] = mix_id
                db["mix_change_log"].append({
                    "previous_mix_id": previous_id,
                    "new_mix_id": mix_id,
                    "changed_at": int(time.time()),
                    "source": "operator_warehouse_demo",
                })
                save_db(db)
        return {"replaced": True, "active_mix": item}

    @staticmethod
    def replace_topping(payload: dict) -> dict:
        slot_id = str(payload.get("slot_id") or "")
        topping_id = str(payload.get("topping_id") or "")
        with LOCK:
            db = load_db()
            if slot_id not in db["topping_slots"]:
                raise ValueError("Неизвестная ячейка топпинга")
            item = db["topping_catalog"].get(topping_id)
            if not item:
                raise ValueError("Топпинг отсутствует в складской базе")
            if int(item.get("stock", 0)) <= 0:
                raise ValueError("Топпинг закончился на складе")
            occupied = {value: key for key, value in db["topping_slots"].items()}
            if topping_id in occupied and occupied[topping_id] != slot_id:
                raise ValueError("Этот топпинг уже установлен в другую ячейку")
            previous_id = db["topping_slots"][slot_id]
            db["topping_slots"][slot_id] = topping_id
            db["topping_change_log"].append({
                "slot_id": slot_id,
                "previous_topping_id": previous_id,
                "new_topping_id": topping_id,
                "changed_at": int(time.time()),
                "source": "operator_warehouse_demo",
            })
            save_db(db)
        return {"replaced": True, "slot_id": slot_id, "topping": item}

    @staticmethod
    def replace_additive(payload: dict) -> dict:
        slot_id = str(payload.get("slot_id") or "")
        additive_id = str(payload.get("additive_id") or "")
        with LOCK:
            db = load_db()
            if slot_id not in db["additive_slots"]:
                raise ValueError("Неизвестная ячейка добавки")
            item = db["additive_catalog"].get(additive_id)
            if not item:
                raise ValueError("Добавка отсутствует в складской базе")
            if int(item.get("stock", 0)) <= 0:
                raise ValueError("Добавка закончилась на складе")
            occupied = {value: key for key, value in db["additive_slots"].items()}
            if additive_id in occupied and occupied[additive_id] != slot_id:
                raise ValueError("Эта добавка уже установлена в другую ячейку")
            previous_id = db["additive_slots"][slot_id]
            db["additive_slots"][slot_id] = additive_id
            db["additive_change_log"].append({
                "slot_id": slot_id,
                "previous_additive_id": previous_id,
                "new_additive_id": additive_id,
                "changed_at": int(time.time()),
                "source": "operator_warehouse_demo",
            })
            save_db(db)
        return {"replaced": True, "slot_id": slot_id, "additive": item}

    @staticmethod
    def customer(payload: dict) -> dict:
        phone = valid_phone(payload.get("phone"))
        with LOCK:
            client = load_db()["clients"].get(phone)
        verified = bool(client and client.get("phone_verified", True))
        return {
            "found": verified,
            "channels": client.get("channels", []) if verified else [],
            "name": client.get("name", "") if verified else "",
            "accrual_rate_percent": int(client.get("accrual_rate_percent", client.get("discount_percent", 0))) if verified else 0,
            "bonus_balance": int(client.get("bonus_balance", 0)) if verified else 0,
        }

    @staticmethod
    def link(payload: dict) -> dict:
        phone = valid_phone(payload.get("phone"))
        selected = valid_channels(payload.get("channels"))
        with LOCK:
            db = load_db()
            previous = db["clients"].get(phone, {}).get("channels", [])
            merged = list(dict.fromkeys(previous + selected))
            previous_client = db["clients"].get(phone, {})
            db["clients"][phone] = {
                "phone": phone,
                "name": previous_client.get("name", ""),
                "accrual_rate_percent": int(previous_client.get("accrual_rate_percent", previous_client.get("discount_percent", 5))),
                "channels": merged,
                "phone_verified": bool(previous_client.get("phone_verified", False)),
                "profile_source": previous_client.get("profile_source", "loyalty_program"),
                "bonus_balance": int(previous_client.get("bonus_balance", 0)),
                "updated_at": int(time.time()),
            }
            save_db(db)
        return {"saved": True, "channels": merged}

    @staticmethod
    def send_code(payload: dict) -> dict:
        phone = valid_phone(payload.get("phone"))
        requested = valid_channels(payload.get("channels"))
        with LOCK:
            db = load_db()
            client = db["clients"].get(phone)
            if not client:
                raise ValueError("Клиент не найден в тестовой CRM")
            linked = client.get("channels", [])
            if any(item not in linked for item in requested):
                raise ValueError("Сначала привяжите выбранный канал")
            nonce = secrets.token_hex(16)
            db["codes"][phone] = {
                "hash": code_hash(phone, TEST_CODE, nonce), "nonce": nonce,
                "channels": requested, "expires_at": int(time.time()) + CODE_TTL_SECONDS,
                "attempts": 0, "used": False
            }
            save_db(db)
        return {
            "sent": True, "channels": requested, "expires_in": CODE_TTL_SECONDS,
            "test_code": TEST_CODE, "max_attempts": MAX_CODE_ATTEMPTS,
        }

    @staticmethod
    def verify_code(payload: dict) -> dict:
        phone = valid_phone(payload.get("phone"))
        code = "".join(ch for ch in str(payload.get("code", "")) if ch.isdigit())
        with LOCK:
            db = load_db()
            record = db["codes"].get(phone)
            if not record or record.get("used") or record.get("expires_at", 0) < int(time.time()):
                return {"valid": False, "reason": "expired", "attempts_remaining": 0, "locked": True}
            valid = secrets.compare_digest(record["hash"], code_hash(phone, code, record["nonce"]))
            if valid:
                record["used"] = True
                client = db["clients"].get(phone)
                if client:
                    client["phone_verified"] = True
                    client["updated_at"] = int(time.time())
                attempts_remaining = MAX_CODE_ATTEMPTS - int(record.get("attempts", 0))
                reason = "valid"
            else:
                record["attempts"] = int(record.get("attempts", 0)) + 1
                attempts_remaining = max(0, MAX_CODE_ATTEMPTS - record["attempts"])
                reason = "wrong_code"
                if attempts_remaining == 0:
                    record["used"] = True
                    reason = "attempts_exhausted"
            save_db(db)
        return {
            "valid": valid, "reason": reason,
            "attempts_remaining": attempts_remaining,
            "locked": reason == "attempts_exhausted",
        }

    @staticmethod
    def community_invite(payload: dict) -> dict:
        phone = valid_phone(payload.get("phone"))
        channel = str(payload.get("channel") or "")
        if channel not in {"telegram", "max"}:
            raise ValueError("Канал не поддерживает приглашение")
        with LOCK:
            db = load_db()
            client = db["clients"].get(phone)
            if not client or not client.get("phone_verified"):
                raise ValueError("Сначала подтвердите номер телефона")
            if channel not in client.get("channels", []):
                raise ValueError("Сначала привяжите выбранный мессенджер")
            invites = client.setdefault("community_invites", {})
            invites[channel] = {
                "invite_sent_at": int(time.time()),
                "subscription_confirmed": False,
                "bonus_pending": 50,
                "bonus_awarded": False,
            }
            client["updated_at"] = int(time.time())
            save_db(db)
        return {"invite_sent": True, "channel": channel, "bonus_pending": 50}

    @staticmethod
    def _qr_token(preorder: dict, bucket: int | None = None) -> str:
        current_bucket = int(bucket if bucket is not None else time.time() // PREORDER_QR_ROTATION_SECONDS)
        raw = f"{preorder['preorder_id']}:{preorder['machine_id']}:{current_bucket}:{preorder['qr_secret']}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]

    @staticmethod
    def _preorder_public(preorder: dict, profile: dict | None = None) -> dict:
        composition = preorder.get("order") or {}
        with LOCK:
            db = load_db()
        topping = db.get("topping_catalog", {}).get(str(composition.get("topping_id") or "none"), {"name": "Без топпинга"})
        additive = db.get("additive_catalog", {}).get(str(composition.get("additive_id") or "none"), {"name": "Без добавки"})
        parts = ["Ванильное мороженое", str(topping.get("name") or "Без топпинга"), str(additive.get("name") or "Без добавки")]
        now = int(time.time())
        pickup_code_expires_at = int(preorder.get("pickup_code_expires_at", 0))
        code_is_active = preorder.get("status") == "pickup_code_active" and pickup_code_expires_at > now
        manual_code = str(preorder.get("manual_code_demo") or "") if code_is_active else ""
        qr_token = Handler._qr_token(preorder) if code_is_active else ""
        transfer_status = str(preorder.get("transfer_status") or "")
        viewer_role = ""
        if profile:
            if Handler._preorder_original_owner(preorder, profile):
                viewer_role = "buyer"
            if Handler._preorder_belongs_to(preorder, profile):
                viewer_role = "recipient" if transfer_status == "accepted" else "holder"
        sender_visibility = str(preorder.get("transfer_sender_visibility") or "named")
        sender_public_name = "Добрый друг" if sender_visibility == "anonymous" else str(preorder.get("transfer_sender_name") or "Добрый друг")
        result = {
            "preorder_id": preorder.get("preorder_id"),
            "status": preorder.get("status"),
            "machine_id": preorder.get("machine_id"),
            "amount": int(preorder.get("amount", 0)),
            "expires_at": int(preorder.get("expires_at", 0)),
            "pickup_code_expires_at": pickup_code_expires_at,
            "qr_rotates_in": max(0, pickup_code_expires_at - now) if code_is_active else 0,
            "qr_token": qr_token,
            "qr_value": f"{preorder.get('preorder_id')}:{qr_token}" if qr_token else "",
            "manual_code": manual_code,
            "manual_code_hint": f"Тестовый код: {manual_code}" if manual_code else "",
            "composition": composition,
            "description": " · ".join(parts),
            "machine": MACHINES.get(str(preorder.get("machine_id")), {"id": preorder.get("machine_id"), "name": "Аппарат Soft_ICE"}),
            "transfer_status": transfer_status,
            "viewer_role": viewer_role,
            "transferred_to_name": str(preorder.get("transfer_recipient_name") or "") if viewer_role == "buyer" else "",
            "transferred_from_name": sender_public_name if viewer_role == "recipient" else "",
            "gift_message": str(preorder.get("transfer_message") or "") if viewer_role == "recipient" else "",
            "can_thank": bool(viewer_role == "recipient" and transfer_status == "accepted" and not preorder.get("transfer_thanked_at")),
            "thanked_at": int(preorder.get("transfer_thanked_at", 0)) if viewer_role == "recipient" else 0,
            "thanks_received_name": str(preorder.get("transfer_recipient_name") or "Получатель") if viewer_role == "buyer" and preorder.get("transfer_thanked_at") else "",
            "vk_shared_at": int(preorder.get("transfer_vk_shared_at", 0)) if viewer_role == "recipient" else 0,
        }
        if viewer_role in {"buyer", "holder"} and transfer_status == "offered":
            token = normalize_transfer_token(preorder.get("transfer_token"))
            if token:
                result.update(Handler._transfer_links(token))
        return result

    @staticmethod
    def preorder_demo() -> dict:
        with LOCK:
            db = load_db()
            preorder = next((item for item in sorted(db["preorders"].values(), key=lambda value: int(value.get("created_at", 0)), reverse=True)
                             if item.get("machine_id") == MACHINE_ID and item.get("status") == "paid_waiting_pickup"), None)
            if not preorder:
                preorder = demo_preorder()
                preorder["manual_code_demo"] = PREORDER_MANUAL_CODE
                db["preorders"][preorder["preorder_id"]] = preorder
                save_db(db)
        return Handler._preorder_public(preorder)

    @staticmethod
    def _find_preorder(db: dict, payload: dict, mode: str = "") -> dict | None:
        preorder_id = str(payload.get("preorder_id") or "")
        value = str(payload.get("value") or "")
        if mode == "qr" and not preorder_id and ":" in value:
            preorder_id = value.split(":", 1)[0]
        if preorder_id:
            return db.get("preorders", {}).get(preorder_id)
        if mode == "code":
            supplied_hash = hashlib.sha256("".join(ch for ch in value if ch.isdigit()).encode("utf-8")).hexdigest()
            return next((item for item in db.get("preorders", {}).values()
                         if item.get("machine_id") == MACHINE_ID and secrets.compare_digest(supplied_hash, str(item.get("manual_code_hash") or ""))), None)
        return next((item for item in sorted(db.get("preorders", {}).values(), key=lambda item: int(item.get("created_at", 0)), reverse=True)
                     if item.get("machine_id") == MACHINE_ID and item.get("status") == "paid_waiting_pickup"), None)

    @staticmethod
    def tma_machines() -> dict:
        return {"machines": list(MACHINES.values()), "selected_machine_id": MACHINE_ID}

    @staticmethod
    def _price_order(db: dict, order: dict) -> tuple[int, dict]:
        active_mix_id = str(db.get("active_mix_id") or "")
        product_id = str(order.get("product_id") or "")
        if product_id != active_mix_id:
            raise ValueError("Выбранная порция недоступна")
        mix = db.get("mix_catalog", {}).get(product_id)
        if not mix or int(mix.get("stock", 0)) <= 0:
            raise ValueError("Смесь выбранного вкуса закончилась")
        topping_id = str(order.get("topping_id") or "none")
        additive_id = str(order.get("additive_id") or "none")
        active_toppings = set(db.get("topping_slots", {}).values())
        active_additives = set(db.get("additive_slots", {}).values())
        if topping_id != "none" and topping_id not in active_toppings:
            raise ValueError("Выбранный топпинг уже недоступен. Обновите меню")
        if additive_id != "none" and additive_id not in active_additives:
            raise ValueError("Выбранная добавка уже недоступна. Обновите меню")
        topping = db.get("topping_catalog", {}).get(topping_id, {"price": 0, "stock": 1})
        additive = db.get("additive_catalog", {}).get(additive_id, {"price": 0, "stock": 1})
        if topping_id != "none" and int(topping.get("stock", 0)) <= 0:
            raise ValueError("Выбранный топпинг закончился")
        if additive_id != "none" and int(additive.get("stock", 0)) <= 0:
            raise ValueError("Выбранная добавка закончилась")
        normalized = {"product_id": product_id, "topping_id": topping_id, "additive_id": additive_id}
        return int(mix.get("price", 0)) + int(topping.get("price", 0)) + int(additive.get("price", 0)), normalized

    @staticmethod
    def create_tma_preorder(payload: dict) -> dict:
        profile = authenticate_webapp(payload)
        phone = str(profile.get("phone") or "")
        machine_id = str(payload.get("machine_id") or "")
        machine = MACHINES.get(machine_id)
        if not machine or not machine.get("available"):
            raise ValueError("Выбранный аппарат сейчас недоступен для предзаказа")
        method = str(payload.get("method") or "")
        if method not in {"sbp", "card"}:
            raise ValueError("Выберите СБП или банковскую карту")
        order = payload.get("order")
        if not isinstance(order, dict):
            raise ValueError("Состав заказа не выбран")
        now = int(time.time())
        preorder_id = f"preorder-{now}-{secrets.token_hex(3)}"
        payment_id = f"prepay-{now}-{secrets.token_hex(3)}"
        with LOCK:
            db = load_db()
            Handler._expire_user_preorders(db, profile, now)
            active = Handler._active_user_preorder(db, profile)
            if active:
                save_db(db)
                raise ValueError("Сначала получите уже оплаченный заказ в личном кабинете")
            amount, normalized = Handler._price_order(db, order)
            preorder = {
                "preorder_id": preorder_id, "status": "awaiting_payment", "machine_id": machine_id,
                "phone": phone, "phone_last4": phone[-4:] if phone else "", "channels": [profile["provider"]],
                "identity_key": profile["identity_key"], "identity_provider": profile["provider"],
                "provider_user_id": profile["id"], "client_key": profile["client_key"],
                "amount": amount, "currency": "RUB", "order": normalized,
                "manual_code_hash": "", "manual_code_demo": "", "qr_secret": secrets.token_hex(16),
                "created_at": now, "expires_at": 0, "attempts": 0, "locked_until": 0,
                "pickup_code_expires_at": 0,
                "payment_id": payment_id, "payment_method": method,
            }
            db["preorders"][preorder_id] = preorder
            db["payments"][payment_id] = {
                "id": payment_id, "provider": "yookassa_demo", "method": method, "amount": amount,
                "bonus_used": 0, "subtotal": amount, "currency": "RUB", "status": "pending",
                "phone": phone, "identity_key": profile["identity_key"],
                "identity_provider": profile["provider"], "provider_user_id": profile["id"],
                "client_key": profile["client_key"],
                "order": normalized, "preorder_id": preorder_id,
                "loyalty_eligible": False, "created_at": now,
            }
            db["gateway_audit"].append({"event": "preorder.created", "preorder_id": preorder_id, "payment_id": payment_id, "machine_id": machine_id, "amount": amount, "created_at": now})
            save_db(db)
        return {"preorder_id": preorder_id, "payment_id": payment_id, "status": "awaiting_payment", "amount": amount, "provider": "yookassa_demo"}

    @staticmethod
    def complete_tma_preorder(payload: dict) -> dict:
        profile = authenticate_webapp(payload)
        preorder_id = str(payload.get("preorder_id") or "")
        result = str(payload.get("result") or "")
        if result not in {"succeeded", "failed"}:
            raise ValueError("Неизвестный результат оплаты")
        now = int(time.time())
        with LOCK:
            db = load_db()
            preorder = db.get("preorders", {}).get(preorder_id)
            if not preorder:
                raise ValueError("Предзаказ не найден")
            if not Handler._preorder_belongs_to(preorder, profile):
                raise ValueError("Предзаказ принадлежит другому профилю")
            payment = db.get("payments", {}).get(str(preorder.get("payment_id") or ""))
            if not payment or payment.get("status") != "pending" or preorder.get("status") != "awaiting_payment":
                raise ValueError("Оплата этого предзаказа уже завершена")
            if result == "succeeded":
                amount, _ = Handler._price_order(db, preorder.get("order") or {})
                if amount != int(preorder.get("amount", 0)):
                    raise ValueError("Цена изменилась. Сформируйте предзаказ заново")
                preorder["status"] = "paid_waiting_pickup"
                preorder["paid_at"] = now
                preorder["expires_at"] = now + PREORDER_TTL_SECONDS
            else:
                preorder["status"] = "payment_failed"
            payment["status"] = result
            payment["completed_at"] = now
            db["gateway_audit"].append({"event": f"preorder.payment.{result}", "preorder_id": preorder_id, "payment_id": payment.get("id"), "created_at": now})
            save_db(db)
        response = Handler._preorder_public(preorder) if result == "succeeded" else {"preorder_id": preorder_id, "status": "payment_failed"}
        response["payment_status"] = result
        return response

    @staticmethod
    def tma_preorder_status(payload: dict) -> dict:
        profile = authenticate_webapp(payload)
        preorder_id = str(payload.get("preorder_id") or "")
        with LOCK:
            db = load_db()
            preorder = db.get("preorders", {}).get(preorder_id)
        if not preorder:
            raise ValueError("Предзаказ не найден")
        if not Handler._preorder_belongs_to(preorder, profile):
            raise ValueError("Предзаказ принадлежит другому профилю")
        return Handler._preorder_public(preorder)

    @staticmethod
    def _preorder_original_owner(preorder: dict, profile: dict) -> bool:
        identity_key = str(preorder.get("identity_key") or "")
        if identity_key:
            return secrets.compare_digest(identity_key, str(profile.get("identity_key") or ""))
        return profile.get("provider") == "telegram" and int(preorder.get("telegram_user_id") or 0) == int(profile["id"])

    @staticmethod
    def _preorder_belongs_to(preorder: dict, profile: dict) -> bool:
        if preorder.get("transfer_status") == "accepted":
            recipient_key = str(preorder.get("transfer_recipient_identity_key") or "")
            return bool(recipient_key) and secrets.compare_digest(recipient_key, str(profile.get("identity_key") or ""))
        return Handler._preorder_original_owner(preorder, profile)

    @staticmethod
    def _active_user_preorder(db: dict, profile: dict) -> dict | None:
        return next((item for item in sorted(db.get("preorders", {}).values(), key=lambda value: int(value.get("created_at", 0)), reverse=True)
                     if Handler._preorder_belongs_to(item, profile) and item.get("status") in ACTIVE_PREORDER_STATUSES), None)

    @staticmethod
    def _expire_user_preorders(db: dict, profile: dict, now: int) -> bool:
        changed = False
        for preorder in db.get("preorders", {}).values():
            if not (Handler._preorder_belongs_to(preorder, profile) or Handler._preorder_original_owner(preorder, profile)):
                continue
            if preorder.get("status") == "pickup_code_active" and int(preorder.get("pickup_code_expires_at", 0)) <= now:
                preorder["status"] = "paid_waiting_pickup"
                preorder["pickup_code_expires_at"] = 0
                preorder["manual_code_hash"] = ""
                preorder["manual_code_demo"] = ""
                changed = True
            if preorder.get("status") == "paid_waiting_pickup" and int(preorder.get("expires_at", 0)) <= now:
                amount = int(preorder.get("amount", 0))
                client = db.get("clients", {}).get(str(preorder.get("client_key") or preorder.get("phone") or ""))
                if client and not preorder.get("money_refund_completed"):
                    before = int(client.get("money_balance", 0))
                    client["money_balance"] = before + amount
                    preorder["money_refund_completed"] = True
                    preorder["money_refund_amount"] = amount
                    db["gateway_audit"].append({
                        "event": "preorder.expired.money_balance_refunded", "preorder_id": preorder["preorder_id"],
                        "amount": amount, "balance_before": before, "balance_after": before + amount, "created_at": now,
                    })
                preorder["status"] = "expired_refunded"
                changed = True
        return changed

    @staticmethod
    def tma_account(payload: dict) -> dict:
        profile = authenticate_webapp(payload)
        now = int(time.time())
        with LOCK:
            db = load_db()
            changed = Handler._expire_user_preorders(db, profile, now)
            active = Handler._active_user_preorder(db, profile)
            history = [item for item in sorted(db.get("preorders", {}).values(), key=lambda value: int(value.get("created_at", 0)), reverse=True)
                       if Handler._preorder_belongs_to(item, profile) or Handler._preorder_original_owner(item, profile)][:10]
            notifications = [
                {
                    "type": "gift_thanks", "preorder_id": item.get("preorder_id"),
                    "name": str(item.get("transfer_recipient_name") or "Получатель"),
                    "created_at": int(item.get("transfer_thanked_at", 0)),
                }
                for item in history
                if Handler._preorder_original_owner(item, profile) and item.get("transfer_thanked_at")
            ][:3]
            client = db.get("clients", {}).get(str(profile.get("client_key") or ""), {})
            if changed:
                save_db(db)
        return {
            "active_order": Handler._preorder_public(active, profile) if active else None,
            "orders": [Handler._preorder_public(item, profile) for item in history],
            "notifications": notifications,
            "balances": {"bonus": int(client.get("bonus_balance", 0)), "money": int(client.get("money_balance", 0))},
        }

    @staticmethod
    def tma_referral(payload: dict) -> dict:
        profile = authenticate_webapp(payload)
        client_key = str(profile.get("client_key") or "")
        now = int(time.time())
        with LOCK:
            db = load_db()
            code = ensure_referral_code(db, client_key, now)
            referrals = [
                item for item in db.get("referrals", {}).values()
                if str(item.get("referrer_client_key") or "") == client_key
            ]
            referrals.sort(key=lambda item: int(item.get("registered_at", 0)), reverse=True)
            friends = []
            for item in referrals[:50]:
                invitee = db.get("clients", {}).get(str(item.get("invitee_client_key") or ""), {})
                friends.append({
                    "name": str(invitee.get("name") or "Участник")[:64],
                    "status": str(item.get("status") or "registered"),
                    "registered_at": int(item.get("registered_at", 0)),
                    "activated_at": int(item.get("activated_at", 0)),
                })
            active_count = sum(1 for item in referrals if item.get("status") == "active")
            referral_earned = sum(
                int(item.get("points", 0)) for item in db.get("loyalty_transactions", [])
                if str(item.get("client_key") or "") == client_key
                and str(item.get("event") or "").startswith("referral.inviter")
            )
            client = db.get("clients", {}).get(client_key, {})
            settings = db.get("referral_settings", {})
            save_db(db)
        return {
            "code": code,
            **referral_links(code),
            "invited_count": len(referrals),
            "active_count": active_count,
            "earned_bonus": referral_earned,
            "milestone": {
                "current": min(active_count, int(settings.get("milestone_size", REFERRAL_MILESTONE_SIZE))),
                "target": int(settings.get("milestone_size", REFERRAL_MILESTONE_SIZE)),
                "bonus": int(settings.get("milestone_bonus", REFERRAL_MILESTONE_BONUS)),
                "awarded": bool(client.get("referral_milestone_awarded")),
            },
            "rewards": {
                "invitee": int(settings.get("invitee_bonus", REFERRAL_INVITEE_BONUS)),
                "inviter": int(settings.get("inviter_bonus", REFERRAL_INVITER_BONUS)),
            },
            "friends": friends,
        }

    @staticmethod
    def _transfer_links(token: str) -> dict:
        start_param = f"gift_{token}"
        public_url = f"{PUBLIC_BASE_URL}/transfer/{quote(token)}"
        telegram_url = f"https://t.me/{TELEGRAM_EXPECTED_USERNAME}?startapp={quote(start_param)}"
        max_url = f"https://max.ru/{MAX_BOT_USERNAME}?startapp={quote(start_param)}" if MAX_BOT_USERNAME else ""
        text = "Я передаю вам уже оплаченное мороженое «У Тимоши» 🍦 Примите заказ по ссылке:"
        return {
            "transfer_url": public_url,
            "transfer_telegram_url": telegram_url,
            "transfer_max_url": max_url,
            "transfer_telegram_share_url": f"https://t.me/share/url?url={quote(telegram_url, safe='')}&text={quote(text, safe='')}",
            "transfer_max_share_url": f"https://max.ru/:share?text={quote(f'{text} {max_url}', safe='')}" if max_url else "",
            "transfer_share_text": text,
        }

    @staticmethod
    def _find_transfer(db: dict, token: str) -> dict | None:
        normalized = normalize_transfer_token(token)
        if not normalized:
            return None
        return next(
            (item for item in db.get("preorders", {}).values()
             if secrets.compare_digest(str(item.get("transfer_token") or ""), normalized)),
            None,
        )

    @staticmethod
    def create_preorder_transfer(payload: dict) -> dict:
        profile = authenticate_webapp(payload)
        preorder_id = str(payload.get("preorder_id") or "")
        now = int(time.time())
        sender_visibility = "anonymous" if str(payload.get("sender_visibility") or "") == "anonymous" else "named"
        message = " ".join(str(payload.get("gift_message") or "").split())[:160]
        with LOCK:
            db = load_db()
            Handler._expire_user_preorders(db, profile, now)
            preorder = db.get("preorders", {}).get(preorder_id)
            if not preorder or not Handler._preorder_original_owner(preorder, profile):
                raise ValueError("Оплаченный заказ не найден")
            if preorder.get("transfer_status") == "accepted":
                raise ValueError("Заказ уже передан другому человеку")
            if preorder.get("status") != "paid_waiting_pickup":
                raise ValueError("Передать заказ можно до создания кода получения")
            if int(preorder.get("expires_at", 0)) <= now:
                raise ValueError("Срок получения заказа уже истёк")
            token = normalize_transfer_token(preorder.get("transfer_token"))
            if not token or preorder.get("transfer_status") != "offered":
                token = secrets.token_urlsafe(24)
            preorder.update({
                "transfer_status": "offered",
                "transfer_token": token,
                "transfer_created_at": now,
                "transfer_sender_name": str(profile.get("first_name") or "Покупатель")[:64],
                "transfer_sender_visibility": sender_visibility,
                "transfer_message": message,
                "transfer_recipient_identity_key": "",
                "transfer_recipient_client_key": "",
                "transfer_recipient_name": "",
                "transfer_accepted_at": 0,
            })
            db.setdefault("gateway_audit", []).append({
                "event": "preorder.transfer.created", "preorder_id": preorder_id,
                "sender_identity_key": profile.get("identity_key"), "created_at": now,
            })
            save_db(db)
        return {"preorder_id": preorder_id, "status": "offered", "expires_at": int(preorder.get("expires_at", 0)), **Handler._transfer_links(token)}

    @staticmethod
    def preview_preorder_transfer(payload: dict) -> dict:
        profile = authenticate_webapp(payload)
        token = normalize_transfer_token(payload.get("transfer_token")) or transfer_start_token(referral_start_param(payload, str(profile.get("auth_mode") or "")))
        now = int(time.time())
        with LOCK:
            db = load_db()
            preorder = Handler._find_transfer(db, token)
            if not preorder or preorder.get("transfer_status") != "offered":
                raise ValueError("Ссылка передачи уже использована или отменена")
            if preorder.get("status") != "paid_waiting_pickup" or int(preorder.get("expires_at", 0)) <= now:
                raise ValueError("Заказ уже нельзя передать")
            if Handler._preorder_original_owner(preorder, profile):
                raise ValueError("Это ваша ссылка. Отправьте её человеку, которому хотите передать заказ")
        result = Handler._preorder_public(preorder)
        sender_visibility = str(preorder.get("transfer_sender_visibility") or "named")
        sender_name = "Добрый друг" if sender_visibility == "anonymous" else str(preorder.get("transfer_sender_name") or "Добрый друг")
        result.update({"transfer_token": token, "sender_name": sender_name, "gift_message": str(preorder.get("transfer_message") or "")})
        return result

    @staticmethod
    def accept_preorder_transfer(payload: dict) -> dict:
        profile = authenticate_webapp(payload)
        token = normalize_transfer_token(payload.get("transfer_token")) or transfer_start_token(referral_start_param(payload, str(profile.get("auth_mode") or "")))
        now = int(time.time())
        with LOCK:
            db = load_db()
            preorder = Handler._find_transfer(db, token)
            if not preorder or preorder.get("transfer_status") != "offered":
                raise ValueError("Ссылка передачи уже использована или отменена")
            if Handler._preorder_original_owner(preorder, profile):
                raise ValueError("Нельзя передать заказ самому себе")
            if preorder.get("status") != "paid_waiting_pickup" or int(preorder.get("expires_at", 0)) <= now:
                raise ValueError("Заказ уже нельзя принять")
            active = Handler._active_user_preorder(db, profile)
            if active and active.get("preorder_id") != preorder.get("preorder_id"):
                raise ValueError("Сначала получите свой активный заказ, затем примите этот")
            preorder.update({
                "transfer_status": "accepted",
                "transfer_recipient_identity_key": profile["identity_key"],
                "transfer_recipient_client_key": profile["client_key"],
                "transfer_recipient_provider": profile["provider"],
                "transfer_recipient_user_id": profile["id"],
                "transfer_recipient_name": str(profile.get("first_name") or "Получатель")[:64],
                "transfer_accepted_at": now,
                "transfer_token": "",
            })
            db.setdefault("gateway_audit", []).append({
                "event": "preorder.transfer.accepted", "preorder_id": preorder.get("preorder_id"),
                "recipient_identity_key": profile.get("identity_key"), "created_at": now,
            })
            save_db(db)
        return Handler._preorder_public(preorder, profile)

    @staticmethod
    def cancel_preorder_transfer(payload: dict) -> dict:
        profile = authenticate_webapp(payload)
        preorder_id = str(payload.get("preorder_id") or "")
        now = int(time.time())
        with LOCK:
            db = load_db()
            preorder = db.get("preorders", {}).get(preorder_id)
            if not preorder or not Handler._preorder_original_owner(preorder, profile):
                raise ValueError("Оплаченный заказ не найден")
            if preorder.get("transfer_status") != "offered":
                raise ValueError("Активного предложения передачи нет")
            preorder.update({"transfer_status": "cancelled", "transfer_token": "", "transfer_cancelled_at": now})
            db.setdefault("gateway_audit", []).append({
                "event": "preorder.transfer.cancelled", "preorder_id": preorder_id,
                "sender_identity_key": profile.get("identity_key"), "created_at": now,
            })
            save_db(db)
        return Handler._preorder_public(preorder, profile)

    @staticmethod
    def thank_for_preorder_transfer(payload: dict) -> dict:
        profile = authenticate_webapp(payload)
        preorder_id = str(payload.get("preorder_id") or "")
        now = int(time.time())
        with LOCK:
            db = load_db()
            preorder = db.get("preorders", {}).get(preorder_id)
            if not preorder or preorder.get("transfer_status") != "accepted" or not Handler._preorder_belongs_to(preorder, profile):
                raise ValueError("Переданный заказ не найден")
            if not preorder.get("transfer_thanked_at"):
                preorder["transfer_thanked_at"] = now
                preorder["transfer_thanks_text"] = "Спасибо за мороженое! ❤️"
                db.setdefault("gateway_audit", []).append({
                    "event": "preorder.transfer.thanked", "preorder_id": preorder_id,
                    "recipient_identity_key": profile.get("identity_key"), "created_at": now,
                })
                save_db(db)
        return {"thanked": True, "message": "Благодарность отправлена", "order": Handler._preorder_public(preorder, profile)}

    @staticmethod
    def share_preorder_transfer_vk(payload: dict) -> dict:
        profile = authenticate_webapp(payload)
        preorder_id = str(payload.get("preorder_id") or "")
        now = int(time.time())
        with LOCK:
            db = load_db()
            preorder = db.get("preorders", {}).get(preorder_id)
            if not preorder or preorder.get("transfer_status") != "accepted" or not Handler._preorder_belongs_to(preorder, profile):
                raise ValueError("Переданный заказ не найден")
            code = ensure_referral_code(db, str(profile.get("client_key") or ""), now)
            landing_url = referral_links(code)["referral_url"]
            preorder["transfer_vk_shared_at"] = now
            preorder["transfer_vk_share_count"] = int(preorder.get("transfer_vk_share_count", 0)) + 1
            db.setdefault("gateway_audit", []).append({
                "event": "preorder.transfer.shared.vk", "preorder_id": preorder_id,
                "recipient_identity_key": profile.get("identity_key"), "created_at": now,
            })
            save_db(db)
        title = "Мне подарили мороженое «У Тимоши» 🍦"
        description = "Маленький подарок, а настроение на весь день! Хотите так же? Подарите другу счастье в одном стаканчике."
        image_url = f"{PUBLIC_BASE_URL}/assets/soft_ice_cup_u_timoshi.png"
        vk_url = "https://vk.com/share.php?" + urlencode({"url": landing_url, "title": title, "description": description, "image": image_url})
        return {"shared": True, "vk_share_url": vk_url}

    @staticmethod
    def activate_tma_pickup(payload: dict) -> dict:
        profile = authenticate_webapp(payload)
        preorder_id = str(payload.get("preorder_id") or "")
        now = int(time.time())
        with LOCK:
            db = load_db()
            Handler._expire_user_preorders(db, profile, now)
            preorder = db.get("preorders", {}).get(preorder_id)
            if not preorder or not Handler._preorder_belongs_to(preorder, profile):
                raise ValueError("Оплаченный заказ не найден")
            if preorder.get("status") not in {"paid_waiting_pickup", "pickup_code_active"}:
                raise ValueError("Этот заказ сейчас нельзя предъявить к выдаче")
            manual_code = f"{secrets.randbelow(900000) + 100000:06d}"
            preorder["status"] = "pickup_code_active"
            preorder["manual_code_hash"] = hashlib.sha256(manual_code.encode("utf-8")).hexdigest()
            preorder["manual_code_demo"] = manual_code
            preorder["qr_secret"] = secrets.token_hex(16)
            preorder["pickup_code_expires_at"] = now + PREORDER_QR_ROTATION_SECONDS
            preorder["pickup_code_activated_at"] = now
            db["gateway_audit"].append({"event": "preorder.pickup_code.activated", "preorder_id": preorder_id, "created_at": now})
            save_db(db)
        return Handler._preorder_public(preorder)

    @staticmethod
    def _assert_preorder_available(preorder: dict, now: int) -> None:
        if preorder.get("machine_id") != MACHINE_ID:
            raise ValueError("Заказ оплачен для другого аппарата")
        if int(preorder.get("expires_at", 0)) < now:
            raise ValueError("Срок получения 48 часов истёк. Средства возвращены в клубный счёт")
        if preorder.get("status") != "pickup_code_active":
            if preorder.get("status") in {"in_progress", "redeemed"}:
                raise ValueError("Этот оплаченный заказ уже был предъявлен к выдаче")
            raise ValueError("Сначала откройте личный кабинет Mini App и нажмите «Я у аппарата»")
        if int(preorder.get("pickup_code_expires_at", 0)) < now:
            raise ValueError("Пятиминутный код истёк. Получите новый код в личном кабинете")
        locked_until = int(preorder.get("locked_until", 0))
        if locked_until > now:
            raise ValueError(f"Слишком много неверных попыток. Повторите через {locked_until - now} сек.")

    @staticmethod
    def claim_preorder(payload: dict) -> dict:
        mode = str(payload.get("mode") or "")
        value = str(payload.get("value") or "").strip()
        if mode not in {"qr", "code"}:
            raise ValueError("Выберите QR-код или цифровой код")
        now = int(time.time())
        with LOCK:
            db = load_db()
            preorder = Handler._find_preorder(db, payload, mode)
            if not preorder:
                raise ValueError("Оплаченный заказ не найден")
            if int(preorder.get("expires_at", 0)) < now and preorder.get("status") in {"paid_waiting_pickup", "pickup_code_active"}:
                client = db.get("clients", {}).get(str(preorder.get("client_key") or preorder.get("phone") or ""))
                amount = int(preorder.get("amount", 0))
                if client and not preorder.get("money_refund_completed"):
                    before = int(client.get("money_balance", 0))
                    client["money_balance"] = before + amount
                    preorder["money_refund_completed"] = True
                    preorder["money_refund_amount"] = amount
                    db["gateway_audit"].append({
                        "event": "preorder.expired.money_balance_refunded", "preorder_id": preorder["preorder_id"],
                        "amount": amount, "balance_before": before, "balance_after": before + amount, "created_at": now,
                    })
                preorder["status"] = "expired_refunded"
                save_db(db)
            Handler._assert_preorder_available(preorder, now)
            valid = False
            if mode == "qr":
                if ":" in value:
                    value = value.split(":", 1)[1]
                current_bucket = now // PREORDER_QR_ROTATION_SECONDS
                valid = any(secrets.compare_digest(value, Handler._qr_token(preorder, bucket)) for bucket in (current_bucket, current_bucket - 1))
            else:
                supplied_hash = hashlib.sha256("".join(ch for ch in value if ch.isdigit()).encode("utf-8")).hexdigest()
                valid = secrets.compare_digest(supplied_hash, preorder.get("manual_code_hash", ""))
            db["preorder_attempts"].append({
                "preorder_id": preorder["preorder_id"], "machine_id": MACHINE_ID,
                "mode": mode, "result": "accepted" if valid else "rejected", "created_at": now,
            })
            if not valid:
                attempts = int(preorder.get("attempts", 0)) + 1
                preorder["attempts"] = attempts
                if attempts >= PREORDER_MAX_ATTEMPTS:
                    preorder["attempts"] = 0
                    preorder["locked_until"] = now + PREORDER_LOCK_SECONDS
                    save_db(db)
                    raise ValueError("Три неверные попытки. Ввод временно заблокирован на 60 секунд; оплаченный заказ сохранён")
                save_db(db)
                raise ValueError(f"Код не подошёл. Осталось попыток до паузы: {PREORDER_MAX_ATTEMPTS - attempts}")
            preorder["attempts"] = 0
            preorder["locked_until"] = 0
            payment_id = str(preorder.get("payment_id") or "")
            if not payment_id:
                payment_id = f"prepaid-{now}-{secrets.token_hex(3)}"
                db["payments"][payment_id] = {
                    "id": payment_id, "provider": "yookassa_demo", "method": "prepaid",
                    "amount": int(preorder.get("amount", 0)), "bonus_used": 0,
                    "subtotal": int(preorder.get("amount", 0)), "currency": "RUB",
                    "status": "succeeded", "phone": preorder.get("phone", ""),
                    "order": preorder.get("order", {}), "preorder_id": preorder["preorder_id"],
                    "loyalty_eligible": False, "created_at": preorder.get("created_at", now), "completed_at": now,
                }
                preorder["payment_id"] = payment_id
            preorder["status"] = "in_progress"
            preorder["claimed_at"] = now
            save_db(db)
        return {"accepted": True, "payment_id": payment_id, "preorder_id": preorder["preorder_id"], "status": "in_progress"}

    @staticmethod
    def recover_preorder(payload: dict) -> dict:
        last4 = "".join(ch for ch in str(payload.get("phone_last4") or "") if ch.isdigit())
        with LOCK:
            db = load_db()
            preorder = Handler._find_preorder(db, payload)
            if not preorder or last4 != str(preorder.get("phone_last4") or ""):
                raise ValueError("Последние четыре цифры телефона не совпали")
            preorder["recovery_expires_at"] = int(time.time()) + CODE_TTL_SECONDS
            save_db(db)
        return {"sent": True, "channels": preorder.get("channels", []), "test_code": PREORDER_RECOVERY_CODE, "expires_in": CODE_TTL_SECONDS}

    @staticmethod
    def verify_preorder_recovery(payload: dict) -> dict:
        code = "".join(ch for ch in str(payload.get("code") or "") if ch.isdigit())
        with LOCK:
            db = load_db()
            preorder = Handler._find_preorder(db, payload)
            if not preorder or int(preorder.get("recovery_expires_at", 0)) < int(time.time()):
                raise ValueError("Срок действия кода восстановления истёк")
            if not secrets.compare_digest(code, PREORDER_RECOVERY_CODE):
                raise ValueError("Неверный код восстановления")
            preorder["locked_until"] = 0
            preorder["attempts"] = 0
            preorder["recovery_expires_at"] = 0
            save_db(db)
        return {"verified": True, "manual_code": str(preorder.get("manual_code_demo") or PREORDER_MANUAL_CODE)}

    @staticmethod
    def create_payment(payload: dict) -> dict:
        method = str(payload.get("method") or "")
        if method not in {"sbp", "card", "bonus"}:
            raise ValueError("Выберите способ оплаты")
        try:
            amount = int(payload.get("amount"))
            bonus_used = int(payload.get("bonus_used", 0))
        except (TypeError, ValueError):
            raise ValueError("Некорректная сумма заказа")
        if amount < 0 or amount > 10_000 or bonus_used < 0:
            raise ValueError("Некорректная сумма платежа")
        order = payload.get("order")
        if not isinstance(order, dict) or not order.get("product_id"):
            raise ValueError("Заказ не сформирован")
        phone = str(payload.get("phone") or "")
        payment_id = f"demo-{int(time.time())}-{secrets.token_hex(3)}"
        with LOCK:
            db = load_db()
            product_id = str(order.get("product_id") or "")
            if product_id != str(db.get("active_mix_id") or ""):
                raise ValueError("Вкус в аппарате изменился. Сформируйте заказ заново")
            mix = db.get("mix_catalog", {}).get(product_id)
            if not mix or int(mix.get("stock", 0)) <= 0:
                raise ValueError("Смесь выбранного вкуса закончилась")
            topping = db.get("topping_catalog", {}).get(str(order.get("topping_id") or "none"), {"price": 0})
            additive = db.get("additive_catalog", {}).get(str(order.get("additive_id") or "none"), {"price": 0})
            product_price = int(mix.get("price", 0))
            subtotal = product_price + int(topping.get("price", 0)) + int(additive.get("price", 0))
            if bonus_used not in {0, product_price} or amount != subtotal - bonus_used:
                raise ValueError("Сумма заказа изменилась. Сформируйте заказ заново")
            if bonus_used:
                client = db.get("clients", {}).get(phone)
                if not client or not client.get("phone_verified"):
                    raise ValueError("Для оплаты бонусами подтвердите номер телефона")
                if int(client.get("bonus_balance", 0)) < bonus_used:
                    raise ValueError("На бонусном балансе недостаточно средств")
            if amount == 0 and method != "bonus":
                raise ValueError("Для заказа без денежной части выберите оплату бонусами")
            if amount > 0 and method == "bonus":
                raise ValueError("Топпинг и добавка оплачиваются СБП или банковской картой")
            db["payments"][payment_id] = {
                "id": payment_id,
                "provider": "loyalty_demo" if method == "bonus" else "yookassa_demo",
                "method": method,
                "amount": amount,
                "bonus_used": bonus_used,
                "subtotal": subtotal,
                "currency": "RUB",
                "status": "pending",
                "phone": phone,
                "order": order,
                "created_at": int(time.time()),
            }
            save_db(db)
        return {"payment_id": payment_id, "status": "pending", "provider": "yookassa_demo"}

    @staticmethod
    def complete_payment(payload: dict) -> dict:
        payment_id = str(payload.get("payment_id") or "")
        result = str(payload.get("result") or "")
        if result not in {"succeeded", "failed"}:
            raise ValueError("Неизвестный результат платежа")
        with LOCK:
            db = load_db()
            payment = db["payments"].get(payment_id)
            if not payment:
                raise ValueError("Платёж не найден")
            if payment.get("status") != "pending":
                raise ValueError("Платёж уже завершён")
            if result == "succeeded" and int(payment.get("bonus_used", 0)):
                phone = str(payment.get("phone") or "")
                client = db.get("clients", {}).get(phone)
                bonus_used = int(payment.get("bonus_used", 0))
                if not client or not client.get("phone_verified") or int(client.get("bonus_balance", 0)) < bonus_used:
                    raise ValueError("Бонусный баланс изменился. Сформируйте заказ заново")
                before = int(client.get("bonus_balance", 0))
                transaction_id = f"bonus-spend-{int(time.time())}-{secrets.token_hex(3)}"
                transaction = {
                    "transaction_id": transaction_id,
                    "event": "loyalty.bonus.redeemed",
                    "payment_id": payment_id,
                    "phone": phone,
                    "points": bonus_used,
                    "balance_before": before,
                    "balance_after": before - bonus_used,
                    "status": "completed",
                    "created_at": int(time.time()),
                }
                client["bonus_balance"] = before - bonus_used
                client["updated_at"] = int(time.time())
                db.setdefault("loyalty_transactions", []).append(transaction)
                payment["bonus_redemption_transaction_id"] = transaction_id
            payment["status"] = result
            payment["completed_at"] = int(time.time())
            save_db(db)
        message = "Платёж подтверждён" if result == "succeeded" else "Средства не списаны"
        return {"payment_id": payment_id, "status": result, "message": message}

    @staticmethod
    def machine_status() -> dict:
        with LOCK:
            db = load_db()
            machine = dict(db["machine"])
        ready = (
            machine.get("connection") == "online"
            and machine.get("sales_mode") == "ready"
            and not machine.get("safety_lock")
            and not machine.get("active_order_id")
        )
        return {
            "machine_id": machine.get("id", MACHINE_ID),
            "ready": ready,
            "connection": machine.get("connection", "offline"),
            "sales_mode": machine.get("sales_mode", "stopped"),
            "safety_lock": bool(machine.get("safety_lock")),
            "active_order_id": machine.get("active_order_id"),
            "telemetry_fresh": int(time.time()) - int(machine.get("last_telemetry_at", 0)) <= 60,
        }

    @staticmethod
    def start_dispense(payload: dict) -> dict:
        payment_id = str(payload.get("payment_id") or "")
        simulation = str(payload.get("simulation") or "success")
        if simulation not in {"success", "failure", "timeout"}:
            raise ValueError("Неизвестный сценарий Machine Gateway")
        with LOCK:
            db = load_db()
            payment = db["payments"].get(payment_id)
            if not payment or payment.get("status") != "succeeded":
                raise ValueError("Выдача доступна только после подтверждённой оплаты")
            existing = next(
                (item for item in db["dispense_orders"].values() if item.get("payment_id") == payment_id),
                None,
            )
            if existing:
                return Handler._dispense_payload(existing)
            machine = db["machine"]
            if machine.get("connection") != "online":
                raise ValueError("Аппарат не в сети. Заказ сохранён, выдача не начата")
            if machine.get("safety_lock"):
                raise ValueError("Аппарат временно заблокирован. Заказ сохранён")
            if machine.get("sales_mode") != "ready" or machine.get("active_order_id"):
                raise ValueError("Аппарат занят другим заказом. Подождите")
            order_id = f"order-{int(time.time())}-{secrets.token_hex(3)}"
            now = int(time.time())
            order = {
                "order_id": order_id,
                "payment_id": payment_id,
                "machine_id": MACHINE_ID,
                "status": "queued",
                "simulation": simulation,
                "product_released": False,
                "created_at": now,
                "updated_at": now,
                "order": payment.get("order", {}),
                "amount": payment.get("amount", 0),
                "inventory_committed": False,
                "recovery_status": None,
                "preorder_id": payment.get("preorder_id", ""),
            }
            db["dispense_orders"][order_id] = order
            machine["active_order_id"] = order_id
            machine["sales_mode"] = "busy"
            machine["last_telemetry_at"] = now
            db["gateway_audit"].append({
                "event": "dispense.command.accepted",
                "order_id": order_id,
                "payment_id": payment_id,
                "idempotency_key": f"dispense:{payment_id}",
                "created_at": now,
            })
            save_db(db)
        return Handler._dispense_payload(order)

    @staticmethod
    def _award_referral_points(db: dict, client_key: str, points: int, event: str, referral_id: str, order_id: str, now: int) -> str:
        idempotency_key = f"{event}:{referral_id}"
        existing = next(
            (item for item in db.get("loyalty_transactions", []) if item.get("idempotency_key") == idempotency_key),
            None,
        )
        if existing:
            return str(existing.get("transaction_id") or "")
        client = db.get("clients", {}).get(client_key)
        if not client:
            return ""
        before = int(client.get("bonus_balance", 0))
        transaction_id = f"ref-bonus-{now}-{secrets.token_hex(3)}"
        transaction = {
            "transaction_id": transaction_id,
            "idempotency_key": idempotency_key,
            "event": event,
            "referral_id": referral_id,
            "order_id": order_id,
            "client_key": client_key,
            "points": points,
            "balance_before": before,
            "balance_after": before + points,
            "status": "accrued",
            "created_at": now,
        }
        client["bonus_balance"] = before + points
        client["updated_at"] = now
        db.setdefault("loyalty_transactions", []).append(transaction)
        db.setdefault("gateway_audit", []).append({
            "event": event,
            "transaction_id": transaction_id,
            "referral_id": referral_id,
            "client_key": client_key,
            "points": points,
            "created_at": now,
        })
        return transaction_id

    @staticmethod
    def _activate_referral(db: dict, invitee_client_key: str, order_id: str, now: int) -> None:
        referral = db.get("referrals", {}).get(invitee_client_key)
        if not referral or referral.get("status") == "active":
            return
        referral_id = str(referral.get("referral_id") or "")
        referrer_key = str(referral.get("referrer_client_key") or "")
        if not referral_id or not referrer_key or referrer_key == invitee_client_key:
            return
        invitee_tx = Handler._award_referral_points(
            db, invitee_client_key, REFERRAL_INVITEE_BONUS, "referral.invitee.first_purchase", referral_id, order_id, now
        )
        inviter_tx = Handler._award_referral_points(
            db, referrer_key, REFERRAL_INVITER_BONUS, "referral.inviter.friend_activated", referral_id, order_id, now
        )
        if not invitee_tx or not inviter_tx:
            return
        referral.update({
            "status": "active",
            "activated_at": now,
            "activation_order_id": order_id,
            "invitee_transaction_id": invitee_tx,
            "inviter_transaction_id": inviter_tx,
        })
        active_count = sum(
            1 for item in db.get("referrals", {}).values()
            if str(item.get("referrer_client_key") or "") == referrer_key and item.get("status") == "active"
        )
        referrer = db.get("clients", {}).get(referrer_key, {})
        if active_count >= REFERRAL_MILESTONE_SIZE and not referrer.get("referral_milestone_awarded"):
            milestone_referral_id = f"milestone-{referrer_key}-{REFERRAL_MILESTONE_SIZE}"
            milestone_tx = Handler._award_referral_points(
                db, referrer_key, REFERRAL_MILESTONE_BONUS, "referral.inviter.milestone", milestone_referral_id, order_id, now
            )
            if milestone_tx:
                referrer["referral_milestone_awarded"] = True
                referrer["referral_milestone_transaction_id"] = milestone_tx
        db.setdefault("gateway_audit", []).append({
            "event": "referral.activated",
            "referral_id": referral_id,
            "referrer_client_key": referrer_key,
            "invitee_client_key": invitee_client_key,
            "order_id": order_id,
            "created_at": now,
        })

    @staticmethod
    def dispense_status(payload: dict) -> dict:
        order_id = str(payload.get("order_id") or "")
        with LOCK:
            db = load_db()
            order = db["dispense_orders"].get(order_id)
            if not order:
                raise ValueError("Заказ на выдачу не найден")
            now = int(time.time())
            elapsed = now - int(order.get("created_at", now))
            previous = order.get("status")
            if previous == "queued" and elapsed >= 1:
                order["status"] = "dispensing"
                order["updated_at"] = now
            if order.get("status") == "dispensing":
                simulation = order.get("simulation", "success")
                if simulation == "success" and elapsed >= 4:
                    order["status"] = "completed"
                    order["product_released"] = True
                elif simulation == "failure" and elapsed >= 3:
                    order["status"] = "failed"
                    order["error_code"] = "CONTROLLER_REJECTED"
                    order["error_message"] = "Аппарат не подтвердил запуск выдачи"
                elif simulation == "timeout" and elapsed >= 6:
                    order["status"] = "failed"
                    order["error_code"] = "CONTROLLER_TIMEOUT"
                    order["error_message"] = "Нет подтверждения от контроллера аппарата"
                if order.get("status") in {"completed", "failed"}:
                    order["updated_at"] = now
                    machine = db["machine"]
                    machine["active_order_id"] = None
                    machine["sales_mode"] = "ready"
                    machine["last_telemetry_at"] = now
                    if order.get("status") == "completed" and not order.get("inventory_committed"):
                        Handler._commit_inventory(db, order, now)
                    if order.get("status") == "completed":
                        Handler._finalize_completed_order(db, order, now)
                        preorder_id = str(order.get("preorder_id") or "")
                        if preorder_id and preorder_id in db.get("preorders", {}):
                            preorder = db["preorders"][preorder_id]
                            preorder["status"] = "redeemed"
                            preorder["redeemed_at"] = now
                    if order.get("status") == "failed":
                        Handler._create_incident(db, order, now)
                        if order.get("error_code") == "CONTROLLER_TIMEOUT":
                            machine["safety_lock"] = True
                            machine["sales_mode"] = "stopped"
                    db["gateway_audit"].append({
                        "event": f"dispense.{order['status']}",
                        "order_id": order_id,
                        "product_released": bool(order.get("product_released")),
                        "created_at": now,
                    })
            save_db(db)
        return Handler._dispense_payload(order)

    @staticmethod
    def _commit_inventory(db: dict, order: dict, now: int) -> None:
        composition = order.get("order") or {}
        for kind, item_id, catalog_name in (
            ("mix", composition.get("product_id"), "mix_catalog"),
            ("topping", composition.get("topping_id"), "topping_catalog"),
            ("additive", composition.get("additive_id"), "additive_catalog"),
        ):
            if not item_id or item_id == "none":
                continue
            item = db.get(catalog_name, {}).get(item_id)
            if not item:
                continue
            before = int(item.get("stock", 0))
            item["stock"] = max(0, before - 1)
            db["inventory_movements"].append({
                "event": "inventory.dispense_committed",
                "order_id": order.get("order_id"),
                "item_type": kind,
                "item_id": item_id,
                "quantity": -1,
                "stock_before": before,
                "stock_after": item["stock"],
                "created_at": now,
            })
        order["inventory_committed"] = True

    @staticmethod
    def _finalize_completed_order(db: dict, order: dict, now: int) -> None:
        """Создаёт чек и начисление один раз, только после подтверждённой выдачи."""
        payment = db.get("payments", {}).get(str(order.get("payment_id") or ""))
        if not payment or payment.get("status") != "succeeded" or not order.get("product_released"):
            return

        receipt_id = str(order.get("receipt_id") or "")
        receipt = db.get("receipts", {}).get(receipt_id) if receipt_id else None
        if not receipt:
            receipt_id = f"receipt-{now}-{secrets.token_hex(3)}"
            composition = payment.get("order") or {}
            product_id = str(composition.get("product_id") or "")
            topping_id = str(composition.get("topping_id") or "none")
            additive_id = str(composition.get("additive_id") or "none")
            product = db.get("mix_catalog", {}).get(product_id, {"name": product_id or "Мороженое", "price": 0})
            topping = db.get("topping_catalog", {}).get(topping_id, {"name": "Без топпинга", "price": 0})
            additive = db.get("additive_catalog", {}).get(additive_id, {"name": "Без добавки", "price": 0})
            subtotal = int(product.get("price", 0)) + int(topping.get("price", 0)) + int(additive.get("price", 0))
            paid_amount = int(payment.get("amount", 0))
            receipt = {
                "receipt_id": receipt_id,
                "receipt_number": f"ЧЕК-{now}-{secrets.token_hex(2).upper()}",
                "order_id": order.get("order_id"),
                "payment_id": payment.get("id"),
                "subtotal": subtotal,
                "discount": 0,
                "bonus_used": int(payment.get("bonus_used", 0)),
                "amount": paid_amount,
                "currency": payment.get("currency", "RUB"),
                "payment_method": payment.get("method"),
                "status": "formed",
                "fiscal_status": "demo_not_fiscalized",
                "phone": str(payment.get("phone") or ""),
                "items": [
                    {"name": product.get("name"), "price": int(product.get("price", 0))},
                    {"name": topping.get("name", "Без топпинга"), "price": int(topping.get("price", 0))},
                    {"name": additive.get("name", "Без добавки"), "price": int(additive.get("price", 0))},
                ],
                "created_at": now,
            }
            db.setdefault("receipts", {})[receipt_id] = receipt
            order["receipt_id"] = receipt_id
            db["gateway_audit"].append({
                "event": "receipt.formed",
                "receipt_id": receipt_id,
                "order_id": order.get("order_id"),
                "payment_id": payment.get("id"),
                "created_at": now,
            })

        referral_client_key = str(payment.get("client_key") or payment.get("phone") or "")
        if referral_client_key:
            Handler._activate_referral(db, referral_client_key, str(order.get("order_id") or ""), now)

        if not payment.get("loyalty_eligible", True):
            return
        phone = str(payment.get("phone") or "")
        client = db.get("clients", {}).get(phone) if phone else None
        if not client or not client.get("phone_verified") or order.get("loyalty_transaction_id"):
            return
        rate = int(client.get("accrual_rate_percent", client.get("discount_percent", LOYALTY_RATE_PERCENT)))
        points = int(int(payment.get("amount", 0)) * rate / 100)
        if points <= 0:
            return
        before = int(client.get("bonus_balance", 0))
        transaction_id = f"bonus-{now}-{secrets.token_hex(3)}"
        transaction = {
            "transaction_id": transaction_id,
            "event": "loyalty.purchase.accrued",
            "order_id": order.get("order_id"),
            "payment_id": payment.get("id"),
            "phone": phone,
            "rate_percent": rate,
            "points": points,
            "balance_before": before,
            "balance_after": before + points,
            "status": "demo",
            "created_at": now,
        }
        client["bonus_balance"] = before + points
        client["updated_at"] = now
        db.setdefault("loyalty_transactions", []).append(transaction)
        order["loyalty_transaction_id"] = transaction_id
        db["gateway_audit"].append({
            "event": "loyalty.purchase.accrued",
            "transaction_id": transaction_id,
            "order_id": order.get("order_id"),
            "points": points,
            "created_at": now,
        })

    @staticmethod
    def _create_incident(db: dict, order: dict, now: int) -> dict:
        existing = next(
            (item for item in db["service_incidents"].values() if item.get("order_id") == order.get("order_id")),
            None,
        )
        if existing:
            return existing
        incident_id = f"incident-{now}-{secrets.token_hex(3)}"
        incident = {
            "incident_id": incident_id,
            "order_id": order.get("order_id"),
            "payment_id": order.get("payment_id"),
            "machine_id": order.get("machine_id", MACHINE_ID),
            "status": "open",
            "severity": "critical" if order.get("error_code") == "CONTROLLER_TIMEOUT" else "high",
            "error_code": order.get("error_code"),
            "error_message": order.get("error_message"),
            "product_released": bool(order.get("product_released")),
            "created_at": now,
        }
        db["service_incidents"][incident_id] = incident
        order["incident_id"] = incident_id
        order["recovery_status"] = "refund_available"
        db["gateway_audit"].append({
            "event": "service.incident.created",
            "incident_id": incident_id,
            "order_id": order.get("order_id"),
            "correlation_id": order.get("payment_id"),
            "created_at": now,
        })
        return incident

    @staticmethod
    def refund_failed_order(payload: dict) -> dict:
        order_id = str(payload.get("order_id") or "")
        with LOCK:
            db = load_db()
            order = db["dispense_orders"].get(order_id)
            if not order:
                raise ValueError("Заказ на выдачу не найден")
            if order.get("status") != "failed" or order.get("product_released"):
                raise ValueError("Возврат доступен только для неподтверждённой выдачи")
            payment_id = str(order.get("payment_id") or "")
            existing = next(
                (item for item in db["refunds"].values() if item.get("payment_id") == payment_id),
                None,
            )
            if existing:
                return Handler._refund_payload(existing, order)
            payment = db["payments"].get(payment_id)
            if not payment or payment.get("status") not in {"succeeded", "refunded"}:
                raise ValueError("Подтверждённый платёж не найден")
            now = int(time.time())
            refund_id = f"refund-{now}-{secrets.token_hex(3)}"
            refund = {
                "refund_id": refund_id,
                "payment_id": payment_id,
                "order_id": order_id,
                "amount": int(payment.get("amount", 0)),
                "currency": payment.get("currency", "RUB"),
                "status": "succeeded",
                "provider": "yookassa_demo" if int(payment.get("amount", 0)) else "loyalty_demo",
                "idempotency_key": f"refund:{payment_id}",
                "created_at": now,
            }
            db["refunds"][refund_id] = refund
            payment["status"] = "refunded"
            payment["refunded_at"] = now
            order["recovery_status"] = "refunded"
            bonus_used = int(payment.get("bonus_used", 0))
            if bonus_used and not payment.get("bonus_restored_transaction_id"):
                phone = str(payment.get("phone") or "")
                client = db.get("clients", {}).get(phone)
                if client:
                    before = int(client.get("bonus_balance", 0))
                    restore_id = f"bonus-restore-{now}-{secrets.token_hex(3)}"
                    restore = {
                        "transaction_id": restore_id,
                        "event": "loyalty.bonus.restored",
                        "order_id": order_id,
                        "payment_id": payment_id,
                        "phone": phone,
                        "points": bonus_used,
                        "balance_before": before,
                        "balance_after": before + bonus_used,
                        "status": "completed",
                        "created_at": now,
                    }
                    client["bonus_balance"] = before + bonus_used
                    client["updated_at"] = now
                    db.setdefault("loyalty_transactions", []).append(restore)
                    payment["bonus_restored_transaction_id"] = restore_id
            incident = db["service_incidents"].get(order.get("incident_id"))
            if incident:
                incident["status"] = "refund_completed"
                incident["refund_id"] = refund_id
                incident["updated_at"] = now
            db["gateway_audit"].append({
                "event": "payment.refund.succeeded",
                "refund_id": refund_id,
                "payment_id": payment_id,
                "order_id": order_id,
                "idempotency_key": refund["idempotency_key"],
                "created_at": now,
            })
            save_db(db)
        return Handler._refund_payload(refund, order)

    @staticmethod
    def _refund_payload(refund: dict, order: dict) -> dict:
        return {
            "refund_id": refund.get("refund_id"),
            "payment_id": refund.get("payment_id"),
            "order_id": refund.get("order_id"),
            "status": refund.get("status"),
            "amount": refund.get("amount", 0),
            "message": "Возврат оформлен. В тестовом режиме деньги не списывались.",
            "incident_id": order.get("incident_id"),
        }

    @staticmethod
    def operations() -> dict:
        with LOCK:
            db = load_db()
            return {
                "machine": dict(db["machine"]),
                "incidents": list(db["service_incidents"].values())[-20:],
                "refunds": list(db["refunds"].values())[-20:],
                "receipts": list(db["receipts"].values())[-20:],
                "loyalty_transactions": list(db["loyalty_transactions"])[-30:],
                "inventory_movements": list(db["inventory_movements"])[-30:],
                "gateway_audit": list(db["gateway_audit"])[-50:],
                "preorders": list(db.get("preorders", {}).values())[-30:],
                "preorder_attempts": list(db.get("preorder_attempts", []))[-30:],
            }

    @staticmethod
    def _dispense_payload(order: dict) -> dict:
        with LOCK:
            db = load_db()
        receipt = db.get("receipts", {}).get(str(order.get("receipt_id") or ""), {})
        loyalty = next(
            (item for item in reversed(db.get("loyalty_transactions", []))
             if item.get("transaction_id") == order.get("loyalty_transaction_id")),
            {},
        )
        payment = db.get("payments", {}).get(str(order.get("payment_id") or ""), {})
        redemption = next(
            (item for item in reversed(db.get("loyalty_transactions", []))
             if item.get("transaction_id") == payment.get("bonus_redemption_transaction_id")),
            {},
        )
        return {
            "order_id": order.get("order_id"),
            "payment_id": order.get("payment_id"),
            "status": order.get("status"),
            "product_released": bool(order.get("product_released")),
            "error_code": order.get("error_code"),
            "error_message": order.get("error_message"),
            "incident_id": order.get("incident_id"),
            "recovery_status": order.get("recovery_status"),
            "inventory_committed": bool(order.get("inventory_committed")),
            "receipt": receipt,
            "loyalty": loyalty,
            "redemption": redemption,
        }


def telegram_api(method: str, payload: dict | None = None, timeout: int = 35) -> dict:
    if not TELEGRAM_BOT_TOKEN:
        raise ValueError("Токен Telegram не настроен")
    body = json.dumps(payload or {}).encode("utf-8")
    request = Request(
        f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/{method}",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            result = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError) as error:
        raise RuntimeError(f"Telegram API недоступен: {error}") from error
    if not result.get("ok"):
        raise RuntimeError(str(result.get("description") or "Telegram API вернул ошибку"))
    return result.get("result")


LEGACY_TELEGRAM_BUTTONS = {
    "Акции дня",
    "Завтраки",
    "Торты",
    "Десерты",
}


def telegram_start_message(chat_id: int) -> None:
    separator = "&" if "?" in TELEGRAM_WEBAPP_URL else "?"
    good_deeds_url = f"{TELEGRAM_WEBAPP_URL}{separator}section=good-deeds"
    keyboard = {"inline_keyboard": [
        [{"text": "Вступить в Клуб Тимоши", "web_app": {"url": TELEGRAM_WEBAPP_URL}}],
        [{"text": "❤️ Кнопка добра", "web_app": {"url": good_deeds_url}}],
    ]}
    telegram_api("sendMessage", {
        "chat_id": chat_id,
        "text": (
            "Добро пожаловать в Клуб Тимоши!\n\n"
            "Выберите любимое мороженое, оформите предзаказ, "
            "получайте бонусы и приглашайте друзей.\n\n"
            "Счастье в одном стаканчике!"
        ),
        "reply_markup": keyboard,
    })


def telegram_configure_bot() -> None:
    telegram_api("deleteWebhook", {"drop_pending_updates": False})
    telegram_api("deleteMyCommands")
    telegram_api("deleteMyCommands", {"language_code": "ru"})
    telegram_api("deleteMyCommands", {"language_code": "en"})
    telegram_api("setMyName", {"name": "У Тимоши"})
    telegram_api("setMyShortDescription", {
        "short_description": "Мягкое мороженое, предзаказ и Клуб Тимоши.",
    })
    telegram_api("setMyDescription", {
        "description": "Официальный бот «У Тимоши». Откройте Mini App, выберите мороженое и оформите предзаказ.",
    })
    telegram_api("setChatMenuButton", {
        "menu_button": {
            "type": "web_app",
            "text": "Заказать мороженое",
            "web_app": {"url": TELEGRAM_WEBAPP_URL},
        },
    })


def run_telegram_bot(stop_event: threading.Event) -> None:
    offset = 0
    try:
        me = telegram_api("getMe")
        actual_username = str(me.get("username") or "").lower()
        if TELEGRAM_EXPECTED_USERNAME and actual_username != TELEGRAM_EXPECTED_USERNAME:
            raise RuntimeError(
                f"Токен принадлежит боту @{actual_username or 'без_имени'}, "
                f"ожидался @{TELEGRAM_EXPECTED_USERNAME}"
            )
        telegram_configure_bot()
        print(f"[Telegram] Бот @{me.get('username', '')} очищен от старого меню и настроен для «У Тимоши».")
    except Exception as error:
        print("[Telegram] Не удалось запустить бота:", error)
        return
    while not stop_event.is_set():
        try:
            updates = telegram_api("getUpdates", {"offset": offset, "timeout": 25, "allowed_updates": ["message"]}, timeout=32)
            for update in updates:
                offset = max(offset, int(update.get("update_id", 0)) + 1)
                message = update.get("message") or {}
                text = str(message.get("text") or "")
                chat_id = (message.get("chat") or {}).get("id")
                is_start = text.startswith("/start") or text.startswith("/menu")
                is_legacy_button = text.strip() in LEGACY_TELEGRAM_BUTTONS
                if chat_id and (is_start or is_legacy_button):
                    telegram_start_message(int(chat_id))
        except Exception as error:
            print("[Telegram] Ошибка получения сообщений:", error)
            stop_event.wait(3)


if __name__ == "__main__":
    mimetypes.add_type("application/javascript", ".js")
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    url = f"http://{HOST}:{PORT}/"
    print(f"Soft_ICE v0.35.1 запущен: {url}")
    bot_stop = threading.Event()
    if TELEGRAM_BOT_TOKEN and TELEGRAM_WEBAPP_URL.startswith("https://"):
        threading.Thread(target=run_telegram_bot, args=(bot_stop,), daemon=True).start()
    elif TELEGRAM_BOT_TOKEN:
        print("[Telegram] Укажите публичный HTTPS-адрес в TELEGRAM_WEBAPP_URL. Запущен локальный режим.")
    elif DEMO_MODE:
        print("[Telegram] Токен не задан. Запущен безопасный демонстрационный режим.")
    else:
        print("[Telegram] Токен не задан. Telegram-авторизация отключена.")
    if MAX_BOT_TOKEN:
        print("[MAX] Токен загружен из окружения. Серверная авторизация MAX включена.")
    else:
        print("[MAX] Токен не задан. MAX-авторизация пока отключена.")
    threading.Timer(0.7, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        bot_stop.set()
        server.server_close()
