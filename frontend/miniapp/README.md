# Soft ICE Mini App

Первый React-модуль Soft ICE Platform для `app.utimoshi.ru`.

## Назначение

Mini App используется как единый frontend-шлюз для:

- Telegram Mini App;
- MAX Mini App;
- Web App;
- будущих клиентских сценариев бренда «У Тимоши».

## Первый экран

MVP-экран содержит:

- AppHeader;
- WelcomeBlock;
- ActionCard: Купить мороженое;
- ActionCard: Клуб Тимоши;
- ActionCard: Бонусы;
- ActionCard: Где купить;
- BottomNavigation;
- Cookie / Consent panel.

## Установка

```bash
cd frontend/miniapp
npm install
npm run dev
```

## Сборка

```bash
npm run build
```

Результат сборки будет в папке:

```text
dist/
```

## Preview

```bash
npm run preview
```

## Production target

Планируемый домен:

```text
https://app.utimoshi.ru
```

## Privacy / Analytics

На первом этапе события логируются локально в консоль браузера.

После появления backend события будут отправляться через Analytics API.

Связанные документы:

- `docs/privacy/COOKIE_AND_TRACKING_POLICY.md`
- `docs/domain/ANALYTICS_EVENTS.md`
- `docs/domain/CONSENT_MODEL.md`
