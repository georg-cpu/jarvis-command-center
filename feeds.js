// Real data feeds: free, no key, no signup. Server-side polling + cache.
const UA = 'Mozilla/5.0 (X11; Linux x86_64) JarvisCommandCenter/1.0';
const YAHOO = [
  { g: 'FOREX + ЗЛАТО', sym: 'XAUUSD', y: 'GC=F', d: 2, note: 'злато фючърс COMEX (GC=F), не спот' },
  { g: 'FOREX + ЗЛАТО', sym: 'EURUSD', y: 'EURUSD=X', d: 4 },
  { g: 'FOREX + ЗЛАТО', sym: 'GBPUSD', y: 'GBPUSD=X', d: 4 },
  { g: 'FOREX + ЗЛАТО', sym: 'USDJPY', y: 'JPY=X', d: 3 },
  { g: 'FOREX + ЗЛАТО', sym: 'USDCHF', y: 'CHF=X', d: 4 },
  { g: 'FOREX + ЗЛАТО', sym: 'AUDUSD', y: 'AUDUSD=X', d: 4 },
  { g: 'FOREX + ЗЛАТО', sym: 'USDCAD', y: 'CAD=X', d: 4 },
  { g: 'ИНДЕКСИ + ФЮЧЪРСИ', sym: 'NAS100', y: '^NDX', d: 1, note: 'индекс Nasdaq-100 (^NDX)' },
  { g: 'ИНДЕКСИ + ФЮЧЪРСИ', sym: 'US30', y: '^DJI', d: 1, note: 'индекс Dow Jones (^DJI)' },
  { g: 'ИНДЕКСИ + ФЮЧЪРСИ', sym: 'ES', y: 'ES=F', d: 2, note: 'E-mini S&P 500 фючърс' },
  { g: 'ИНДЕКСИ + ФЮЧЪРСИ', sym: 'CL', y: 'CL=F', d: 2, note: 'WTI петрол фючърс' },
];
const CRYPTO = [{ g: 'КРИПТО', sym: 'BTCUSD', b: 'BTCUSDT', cg: 'bitcoin', d: 0 }, { g: 'КРИПТО', sym: 'ETHUSD', b: 'ETHUSDT', cg: 'ethereum', d: 2 }];
const RSS = [
  { name: 'CNBC Top News', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html' },
  { name: 'CNBC Economy', url: 'https://www.cnbc.com/id/20910258/device/rss/rss.html' },
  { name: 'FXStreet', url: 'https://www.fxstreet.com/rss/news' },
  { name: 'Investing.com', url: 'https://www.investing.com/rss/news_25.rss', utcNoZone: true },
  { name: 'MarketWatch', url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories' },
];
const BREAKING = [/\bfed\b/i, /fomc/i, /powell/i, /federal reserve/i, /\becb\b/i, /lagarde/i, /\bcpi\b/i, /\bnfp\b/i, /nonfarm|non-farm/i, /payrolls/i, /rate (decision|cut|hike)/i, /interest rates?\b.*(decision|cut|hike|hold)/i, /\bwar\b/i, /emergency/i, /invasion/i, /missile/i, /\bbank of (england|japan)\b/i];
const INSTR = [
  [/gold|xau/i, 'XAUUSD'], [/nasdaq|tech stocks|nvidia|apple|microsoft/i, 'NAS100'], [/dow\b|dow jones/i, 'US30'], [/s&p|s&amp;p|stocks/i, 'ES'],
  [/oil|crude|opec|wti|brent/i, 'CL'], [/bitcoin|btc|crypto/i, 'BTCUSD'], [/ether|eth\b/i, 'ETHUSD'], [/euro|eur\b|ecb/i, 'EURUSD'], [/pound|sterling|gbp|bank of england/i, 'GBPUSD'], [/yen|jpy|bank of japan/i, 'USDJPY'],
  [/fed|fomc|powell|inflation|cpi|payrolls|nfp|treasury|yields/i, 'USD'],
];

export const cache = {
  markets: { items: {}, sources: { yahoo: { ok: false, last: null, error: 'още не е зареждано' }, binance: { ok: false, last: null, error: 'още не е зареждано' } } },
  news: { items: [], sources: {}, last: null },
};

async function get(url, timeout = 10000) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' }, signal: AbortSignal.timeout(timeout) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function pollYahoo() {
  let okN = 0, errs = [];
  for (const s of YAHOO) {
    try {
      const r = await get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s.y)}?interval=15m&range=1d`);
      const j = await r.json(); const res = j.chart.result[0]; const m = res.meta;
      const closes = (res.indicators.quote[0].close || []).filter(x => x != null);
      const prev = m.chartPreviousClose ?? m.previousClose;
      const price = m.regularMarketPrice;
      if (price == null) throw new Error('няма цена');
      cache.markets.items[s.sym] = { ...s, price, prev, changePct: prev ? ((price - prev) / prev) * 100 : null, spark: closes.slice(-60), priceTime: new Date(m.regularMarketTime * 1000).toISOString(), fetchedAt: new Date().toISOString(), source: 'Yahoo Finance (' + s.y + ')', ok: true };
      okN++;
    } catch (e) {
      errs.push(`${s.sym}: ${e.message}`);
      const prev = cache.markets.items[s.sym];
      if (prev) prev.stale = true; else cache.markets.items[s.sym] = { ...s, ok: false, error: e.message, source: 'Yahoo Finance (' + s.y + ')' };
    }
    await sleep(250);
  }
  cache.markets.sources.yahoo = { ok: okN > 0, okCount: okN, total: YAHOO.length, last: new Date().toISOString(), error: errs.join('; ') || null };
}

export async function pollCrypto() {
  try {
    const syms = encodeURIComponent(JSON.stringify(CRYPTO.map(c => c.b)));
    const t = await (await get(`https://api.binance.com/api/v3/ticker/24hr?symbols=${syms}`)).json();
    for (const c of CRYPTO) {
      const x = t.find(z => z.symbol === c.b);
      let spark = cache.markets.items[c.sym]?.spark || [];
      try { const k = await (await get(`https://api.binance.com/api/v3/klines?symbol=${c.b}&interval=15m&limit=60`)).json(); spark = k.map(r => +r[4]); } catch {}
      cache.markets.items[c.sym] = { ...c, price: +x.lastPrice, prev: +x.prevClosePrice, changePct: +x.priceChangePercent, spark, priceTime: new Date(x.closeTime).toISOString(), fetchedAt: new Date().toISOString(), source: 'Binance (' + c.b + ', 24ч промяна)', ok: true };
    }
    cache.markets.sources.binance = { ok: true, last: new Date().toISOString(), error: null };
  } catch (e) {
    // fallback CoinGecko
    try {
      const j = await (await get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true')).json();
      for (const c of CRYPTO) {
        const old = cache.markets.items[c.sym] || {};
        cache.markets.items[c.sym] = { ...c, price: j[c.cg].usd, changePct: j[c.cg].usd_24h_change, spark: old.spark || [], priceTime: new Date().toISOString(), fetchedAt: new Date().toISOString(), source: 'CoinGecko (резервен)', ok: true };
      }
      cache.markets.sources.binance = { ok: true, last: new Date().toISOString(), error: 'Binance: ' + e.message + ' → CoinGecko' };
    } catch (e2) {
      cache.markets.sources.binance = { ok: false, last: new Date().toISOString(), error: `Binance: ${e.message}; CoinGecko: ${e2.message}` };
      for (const c of CRYPTO) if (cache.markets.items[c.sym]) cache.markets.items[c.sym].stale = true; else cache.markets.items[c.sym] = { ...c, ok: false, error: e2.message };
    }
  }
}

function decode(s = '') {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;|&#39;|&#x27;/g, "'").replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).trim();
}
const tag = (xml, t) => { const m = xml.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`, 'i')); return m ? decode(m[1]) : ''; };

let seeded = false;
const seen = new Set();
export async function pollNews(onBreaking) {
  const all = [];
  for (const f of RSS) {
    try {
      const xml = await (await get(f.url)).text();
      const items = xml.split(/<item[\s>]/i).slice(1).map(x => x.split(/<\/item>/i)[0]);
      let n = 0;
      for (const it of items.slice(0, 20)) {
        const title = tag(it, 'title'); if (!title) continue;
        let link = tag(it, 'link') || (it.match(/<guid[^>]*>([^<]+)/) || [])[1] || '';
        let pd = tag(it, 'pubDate') || tag(it, 'dc:date');
        let ts = pd ? new Date(f.utcNoZone && !/[zZ+]|GMT/.test(pd) ? pd.replace(' ', 'T') + 'Z' : pd) : null;
        if (!ts || isNaN(+ts)) ts = null;
        const breaking = BREAKING.some(r => r.test(title));
        const instruments = [...new Set(INSTR.filter(([r]) => r.test(title)).map(([, s]) => s))];
        all.push({ id: f.name + '|' + (link || title), title, link: decode(link), source: f.name, ts: ts ? ts.toISOString() : null, breaking, instruments });
        n++;
      }
      cache.news.sources[f.name] = { ok: n > 0, count: n, last: new Date().toISOString(), error: n ? null : 'празен feed' };
    } catch (e) {
      cache.news.sources[f.name] = { ok: false, count: 0, last: new Date().toISOString(), error: e.message };
    }
  }
  if (all.length) {
    const dedup = new Map(); for (const x of all) if (!dedup.has(x.title)) dedup.set(x.title, x);
    cache.news.items = [...dedup.values()].sort((a, b) => (b.ts || '').localeCompare(a.ts || '')).slice(0, 60);
    cache.news.last = new Date().toISOString();
    const fresh = cache.news.items.filter(x => !seen.has(x.id));
    fresh.forEach(x => seen.add(x.id));
    if (seeded) for (const x of fresh.filter(x => x.breaking)) onBreaking(x);
    seeded = true;
  }
}
export const MARKET_ORDER = [...YAHOO.map(x => x.sym), ...CRYPTO.map(x => x.sym)];
