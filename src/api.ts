export type Task = { result?: string; botName?: string; dispatchError?: string | null; dispatchedAt?: string; approvedAt?: string; id: string; title: string; description: string; agentId: string; demo: boolean; stage: number; needsApproval: boolean; status: string; progress: number; createdAt: string; updatedAt: string; log: { ts: string; msg: string }[]; outputs: string[] };
export type Ev = { id: number; ts: string; type: string; demo: boolean; msg: string; agentId?: string; from?: string; to?: string; taskId?: string; source?: string; instruments?: string[]; severity?: string };
export type Agent = { id: string; name: string; bg: string; color: string; role: string; created: boolean; realStatus: string };
export type State = { agents: Agent[]; stages: string[]; system: any; tasks: Task[]; events: Ev[]; demoMode: boolean; serverTime: string; startedAt: string; markets?: any; news?: any; dispatch?: { webhookConfigured: boolean; adminKeyConfigured: boolean }; storage?: Storage };
export type Storage = { mode: 'github' | 'local'; configured: boolean; loaded: boolean; repo: string | null; path: string | null; lastLoadOk: boolean | null; lastLoadAt: string | null; lastSaveOk: boolean | null; lastSaveAt: string | null; lastError: string | null; pending: boolean };

const KEY = 'jarvis_admin_key';
export const getKey = () => localStorage.getItem(KEY) || '';
export const clearKey = () => localStorage.removeItem(KEY);
async function j(url: string, opts?: RequestInit, retried = false): Promise<any> {
  const write = !!opts?.method && opts.method !== 'GET';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (write && getKey()) headers['X-Jarvis-Key'] = getKey();
  const r = await fetch(url, { ...opts, headers });
  const body = await r.json().catch(() => ({}));
  if (r.status === 401 && write && !retried) {
    const k = window.prompt('Въведи ключа за достъп');
    if (k && k.trim()) { localStorage.setItem(KEY, k.trim()); return j(url, opts, true); }
  }
  if (r.status === 401) clearKey();
  if (!r.ok) throw new Error(body.error || r.statusText);
  return body;
}
export const api = {
  state: () => j('/api/state'),
  create: (title: string, agentId: string, description = '') => j('/api/tasks', { method: 'POST', body: JSON.stringify({ title, agentId, description }) }),
  act: (id: string, action: 'approve' | 'pause' | 'resume' | 'stop' | 'redispatch') => j(`/api/tasks/${id}/${action}`, { method: 'POST' }),
  del: (id: string) => j(`/api/tasks/${id}`, { method: 'DELETE' }),
  demo: (on: boolean) => j('/api/demo', { method: 'POST', body: JSON.stringify({ on }) }),
  demoNews: () => j('/api/demo/news', { method: 'POST' }),
};

export const STATUS_BG: Record<string, string> = {
  pending: 'Чака одобрение', queued: 'Чака одобрение', dispatched: 'Изпратена към бота', blocked: 'Блокирана', running: 'Изпълнява се', paused: 'На пауза', awaiting_approval: 'Чака одобрение (DEMO)',
  approved: 'Одобрена', done: 'Завършена', stopped: 'Спряна', failed: 'Грешка',
};
