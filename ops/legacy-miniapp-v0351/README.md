# Mini App v0.35.1 production bridge

Current production host: `miniapp.utimoshi.ru`.

Nginx proxies to `127.0.0.1:8780`, served by systemd unit `soft-ice-miniapp.service`.

Runtime release directory:

`/home/julcapp/soft-ice-platform/releases/v0.35.1/work_v0.35.1`

The files in this directory are source-control snapshots of the production bridge modified for the shared PostgreSQL preorder/pickup flow:

- `shared_preorder_proxy.py` — allowlisted proxy from the legacy Mini App to `/api/v1/miniapp-test-preorders`.
- `preorder-test.js` — test preorder UI; after SUCCEEDED it keeps the order for 48 hours and issues a 5-minute pickup code only when the buyer presses “Я у аппарата — получить код”.

The authoritative order/payment/pickup state is held by the backend/PostgreSQL contour. Do not reintroduce local demo pickup codes for this shared flow.
