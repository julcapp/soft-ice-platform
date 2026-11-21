# Развёртывание Equipment Integration Sandbox

Статус: Sandbox only
Дата: 2026-08-16

## Цель

Развернуть изолированный стенд интеграции оборудования Soft ICE рядом с рабочей платформой без переключения production-релиза и без публикации внутренних API.

## Изоляция

- рабочая копия стенда: `/home/julcapp/soft-ice-platform/equipment-sandbox`;
- backend слушает только `127.0.0.1:8791`;
- Mini App на 8780 не затрагивается;
- Nginx публикует только `/equipment/v1/`;
- `/api/v1/admin/equipment` используется только локально для smoke-test и не должен проксироваться наружу;
- реальный `EQUIPMENT_INTEGRATION_API_KEY` хранится только в `/etc/soft-ice/equipment-sandbox.env` с правами 600.

## 1. Получить отдельную копию ветки

```bash
cd /home/julcapp/soft-ice-platform

if [ ! -d equipment-sandbox/.git ]; then
  git clone --branch feature/equipment-integration-sandbox-v1 --single-branch \
    https://github.com/julcapp/soft-ice-platform.git equipment-sandbox
else
  cd equipment-sandbox
  git fetch origin feature/equipment-integration-sandbox-v1
  git checkout feature/equipment-integration-sandbox-v1
  git pull --ff-only origin feature/equipment-integration-sandbox-v1
  cd ..
fi
```

## 2. Установить зависимости и выполнить backend-тесты

```bash
cd /home/julcapp/soft-ice-platform/equipment-sandbox/backend
npm ci
npm test
```

Продолжать развёртывание только после успешного завершения тестов.

## 3. Проверить Admin Console

```bash
cd /home/julcapp/soft-ice-platform/equipment-sandbox/frontend/admin-console
npm ci
npm test
npm run build
```

`dist/` не коммитить.

## 4. Создать секрет стенда

```bash
sudo install -d -m 750 -o root -g julcapp /etc/soft-ice
SECRET=$(openssl rand -hex 32)
echo "$SECRET"
```

Сохранить значение в менеджере секретов/защищённой записи. Затем:

```bash
sudo cp /home/julcapp/soft-ice-platform/equipment-sandbox/infrastructure/systemd/equipment-sandbox.env.example \
  /etc/soft-ice/equipment-sandbox.env
sudo nano /etc/soft-ice/equipment-sandbox.env
```

Заменить:

```text
EQUIPMENT_INTEGRATION_API_KEY=REPLACE_WITH_64_CHAR_RANDOM_SECRET
```

на сгенерированное значение. После этого:

```bash
sudo chown root:julcapp /etc/soft-ice/equipment-sandbox.env
sudo chmod 600 /etc/soft-ice/equipment-sandbox.env
```

## 5. Установить systemd unit

```bash
sudo cp /home/julcapp/soft-ice-platform/equipment-sandbox/infrastructure/systemd/soft-ice-equipment-sandbox.service \
  /etc/systemd/system/soft-ice-equipment-sandbox.service
sudo systemctl daemon-reload
sudo systemctl enable --now soft-ice-equipment-sandbox.service
sudo systemctl status soft-ice-equipment-sandbox.service --no-pager
```

Проверить порт:

```bash
ss -ltnp | grep 8791
```

Ожидается только `127.0.0.1:8791`, не `0.0.0.0:8791`.

## 6. Локальная проверка health

```bash
curl -sS http://127.0.0.1:8791/equipment/v1/health
```

Ожидается `status: online`, `mode: SANDBOX`.

## 7. Полный smoke-test

```bash
set -a
source /etc/soft-ice/equipment-sandbox.env
set +a
cd /home/julcapp/soft-ice-platform/equipment-sandbox/backend
bash scripts/equipment-sandbox-smoke.sh
```

Сценарий проверяет последовательно:

`health → heartbeat → telemetry → DISPENSE → poll → ACK → SUCCESS → dashboard snapshot`.

## 8. Nginx

Не изменять существующий Mini App location. В TLS server block отдельного sandbox-host включить содержимое:

```text
infrastructure/nginx/equipment-sandbox.location.conf
```

Перед reload:

```bash
sudo nginx -t
```

Только после `syntax is ok` / `test is successful`:

```bash
sudo systemctl reload nginx
```

Рекомендуемый внешний адрес:

```text
https://equipment-sandbox.<ваш-домен>/equipment/v1/health
```

Не публиковать `/api/`, `/api/v1/`, backend root или порт 8791 напрямую.

## 9. Проверка внешней границы

С внешнего компьютера:

```bash
curl -i https://equipment-sandbox.<ваш-домен>/equipment/v1/health
curl -i https://equipment-sandbox.<ваш-домен>/api/v1/admin/equipment/machines/TEST-MACHINE-001
```

Первый запрос должен возвращать 200. Второй не должен попадать в backend sandbox (ожидается 404/deny со стороны Nginx).

Проверить аутентификацию:

```bash
curl -i https://equipment-sandbox.<ваш-домен>/equipment/v1/machines/TEST-MACHINE-001/commands
```

Без `X-API-Key` ожидается 401.

## 10. Передача поставщику

Передавать только:

- base URL `/equipment/v1`;
- `machine_id = TEST-MACHINE-001`;
- отдельный sandbox API key;
- OpenAPI `docs/api/openapi/equipment-integration-v1.yaml`;
- сценарии испытаний.

Не передавать SSH, GitHub, DATABASE_URL, Telegram token, CRM/admin credentials или доступ к `/api/v1`.

## Откат

```bash
sudo systemctl disable --now soft-ice-equipment-sandbox.service
sudo rm -f /etc/systemd/system/soft-ice-equipment-sandbox.service
sudo systemctl daemon-reload
```

Удалить/отключить только sandbox Nginx server/location и выполнить `nginx -t` перед reload. Рабочий релиз Mini App не затрагивается.
