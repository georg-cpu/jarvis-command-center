import { HEAD_IMG } from './assets';
import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, State, Task, Ev, Agent, STATUS_BG, getKey, clearKey } from './api';
import { canListen, canSpeak, SR, speak, parseIntent, hasBgVoice } from './voice';
const Globe = lazy(() => import('./Globe'));
const Workflow3D = lazy(() => import('./Workflow3D'));

const NAV = [
  ['home', 'Начало', 'M3 11l9-7 9 7v9h-6v-6H9v6H3z'],
  ['agents', 'Агенти', 'M12 2a4 4 0 110 8 4 4 0 010-8zm-8 18c0-4 4-6 8-6s8 2 8 6z'],
  ['tasks', 'Задачи', 'M4 5h16M4 12h16M4 19h10'],
  ['markets', 'Пазари', 'M3 20l5-7 4 4 8-11'],
  ['content', 'Съдържание', 'M4 5h16v14H4zM10 9l5 3-5 3z'],
  ['publishing', 'Публикации', 'M4 12l16-8-6 16-3-6z'],
  ['brands', 'Брандове', 'M12 3l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6L3 10l6-1z'],
  ['automations', 'Автоматизации', 'M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v3M12 19v3M2 12h3M19 12h3'],
  ['analytics', 'Анализи', 'M5 20V10M12 20V4M19 20v-7'],
  ['settings', 'Настройки', 'M12 9a3 3 0 100 6 3 3 0 000-6zM4 12h2M18 12h2M12 4v2M12 18v2'],
] as const;

const ICONS: Record<string, string> = {
  '01': 'M3 18l5-6 4 3 6-8 3 3M3 21h18',
  '02': 'M6 4v16M6 8h3v6H6M14 6v14M14 9h3v5h-3',
  '03': 'M12 3a6 6 0 00-3 11v3h6v-3a6 6 0 00-3-11zM10 21h4',
  '04': 'M3 6h13v12H3zM16 10l5-3v10l-5-3',
  '05': 'M18 8a3 3 0 100-6 3 3 0 000 6zM6 15a3 3 0 100-6 3 3 0 000 6zM18 22a3 3 0 100-6 3 3 0 000 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4',
  '06': 'M3 8l4 4 5-7 5 7 4-4-2 11H5z',
  '07': 'M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z',
};

const MARKETS = [
  { g: 'FOREX + ЗЛАТО', sym: 'XAUUSD', base: 4012.4, d: 2 }, { g: 'FOREX + ЗЛАТО', sym: 'EURUSD', base: 1.1580, d: 4 }, { g: 'FOREX + ЗЛАТО', sym: 'GBPUSD', base: 1.3120, d: 4 },
  { g: 'FOREX + ЗЛАТО', sym: 'USDJPY', base: 153.40, d: 2 }, { g: 'FOREX + ЗЛАТО', sym: 'USDCHF', base: 0.8040, d: 4 }, { g: 'FOREX + ЗЛАТО', sym: 'AUDUSD', base: 0.6510, d: 4 },
  { g: 'FOREX + ЗЛАТО', sym: 'USDCAD', base: 1.4030, d: 4 },
  { g: 'ФЮЧЪРСИ', sym: 'NAS100', base: 25480, d: 1 }, { g: 'ФЮЧЪРСИ', sym: 'US30', base: 47150, d: 0 }, { g: 'ФЮЧЪРСИ', sym: 'ES', base: 6780, d: 2 }, { g: 'ФЮЧЪРСИ', sym: 'CL', base: 60.8, d: 2 },
  { g: 'КРИПТО', sym: 'BTCUSD', base: 98400, d: 0 }, { g: 'КРИПТО', sym: 'ETHUSD', base: 3420, d: 1 },
];
const DEMO_NEWS = [
  { title: 'ЕЦБ запазва лихвите без промяна', source: 'DEMO източник', instruments: ['EURUSD', 'US30'], mins: 18 },
  { title: 'Петролът поскъпва след данни за запасите', source: 'DEMO източник', instruments: ['US30'], mins: 42 },
  { title: 'Технологичните акции водят ръста в САЩ', source: 'DEMO източник', instruments: ['NAS100'], mins: 65 },
];
const BRANDS = [
  { name: 'WAGNNER DIGITAL', tag: 'AI агенция · Instagram', c1: '#22e4ff', c2: '#1e5bff', mono: 'WD' },
  { name: 'WAGNNERTRADE', tag: 'Трейдинг · сигнали', c1: '#ffc83d', c2: '#ff7a1a', mono: 'WT' },
  { name: 'GEORG WAGNNER', tag: 'Личен бранд', c1: '#e8eef7', c2: '#7c8aa5', mono: 'GW' },
  { name: 'LENA AFTER DARK', tag: 'Креативен проект', c1: '#ff4fd8', c2: '#8a2bff', mono: 'LA' },
];
const SOCIAL = [
  { n: 'TikTok', c: '#ff2d6f' }, { n: 'Instagram', c: '#d63cff' }, { n: 'YouTube Shorts', c: '#ff3b3b' }, { n: 'Facebook', c: '#3d7bff' },
];

function useClock() {
  const [d, setD] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setD(new Date()), 1000); return () => clearInterval(i); }, []);
  return d;
}
const fmtTime = (d: Date | string) => new Date(d).toLocaleTimeString('bg-BG', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const fmtDate = (d: Date) => d.toLocaleDateString('bg-BG', { timeZone: 'Europe/Berlin', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

function useIsMobile() {
  const q = '(max-width: 900px)';
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => { const mm = window.matchMedia(q); const f = () => setM(mm.matches); mm.addEventListener('change', f); return () => mm.removeEventListener('change', f); }, []);
  return m;
}

function Svg({ d, size = 18, sw = 1.7 }: { d: string; size?: number; sw?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}
const Demo = ({ t = 'DEMO' }: { t?: string }) => <span className="demo-tag">{t}</span>;

function Panel({ title, accent = '#22e4ff', children, className = '', right, defaultOpen = false, id }: any) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section id={id} className={`panel ${className} ${open ? 'open' : ''}`} style={{ ['--accent' as any]: accent }}>
      <button className="panel-h" onClick={() => setOpen(o => !o)}>
        <span className="panel-dot" /> <span className="panel-t">{title}</span> <span className="panel-r">{right}</span><span className="chev">▾</span>
      </button>
      <div className="panel-b">{children}</div>
    </section>
  );
}

function spark(seed: number, n = 40, vol = 1) {
  let x = 0; const out: number[] = []; let s = seed;
  for (let i = 0; i < n; i++) { s = (s * 9301 + 49297) % 233280; x += (s / 233280 - 0.48) * vol; out.push(x); }
  return out;
}
function Spark({ data, color, h = 26, w = 90 }: { data: number[]; color: string; h?: number; w?: number }) {
  const mn = Math.min(...data), mx = Math.max(...data);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - mn) / (mx - mn || 1)) * (h - 4) - 2}`).join(' ');
  const id = 'g' + color.slice(1);
  return <svg width={w} height={h} className="spark"><defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".45" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
    <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#${id})`} /><polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" /></svg>;
}

function srcLine(label: string, src: any) {
  if (!src) return null;
  return <div className={`srcline ${src.ok ? 'ok' : 'bad'}`}>{src.ok ? <span className="live">LIVE</span> : <span className="errb">ГРЕШКА</span>} {label} · обновено {src.last ? fmtTime(src.last) : '—'}{src.error ? <em> · {src.error}</em> : null}</div>;
}
function Markets({ m, big }: { m: any; big?: boolean }) {
  if (!m) return <div className="muted">Зареждане…</div>;
  let prevG = '';
  return (
    <div className="markets">
      {srcLine('Yahoo Finance (FX, злато, индекси, фючърси)', m.sources.yahoo)}
      {srcLine(`Крипто: ${m.sources.binance?.provider || 'Binance'}`, m.sources.binance)}
      {m.order.map((sym: string) => {
        const x = m.items[sym]; if (!x) return null;
        const head = x.g !== prevG ? <div className="mgroup">{x.g}</div> : null; prevG = x.g;
        if (!x.ok || x.price == null) return <div key={sym}>{head}<div className="mrow"><div className="msym">{sym}</div><div className="mch muted">няма източник</div><div className="mprice muted">—</div></div></div>;
        const up = (x.changePct ?? 0) >= 0;
        return (<div key={sym}>{head}
          <div className="mrow" title={`${x.source}${x.note ? ' — ' + x.note : ''} · цена от ${fmtTime(x.priceTime)}`}>
            <div className="msym">{sym}{x.note && <span className="mnote">*</span>}{x.stale && <span className="stale">остаряло</span>}</div>
            <div className="mprice">{x.price.toLocaleString('en-US', { minimumFractionDigits: x.d, maximumFractionDigits: x.d })}</div>
            <div className={`mch ${up ? 'up' : 'down'}`}>{x.changePct == null ? '—' : `${up ? '▲' : '▼'} ${Math.abs(x.changePct).toFixed(2)}%`}</div>
            {x.spark?.length > 2 ? <Spark data={x.spark} color={up ? "#20e08a" : "#ff4d5e"} w={big ? 200 : 72} h={20} /> : <span />}
          </div>{big && <div className="tsub">{x.source}{x.note ? ' — ' + x.note : ''} · цена от {fmtTime(x.priceTime)}</div>}</div>);
      })}
      <div className="note">* XAUUSD = злато фючърс GC=F (не спот); NAS100/US30 = индексите ^NDX/^DJI. Промяната е спрямо предишното затваряне (крипто: 24ч).</div>
    </div>
  );
}

function News({ n, alerts }: { n: any; alerts: Ev[] }) {
  const srcs = n ? Object.entries(n.sources) : [];
  const okN = srcs.filter(([, v]: any) => v.ok).length;
  const ago = (ts: string) => { const m = Math.round((Date.now() - +new Date(ts)) / 60000); return m < 60 ? `преди ${m} мин` : m < 1440 ? `преди ${Math.round(m / 60)} ч` : new Date(ts).toLocaleDateString('bg-BG'); };
  return (
    <div className="news">
      {n && <div className={`srcline ${okN ? 'ok' : 'bad'}`}>{okN ? <span className="live">LIVE</span> : <span className="errb">ГРЕШКА</span>} RSS {okN}/{srcs.length} източника · обновено {n.last ? fmtTime(n.last) : '—'}
        {srcs.filter(([, v]: any) => !v.ok).map(([k, v]: any) => <em key={k}> · {k}: {v.error}</em>)}</div>}
      {alerts.filter(a => a.demo).slice(-2).reverse().map(a => (
        <div className="nitem breaking" key={a.id}><div className="nmeta"><span className="bk">ИЗВЪНРЕДНО</span> <Demo /> {fmtTime(a.ts)} · {a.source}</div><div className="ntitle">{a.msg}</div></div>
      ))}
      {(n?.items || []).slice(0, 25).map((x: any) => (
        <a className={`nitem ${x.breaking ? 'breaking' : ''}`} key={x.id} href={x.link} target="_blank" rel="noopener noreferrer">
          <div className="nmeta">{x.breaking && <span className="bk">ВАЖНО</span>} {x.ts ? <>{fmtTime(x.ts)} · {ago(x.ts)}</> : 'без час'} · {x.source}</div>
          <div className="ntitle">{x.title}</div>
          <div className="ninst">{x.instruments.map((i: string) => <span key={i}>{i}</span>)}</div>
        </a>
      ))}
      {n && !n.items.length && <p className="muted">Няма заредени новини.</p>}
      <div className="note">„ВАЖНО“ = ключови думи (Fed, FOMC, ECB, CPI, NFP, payrolls, rate decision/cut/hike, war, emergency…). Известие се праща само за нови такива новини.</div>
    </div>
  );
}

function Brands() {
  return <div className="brands">{BRANDS.map(b => (
    <div className="brand" key={b.name} style={{ ['--c1' as any]: b.c1, ['--c2' as any]: b.c2 }}>
      <div className="bmono">{b.mono}</div>
      <div><div className="bname">{b.name}</div><div className="btag">{b.tag}</div></div>
      <div className="bstat">няма данни</div>
    </div>))}</div>;
}

function contentSteps(t?: Task) {
  const L = ['Сценарий', 'Генериране', 'Монтаж', 'Субтитри', 'Финален експорт', 'Готовност за публикуване'];
  if (!t) return L.map(l => [l, '—', 'idle']);
  const st = t.stage, failed = t.status === 'failed';
  return L.map((l, i) => {
    if (st < 2) return [l, 'чака', 'idle'];
    if (st === 2) return i === 0 ? [l, `${t.progress}%`, 'run'] : [l, 'чака', 'idle'];
    if (st === 3) {
      if (i === 0) return [l, 'готов', 'ok'];
      if (failed && i === 3) return [l, 'грешка', 'err'];
      if (i <= 3) return [l, failed ? (i < 3 ? 'готов' : '') : `${Math.min(100, t.progress + (3 - i) * 20)}%`, failed ? 'ok' : 'run'];
      return [l, 'чака', 'idle'];
    }
    if (i < 5) return [l, 'готов', 'ok'];
    return [l, t.status === 'awaiting_approval' ? 'чака одобрение' : STATUS_BG[t.status], t.status === 'awaiting_approval' ? 'warn' : 'ok'];
  });
}
function Content({ tasks }: { tasks: Task[] }) {
  const t = [...tasks].reverse().find(x => x.demo && x.title.includes('Видео') && !['done', 'stopped'].includes(x.status));
  return (
    <div className="content">
      <div className="thumb">
        <svg viewBox="0 0 160 90" preserveAspectRatio="none"><defs><linearGradient id="tg" x1="0" x2="1"><stop offset="0" stopColor="#ffc83d" /><stop offset="1" stopColor="#ff7a1a" /></linearGradient></defs>
          <polyline points="0,70 20,62 35,66 55,48 70,52 90,34 110,40 130,22 160,18" fill="none" stroke="url(#tg)" strokeWidth="2.5" /></svg>
        <div className="play">▶</div>{t && <Demo />}<div className="thumb-t">{t ? t.title.replace('DEMO: ', '') : 'Няма активен проект'}</div>
      </div>
      <div className="steps">{contentSteps(t).map(([l, v, k]) => <div className={`step ${k}`} key={l}><span>{l}</span><b>{v}</b></div>)}</div>
    </div>
  );
}

function Social({ tasks, system }: { tasks: Task[]; system: any }) {
  const q = tasks.filter(t => ['awaiting_approval'].includes(t.status)).length;
  const ap = tasks.filter(t => t.status === 'approved').length;
  const pub = tasks.filter(t => t.demo && t.status === 'done' && t.stage === 5).length;
  return (
    <div className="social">
      <div className="plats">{SOCIAL.map(s => <div className="plat" key={s.n} style={{ ['--c' as any]: s.c }}><span className="pdot" />{s.n}<em>не е свързан</em></div>)}</div>
      <div className="qgrid">
        <div><b>{q}</b><span>Чакат одобрение</span></div><div><b>{ap}</b><span>Одобрени</span></div>
        <div><b>0</b><span>Насрочени</span></div><div><b>{pub}</b><span>Публикувани {pub ? <Demo /> : null}</span></div>
      </div>
      <div className="note">Метрики: няма данни (няма свързан акаунт). Автоматично публикуване: <b className="off">{system?.autoPublishing ? 'ВКЛ' : 'ИЗКЛ'}</b></div>
    </div>
  );
}

function Head({ active, alert, reduced }: { active: boolean; alert: boolean; reduced: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reduced) return;
    const f = (e: PointerEvent) => {
      const el = ref.current; if (!el) return;
      const x = e.clientX / window.innerWidth - 0.5, y = e.clientY / window.innerHeight - 0.5;
      el.style.setProperty('--rx', `${(-y * 8).toFixed(2)}deg`); el.style.setProperty('--ry', `${(x * 10).toFixed(2)}deg`);
    };
    window.addEventListener('pointermove', f); return () => window.removeEventListener('pointermove', f);
  }, [reduced]);
  return (
    <div className={`head ${active ? 'active' : ''} ${alert ? 'alert' : ''}`} ref={ref}>
      <svg className="halo" viewBox="0 0 400 400">
        <defs><radialGradient id="hg"><stop offset="0.55" stopColor="#1e7dff" stopOpacity="0" /><stop offset="0.8" stopColor="#22c8ff" stopOpacity=".35" /><stop offset="1" stopColor="#22c8ff" stopOpacity="0" /></radialGradient></defs>
        <circle cx="200" cy="200" r="195" fill="url(#hg)" />
        <g className="spin1"><circle cx="200" cy="200" r="182" fill="none" stroke="#22e4ff" strokeOpacity=".7" strokeWidth="2" strokeDasharray="60 14 6 14" /></g>
        <g className="spin2"><circle cx="200" cy="200" r="166" fill="none" stroke="#3d7bff" strokeOpacity=".6" strokeWidth="1.2" strokeDasharray="2 6" /></g>
        <g className="spin3">{Array.from({ length: 48 }).map((_, i) => { const a = (i / 48) * Math.PI * 2; return <line key={i} x1={200 + Math.cos(a) * 150} y1={200 + Math.sin(a) * 150} x2={200 + Math.cos(a) * (i % 4 ? 156 : 162)} y2={200 + Math.sin(a) * (i % 4 ? 156 : 162)} stroke="#8fe9ff" strokeOpacity=".7" />; })}</g>
      </svg>
      <div className="head-img"><img src={HEAD_IMG} alt="JARVIS OMEGA" /><span className="eye l" /><span className="eye r" /></div>
    </div>
  );
}

function AgentCard({ a, tasks, demoMode, onOpen, activeIds }: { a: Agent; tasks: Task[]; demoMode: boolean; onOpen: () => void; activeIds: Set<string> }) {
  const mine = tasks.filter(t => t.agentId === a.id && !['done', 'stopped'].includes(t.status));
  const real = mine.filter(t => !t.demo); const demo = mine.filter(t => t.demo);
  const cur = real.find(t => ['running', 'dispatched', 'blocked'].includes(t.status)) || demo.find(t => t.status === 'running') || real[0] || demo[0];
  const busy = activeIds.has(a.id);
  return (
    <motion.button whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }} className={`agent ${busy ? 'busy' : ''} ${cur?.status === 'failed' ? 'fail' : ''}`} style={{ ['--c' as any]: a.color }} onClick={onOpen}>
      <div className="ag-top"><span className="ag-num">{a.id}</span><span className="ag-real">{a.realStatus}</span></div>
      <div className="ag-icon"><Svg d={ICONS[a.id]} size={30} sw={1.5} /></div>
      <div className="ag-name">{a.name}</div>
      <div className="ag-bg">{a.bg}</div>
      <div className="ag-task">
        {cur ? <>{cur.demo && <Demo />}<span className="ag-tt">{cur.title.replace('DEMO: ', '')}</span><span className={`st st-${cur.status}`}>{STATUS_BG[cur.status]}</span>
          <div className="bar"><i style={{ width: `${cur.progress}%` }} /></div></> : <span className="muted">Няма задачи</span>}
      </div>
      <div className="ag-foot">Задачи в опашката: {real.length}</div>
    </motion.button>
  );
}

function LinkOverlay({ pulses, active, failed }: { pulses: { id: number; from: string; to: string }[]; active: Set<string>; failed: Set<string> }) {
  const [geo, setGeo] = useState<{ w: number; h: number; g: { x: number; y: number }; c: Record<string, { x: number; y: number }> } | null>(null);
  useEffect(() => {
    const m = () => {
      const gl = document.querySelector('.globe-wrap')?.getBoundingClientRect();
      const cards = Array.from(document.querySelectorAll('.agent')) as HTMLElement[];
      if (!gl || cards.length < 6) return;
      const c: any = {};
      cards.forEach((el, i) => { const r = el.getBoundingClientRect(); c[String(i + 1).padStart(2, '0')] = { x: r.left + r.width / 2, y: r.top }; });
      setGeo({ w: window.innerWidth, h: window.innerHeight, g: { x: gl.left + gl.width / 2, y: gl.top + gl.height * 0.55 }, c });
    };
    m(); const i = setInterval(m, 1500); window.addEventListener('resize', m);
    return () => { clearInterval(i); window.removeEventListener('resize', m); };
  }, []);
  if (!geo) return null;
  const ids = Object.keys(geo.c);
  return (
    <svg className="links" viewBox={`0 0 ${geo.w} ${geo.h}`} width={geo.w} height={geo.h}>
      <defs><filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" /></filter>
        {ids.map(id => <linearGradient key={id} id={'lg' + id} gradientUnits="userSpaceOnUse" x1={geo.c[id].x} y1={geo.c[id].y} x2={geo.g.x} y2={geo.g.y}><stop offset="0" stopColor={AGENT_COLORS[id]} /><stop offset="1" stopColor="#22e4ff" stopOpacity=".15" /></linearGradient>)}</defs>
      {ids.map(id => { const a = geo.c[id]; const d = `M${a.x} ${a.y} C ${a.x} ${a.y - 60}, ${geo.g.x} ${geo.g.y + 120}, ${geo.g.x} ${geo.g.y}`; return <g key={id}><path d={d} className={`beam ${active.has(id) ? 'on' : ''} ${failed.has(id) ? 'bad' : ''}`} stroke={`url(#lg${id})`} />{active.has(id) && <circle r="3" fill={AGENT_COLORS[id]}><animateMotion dur="2.2s" repeatCount="indefinite" path={d} /></circle>}</g>; })}
      {pulses.map(p => {
        const a = geo.c[p.from], b = geo.c[p.to]; if (!a || !b) return null;
        const path = `M${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${a.y - 110} ${b.x} ${b.y}`;
        return <g key={p.id}><path d={path} className="hpath" stroke={AGENT_COLORS[p.to]} /><circle r="9" fill={AGENT_COLORS[p.to]} filter="url(#glow)"><animateMotion dur="2.4s" path={path} fill="freeze" /></circle><circle r="4" fill="#fff"><animateMotion dur="2.4s" path={path} fill="freeze" /></circle></g>;
      })}
    </svg>
  );
}
export const AGENT_COLORS: Record<string, string> = { '01': '#22e4ff', '02': '#ff8a1f', '03': '#b44dff', '04': '#3d7bff', '05': '#20e08a', '06': '#ffc83d', '07': '#ff3fd2' };

function Gauge({ value, label }: { value: number; label: string }) {
  const r = 38, c = Math.PI * r;
  return (
    <div className="gauge">
      <svg viewBox="0 0 100 60"><path d="M12 52 A38 38 0 0 1 88 52" className="g-bg" /><path d="M12 52 A38 38 0 0 1 88 52" className="g-fg" style={{ strokeDasharray: `${(value / 100) * c} ${c}` }} /></svg>
      <div className="g-v">{value}%</div><div className="g-l">{label}</div>
    </div>
  );
}

function TaskRow({ t, agents, onErr, hook }: { t: Task; agents: Agent[]; onErr: (s: string) => void; hook?: boolean }) {
  const [open, setOpen] = useState(false);
  const a = agents.find(x => x.id === t.agentId);
  const act = (k: any) => api.act(t.id, k).catch(e => onErr(e.message));
  const can = (k: string) => ({ approve: ['pending', 'queued', 'awaiting_approval', 'paused', 'blocked'], pause: ['pending', 'queued', 'running', 'awaiting_approval', 'approved', 'dispatched'], resume: ['paused'], stop: ['pending', 'queued', 'running', 'paused', 'awaiting_approval', 'approved', 'dispatched', 'blocked', 'failed'], redispatch: t.demo || !hook ? [] : ['approved', 'dispatched', 'running', 'blocked'] } as any)[k].includes(t.status);
  return (
    <div className="trow" style={{ ['--c' as any]: a?.color }}>
      <div className="tmain"><span className="tag-ag">{t.agentId}</span>{t.demo && <Demo />}<b>{t.title.replace('DEMO: ', '')}</b><span className={`st st-${t.status}`}>{STATUS_BG[t.status] || t.status}</span>{t.botName && <span className="muted small">· {t.botName}</span>}</div>
      {t.description && <div className="tsub">{t.description}</div>}
      <div className="tsub">{t.log[t.log.length - 1]?.msg} · {fmtTime(t.updatedAt)}</div>
      {t.dispatchError && <div className="tsub err">Грешка при изпращане: {t.dispatchError}</div>}
      {t.result && <div className="tresult"><b>Резултат:</b> {t.result}</div>}
      {open && <div className="tlog">{t.log.slice().reverse().map((l, i) => <p key={i}><span className="muted">{new Date(l.ts).toLocaleString('bg-BG', { timeZone: 'Europe/Berlin' })}</span> {l.msg}</p>)}</div>}
      <div className="tact">
        {can('approve') && <button className="btn ok" onClick={() => act('approve')}>Одобри</button>}
        {can('pause') && <button className="btn" onClick={() => act('pause')}>Пауза</button>}
        {can('resume') && <button className="btn" onClick={() => act('resume')}>Продължи</button>}
        {can('stop') && <button className="btn bad" onClick={() => act('stop')}>Спри</button>}
        {can('redispatch') && <button className="btn" onClick={() => act('redispatch')}>Изпрати пак</button>}
        {['done', 'stopped'].includes(t.status) && <button className="btn" onClick={() => api.del(t.id).catch(e => onErr(e.message))}>Изтрий</button>}
        <button className="btn" onClick={() => setOpen(o => !o)}>{open ? 'Скрий лога' : `Лог (${t.log.length})`}</button>
      </div>
    </div>
  );
}

function NewTask({ agents, defAgent = '06', onErr }: { agents: Agent[]; defAgent?: string; onErr: (s: string) => void }) {
  const [title, setTitle] = useState(''); const [ag, setAg] = useState(defAgent); const [desc, setDesc] = useState('');
  return (
    <form className="newtask" onSubmit={e => { e.preventDefault(); if (!title.trim()) return; api.create(title, ag, desc).then(() => { setTitle(''); setDesc(''); }).catch(er => onErr(er.message)); }}>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Нова задача, напр. „Сценарий за видео за златото“" />
      <select value={ag} onChange={e => setAg(e.target.value)}>{agents.map(a => <option key={a.id} value={a.id}>{a.id} {a.name}</option>)}</select>
      <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Описание (по желание)" />
      <button className="btn ok" type="submit">Създай задача</button>
    </form>
  );
}

function AgentModal({ a, st, onClose, onErr }: { a: Agent; st: State; onClose: () => void; onErr: (s: string) => void }) {
  const tasks = st.tasks.filter(t => t.agentId === a.id);
  const evs = st.events.filter(e => e.agentId === a.id || e.from === a.id || e.to === a.id).slice(-12).reverse();
  const errs = evs.filter(e => e.type === 'task_failed');
  const comms = evs.filter(e => e.type === 'handoff');
  const outs = tasks.flatMap(t => t.outputs);
  const cur = tasks.find(t => !['done', 'stopped'].includes(t.status));
  return (
    <motion.div className="modal-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="modal" style={{ ['--c' as any]: a.color }} initial={{ y: 30, scale: .97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 30, opacity: 0 }} onClick={e => e.stopPropagation()}>
        <div className="m-h"><span className="ag-icon"><Svg d={ICONS[a.id]} size={34} /></span><div><div className="m-t">{a.id} · {a.name}</div><div className="m-s">{a.bg} — {a.role}</div></div><button className="x" onClick={onClose}>✕</button></div>
        <div className="note warn">Статус на бота: <b>{a.realStatus}</b>. {st.dispatch?.webhookConfigured ? 'Одобрените задачи се изпращат към JARVIS OMEGA, а статусът по-долу идва от отчета на бота.' : 'Изпращането към ботовете не е настроено.'}</div>
        <div className="m-grid">
          <div className="m-box"><h4>Текуща задача</h4>{cur ? <><b>{cur.demo && <Demo />} {cur.title}</b><p>{cur.description || '—'}</p><p>Статус: {STATUS_BG[cur.status]} · {cur.progress}%</p></> : <p className="muted">Няма</p>}</div>
          <div className="m-box"><h4>Входни данни</h4><p className="muted">{a.id === '01' ? 'LIVE пазари (Yahoo Finance, Binance) и RSS новини през бекенда на таблото' : 'Получава от предишния агент в потока'}</p></div>
          <div className="m-box"><h4>Изходни файлове</h4>{outs.length ? outs.map((o, i) => <p key={i}>{o}</p>) : <p className="muted">Няма</p>}</div>
          <div className="m-box"><h4>Грешки</h4>{errs.length ? errs.map(e => <p key={e.id} className="err">{fmtTime(e.ts)} {e.msg} {e.demo && <Demo />}</p>) : <p className="muted">Няма</p>}</div>
          <div className="m-box"><h4>Комуникация</h4>{comms.length ? comms.map(e => <p key={e.id}>{fmtTime(e.ts)} {e.from} → {e.to}: {e.msg} {e.demo && <Demo />}</p>) : <p className="muted">Няма</p>}</div>
          <div className="m-box"><h4>Последна активност</h4>{evs.length ? evs.slice(0, 6).map(e => <p key={e.id}>{fmtTime(e.ts)} {e.msg} {e.demo && <Demo />}</p>) : <p className="muted">Няма</p>}</div>
        </div>
        <h4>Задачи ({tasks.length})</h4>
        <div className="tlist">{tasks.slice().reverse().map(t => <TaskRow key={t.id} t={t} agents={st.agents} onErr={onErr} hook={st.dispatch?.webhookConfigured} />)}</div>
        <h4>Възложи нова задача</h4>
        <NewTask agents={st.agents} defAgent={a.id} onErr={onErr} />
      </motion.div>
    </motion.div>
  );
}

function Waveform({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!; const ctx = cv.getContext('2d')!; let raf = 0; let an: AnalyserNode | null = null; let ac: AudioContext | null = null;
    if (stream) { ac = new AudioContext(); an = ac.createAnalyser(); an.fftSize = 256; ac.createMediaStreamSource(stream).connect(an); }
    const buf = new Uint8Array(128); let t = 0;
    const draw = () => {
      t += 0.05; ctx.clearRect(0, 0, cv.width, cv.height);
      if (an) an.getByteTimeDomainData(buf);
      ctx.strokeStyle = stream ? '#22e4ff' : 'rgba(34,228,255,.35)'; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < 128; i++) {
        const v = an ? (buf[i] - 128) / 128 : Math.sin(i / 8 + t) * 0.08;
        const x = (i / 127) * cv.width, y = cv.height / 2 + v * cv.height * 0.45;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke(); raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); ac?.close(); };
  }, [stream]);
  return <canvas ref={ref} className="wave" width={260} height={36} />;
}

type Msg = { who: 'me' | 'j'; text: string };
function CommandBox({ onCommand, msgs }: { onCommand: (t: string, voice?: boolean) => void; msgs: Msg[] }) {
  const [txt, setTxt] = useState(''); const [listening, setListening] = useState(false); const [stream, setStream] = useState<MediaStream | null>(null);
  const recRef = useRef<any>(null);
  const listen = async () => {
    if (!canListen) return;
    if (listening) { recRef.current?.stop(); return; }
    try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); setStream(s); } catch { /* waveform optional */ }
    const r = new SR(); r.lang = 'bg-BG'; r.interimResults = false; r.maxAlternatives = 1;
    r.onresult = (e: any) => { const t = e.results[0][0].transcript; onCommand(t, true); };
    r.onend = () => { setListening(false); setStream(s => { s?.getTracks().forEach(x => x.stop()); return null; }); };
    r.onerror = (e: any) => onCommand('__voice_error__' + e.error);
    recRef.current = r; r.start(); setListening(true);
  };
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.scrollTo(0, 99999); }, [msgs]);
  return (
    <div className="cmd">
      <div className="msgs" ref={box}>{msgs.slice(-8).map((m, i) => <div key={i} className={`msg ${m.who}`}>{m.text}</div>)}</div>
      <form onSubmit={e => { e.preventDefault(); if (txt.trim()) { onCommand(txt); setTxt(''); } }}>
        <input value={txt} onChange={e => setTxt(e.target.value)} placeholder="JARVIS, какво правят агентите?" />
        <button type="button" className={`mic ${listening ? 'on' : ''}`} onClick={listen} disabled={!canListen} title={canListen ? 'Говори на български' : 'Гласът не се поддържа в този браузър'}>🎙</button>
        <button className="btn ok" type="submit">➤</button>
      </form>
      <div className="vrow"><Waveform stream={stream} /><span className="muted small">{canListen ? (listening ? 'Слушам… (bg-BG)' : 'Глас: bg-BG готов') : 'Гласът не се поддържа в този браузър'}</span></div>
    </div>
  );
}

export default function App() {
  const [st, setSt] = useState<State | null>(null);
  const [conn, setConn] = useState<'connecting' | 'ok' | 'down'>('connecting');
  const [view, setView] = useState<string>('home');
  const [openAgent, setOpenAgent] = useState<string | null>(null);
  const [pulses, setPulses] = useState<{ id: number; from: string; to: string }[]>([]);
  const [globePulse, setGlobePulse] = useState(0);
  const [alertEv, setAlertEv] = useState<Ev | null>(null);
  const [toasts, setToasts] = useState<{ id: number; text: string; kind: string }[]>([]);
  const [focus, setFocus] = useState(false);
  const [view3d, setView3d] = useState(false);
  const [packets, setPackets] = useState<{ id: number; from: string; to: string; demo: boolean }[]>([]);
  const sysReduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const [reduced, setReduced] = useState(() => localStorage.getItem('rm') ? localStorage.getItem('rm') === '1' : sysReduced);
  const [quality, setQuality] = useState(() => {
    const saved = localStorage.getItem('q'); if (saved) return +saved;
    const cores = navigator.hardwareConcurrency || 4; const mem = (navigator as any).deviceMemory || 4;
    return cores >= 8 && mem >= 4 && window.innerWidth > 900 ? 2 : 1;
  });
  const [voiceOut, setVoiceOut] = useState(false);
  const [notif, setNotif] = useState<string>(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
  const [msgs, setMsgs] = useState<Msg[]>([{ who: 'j', text: 'Здравей, Георг. Аз съм JARVIS. Пазарите и новините са LIVE, задачите се одобряват от теб. Пиши или говори на български.' }]);
  const mobile = useIsMobile();
  const now = useClock();
  const voiceRef = useRef(voiceOut); voiceRef.current = voiceOut;
  const notifRef = useRef(notif); notifRef.current = notif;

  useEffect(() => { document.documentElement.classList.toggle('rm', reduced); localStorage.setItem('rm', reduced ? '1' : '0'); }, [reduced]);
  useEffect(() => { localStorage.setItem('q', String(quality)); }, [quality]);

  const toast = useCallback((text: string, kind = 'info') => {
    const id = Math.random(); setToasts(t => [...t.slice(-3), { id, text, kind }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4500);
  }, []);

  useEffect(() => {
    let es: EventSource | null = null; let stop = false;
    const open = () => {
      es = new EventSource('/api/events');
      es.addEventListener('open', () => setConn('ok'));
      es.addEventListener('state', (e: any) => { setSt(JSON.parse(e.data)); setConn('ok'); });
      es.addEventListener('event', (e: any) => {
        const ev: Ev = JSON.parse(e.data);
        if (ev.type === 'handoff' && ev.from && ev.to) {
          const id = ev.id; setPulses(p => [...p, { id, from: ev.from!, to: ev.to! }]); setGlobePulse(x => x + 1);
          setPackets(p => [...p.slice(-10), { id, from: ev.from!, to: ev.to!, demo: ev.demo }]); setTimeout(() => setPackets(p => p.filter(x => x.id !== id)), 3200);
          setTimeout(() => setPulses(p => p.filter(x => x.id !== id)), 3000);
          toast(`${ev.from} → ${ev.to}: ${ev.msg}${ev.demo ? ' (DEMO)' : ''}`, 'handoff');
        } else if (ev.type === 'news_alert') {
          setAlertEv(ev); setTimeout(() => setAlertEv(a => (a?.id === ev.id ? null : a)), 9000);
          if (notifRef.current === 'granted') try { new Notification((ev.demo ? 'ИЗВЪНРЕДНО (DEMO): ' : 'ИЗВЪНРЕДНО: ') + ev.msg, { body: `${ev.source} · ${ev.instruments?.join(', ')}`, tag: 'jarvis-news' }); } catch {}
          if (voiceRef.current) speak((ev.demo ? 'Извънредна новина, демо: ' : 'Извънредна новина: ') + ev.msg);
        } else if (ev.type === 'task_failed' || ev.type === 'dispatch_failed') toast(ev.msg, 'err');
        else if (ev.type === 'approval_needed') toast(ev.msg + ' (DEMO)', 'warn');
        else if (!['demo_on', 'demo_off'].includes(ev.type)) toast(ev.msg + (ev.demo ? ' (DEMO)' : ''), 'info');
      });
      es.onerror = () => { setConn('down'); };
    };
    open();
    api.state().then(setSt).catch(() => setConn('down'));
    return () => { stop = true; es?.close(); };
  }, [toast]);

  const tasks = st?.tasks || [];
  const activeIds = useMemo(() => new Set(tasks.filter(t => ['running', 'dispatched'].includes(t.status)).map(t => t.agentId)), [tasks]);
  const mktLive = !!(st?.markets && (st.markets.sources.yahoo?.ok || st.markets.sources.binance?.ok));
  const newsLive = !!(st?.news && Object.values(st.news.sources).some((v: any) => v.ok));
  const hookOn = !!st?.dispatch?.webhookConfigured;
  const failedIds = useMemo(() => new Set(tasks.filter(t => t.status === 'failed').map(t => t.agentId)), [tasks]);
  const alerts = (st?.events || []).filter(e => e.type === 'news_alert');
  const sys = st?.system;
  const totalInt = sys ? sys.connected.length + sys.partial.length + sys.needsSignIn.length + sys.notConnected.length : 16;
  const readiness = sys ? Math.round(((sys.connected.length + sys.partial.length * 0.5 + (mktLive ? 1 : 0) + (newsLive ? 1 : 0)) / (totalInt + 2)) * 100) : 0;
  const cnt = (f: (t: Task) => boolean) => { const a = tasks.filter(f); return [a.length, a.filter(t => t.demo).length]; };
  const C = {
    active: cnt(t => ['running', 'approved', 'dispatched'].includes(t.status)), wait: cnt(t => ['awaiting_approval', 'pending', 'queued'].includes(t.status)),
    done: cnt(t => t.status === 'done'), err: cnt(t => ['failed', 'blocked'].includes(t.status) || !!t.dispatchError), paused: cnt(t => t.status === 'paused'),
  };
  const err = (s: string) => toast('Грешка: ' + s, 'err');

  const reply = (text: string) => { setMsgs(m => [...m, { who: 'j', text }]); if (voiceRef.current) speak(text); };
  const onCommand = async (raw: string, fromVoice = false) => {
    if (raw.startsWith('__voice_error__')) { reply('Гласът не успя: ' + raw.slice(15) + '. Провери разрешението за микрофон.'); return; }
    setMsgs(m => [...m, { who: 'me', text: (fromVoice ? '🎙 ' : '') + raw }]);
    const it = parseIntent(raw);
    const s = st;
    switch (it.kind) {
      case 'agents': {
        const run = tasks.filter(t => t.status === 'running');
        setView('agents');
        reply(`Седемте агента са готови и без задача (реален статус). ${run.length ? `В DEMO симулацията работят: ${run.map(t => t.agentId + ' ' + t.title.replace('DEMO: ', '')).join('; ')}.` : 'Няма активни задачи.'} Задачи: ${tasks.filter(t => !t.demo).length} (${tasks.filter(t => !t.demo && ['dispatched', 'running'].includes(t.status)).length} при ботовете).`);
        break;
      }
      case 'markets': { setView('markets'); const mi = st?.markets?.items || {}; const f = (k: string) => mi[k]?.ok ? `${k} ${mi[k].price.toLocaleString('en-US', { maximumFractionDigits: mi[k].d })}` : `${k} няма източник`; reply(`Пазари (LIVE): ${['XAUUSD', 'NAS100', 'US30', 'BTCUSD', 'ETHUSD'].map(f).join(', ')}.`); break; }
      case 'video': {
        const v = [...tasks].reverse().find(t => t.title.includes('Видео'));
        setView('content');
        reply(v ? `${v.demo ? 'DEMO ' : ''}видео „${v.title.replace('DEMO: ', '')}“: ${STATUS_BG[v.status]}, етап ${s?.stages[v.stage]}, ${v.progress}%.` : 'Няма активно видео. VIDEO CREATOR е готов и без задача.');
        break;
      }
      case 'publishing': setView('publishing'); reply('Отварям управлението на публикациите. Няма свързани социални акаунти, автоматичното публикуване е изключено.'); break;
      case 'news': { setView('news'); const it = st?.news?.items?.[0]; reply(it ? `Последна новина (${it.source}, ${it.ts ? fmtTime(it.ts) : ''}): ${it.title}` : 'Няма заредени новини.'); break; }
      case 'focus': setFocus(f => { reply(!f ? 'Фокус режим активиран.' : 'Фокус режим изключен.'); return !f; }); break;
      case 'create': {
        if (!it.arg) { reply('Кажи заглавие, напр. „създай задача сценарий за златото“.'); break; }
        try { await api.create(it.arg, '06'); reply(`Създадох задача „${it.arg}“ за DIRECTOR CONTROL. Чака твоето одобрение.`); } catch (e: any) { reply('Грешка: ' + e.message); }
        break;
      }
      case 'demo_on': await api.demo(true); reply('Включих DEMO симулацията.'); break;
      case 'demo_off': await api.demo(false); reply('Изключих DEMO симулацията.'); break;
      default: reply('Разбирам: „какво правят агентите“, „покажи ми пазарите“, „как върви видеото“, „отвори управлението на публикациите“, „покажи ми последните новини“, „активирай фокус режим“, „създай задача …“, „включи/спри демо“.');
    }
  };

  const reqNotif = async () => { if (typeof Notification === 'undefined') return; const p = await Notification.requestPermission(); setNotif(p); if (p === 'granted') new Notification('JARVIS OMEGA', { body: 'Известията са включени (за сега само DEMO новини).' }); };

  const agents = st?.agents || [];
  const curAgent = agents.find(a => a.id === openAgent);
  const lastEv = st ? [...st.events].reverse().find(e => st.demoMode || !e.demo) : undefined;

  const drawer = (() => {
    if (view === 'home' || !st) return null;
    const title = NAV.find(n => n[0] === view)?.[1] || (view === 'news' ? 'Новини' : '');
    let body: any = null;
    if (view === 'agents') body = <div className="dlist">{agents.map(a => { const n = tasks.filter(t => t.agentId === a.id && !['done', 'stopped'].includes(t.status)); return <button key={a.id} className="drow" style={{ ['--c' as any]: a.color }} onClick={() => setOpenAgent(a.id)}><b>{a.id} {a.name}</b><span>{a.realStatus}</span><span>{n.length} активни ({n.filter(t => t.demo).length} DEMO)</span></button>; })}</div>;
    if (view === 'tasks') body = <><div className="note">{hookOn ? 'Одобрените задачи се изпращат към JARVIS OMEGA. Статусите („изпратена“, „изпълнява се“, „готова“, „блокирана“) идват от отчетите на ботовете.' : 'Изпращането към ботовете не е настроено.'} Записът изисква ключ за достъп.</div><NewTask agents={agents} onErr={err} /><div className="tlist">{tasks.slice().reverse().map(t => <TaskRow key={t.id} t={t} agents={agents} onErr={err} hook={hookOn} />)}{!tasks.length && <p className="muted">Няма задачи. Създай първата.</p>}</div></>;
    if (view === 'markets') body = <Markets m={st.markets} big />;
    if (view === 'news') body = <News n={st?.news} alerts={alerts} />;
    if (view === 'content') body = <><Content tasks={tasks} /><h4>Готови материали</h4>{tasks.flatMap(t => t.outputs.map(o => <p key={t.id + o}>{o}</p>))}{!tasks.some(t => t.outputs.length) && <p className="muted">Няма готови материали.</p>}</>;
    if (view === 'publishing') body = <><Social tasks={tasks} system={sys} /><h4>Чакат одобрение</h4><div className="tlist">{tasks.filter(t => ['awaiting_approval', 'pending', 'queued', 'approved'].includes(t.status)).map(t => <TaskRow key={t.id} t={t} agents={agents} onErr={err} hook={hookOn} />)}</div></>;
    if (view === 'brands') body = <Brands />;
    if (view === 'automations') body = <><div className="note">Няма създадени автоматизации или рутини. Автоматично публикуване: <b className="off">ИЗКЛ</b>.</div><label className="sw"><input type="checkbox" checked={st.demoMode} onChange={e => api.demo(e.target.checked)} /> DEMO РЕЖИМ (симулация на поток през API)</label><button className="btn" disabled={!st.demoMode} onClick={() => api.demoNews().catch(e => err(e.message))}>Пусни DEMO извънредна новина</button></>;
    if (view === 'analytics') body = <div className="log">{st.events.slice().reverse().map(e => <p key={e.id}><span className="muted">{fmtTime(e.ts)}</span> {e.demo && <Demo />} {e.msg}</p>)}{!st.events.length && <p className="muted">Още няма събития.</p>}</div>;
    if (view === 'settings') body = <div className="settings">
      <h4>Интеграции (реален статус)</h4>
      {sys.connected.map((n: string) => <p key={n}><span className="dot g" />{n} — свързан</p>)}
      {sys.partial.map((n: any) => <p key={n.name}><span className="dot y" />{n.name} — {n.note}</p>)}
      {sys.needsSignIn.map((n: string) => <p key={n}><span className="dot y" />{n} — чака вход</p>)}
      {sys.notConnected.map((n: string) => <p key={n}><span className="dot r" />{n} — не е свързан</p>)}
      <h4>Данни (без ключ, без регистрация)</h4>{st.markets && Object.entries(st.markets.sources).map(([k, v]: any) => <p key={k}><span className={`dot ${v.ok ? 'g' : 'r'}`} />{k === 'yahoo' ? 'Yahoo Finance' : 'Binance / CoinGecko'} — {v.ok ? 'LIVE' : 'грешка'} {v.error && <em className="muted">({v.error})</em>}</p>)}{st.news && Object.entries(st.news.sources).map(([k, v]: any) => <p key={k}><span className={`dot ${v.ok ? 'g' : 'r'}`} />{k} RSS — {v.ok ? `LIVE (${v.count})` : 'грешка: ' + v.error}</p>)}
      <h4>Достъп</h4><p>Ключ за запис: {getKey() ? 'запазен в този браузър' : 'не е въведен'} {getKey() && <button className="btn" onClick={() => { clearKey(); toast('Ключът е изтрит от браузъра'); }}>Изтрий ключа</button>}</p>
      <p>Изпращане към ботовете: {hookOn ? 'настроено (JARVIS_WEBHOOK_URL)' : 'не е настроено'}</p>
      <h4>Интерфейс</h4>
      <label className="sw"><input type="checkbox" checked={reduced} onChange={e => setReduced(e.target.checked)} /> Намалено движение</label>
      <label className="sw"><input type="checkbox" checked={quality > 1} onChange={e => setQuality(e.target.checked ? 2 : 1)} /> Високо качество на 3D</label>
      <label className="sw"><input type="checkbox" checked={voiceOut} onChange={e => setVoiceOut(e.target.checked)} disabled={!canSpeak} /> Гласови отговори (bg-BG) {canSpeak ? (hasBgVoice() ? '' : '— няма български глас в това устройство, ще се ползва стандартният') : '— не се поддържа'}</label>
      <p>Разпознаване на глас: {canListen ? 'поддържа се' : 'Гласът не се поддържа в този браузър'}</p>
      <p>Известия: {notif === 'unsupported' ? 'не се поддържат' : notif} {notif === 'default' && <button className="btn" onClick={reqNotif}>Разреши</button>}</p>
    </div>;
    return (
      <motion.aside className="drawer" initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }}>
        <div className="d-h"><b>{title}</b><button className="x" onClick={() => setView('home')}>✕</button></div>
        <div className="d-b">{body}</div>
      </motion.aside>
    );
  })();

  return (
    <div className={`app ${focus ? 'focus' : ''} ${reduced ? 'reduced' : ''} ${alertEv ? 'red' : ''}`}>
      <div className="bg"><div className="grid-floor" /><div className="trail tr1" /><div className="trail tr2" /><div className="trail tr3" /><div className="vignette" /></div>

      <header className="hdr">
        <div className="logo"><div className="wmark">W</div><div><div className="lname">WAGNNER</div><div className="lsub">AI AGENCY</div></div></div>
        <div className="title"><div className="t1">JARVIS OMEGA</div><div className="t2">COMMAND CENTER</div></div>
        <div className="hr">
          <div className="clock"><b>{fmtTime(now)}</b><span>{fmtDate(now)} · Берлин</span></div>
          <div className="pills">
            <span className={`pill ${conn}`}><i />{conn === 'ok' ? 'Бекенд свързан' : conn === 'down' ? 'Няма връзка' : 'Свързване…'}</span>
            <span className={`pill ${mktLive ? 'livep' : ''}`}>{mktLive ? 'ПАЗАРИ LIVE' : 'ПАЗАРИ: НЯМА'} · {newsLive ? 'НОВИНИ LIVE' : 'НОВИНИ: НЯМА'} · {hookOn ? 'ИЗПРАЩАНЕ: ВКЛ' : 'ИЗПРАЩАНЕ: НЕ Е НАСТРОЕНО'}</span>
            {st?.storage && (() => { const g = st.storage!; const fmt = (x?: string | null) => x ? new Date(x).toLocaleTimeString('bg-BG', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }) : '—';
              const label = g.mode === 'github' ? (g.lastSaveOk === false ? 'Хранилище: GitHub ✗' : 'Хранилище: GitHub ✓') : g.configured ? 'Хранилище: локално (GitHub грешка)' : 'Хранилище: локално (губи се при рестарт)';
              const tip = g.mode === 'github' ? `${g.repo}/${g.path} · последен запис: ${fmt(g.lastSaveAt)}${g.pending ? ' · записва…' : ''}${g.lastError ? ' · ' + g.lastError : ''}` : (g.lastError || 'Задачите се пазят само на сървъра и се губят при рестарт');
              return <span className={`pill stor ${g.mode === 'github' && g.lastSaveOk !== false ? 'ok' : 'warnp'}`} title={tip}>{label}</span>; })()}
            {st?.demoMode && <span className="pill demo">DEMO СИМУЛАЦИЯ ВКЛ</span>}
            <span className="pill"><i className="y" />Свързани услуги {sys ? `${sys.connected.length}+X / ${totalInt}` : '…'}</span>
            <button className={`pill btnp ${notif === 'granted' ? 'on' : ''}`} onClick={reqNotif} title="Известия за извънредни новини">🔔 {notif === 'granted' ? 'Вкл' : 'Известия'}</button>
          </div>
        </div>
      </header>

      <nav className="side">
        {NAV.map(([k, l, d]) => <button key={k} className={`nav ${view === k ? 'sel' : ''}`} onClick={() => setView(k)}><Svg d={d} /><span>{l}</span></button>)}
        <div className="side-sp" />
        <label className="demo-switch" title="Симулиран поток през API, всичко е маркирано DEMO">
          <input type="checkbox" checked={!!st?.demoMode} onChange={e => api.demo(e.target.checked).catch(er => err(er.message))} />
          <span className="knob" /><span>DEMO РЕЖИМ</span>
        </label>
        <label className="demo-switch rmsw"><input type="checkbox" checked={reduced} onChange={e => setReduced(e.target.checked)} /><span className="knob" /><span>Без движение</span></label>
      </nav>

      <main className="stage">
        <div className="viewtabs"><button className={!view3d ? 'sel' : ''} onClick={() => setView3d(false)}>КОМАНДНА ЗАЛА</button><button className={view3d ? 'sel' : ''} onClick={() => setView3d(true)}>3D ИЗГЛЕД</button></div>
        {view3d ? <div className="w3d"><Suspense fallback={<div className="muted">Зареждане на 3D…</div>}><Workflow3D agents={agents} tasks={tasks} packets={packets} quality={quality} reduced={reduced} onPick={id => setOpenAgent(id)} /></Suspense>
          <div className="w3d-legend">{st?.demoMode ? <><Demo t="DEMO" /> Пакетите по връзките са симулирани предавания от DEMO режима</> : 'Пакетите се появяват при реални събития „предаване“ (SSE). Сега няма предавания: агентите са без задача.'} · Кликни станция за детайли · влачи за въртене</div>
          <div className="ticker">{lastEv ? <>{lastEv.demo && <Demo />} <span className="muted">{fmtTime(lastEv.ts)}</span> {lastEv.msg}</> : 'Няма събития.'}</div></div> :
        <div className="core">
          <Head active={activeIds.size > 0} alert={!!alertEv} reduced={reduced} />
          <div className="globe-wrap">
            <div className="globe"><Suspense fallback={<div className="globe-fb" />}><Globe quality={quality} reduced={reduced} pulse={globePulse} alert={!!alertEv} /></Suspense></div>
            <div className="platform"><i /><i /><i /></div>
          </div>
          <div className="ticker">{lastEv ? <>{lastEv.demo && <Demo />} <span className="muted">{fmtTime(lastEv.ts)}</span> {lastEv.msg}</> : 'Няма събития по задачите. Създай задача или включи DEMO РЕЖИМ за симулация.'}</div>
        </div>}
      </main>

      <div className="lcol side-col">
        <Panel id="p-markets" title="LIVE FINANCIAL MARKETS" accent="#22e4ff" right={mktLive ? <span className="live">LIVE</span> : <span className="errb">НЯМА ДАННИ</span>} defaultOpen={!mobile}><Markets m={st?.markets} /></Panel>
        <Panel id="p-news" title="BREAKING NEWS INTELLIGENCE" accent="#ff3b4e" right={newsLive ? <span className="live">LIVE</span> : <span className="errb">НЯМА ДАННИ</span>} defaultOpen={!mobile}><News n={st?.news} alerts={alerts} /></Panel>
      </div>
      <div className="rcol side-col">
        <Panel title="BRANDS & PROJECTS" accent="#ffc83d" defaultOpen={!mobile}><Brands /></Panel>
        <Panel title="CONTENT PRODUCTION" accent="#b44dff" defaultOpen={!mobile}><Content tasks={tasks} /></Panel>
        <Panel title="SOCIAL MEDIA PUBLISHING" accent="#20e08a" defaultOpen={!mobile}><Social tasks={tasks} system={sys} /></Panel>
      </div>

      <section className="agents-row">
                <div className="agents">{agents.map(a => <AgentCard key={a.id} a={a} tasks={tasks} demoMode={!!st?.demoMode} activeIds={activeIds} onOpen={() => setOpenAgent(a.id)} />)}</div>
        {!agents.length && <div className="muted">Зареждане…</div>}
      </section>

      <section className="bottom">
        <Panel title="SYSTEM HEALTH" accent="#20e08a" defaultOpen className="b-health">
          <div className="health">
            <Gauge value={readiness} label="готовност на интеграциите" />
            <div className="hlist">
              <p><span className={`dot ${conn === 'ok' ? 'g' : 'r'}`} />Бекенд и поток (SSE): {conn === 'ok' ? 'онлайн' : 'няма връзка'}</p>
              <p><span className={`dot ${hookOn ? 'g' : 'y'}`} />Агенти: 7 / 7 · изпращане: {hookOn ? 'настроено' : 'не е настроено'}</p>
              <p><span className="dot g" />Авто-публикуване: ИЗКЛ</p>
              <p><span className={`dot ${mktLive ? 'g' : 'r'}`} />Пазари: {mktLive ? 'LIVE' : 'няма'} · <span className={`dot ${newsLive ? 'g' : 'r'}`} />Новини: {newsLive ? 'LIVE' : 'няма'}</p>
            </div>
          </div>
        </Panel>
        <Panel title="WORKFLOW PIPELINE" accent="#3d7bff" defaultOpen className="b-flow">
          <div className="flow">{(st?.stages || []).map((s, i) => { const n = tasks.filter(t => t.stage === i && !['done', 'stopped'].includes(t.status)); return <div key={s} className={`fstage ${n.length ? 'on' : ''}`}><div className="fnum">{i + 1}</div><div className="fname">{s}</div><div className="fcount">{n.length}{n.some(t => t.demo) ? ' DEMO' : ''}</div>{i < 5 && <div className="farrow" />}</div>; })}</div>
        </Panel>
        <Panel title="ACTIVE TASKS" accent="#ff8a1f" defaultOpen className="b-count">
          <div className="counters">
            {[['Активни', C.active, '#22e4ff'], ['Чакат одобрение', C.wait, '#ffc83d'], ['Завършени', C.done, '#20e08a'], ['Грешки', C.err, '#ff4d5e']].map(([l, v, c]: any) =>
              <div key={l} className="ctr" style={{ ['--c' as any]: c }}><b>{v[0]}</b><span>{l}</span>{v[1] > 0 && <em>{v[1]} DEMO</em>}</div>)}
          </div>
          <button className="btn wide" onClick={() => setView('tasks')}>Управление на задачите →</button>
        </Panel>
        <Panel title="JARVIS КОМАНДИ" accent="#22e4ff" defaultOpen className="b-cmd"><CommandBox onCommand={onCommand} msgs={msgs} /></Panel>
      </section>

      {!mobile && !view3d && <LinkOverlay pulses={pulses} active={activeIds} failed={failedIds} />}
      <AnimatePresence>{drawer}</AnimatePresence>
      <AnimatePresence>{curAgent && st && <AgentModal a={curAgent} st={st} onClose={() => setOpenAgent(null)} onErr={err} />}</AnimatePresence>
      <AnimatePresence>{alertEv && (
        <motion.div className="breaking-banner" initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -60, opacity: 0 }} onClick={() => { const l = (alertEv as any).link; setAlertEv(null); if (l) window.open(l, '_blank', 'noopener'); else setView('news'); }}>
          <b>⚠ ИЗВЪНРЕДНА НОВИНА</b> {alertEv.demo && <Demo />} {alertEv.msg} <span className="muted">· {alertEv.source} · {alertEv.instruments?.join(', ')}</span>
        </motion.div>)}</AnimatePresence>
      <div className="toasts"><AnimatePresence>{toasts.map(t => <motion.div key={t.id} className={`toast ${t.kind}`} initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ opacity: 0 }}>{t.text}</motion.div>)}</AnimatePresence></div>
    </div>
  );
}
