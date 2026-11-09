# JARVIS OMEGA — Command Center

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

## API
- `GET /api/state` пълно състояние (агенти, задачи, събития, пазари, новини)
- `GET /api/markets`, `GET /api/news`, `GET /api/health`
- `POST /api/tasks` `{title, agentId, description}`
- `POST /api/tasks/:id/{approve|pause|resume|stop}`, `DELETE /api/tasks/:id`
- `POST /api/demo` `{on:true|false}` DEMO симулация (по подразбиране изключена), `POST /api/demo/news`
- `GET /api/events` Server-Sent Events (`state`, `event`, `ping`)

## Реални данни (без ключ, без регистрация)
- Yahoo Finance chart API, на всеки 60 с: GC=F (XAUUSD*, злато фючърс), EURUSD=X, GBPUSD=X, JPY=X, CHF=X, AUDUSD=X, CAD=X, ^NDX (NAS100), ^DJI (US30), ES=F, CL=F
- Binance public ticker + klines, на всеки 15 с: BTCUSDT, ETHUSDT (резервен: CoinGecko simple/price)
- RSS, на всеки 3 мин: CNBC Top News, CNBC Economy, FXStreet, Investing.com, MarketWatch.
  „Важно/извънредно“ = правила с ключови думи; известие (SSE + Notification API) само за нови такива.

Задачите са записи в опашката на таблото (`data/state.json`). Не се изпращат автоматично към ботовете.
Скрийншоти: `node shoot.mjs` -> `shots/`.
