# Mini App v0.35.1 production bridge

Production: `miniapp.utimoshi.ru` → nginx → `127.0.0.1:8780` → `soft-ice-miniapp.service`.

Runtime directory:
`/home/julcapp/soft-ice-platform/releases/v0.35.1/work_v0.35.1`

Tracked snapshots:
- `server.py` — Mini App HTTP service and public-route whitelist.
- `shared_preorder_proxy.py` — allowlisted proxy to backend `/api/v1/miniapp-test-preorders`.
- `preorder-test.js` — shared PostgreSQL preorder/pickup UI.
- `preorder-return.html` — YooKassa browser return page; it never requires Telegram initData.

Preorder behavior:
- paid order is valid for 48 hours;
- ingredients are not reserved for 48 hours;
- when the buyer is at the machine, Mini App issues a one-time pickup code valid for 5 minutes;
- the same credential can be shown as a QR code;
- order recovery uses backend `orders/recent` plus localStorage, so leaving Telegram for YooKassa does not lose the paid order.

The authoritative state is PostgreSQL/backend. Do not reintroduce local demo pickup codes.
