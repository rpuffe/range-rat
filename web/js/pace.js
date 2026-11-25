// Range Rat pace log (council round 4, build item 11): with ?pace in the URL, every shift report appends
// one record (day, venue, session minutes, cash, banked, stamps, the KPIs at the bell, incidents, debris)
// to sessionStorage; the pause card's "Copy pace log" button copies them as TSV for a spreadsheet.
// The record shape and the text are pure and unit-tested; createPace() is the tiny browser shell.

export const KEY = 'rr.pace';
export const MAX_RECORDS = 200;
const num = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d;
const r2 = v => Math.round(num(v) * 100) / 100;

// report: the server's shift report. ctx: { minutes, venueName, value, debris } (what the client knows at the bell).
export function makeRecord(report, ctx = {}) {
  const r = report ?? {}, v = ctx.value ?? {};
  return {
    day: num(r.day), venue: num(r.venue), venueName: String(ctx.venueName ?? r.title ?? ''),
    minutes: r2(ctx.minutes), cash: r2(r.cash), banked: num(r.deposited), stamps: num(r.quota?.reviews ?? r.quota?.stamps),   // round 10: the review's count is `reviews`
    quotaHit: r.quota ? !!r.quota.hit : null,
    kpi: { bv: r2(v.bv), rate: r2(v.rate), upkeep: r2(v.upkeep), hustle: r2(v.hustle), curb: r2(v.curb), venue: v.kpi == null ? null : r2(v.kpi) },
    incidents: num(r.incidents), debris: ctx.debris == null ? null : num(ctx.debris),
  };
}

export const append = (list, rec, cap = MAX_RECORDS) => [...(Array.isArray(list) ? list : []), rec].slice(-cap);

export const COLUMNS = ['day', 'venue', 'venueName', 'minutes', 'cash', 'banked', 'stamps', 'quotaHit', 'bv', 'rate', 'upkeep', 'hustle', 'curb', 'venueKpi', 'incidents', 'debris'];
export function toText(list) {
  const rows = (Array.isArray(list) ? list : []).map(r => [r.day, r.venue, r.venueName, r.minutes, r.cash, r.banked, r.stamps, r.quotaHit ?? '',
    r.kpi?.bv, r.kpi?.rate, r.kpi?.upkeep, r.kpi?.hustle, r.kpi?.curb, r.kpi?.venue ?? '', r.incidents, r.debris ?? ''].join('\t'));
  return [COLUMNS.join('\t'), ...rows].join('\n');
}

// The shell. storage and clipboard are injectable; every storage touch is try/catch, with a memory fallback.
export function createPace({ search = '', storage, clipboard, now = () => Date.now() } = {}) {
  const enabled = new URLSearchParams(search).has('pace');
  const t0 = now();
  let mem = [];
  const load = () => { try { const j = JSON.parse(storage?.getItem(KEY) ?? 'null'); if (Array.isArray(j)) return j; } catch { /* storage threw or held junk */ } return mem; };
  const save = list => { mem = list; try { storage?.setItem(KEY, JSON.stringify(list)); } catch { /* memory copy still holds it */ } };
  return {
    enabled,
    record(report, ctx = {}) {
      if (!enabled || !report) return null;
      const rec = makeRecord(report, { minutes: (now() - t0) / 60000, ...ctx });
      save(append(load(), rec));
      return rec;
    },
    list: load,
    text: () => toText(load()),
    // The pause card's button: shown only with ?pace.
    bind(btn) {
      if (!btn || !enabled) return;
      btn.classList.remove('hidden');
      btn.addEventListener('click', async () => { const ok = await this.copy(); btn.textContent = ok ? 'Copied' : 'Copy failed'; setTimeout(() => { btn.textContent = 'Copy pace log'; }, 1800); });
    },
    async copy() { try { await clipboard?.writeText(toText(load())); return true; } catch { return false; } },
  };
}
