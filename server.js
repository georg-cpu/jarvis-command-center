// JARVIS OMEGA Command Center — tiny backend (Express + SSE + JSON file store)
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { cache, pollYahoo, pollCrypto, pollNews, MARKET_ORDER } from './feeds.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8787;
const DATA = process.env.STATE_FILE || path.join(__dirname, 'data', 'state.json');

const AGENTS = [
  { id: '01', name: 'MARKET WATCH', bg: 'Пазарен наблюдател', color: '#22e4ff', role: 'Следи XAUUSD, NAS100, US30, BTCUSD, ETHUSD и извънредни новини.' },
  { id: '02', name: 'CHART ANALYST', bg: 'Анализатор на графики', color: '#ff8a1f', role: 'Технически анализ, нива, сценарии.' },
  { id: '03', name: 'CONTENT STRATEGIST', bg: 'Контент стратег', color: '#b44dff', role: 'Идеи, сценарии и контент план за брандовете.' },
  { id: '04', name: 'VIDEO CREATOR', bg: 'Видео създател', color: '#3d7bff', role: 'Генериране, монтаж, субтитри и финален експорт на видео.' },
  { id: '05', name: 'SOCIAL PUBLISHER', bg: 'Публикуване', color: '#20e08a', role: 'Опашка за публикуване, график и метрики (само след одобрение).' },
  { id: '06', name: 'DIRECTOR CONTROL', bg: 'Директорски контрол', color: '#ffc83d', role: 'Координира агентите, одобрения и приоритети.' },
  { id: '07', name: 'AFTER DARK STUDIO', bg: 'Студио LENA AFTER DARK', color: '#ff3fd2', role: 'Креативно студио за проекта LENA AFTER DARK.' },
];

const STAGES = ['Анализ', 'Стратегия', 'Сценарий', 'Видео', 'Одобрение', 'Публикуване'];

const SYSTEM = {
  connected: ['Google Drive', 'Notion', 'Gamma', 'GitHub', 'Origin'],
  partial: [{ name: 'X', note: 'само четене и чернови' }],
  needsSignIn: ['Runway', 'Finance'],
  notConnected: ['Instagram', 'TikTok', 'YouTube', 'Facebook', 'Gmail', 'Google Calendar', ],
  autoPublishing: false,
  agentsCreated: 7,
  dispatch: 'ръчно — задачите от таблото не се изпращат автоматично към ботовете',
};

function fresh() {
  return { tasks: [], events: [], demoMode: false, seq: 1 };
}
let db;
try { db = JSON.parse(fs.readFileSync(DATA, 'utf8')); } catch { db = fresh(); }
db.demoMode = false; // never resume demo automatically after restart
db.tasks = db.tasks.filter(t => !t.demo);
db.events = db.events.filter(e => !e.demo);
function save() { fs.mkdirSync(path.dirname(DATA), { recursive: true }); fs.writeFileSync(DATA, JSON.stringify(db, null, 1)); }
save();

const clients = new Set();
function snapshot() {
  return {
    agents: AGENTS.map(a => ({ ...a, created: true, realStatus: 'ГОТОВ / БЕЗ ЗАДАЧА' })),
    markets: marketsView(),
    news: newsView(),
    stages: STAGES,
    system: SYSTEM,
    tasks: db.tasks,
    events: db.events.slice(-80),
    demoMode: db.demoMode,
    serverTime: new Date().toISOString(),
    startedAt,
  };
}
const startedAt = new Date().toISOString();
function broadcast(type, payload) {
  const msg = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of clients) res.write(msg);
}
function emit(ev) {
  const e = { id: db.seq++, ts: new Date().toISOString(), demo: false, ...ev };
  db.events.push(e);
  if (db.events.length > 300) db.events = db.events.slice(-300);
  save();
  broadcast('event', e);
  broadcast('state', snapshot());
  return e;
}
function newTask({ title, description = '', agentId = '06', demo = false, stage = 0, needsApproval = false }) {
  const t = {
    id: 'T' + (db.seq++), title: String(title).slice(0, 140), description: String(description).slice(0, 1000),
    agentId, demo, stage, needsApproval, status: demo ? 'running' : 'queued', progress: 0,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    log: [], outputs: [],
  };
  if (!demo) t.log.push({ ts: t.createdAt, msg: 'Записана в опашката на таблото. Още не се изпраща автоматично към бота (ръчно управление).' });
  db.tasks.push(t);
  return t;
}
function setStatus(t, status, msg) {
  t.status = status; t.updatedAt = new Date().toISOString();
  t.log.push({ ts: t.updatedAt, msg });
}

const app = express();
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, uptimeSec: Math.round(process.uptime()), serverTime: new Date().toISOString() }));
app.get('/api/state', (_req, res) => res.json(snapshot()));
app.get('/api/markets', (_req, res) => res.json(marketsView()));
app.get('/api/news', (_req, res) => res.json(newsView()));

app.post('/api/tasks', (req, res) => {
  const { title, description, agentId } = req.body || {};
  if (!title || !String(title).trim()) return res.status(400).json({ error: 'Липсва заглавие' });
  if (agentId && !AGENTS.find(a => a.id === agentId)) return res.status(400).json({ error: 'Непознат агент' });
  const t = newTask({ title: String(title).trim(), description, agentId: agentId || '06' });
  save();
  emit({ type: 'task_created', taskId: t.id, agentId: t.agentId, msg: `Нова задача: ${t.title}` });
  res.status(201).json(t);
});

const TRANSITIONS = {
  approve: { from: ['awaiting_approval', 'queued', 'paused'], to: 'approved', msg: 'Одобрена от собственика' },
  pause: { from: ['queued', 'running', 'awaiting_approval', 'approved'], to: 'paused', msg: 'Поставена на пауза' },
  resume: { from: ['paused'], to: 'queued', msg: 'Възобновена (чака изпълнител)' },
  stop: { from: ['queued', 'running', 'paused', 'awaiting_approval', 'approved', 'failed'], to: 'stopped', msg: 'Спряна от собственика' },
};
app.post('/api/tasks/:id/:action', (req, res) => {
  const tr = TRANSITIONS[req.params.action];
  if (!tr) return res.status(404).json({ error: 'Непознато действие' });
  const t = db.tasks.find(x => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'Няма такава задача' });
  if (!tr.from.includes(t.status)) return res.status(409).json({ error: `Не може „${req.params.action}“ от статус ${t.status}` });
  let to = tr.to;
  if (req.params.action === 'resume' && t.demo) to = 'running';
  setStatus(t, to, tr.msg);
  if (t.demo && req.params.action === 'approve') demoAfterApprove(t);
  save();
  emit({ type: 'task_' + req.params.action, taskId: t.id, agentId: t.agentId, demo: t.demo, msg: `${t.title}: ${tr.msg}` });
  res.json(t);
});

app.delete('/api/tasks/:id', (req, res) => {
  const i = db.tasks.findIndex(x => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Няма такава задача' });
  const [t] = db.tasks.splice(i, 1); save();
  emit({ type: 'task_deleted', taskId: t.id, agentId: t.agentId, demo: t.demo, msg: `Изтрита: ${t.title}` });
  res.json({ ok: true });
});

app.post('/api/demo', (req, res) => {
  const on = !!(req.body && req.body.on);
  db.demoMode = on;
  if (on) startDemo(); else { stopDemo(); db.events = db.events.filter(e => !e.demo); }
  save();
  emit({ type: on ? 'demo_on' : 'demo_off', demo: on, msg: on ? 'DEMO режим включен (симулация)' : 'DEMO режим изключен, симулираните задачи са изчистени' });
  res.json({ demoMode: on });
});

app.post('/api/demo/news', (_req, res) => {
  if (!db.demoMode) return res.status(409).json({ error: 'Включи DEMO режим' });
  demoNews(); res.json({ ok: true });
});

app.get('/api/events', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  res.write(`retry: 3000\nevent: state\ndata: ${JSON.stringify(snapshot())}\n\n`);
  clients.add(res);
  const ping = setInterval(() => res.write(`event: ping\ndata: ${Date.now()}\n\n`), 15000);
  req.on('close', () => { clearInterval(ping); clients.delete(res); });
});

// ---------------- DEMO simulation (all items tagged demo:true) ----------------
let timers = [];
let demoTick = null;
function later(ms, fn) { timers.push(setTimeout(fn, ms)); }
function stopDemo() {
  timers.forEach(clearTimeout); timers = [];
  if (demoTick) clearInterval(demoTick); demoTick = null;
  db.tasks = db.tasks.filter(t => !t.demo);
}
const NEWS = [
  { title: 'ФЕД сигнализира за по-дълго задържане на високите лихви', source: 'DEMO Reuters-стил', instruments: ['XAUUSD', 'NAS100', 'US30'] },
  { title: 'Неочаквано силни данни за пазара на труда в САЩ', source: 'DEMO Bloomberg-стил', instruments: ['XAUUSD', 'US30'] },
  { title: 'Голям приток в спот Bitcoin ETF за деня', source: 'DEMO CoinDesk-стил', instruments: ['BTCUSD', 'ETHUSD'] },
];
let newsI = 0;
function demoNews() {
  const n = NEWS[newsI++ % NEWS.length];
  emit({ type: 'news_alert', demo: true, agentId: '01', severity: 'breaking', msg: n.title, source: n.source, instruments: n.instruments });
}
function demoHandoff(t, from, to, stage, msg) {
  t.agentId = to; t.stage = stage; t.progress = 0;
  setStatus(t, 'running', msg);
  save();
  emit({ type: 'handoff', demo: true, taskId: t.id, from, to, agentId: to, msg });
}
function demoAfterApprove(t) {
  later(2500, () => {
    if (!db.demoMode) return;
    demoHandoff(t, '06', '05', 5, 'Одобрено → към SOCIAL PUBLISHER (симулация, нищо не се публикува)');
    later(5000, () => {
      if (!db.demoMode) return;
      t.progress = 100; t.outputs.push('DEMO: публикация в график (симулирана)');
      setStatus(t, 'done', 'DEMO: маркирано като публикувано (реално публикуване няма)'); save();
      emit({ type: 'task_done', demo: true, taskId: t.id, agentId: '05', msg: `${t.title}: завършено (DEMO)` });
      later(4000, runScenario);
    });
  });
}
let scenarioN = 0;
function runScenario() {
  if (!db.demoMode) return;
  scenarioN++;
  // keep the demo list short
  const demos = db.tasks.filter(t => t.demo);
  if (demos.length > 6) db.tasks = db.tasks.filter(t => !t.demo || !['done', 'stopped'].includes(t.status) || demos.slice(-4).includes(t));
  const t = newTask({ title: `DEMO: Видео „Златото днес“ #${scenarioN}`, description: 'Симулиран поток: анализ → стратегия → сценарий → видео → одобрение → публикуване.', agentId: '01', demo: true, stage: 0 });
  t.log.push({ ts: t.createdAt, msg: 'DEMO: стартирана симулация' });
  save();
  emit({ type: 'task_started', demo: true, taskId: t.id, agentId: '01', msg: `${t.title} стартира при MARKET WATCH` });
  const second = newTask({ title: `DEMO: Пазарен преглед BTCUSD #${scenarioN}`, agentId: '02', demo: true, stage: 0 });
  save();
  emit({ type: 'task_started', demo: true, taskId: second.id, agentId: '02', msg: `${second.title} стартира` });
  later(4000, () => demoHandoff(t, '01', '02', 1, 'Пазарни данни → CHART ANALYST'));
  later(6000, () => { if (db.demoMode) demoNews(); });
  later(8000, () => { second.progress = 100; second.outputs.push('DEMO: btc_levels.png'); setStatus(second, 'done', 'DEMO: готов анализ'); save(); emit({ type: 'task_done', demo: true, taskId: second.id, agentId: '02', msg: `${second.title}: готово` }); });
  later(9000, () => demoHandoff(t, '02', '03', 2, 'Анализ → CONTENT STRATEGIST'));
  later(14000, () => { t.outputs.push('DEMO: script_zlato.md'); demoHandoff(t, '03', '04', 3, 'Сценарий готов → VIDEO CREATOR'); });
  later(19000, () => {
    if (!db.demoMode) return;
    setStatus(t, 'failed', 'DEMO грешка: субтитрите не се синхронизираха'); save();
    emit({ type: 'task_failed', demo: true, taskId: t.id, agentId: '04', msg: `${t.title}: грешка при субтитри (DEMO)` });
  });
  later(23000, () => {
    if (!db.demoMode) return;
    setStatus(t, 'running', 'DEMO: автоматичен повторен опит'); save();
    emit({ type: 'task_retry', demo: true, taskId: t.id, agentId: '04', msg: `${t.title}: повторен опит` });
  });
  later(28000, () => {
    if (!db.demoMode) return;
    t.outputs.push('DEMO: zlato_final_9x16.mp4');
    t.agentId = '06'; t.stage = 4; t.needsApproval = true; t.progress = 100;
    setStatus(t, 'awaiting_approval', 'Видеото е готово → DIRECTOR CONTROL, чака твоето одобрение'); save();
    emit({ type: 'handoff', demo: true, taskId: t.id, from: '04', to: '06', agentId: '06', msg: 'Видео готово → чака одобрение' });
    emit({ type: 'approval_needed', demo: true, taskId: t.id, agentId: '06', msg: `${t.title} чака одобрение` });
  });
}
function startDemo() {
  stopDemo();
  runScenario();
  demoTick = setInterval(() => {
    if (!db.demoMode) return;
    let changed = false;
    for (const t of db.tasks) if (t.demo && t.status === 'running' && t.progress < 95) { t.progress = Math.min(95, t.progress + 7 + Math.round(Math.random() * 8)); changed = true; }
    if (changed) broadcast('state', snapshot());
  }, 1000);
}

// ---------------- real feeds ----------------
function marketsView() { return { order: MARKET_ORDER, items: cache.markets.items, sources: cache.markets.sources }; }
function newsView() { return { items: cache.news.items.slice(0, 40), sources: cache.news.sources, last: cache.news.last }; }
async function loop(fn, ms, name) {
  for (;;) { try { await fn(); } catch (e) { console.error(name, e.message); } broadcast('state', snapshot()); await new Promise(r => setTimeout(r, ms)); }
}
loop(pollCrypto, 20000, 'crypto');
loop(pollYahoo, 60000, 'yahoo');
loop(() => pollNews(x => emit({ type: 'news_alert', demo: false, agentId: '01', severity: 'breaking', msg: x.title, source: x.source, link: x.link, newsTs: x.ts, instruments: x.instruments })), 180000, 'news');

app.use(express.static(path.join(__dirname, 'dist'), { maxAge: '1h', index: false }));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
app.listen(PORT, '0.0.0.0', () => console.log(`JARVIS backend listening on 0.0.0.0:${PORT}`));
