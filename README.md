# JARVIS OMEGA — Command Center

Командно табло за задачи, агенти, пазарни котировки и новини. Промените достигат до браузъра през Server-Sent Events. Одобрена задача може да се изпрати към бот чрез настроен webhook.

[Изтегли проекта като ZIP](https://github.com/georg-cpu/jarvis-command-center/archive/refs/heads/main.zip) · [Виж изходния код](https://github.com/georg-cpu/jarvis-command-center/tree/main)

## ☕ Почерпи ме с кафе

Доброволна подкрепа с **native SOL** в мрежата **Solana mainnet**. Копирай публичния адрес в своя портфейл.

`CYmGyR3E2rEheJiG48t9LNPjCU9dxGG6sBeUh9mJB9Fy`

[Виж адреса в Solana Explorer](https://explorer.solana.com/address/CYmGyR3E2rEheJiG48t9LNPjCU9dxGG6sBeUh9mJB9Fy)

Vite + React + TypeScript + Three.js (@react-three/fiber) + Framer Motion, малък Express бекенд със SSE.

## Пускане
```bash
npm install
npm run build          # frontend -> dist/
PORT=8787 node server.js   # сервира dist/ + API
# публичен адрес (на машина, която позволява изходящ порт 7844):
cloudflared tunnel --url http://localhost:8787
```
Разработка: `node server.js` + `npx vite` (proxy /api -> 8787).

## Render (безплатен план)
- Build: `npm ci --include=dev && npm run build`
- Start: `node server.js` (слуша на `process.env.PORT`, 0.0.0.0)
- Състоянието (`data/state.json`) се създава при старт; на безплатния план дискът е временен и опашката се нулира при рестарт.

## Достъп и изпращане към ботовете
Всички записи (POST/PATCH/DELETE под /api) изискват `X-Jarvis-Key: <JARVIS_ADMIN_KEY>`. Четенето е публично.

Env променливи на Render:
- `JARVIS_ADMIN_KEY` ключ за запис (задължителен, иначе записът е изключен)
- `JARVIS_WEBHOOK_URL` webhook на рутината на JARVIS OMEGA (празно = изпращането не е настроено)
- `JARVIS_WEBHOOK_KEY` ключ за webhook-а; праща се като `Authorization: Bearer <key>` и `X-Webhook-Key: <key>`

Поток: pending -> approved -> (webhook) dispatched -> running -> done | blocked (+ paused / stopped).
При одобрение сървърът POST-ва `{id, agent, agentName, title, description, status, approvedAt}` към webhook-а (3 опита: 1 с, 3 с).

## API
- `PATCH /api/tasks/:id/status` `{status, note, result, botName}` статус от бота (pending|approved|dispatched|running|done|blocked|paused|stopped)
- `POST /api/tasks/:id/redispatch` изпраща отново
- `GET /api/export`, `POST /api/import` `{tasks:[...]}` резервно копие / възстановяване (запазва id и статус; съществуващи id се пропускат)
- `GET /api/state` пълно състояние (агенти, задачи, събития, пазари, новини)
- `GET /api/markets`, `GET /api/news`, `GET /api/health`
- `POST /api/tasks` `{title, agentId, description, status?: 'approved'}`
- `POST /api/tasks/:id/{approve|pause|resume|stop}`, `DELETE /api/tasks/:id`
- `POST /api/demo` `{on:true|false}` DEMO симулация (по подразбиране изключена), `POST /api/demo/news`
- `GET /api/events` Server-Sent Events (`state`, `event`, `ping`)

## Реални данни (без ключ, без регистрация)
- Yahoo Finance chart API, на всеки 60 с: GC=F (XAUUSD*, злато фючърс), EURUSD=X, GBPUSD=X, JPY=X, CHF=X, AUDUSD=X, CAD=X, ^NDX (NAS100), ^DJI (US30), ES=F, CL=F
- Крипто на всеки 20 с: Binance public ticker + klines; ако е блокиран (напр. HTTP 418 от IP на Render) -> Yahoo Finance BTC-USD/ETH-USD -> CoinGecko
- RSS, на всеки 3 мин: CNBC Top News, CNBC Economy, FXStreet, Investing.com (общи, Forex, Commodities), MarketWatch.
  „Важно/извънредно“ = правила с ключови думи; известие (SSE + Notification API) само за нови такива.

Задачите са записи в опашката на таблото (`data/state.json`). Одобрението задейства изпращане само при настроен webhook.

Безплатният диск на Render е временен: задачите се пазят в частното репо jarvis-data, когато е зададен GITHUB_TOKEN (виж по-долу). Ръчно възстановяване: `POST /api/import` от `GET /api/export`.

## Persistent task storage (GitHub, optional, free)
If `GITHUB_TOKEN` is set, the server loads tasks on startup from a file in a **private** repo via the GitHub Contents API and saves back after every change (debounced ~3 s, uses the file `sha`, refetches the sha and retries on 409/422 conflicts).

| Env var | Default | Notes |
|---|---|---|
| `GITHUB_TOKEN` | — | Fine-grained token, only repo `jarvis-data`, *Contents: Read and write*. Never logged. |
| `GITHUB_DATA_REPO` | `georg-cpu/jarvis-data` | `owner/repo` |
| `GITHUB_DATA_PATH` | `tasks.json` | file path in the repo |
| `GITHUB_DATA_BRANCH` | repo default | optional |

Without a token or on GitHub errors the app falls back to the local JSON file (lost on Render restarts). `/api/state` → `storage: {mode: 'github'|'local', lastLoadOk, lastSaveOk, lastSaveAt, lastError, ...}`; the header shows `Хранилище: GitHub ✓` or `Хранилище: локално (губи се при рестарт)`. If the initial load fails, the server never overwrites the remote file and retries loading every 60 s.

## Файлове в проекта

| Файл | Предназначение |
|---|---|
| [.gitignore](./.gitignore) | Изключения за локални файлове |
| [README.md](./README.md) | Описание, стартиране и навигация |
| [feeds.js](./feeds.js) | Пазарни котировки и новинарски потоци |
| [index.html](./index.html) | Входна HTML страница |
| [package-lock.json](./package-lock.json) | Фиксирани версии на зависимостите |
| [package.json](./package.json) | Команди и зависимости |
| [server.js](./server.js) | HTTP API, опашка със задачи и SSE |
| [src/App.tsx](./src/App.tsx) | Основен интерфейс и контроли |
| [src/Globe.tsx](./src/Globe.tsx) | Триизмерен глобус |
| [src/Workflow3D.tsx](./src/Workflow3D.tsx) | Триизмерен изглед на работния процес |
| [src/api.ts](./src/api.ts) | Клиент за API на таблото |
| [src/assets.ts](./src/assets.ts) | Ресурси за интерфейса |
| [src/main.tsx](./src/main.tsx) | Стартиране на React |
| [src/styles.css](./src/styles.css) | Стилове на таблото |
| [src/voice.ts](./src/voice.ts) | Гласови функции |
| [storage.js](./storage.js) | Съхранение и възстановяване на задачи |
| [tsconfig.json](./tsconfig.json) | Настройки на TypeScript |
| [vite.config.ts](./vite.config.ts) | Конфигурация на Vite |

## Други публични проекти на JARVIS

- [jarvis-solana-scanner](https://github.com/georg-cpu/jarvis-solana-scanner)
- [jarvis-solana-intelligence](https://github.com/georg-cpu/jarvis-solana-intelligence)
- [jarvis-solana-intelligence1](https://github.com/georg-cpu/jarvis-solana-intelligence1)
