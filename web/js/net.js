// The browser's side of a crew: join, stream the range, send inputs.
//
// The seat {code, p, k} lives in sessionStorage: a reload rejoins as the same
// player (same pocket, same colour), while a second tab is a second player.
// The last crew code and name go in localStorage, to prefill the lobby.

const SEAT = 'range-rat.seat';
const LAST = 'range-rat.last';
const SEND_MS = 66;   // ~15 inputs a second

const loadSeat = () => { try { return JSON.parse(sessionStorage.getItem(SEAT)) ?? null; } catch { return null; } };
const saveSeat = s => { try { sessionStorage.setItem(SEAT, JSON.stringify(s)); } catch {} };
export const seatInTab = loadSeat;
export function lastUsed() { try { return JSON.parse(localStorage.getItem(LAST)) ?? {}; } catch { return {}; } }
export function rememberUsed(code, name) { try { localStorage.setItem(LAST, JSON.stringify({ code, name })); } catch {} }

async function post(path, body) {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
  return j;
}

export async function createCrew(name) {
  const seat = await post('/api/crew', { name });
  saveSeat(seat);
  return seat;
}

export async function joinCrew(code, name) {
  code = code.trim().toUpperCase();
  const prev = loadSeat();
  const again = prev?.code === code ? { p: prev.p, k: prev.k } : {};
  const seat = await post(`/api/crew/${encodeURIComponent(code)}/join`, { name, ...again });
  saveSeat(seat);
  return seat;
}

// Opens the stream. onMsg gets every server message; returns a handle to
// queue actions and report the player's position.
export function connect(seat, onMsg, onStatus = () => {}) {
  const base = `/api/crew/${seat.code}`;
  let es, closed = false, pos = null, actions = [], inflight = false, lastSent = 0;
  const open = () => {
    es = new EventSource(`${base}/stream?p=${seat.p}&k=${seat.k}`);
    es.onmessage = e => { try { onMsg(JSON.parse(e.data)); } catch (err) { console.error(err); } };
    es.onopen = () => onStatus('online');
    es.onerror = () => onStatus(es.readyState === EventSource.CLOSED ? 'lost' : 'reconnecting');
  };
  open();

  async function flush() {
    if (inflight || closed || (!actions.length && !pos)) return;
    inflight = true;
    const a = actions; actions = [];
    const body = { p: seat.p, k: seat.k, a, ...(pos ?? {}) };
    pos = null; lastSent = performance.now();
    try {
      const res = await fetch(`${base}/input`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) onMsg({ k: 'ack', ...(await res.json()) });
      else if (res.status === 403 || res.status === 404) onStatus('kicked');
    } catch { actions = a.concat(actions); }   // offline blip: try those again
    inflight = false;
  }
  const timer = setInterval(flush, SEND_MS);

  return {
    // cart: the cart's pose while this player drives it ({x, z, yaw}), else omit.
    move(x, z, yaw, cart) {
      pos = { x: +x.toFixed(2), z: +z.toFixed(2), yaw: +yaw.toFixed(3) };
      if (cart) pos.cart = { x: +cart.x.toFixed(2), z: +cart.z.toFixed(2), yaw: +cart.yaw.toFixed(3) };
    },
    act(a) { actions.push(a); if (performance.now() - lastSent > 30) flush(); },
    close() { closed = true; clearInterval(timer); es.close(); },
  };
}
