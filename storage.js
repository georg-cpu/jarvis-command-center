// Optional persistent task store in a (private) GitHub repo via the Contents API.
// Enabled only when GITHUB_TOKEN is set. The token is never logged or exposed.
import crypto from 'crypto';

const TOKEN = () => (process.env.GITHUB_TOKEN || '').trim();
const REPO = () => (process.env.GITHUB_DATA_REPO || 'georg-cpu/jarvis-data').trim();
const FILE = () => (process.env.GITHUB_DATA_PATH || 'tasks.json').trim().replace(/^\/+/, '');
const BRANCH = () => (process.env.GITHUB_DATA_BRANCH || '').trim();
const API = () => (process.env.GITHUB_API_BASE || 'https://api.github.com').replace(/\/+$/, '');

export const status = {
  mode: 'local', configured: false, loaded: false, repo: null, path: null,
  lastLoadOk: null, lastLoadAt: null, lastSaveOk: null, lastSaveAt: null, lastError: null, pending: false,
};
let sha = null, lastHash = null, timer = null, saving = false, again = false, getData = null;

const url = () => `${API()}/repos/${REPO()}/contents/${FILE().split('/').map(encodeURIComponent).join('/')}`;
const headers = () => ({ Authorization: `Bearer ${TOKEN()}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'JarvisCommandCenter', 'Content-Type': 'application/json' });
const clean = e => String(e && e.message || e).replace(TOKEN() || '\u0000', '***').slice(0, 300);

async function fetchFile() {
  const r = await fetch(url() + (BRANCH() ? `?ref=${encodeURIComponent(BRANCH())}` : ''), { headers: headers(), signal: AbortSignal.timeout(15000) });
  if (r.status === 404) return { sha: null, data: null };
  if (!r.ok) throw new Error(`GitHub GET HTTP ${r.status}`);
  const j = await r.json();
  const text = Buffer.from(j.content || '', 'base64').toString('utf8');
  return { sha: j.sha, data: text.trim() ? JSON.parse(text) : null };
}

/** Load tasks. Returns {tasks, seq} or null when GitHub is not configured / failed. */
export async function load() {
  status.configured = !!TOKEN(); status.repo = REPO(); status.path = FILE();
  if (!status.configured) { status.mode = 'local'; return null; }
  try {
    const f = await fetchFile();
    sha = f.sha;
    status.loaded = true; status.mode = 'github'; status.lastLoadOk = true; status.lastLoadAt = new Date().toISOString(); status.lastError = null;
    const d = f.data || {};
    return { tasks: Array.isArray(d) ? d : (d.tasks || []), seq: d.seq || 0 };
  } catch (e) {
    status.loaded = false; status.mode = 'local'; status.lastLoadOk = false; status.lastLoadAt = new Date().toISOString(); status.lastError = 'Зареждане: ' + clean(e);
    return null;
  }
}

async function put(body) {
  return fetch(url(), { method: 'PUT', headers: headers(), body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
}

async function saveNow() {
  if (!getData || !status.loaded) return;
  if (saving) { again = true; return; }
  saving = true;
  try {
    const data = getData();
    const json = JSON.stringify({ version: 1, savedAt: new Date().toISOString(), seq: data.seq, tasks: data.tasks }, null, 1);
    const hash = crypto.createHash('sha256').update(JSON.stringify(data.tasks)).digest('hex');
    if (hash === lastHash) { status.pending = false; return; }
    let lastErr = '';
    for (let attempt = 1; attempt <= 4; attempt++) {
      const body = { message: `tasks: ${data.tasks.length} задачи (${new Date().toISOString()})`, content: Buffer.from(json, 'utf8').toString('base64') };
      if (sha) body.sha = sha;
      if (BRANCH()) body.branch = BRANCH();
      let r;
      try { r = await put(body); } catch (e) { lastErr = clean(e); await new Promise(z => setTimeout(z, 1000 * attempt)); continue; }
      if (r.ok) {
        const j = await r.json().catch(() => ({}));
        sha = j.content?.sha || sha; lastHash = hash;
        status.lastSaveOk = true; status.lastSaveAt = new Date().toISOString(); status.lastError = null; status.pending = false;
        return;
      }
      lastErr = `GitHub PUT HTTP ${r.status}`;
      if (r.status === 409 || r.status === 422) { // sha conflict -> refetch sha and retry
        try { sha = (await fetchFile()).sha; } catch (e) { lastErr += '; refetch: ' + clean(e); }
        continue;
      }
      if (r.status >= 500 || r.status === 429) { await new Promise(z => setTimeout(z, 1500 * attempt)); continue; }
      break; // 401/403/404 etc.
    }
    status.lastSaveOk = false; status.lastSaveAt = new Date().toISOString(); status.lastError = 'Запис: ' + lastErr; status.pending = false;
  } finally {
    saving = false;
    if (again) { again = false; schedule(); }
  }
}

export function init(fn) { getData = fn; }
/** Debounced save (~3 s) after every change. No-op in local mode. */
export function schedule() {
  if (!status.loaded) return;
  status.pending = true;
  clearTimeout(timer); timer = setTimeout(saveNow, 3000);
}
export function view() { const { configured, ...rest } = status; return { ...rest, configured }; }
