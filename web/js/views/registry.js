// The venue views' runner (pure: no THREE, no DOM), split from views/index.js so node tests can load it
// without the views themselves (which import three). The contract is documented in views/index.js.

const venueOf = s => (s?.endless ? 5 : s?.venue ?? 0);

// The views for one page: lazily created, shown and hidden as the venue moves, and called in order.
export function createViews(ctx, views = []) {
  const list = views.map(v => ({ v, inst: null, on: false }));
  const live = () => list.filter(e => e.on && e.inst);

  // Bring views up (or down) to this venue. Called with every snapshot.
  function sync(s) {
    const venue = venueOf(s);
    for (const e of list) {
      const want = venue >= e.v.venue;
      if (want && !e.inst) e.inst = e.v.create(ctx) ?? {};
      if (e.inst && want !== e.on) { e.on = want; e.inst.show?.(want); }
    }
  }
  const first = (name, ...a) => { for (const e of live()) { const r = e.inst[name]?.(...a); if (r != null && r !== false) return r; } return null; };

  return {
    onSnapshot(s) { sync(s); for (const e of live()) e.inst.onSnapshot?.(s, s.mods?.[e.v.id]); },
    onEvent(e) { for (const x of live()) x.inst.onEvent?.(e); },
    tick(dt, t) { for (const e of live()) e.inst.tick?.(dt, t); },
    aim(input) { for (const e of live()) e.inst.aim?.(input); },   // round 6 #4: the swing's aim at a crew bay, or null
    prompt: (btn, ibtn) => first('prompt', btn, ibtn),
    use: fromPad => first('use', fromPad) === true,
    unlatch: () => first('unlatch') === true,
    lockLook: () => first('lockLook') === true,
    interact: () => first('interact') === true,
    clamp: me => first('clamp', me) === true,
    speedMul: me => first('speedMul', me),
    capturing: () => first('capturing') === true,
    camera: (cam, dt) => first('camera', cam, dt) === true,
    // The Board's slogan: the newest venue's view speaks first (round 7: the Orbital's CLEAR THE SKY and the
    // Stadium's TWO-MINUTE WARNING outrank the Upper Deck's standing sign).
    banner(s) { for (const e of live().reverse()) { const r = e.inst.banner?.(s); if (r != null && r !== false) return r; } return null; },
    amb(s) { const out = {}; for (const e of live()) Object.assign(out, e.inst.amb?.(s) ?? {}); return out; },
    reportLines(r) { const out = []; for (const e of live()) out.push(...(e.inst.reportLines?.(r) ?? [])); return out; },
    get count() { return live().length; },
  };
}
