// The Stadium (venue 3): the Ping Track and Crowd Sentiment (council round 4, §3.2, build item 7).
// The crowd's mood is this venue's KPI. Pings, laps, targets and knockdowns feed it; time drains it.
import { onTrack } from '../../web/js/map.js';
import { CROWD, gateAt, newLap, stepLap, stepSentiment, bump, pingDelta } from '../../web/js/stadium.js';

const fresh = () => ({ s: CROWD.START, laps: 0, knocks: 0, lap: newLap(), t: 0, lastKnock: null, lastPing: null });

export default {
  id: 'stadium',
  venue: 3,
  init: () => fresh(),
  startShift(crew, st) { Object.assign(st, fresh()); },
  tick(crew, st, dt) {
    if (!crew.working()) return;
    st.t += dt;
    st.s = stepSentiment(st.s, dt);
    const c = crew.cart;
    if (!c || !c.driver) { st.lap = newLap(); return; }              // a parked cart is not racing
    if (stepLap(st.lap, gateAt(c.x, c.z), st.t)) {
      st.laps++; st.s = bump(st.s, CROWD.LAP);
      crew.events.push({ t: 'crowd', kind: 'lap', by: c.driver, laps: st.laps });
    }
  },
  ping(crew, st, b, { prize, cart }) {
    st.s = bump(st.s, pingDelta(!!cart && onTrack(cart.x, cart.z), prize));
    st.lastPing = crew.players.get(b.by)?.name ?? null;
    crew.events.push({ t: 'crowd', kind: 'ping', by: b.by, name: st.lastPing });
  },
  knockDown(crew, st, p) {
    if (!crew.working()) return;
    st.knocks++;
    if (st.knocks <= CROWD.KNOCK_CAP) st.s = bump(st.s, CROWD.KNOCK);
    st.lastKnock = p.name;
    crew.events.push({ t: 'crowd', kind: 'knock', id: p.id, name: p.name, n: st.knocks });
  },
  signal(crew, st, name) {
    if (name === 'target' && crew.working()) st.s = bump(st.s, CROWD.TARGET);   // Tiered's TARGET! (the bowls are still there)
  },
  kpi: (crew, st) => st.s,
  snapshot: (crew, st) => ({ s: Math.round(st.s * 1000) / 1000, laps: st.laps, knocks: st.knocks }),
};
