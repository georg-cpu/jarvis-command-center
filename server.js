// JARVIS OMEGA Command Center — tiny backend (Express + SSE + JSON file store)
import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { cache, pollYahoo, pollCrypto, pollNews, MARKET_ORDER } from './feeds.js';
import * as store from './storage.js';

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
};

function fresh() {
  return { tasks: [], events: [], demoMode: false, seq: 1 };
}
let db;
try { db = JSON.parse(fs.readFileSync(DATA, 'utf8')); } catch { db = fresh(); }
db.demoMode = false; // never resume demo automatically after restart
db.tasks = db.tasks.filter(t => !t.demo);
db.events = db.events.filter(e => !e.demo);
function save() { fs.mkdirSync(path.dirname(DATA), { recursive: true }); fs.writeFileSync(DATA, JSON.stringify(db, null, 1)); store.schedule(); }
store.init(() => ({ seq: db.seq, tasks: db.tasks.filter(t => !t.demo) }));
function mergeRemote(remote) {
  if (!remote) return;
  const local = db.tasks.filter(t => !t.demo);
  const byId = new Map(remote.tasks.filter(t => t && t.id && !t.demo).map(t => [t.id, t]));
  let seq = Math.max(db.seq, remote.seq || 0, ...[...byId.keys()].map(id => +String(id).slice(1) || 0).map(n => n + 1));
  for (const t of local) {
    const r = byId.get(t.id);
    if (!r) byId.set(t.id, t);
    else if (r.createdAt !== t.createdAt) { const id = 'T' + (seq++); byId.set(id, { ...t, id }); }
  }
  db.tasks = [...byId.values()];
  db.seq = seq;
}
async function initStorage() {
  const remote = await store.load();
  if (remote) { mergeRemote(remote); fs.writeFileSync(DATA, JSON.stringify(db, null, 1)); store.schedule(); console.log(`storage: github ${store.status.repo}/${store.status.path}, tasks ${db.tasks.length}`); }
  else if (store.status.configured) { console.log('storage: github configured but load failed -> local; retry in 60s'); setTimeout(initStorage, 60000); }
  else console.log('storage: local (GITHUB_TOKEN not set)');
  broadcast('state', snapshot());
}
save();

const clients = new Set();
const WEBHOOK_URL = () => (process.env.JARVIS_WEBHOOK_URL || '').trim();
const WEBHOOK_KEY = () => (process.env.JARVIS_WEBHOOK_KEY || '').trim();
const ADMIN_KEY = () => (process.env.JARVIS_ADMIN_KEY || '').trim();
function snapshot() {
  return {
    dispatch: { webhookConfigured: !!WEBHOOK_URL(), adminKeyConfigured: !!ADMIN_KEY() },
    storage: store.view(),
    agents: AGENTS.map(a => {
      const mine = db.tasks.filter(t => !t.demo && t.agentId === a.id);
      const st = mine.some(t => ['dispatched', 'running'].includes(t.status)) ? 'РАБОТИ' : mine.some(t => t.status === 'blocked') ? 'БЛОКИРАН' : mine.some(t => ['approved', 'pending', 'queued'].includes(t.status)) ? 'ИМА ЗАДАЧИ' : 'ГОТОВ / БЕЗ ЗАДАЧА';
      return { ...a, created: true, realStatus: st };
    }),
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
    agentId, demo, stage, needsApproval, status: demo ? 'running' : 'pending', progress: 0, result: '', botName: '',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    log: [], outputs: [],
  };
  if (!demo) t.log.push({ ts: t.createdAt, msg: 'Създадена. Чака одобрение.' });
  db.tasks.push(t);
  return t;
}
function setStatus(t, status, msg) {
  t.status = status; t.updatedAt = new Date().toISOString();
  t.log.push({ ts: t.updatedAt, msg });
}

const app = express();
app.use(express.json({ limit: '2mb' }));

// ---------- auth: every write under /api needs X-Jarvis-Key == JARVIS_ADMIN_KEY ----------
function keyOk(given) {
  const k = ADMIN_KEY(); if (!k || !given) return false;
  const a = crypto.createHash('sha256').update(String(given)).digest(), b = crypto.createHash('sha256').update(k).digest();
  return crypto.timingSafeEqual(a, b);
}
app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (!ADMIN_KEY()) return res.status(503).json({ error: 'JARVIS_ADMIN_KEY не е настроен на сървъра — записът е изключен' });
  if (!keyOk(req.get('X-Jarvis-Key'))) return res.status(401).json({ error: 'Въведи ключа за достъп' });
  next();
});

app.get('/api/health', (_req, res) => res.json({ ok: true, uptimeSec: Math.round(process.uptime()), serverTime: new Date().toISOString() }));
app.get('/api/state', (_req, res) => res.json(snapshot()));
app.get('/api/markets', (_req, res) => res.json(marketsView()));
app.get('/api/news', (_req, res) => res.json(newsView()));

app.post('/api/tasks', (req, res) => {
  const { title, description, agentId } = req.body || {};
  if (!title || !String(title).trim()) return res.status(400).json({ error: 'Липсва заглавие' });
  if (agentId && !AGENTS.find(a => a.id === agentId)) return res.status(400).json({ error: 'Непознат агент' });
  const t = newTask({ title: String(title).trim(), description, agentId: agentId || '06' });
  if (req.body && req.body.status === 'approved') { t.approvedAt = new Date().toISOString(); setStatus(t, 'approved', 'Създадена директно като одобрена'); }
  save();
  emit({ type: 'task_created', taskId: t.id, agentId: t.agentId, msg: `Нова задача: ${t.title}` });
  if (t.status === 'approved') dispatch(t);
  res.status(201).json(t);
});

const TRANSITIONS = {
  approve: { from: ['pending', 'queued', 'awaiting_approval', 'paused', 'blocked'], to: 'approved', msg: 'Одобрена от собственика' },
  pause: { from: ['pending', 'queued', 'running', 'awaiting_approval', 'approved', 'dispatched'], to: 'paused', msg: 'Поставена на пауза' },
  resume: { from: ['paused'], to: 'pending', msg: 'Възобновена' },
  stop: { from: ['pending', 'queued', 'running', 'paused', 'awaiting_approval', 'approved', 'dispatched', 'blocked', 'failed'], to: 'stopped', msg: 'Спряна от собственика' },
};
app.post('/api/tasks/:id/:action', (req, res, next) => {
  const tr = TRANSITIONS[req.params.action];
  if (!tr) return next();
  const t = db.tasks.find(x => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'Няма такава задача' });
  if (!tr.from.includes(t.status)) return res.status(409).json({ error: `Не може „${req.params.action}“ от статус ${t.status}` });
  let to = tr.to;
  if (req.params.action === 'pause') t.prevStatus = t.status;
  if (req.params.action === 'resume') to = t.demo ? 'running' : (t.prevStatus && t.prevStatus !== 'paused' ? t.prevStatus : 'pending');
  if (req.params.action === 'approve') t.approvedAt = new Date().toISOString();
  setStatus(t, to, tr.msg);
  if (t.demo && req.params.action === 'approve') demoAfterApprove(t);
  save();
  emit({ type: 'task_' + req.params.action, taskId: t.id, agentId: t.agentId, demo: t.demo, msg: `${t.title}: ${tr.msg}` });
  if (!t.demo && req.params.action === 'approve') dispatch(t);
  res.json(t);
});

// ---------- status from bots (via JARVIS OMEGA) ----------
const BOT_STATUSES = ['pending', 'approved', 'dispatched', 'running', 'done', 'blocked', 'paused', 'stopped'];
app.patch('/api/tasks/:id/status', (req, res) => {
  const t = db.tasks.find(x => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'Няма такава задача' });
  const { status, note, result, botName } = req.body || {};
  if (!BOT_STATUSES.includes(status)) return res.status(400).json({ error: 'Невалиден статус. Позволени: ' + BOT_STATUSES.join(', ') });
  if (botName) t.botName = String(botName).slice(0, 80);
  if (result != null) t.result = String(result).slice(0, 20000);
  if (status === 'done') t.progress = 100;
  const who = t.botName ? `${t.botName}: ` : '';
  setStatus(t, status, `${who}статус → ${status}${note ? ' — ' + String(note).slice(0, 2000) : ''}`);
  save();
  emit({ type: 'task_status', taskId: t.id, agentId: t.agentId, msg: `${t.title}: ${status}${note ? ' — ' + String(note).slice(0, 140) : ''}` });
  res.json(t);
});
app.post('/api/tasks/:id/redispatch', async (req, res) => {
  const t = db.tasks.find(x => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'Няма такава задача' });
  if (t.demo) return res.status(409).json({ error: 'DEMO задачите не се изпращат' });
  if (!['approved', 'dispatched', 'running', 'blocked'].includes(t.status)) return res.status(409).json({ error: 'Само одобрени задачи могат да се изпратят' });
  const r = await dispatch(t, true);
  res.json({ ok: r.ok, http: r.http || null, error: r.error || null, task: t });
});
// Persistent store: see storage.js (GITHUB_TOKEN + GITHUB_DATA_REPO + GITHUB_DATA_PATH). Manual restore: POST /api/import.
// ---------- import / export (restore after free-instance restarts) ----------
app.get('/api/export', (_req, res) => res.json({ exportedAt: new Date().toISOString(), tasks: db.tasks.filter(t => !t.demo) }));
app.post('/api/import', (req, res) => {
  const list = Array.isArray(req.body) ? req.body : (req.body && req.body.tasks);
  if (!Array.isArray(list)) return res.status(400).json({ error: 'Очаква се {tasks:[...]}' });
  const ok = new Set(['pending', 'queued', 'approved', 'dispatched', 'running', 'done', 'blocked', 'paused', 'stopped']);
  const out = { imported: [], skipped: [] };
  for (const x of list) {
    if (!x || !x.title || x.demo) { out.skipped.push(x && x.id); continue; }
    if (x.id && db.tasks.find(t => t.id === x.id)) { out.skipped.push(x.id); continue; }
    const id = x.id && /^T\d+$/.test(x.id) ? x.id : 'T' + (db.seq++);
    const now = new Date().toISOString();
    const t = {
      id, title: String(x.title).slice(0, 140), description: String(x.description || '').slice(0, 1000),
      agentId: AGENTS.find(a => a.id === x.agentId) ? x.agentId : '06', demo: false, stage: +x.stage || 0, needsApproval: !!x.needsApproval,
      status: ok.has(x.status) ? (x.status === 'queued' ? 'pending' : x.status) : 'pending', progress: +x.progress || 0,
      result: x.result || '', botName: x.botName || '', approvedAt: x.approvedAt || (x.status === 'approved' ? x.updatedAt : undefined),
      createdAt: x.createdAt || now, updatedAt: now, log: Array.isArray(x.log) ? x.log.slice(-50) : [], outputs: Array.isArray(x.outputs) ? x.outputs : [],
    };
    t.log.push({ ts: now, msg: 'Възстановена от резервно копие (статусът е запазен, нищо не е изпратено)' });
    const n = +id.slice(1); if (n >= db.seq) db.seq = n + 1;
    db.tasks.push(t); out.imported.push(id);
  }
  save();
  emit({ type: 'tasks_imported', msg: `Възстановени задачи: ${out.imported.length}` });
  res.json(out);
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

// ---------------- webhook dispatch to JARVIS OMEGA ----------------
async function dispatch(t, manual = false) {
  const url = WEBHOOK_URL();
  if (!url) {
    t.log.push({ ts: new Date().toISOString(), msg: 'Изпращането към ботовете не е настроено (JARVIS_WEBHOOK_URL липсва)' });
    save(); emit({ type: 'dispatch_skipped', taskId: t.id, agentId: t.agentId, msg: `${t.title}: изпращането не е настроено` });
    return { ok: false, error: 'не е настроено' };
  }
  const agent = AGENTS.find(a => a.id === t.agentId);
  const body = JSON.stringify({ id: t.id, agent: t.agentId, agentName: agent?.name, title: t.title, description: t.description, status: t.status, approvedAt: t.approvedAt || t.updatedAt });
  const key = WEBHOOK_KEY();
  const headers = { 'Content-Type': 'application/json', 'User-Agent': 'JarvisCommandCenter/1.0' };
  if (key) { headers.Authorization = `Bearer ${key}`; headers['X-Webhook-Key'] = key; }
  let last = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(15000) });
      if (r.ok) {
        t.dispatchedAt = new Date().toISOString(); t.dispatchError = null;
        if (['approved', 'blocked'].includes(t.status)) t.status = 'dispatched';
        t.updatedAt = t.dispatchedAt;
        t.log.push({ ts: t.dispatchedAt, msg: `изпратено към JARVIS OMEGA (HTTP ${r.status}${attempt > 1 ? ', опит ' + attempt : ''}${manual ? ', ръчно повторно' : ''})` });
        save(); emit({ type: 'dispatched', taskId: t.id, agentId: t.agentId, msg: `${t.title}: изпратено към JARVIS OMEGA` });
        return { ok: true, http: r.status };
      }
      last = 'HTTP ' + r.status;
    } catch (e) { last = e.message; }
    if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * Math.pow(3, attempt - 1)));
  }
  t.dispatchError = last; t.updatedAt = new Date().toISOString();
  t.log.push({ ts: t.updatedAt, msg: `грешка при изпращане към JARVIS OMEGA след 3 опита: ${last}` });
  save(); emit({ type: 'dispatch_failed', taskId: t.id, agentId: t.agentId, msg: `${t.title}: грешка при изпращане (${last})` });
  return { ok: false, error: last };
}

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
initStorage();
app.listen(PORT, '0.0.0.0', () => console.log(`JARVIS backend listening on 0.0.0.0:${PORT}`));
