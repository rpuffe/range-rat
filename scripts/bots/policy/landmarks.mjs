// Council round 13 #4 (builder 2): the Range landmarks, as a bot policy (scripts/bots/policies.mjs: BUY=1).
// A tier is bought only when the crew keeps the promotion fee after it (cash - price >= fee), so buying never delays a
// promotion. BUY=eager: from the Stadium on it's bought as soon as it's affordable (the optional "buy the fireworks,
// promote a shift later" trade). It also tracks the money check: shifts with nothing worth buying
// (no unbought, unlocked landmark or shop tier at ≤ 2 shifts of income) and the cash at every venue's last bell.
// Until builder 4's SHOP line lands, the row is appended to the bot process's own SHOP (no file is edited).
const REPO = new URL('../../../', import.meta.url).href;
const S = await import(REPO + 'web/js/sim.js');
const LM = await import(REPO + 'web/js/landmarks.js');

if (!S.SHOP_BY_ID.landmark) { S.SHOP.push(LM.LANDMARK_ROW); S.SHOP_BY_ID.landmark = LM.LANDMARK_ROW; }

export default function make(ctx, value = '1') {
  const { crew, rats } = ctx;
  const bought = [], dry = [], lastBell = {};
  const price = () => S.nextPrice('landmark', crew.up, crew.onlineCount(), 0, crew.venue, S.shopDay(crew.phase, crew.day), crew.endless,
    S.shopDay(crew.phase, crew.venueDay));
  return {
    buy() {
      const pr = price();
      if (pr == null || pr > crew.cash) return;
      // BUY=1 keeps the fee at every venue (never delays a promotion); BUY=eager buys from the Stadium on as soon as it can.
      const fee = crew.venue <= 2 || value !== 'eager' ? crew.promoInfo()?.fee ?? 0 : 0;
      if (crew.cash - pr < fee) return;
      if (crew.buy(rats[0], 'landmark')) bought.push(`d${crew.day} v${crew.venue} tier ${crew.up.landmark} $${Math.round(pr).toLocaleString()}`);
    },
    shiftEnd(report) {
      const inc = Math.max(1, report?.cash ?? 0);
      let worth = false;
      for (const item of S.SHOP) {
        if (item.personal) continue;
        const p = S.nextPrice(item.id, crew.up, crew.onlineCount(), 0, crew.venue, S.shopDay(crew.phase, crew.day), crew.endless, S.shopDay(crew.phase, crew.venueDay));
        if (p != null && p > 0 && LM.worthBuying(p, inc)) { worth = true; break; }
      }
      if (!worth) dry.push(`d${crew.day} v${crew.endless ? 'E' : crew.venue}`);
      lastBell[crew.endless ? 'E' : crew.venue] = Math.round(crew.cash);
      return { landmark: crew.up.landmark ?? 0, worth: worth ? 1 : 0 };
    },
    summary() {
      return [`LANDMARKS bought: ${bought.join(' | ') || 'none'}`, `LANDMARKS shifts with nothing worth buying: ${dry.length} ${dry.join(' ')}`,
        `LANDMARKS cash at each venue's last bell: ${JSON.stringify(lastBell)}`];
    },
  };
}
