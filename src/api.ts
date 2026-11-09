export type Task = { id: string; title: string; description: string; agentId: string; demo: boolean; stage: number; needsApproval: boolean; status: string; progress: number; createdAt: string; updatedAt: string; log: { ts: string; msg: string }[]; outputs: string[] };
export type Ev = { id: number; ts: string; type: string; demo: boolean; msg: string; agentId?: string; from?: string; to?: string; taskId?: string; source?: string; instruments?: string[]; severity?: string };
export type Agent = { id: string; name: string; bg: string; color: string; role: string; created: boolean; realStatus: string };
export type State = { agents: Agent[]; stages: string[]; system: any; tasks: Task[]; events: Ev[]; demoMode: boolean; serverTime: string; startedAt: string; markets?: any; news?: any };

async function j(url: string, opts?: RequestInit) {
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || r.statusText);
  return body;
}
export const api = {
  state: () => j('/api/state'),
  create: (title: string, agentId: string, description = '') => j('/api/tasks', { method: 'POST', body: JSON.stringify({ title, agentId, description }) }),
  act: (id: string, action: 'approve' | 'pause' | 'resume' | 'stop') => j(`/api/tasks/${id}/${action}`, { method: 'POST' }),
  del: (id: string) => j(`/api/tasks/${id}`, { method: 'DELETE' }),
  demo: (on: boolean) => j('/api/demo', { method: 'POST', body: JSON.stringify({ on }) }),
  demoNews: () => j('/api/demo/news', { method: 'POST' }),
};

export const STATUS_BG: Record<string, string> = {
  queued: 'В опашка', running: 'Изпълнява се', paused: 'На пауза', awaiting_approval: 'Чака одобрение',
  approved: 'Одобрена', done: 'Завършена', stopped: 'Спряна', failed: 'Грешка',
};
