import json
import re
from urllib.error import HTTPError
from urllib.request import Request, urlopen


def request_preorder(path, payload):
    if not re.fullmatch(r"(?:catalog|quote|orders|club/topup|club/topup/[0-9a-f-]{36}/status|orders/recent|orders/[0-9a-f-]{36}/(?:payment|status|pickup-code|gift))", path):
        raise ValueError("Действие с заказом не поддерживается")
    fields = {"init_data", "productId", "toppingId", "sprinkleId", "quoteId", "idempotencyKey", "accountFilter", "accountPage", "recipientPhone"}
    body = json.dumps({k: v for k, v in payload.items() if k in fields}).encode()
    request = Request("http://127.0.0.1:8800/api/v1/miniapp-test-preorders/" + path,
                      data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urlopen(request, timeout=25) as response:
            return json.loads(response.read(1024 * 1024))
    except HTTPError as error:
        try:
            message = json.loads(error.read(16384)).get("error", {}).get("message")
        except (ValueError, AttributeError):
            message = None
        raise ValueError(message or "Не удалось выполнить операцию с заказом") from None
