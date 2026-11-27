// Playtest round 10, reviewer A: injected into the reviewer's own page (scripts/bots/pt10a-drive.mjs) before the game
// loads. (1) A fake standard pad (navigator.getGamepads), so seat 1 plays through the real pad path (pollPad:
// sticks, Ⓐ Ⓑ Ⓧ Ⓨ). (2) window.__ap: a pad "thumb" that steers with the sticks and presses buttons like a pad player
// working the field (balls → return), which the reviewer switches on and off. (3) window.__log: every change of the
// centre zone's visible text, with the day and shift clock, and the server's events of interest.
(() => {
  const pad = { id: 'pt10a fake Xbox pad (standard)', index: 0, connected: true, mapping: 'standard', timestamp: 0,
    axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
  window.__pad = pad;
  navigator.getGamepads = () => [pad, null, null, null];
  const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, MENU: 9, LS: 10, RS: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
  const setB = (b, on) => { const x = pad.buttons[BTN[b] ?? b]; x.pressed = on; x.touched = on; x.value = on ? 1 : 0; pad.timestamp = performance.now(); };
  // a tap: down for ~3 frames, then up
  window.__tap = (b, ms = 120) => new Promise(r => { setB(b, true); setTimeout(() => { setB(b, false); setTimeout(r, 60); }, ms); });
  window.__hold = (b, on) => setB(b, on);
  window.__stick = (lx = 0, ly = 0, rx = 0, ry = 0) => { pad.axes = [lx, ly, rx, ry]; pad.timestamp = performance.now(); };

  // ---- the centre log
  const IDS = ['story-card', 'pa-card', 'memo', 'hint', 'todo', 'toast', 'bell-stamp', 'mowe-stamp', 'endcard', 'ending-flash'];
  const L = window.__log = { lines: [], last: '', ev: [] };
  const visible = el => { let o = 1; for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return 0; o *= parseFloat(cs.opacity || '1'); } const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2 ? o : 0; };
  setInterval(() => {
    const rr = window.rr; if (!rr?.crew) return;
    const up = [];
    for (const id of IDS) { const el = document.getElementById(id); if (!el) continue; const t = (el.textContent || '').trim().replace(/\s+/g, ' '); if (t && visible(el) > 0.3) up.push(id + ': ' + t.slice(0, 120)); }
    const key = up.join(' | ');
    if (key !== L.last) { L.last = key; const c = rr.crew; L.lines.push(`${new Date().toISOString().slice(11, 19)} ${c.phase} d${c.day} v${c.venue}.${c.venueDay}${c.endless ? 'E' : ''} t${Math.round(c.shiftT ?? 0)} ${up.length > 1 ? '[' + up.length + '] ' : ''}${key || '-'}`); if (L.lines.length > 4000) L.lines.splice(0, 1000); }
  }, 200);

  // ---- the pad autopilot (seat 1's thumbs)
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const AP = window.__ap = { on: false, mode: 'work', target: null, note: '', avoid: true, stats: { picks: 0, banks: 0 } };
  let busy = false;
  const storyUp = () => { const el = document.getElementById('story-card'); return el && visible(el) > 0.3; };
  const steer = (x, z, near = 0.9) => {
    const me = rr.me, dx = x - me.x, dz = z - me.z, d = Math.hypot(dx, dz);
    if (d < near) { __stick(0, 0, 0, 0); return true; }
    const want = Math.atan2(-dx, -dz), err = wrap(want - me.yaw);
    // the right stick turns (me.yaw -= rx * 2.6 dt): a big error turns at full, a small one gently (past the dead zone)
    const rx = Math.abs(err) < 0.04 ? 0 : -Math.sign(err) * Math.min(1, 0.3 + Math.abs(err) * 1.5);
    const fwd = Math.abs(err) < 0.5 ? -1 : Math.abs(err) < 1.2 ? -0.4 : 0;
    __stick(0, fwd, rx, me.pitch > -0.15 ? 0.3 : me.pitch < -0.45 ? -0.3 : 0);
    return false;
  };
  AP.steer = steer;
  const returns = () => { const t = rr.crew?.up?.returns ?? 0, out = [{ x: 27, z: 1.8, main: 1 }]; if (t >= 1) out.push({ x: 44, z: -130 }); if (t >= 2) out.push({ x: -6, z: -128 }); return out; };
  setInterval(async () => {
    const rr = window.rr; if (!AP.on || !rr?.crew || busy) return;
    const c = rr.crew, me = rr.me;
    if (c.phase !== 'shift' || me.down > 0) { __stick(0, 0, 0, 0); return; }
    if (AP.mode === 'idle') { __stick(0, 0, 0, 0); return; }
    if (AP.mode === 'goto' && AP.target) { if (steer(AP.target.x, AP.target.z, AP.target.r ?? 0.9)) { AP.mode = 'idle'; AP.note = 'arrived'; } return; }
    if (AP.mode === 'custom' && AP.fn) { try { await AP.fn(); } catch (e) { AP.note = 'custom: ' + e.message; } return; }
    // work: an event's hands-ball, else the nearest range ball, else bank
    const mine = c.players.find(p => p.id === me.id) ?? {};
    const pocket = mine.pocket ?? 0, cap = [3, 8, 25, 60][mine.gear ?? 0];
    let held = 0, ev = [];
    for (const v of Object.values(c.mods ?? {})) { if (!v || typeof v !== 'object') continue; if (v.held?.[me.id]) held += v.held[me.id]; if (Array.isArray(v.balls)) for (const b of v.balls) if (!b.pond) ev.push(b); }
    const goBank = held > 0 || pocket >= cap || (me.one);
    if (goBank) {
      let best = returns()[0], bd = 1e9; for (const r of returns()) { const d = Math.hypot(r.x - me.x, r.z - me.z); if (d < bd) { bd = d; best = r; } }
      AP.note = 'bank'; if (steer(best.x, best.z, 1.2)) { busy = true; await __tap('X'); AP.stats.banks++; busy = false; }
      return;
    }
    let tgt = null, bd = 1e9;
    for (const b of ev) { const d = Math.hypot(b.x - me.x, b.z - me.z); if (d < bd) { bd = d; tgt = { x: b.x, z: b.z, id: b.id, ev: 1 }; } }
    if (!tgt) for (const b of rr.balls.values()) {
      if (!b.rest || b.sunk || b.kind === 'one' || b.creek) continue;
      if (b.z > -4) continue;   // not the mats
      const d = Math.hypot(b.x - me.x, b.z - me.z); if (d < bd) { bd = d; tgt = b; }
    }
    if (!tgt) { if (pocket > 0) { AP.note = 'bank (empty field)'; const r = returns()[0]; if (steer(r.x, r.z, 1.2)) { busy = true; await __tap('X'); busy = false; } } else { AP.note = 'nothing'; __stick(0, 0, 0, 0); } return; }
    AP.note = (tgt.ev ? 'event ' : 'ball ') + Math.round(bd) + ' m';
    if (steer(tgt.x, tgt.z, 1.0) && !storyUp()) { busy = true; await __tap('A'); AP.stats.picks++; busy = false; }
  }, 50);
})();
