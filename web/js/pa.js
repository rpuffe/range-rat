// The Corporate PA: a three-tone chime, a flat TTS voice, and an always-on caption card.
// No top-level DOM access; everything happens inside createPA().

export const PA_LINES = {
  welcome: 'Good morning, Range Rats. Corporate pays per ball. Corporate is always counting.',
  glow: 'Last call. The balls are now glowing. This is a lighting decision, not a medical one.',
  square: 'Corporate has introduced a square ball. It does not roll. Neither does Corporate.',
  gold: 'A gold ball has been hit. It belongs to Corporate. You may hold it briefly.',
  lead: 'Corporate has sourced a heavier ball. The pond is now a department.',
  splitter: 'A ball has divided into three. Corporate considers this growth.',
  bouncy: 'The members have requested a livelier ball. Please do not chase it. It can tell.',
  gary: 'Gary from Regional is on site. Look busy. Then be busy.',
  mower: 'Corporate has deployed an autonomous mower. It has been trained on your movements.',
  treasure: 'An item has been recovered from the pond. Corporate will be keeping it in a glass case. Corporate keeps everything in a glass case.',
  huddle: 'Gary from Regional is satisfied. Gary has never been satisfied.',
  cart: 'Corporate has issued you a vehicle. Corporate has not issued you a license.',
  jackpot: 'A jackpot has occurred. Please do not get used to this.',
  record: 'A record shift. Congratulations. This is now the baseline.',
  club: 'Congratulations on your promotion to the Range Club. Your duties and parking are unchanged.',
  cctv: "For your safety, Corporate has installed cameras. For Corporate's safety, they were always there.",
  deck: 'A guest has left the Upper Deck by the fastest available route. Corporate reminds you that beer is not a ladder.',
  tiered: 'Corporate has discovered the word experiential. Please be experiential.',
  fleet: 'You now operate more carts than Corporate has parking. That is a you problem.',
  stadium: 'Your Ball Value is now on a jumbotron. Please wave. Please keep picking up.',
  drones: 'Corporate has deployed drones. They are not watching you. They are watching the balls. Mostly.',
  county: 'Fairway Holdings has acquired the county. Please do not hit the county.',
  orbital: 'Earth has been fully retrieved. Please look up.',
  eva: 'A Range Rat has left the atmosphere. Corporate will hold their locker.',
  one: 'Balls Outstanding: one. Ball Number One is coming home.',
  last: 'There are no more balls. Corporate has no further use for a range. Every ball mattered.',
  endless: 'Balls Outstanding: one. This announcement was not approved by anyone.',
};

const MIN_SHOW_MS = 4000;
const REPEAT_GUARD_MS = 10000;
const MAX_QUEUE = 2;
const CSS_ID = 'pa-style';

const CSS = `
#pa-card { position: fixed; bottom: 20%; left: 50%; transform: translate(-50%, 0.6em); width: min(calc(100vw - 32px), 34em);
  display: flex; gap: 0.9em; align-items: center; box-sizing: border-box;
  background: #fbf6e8; color: #2a2418; border-radius: 0.3em; padding: 0.7em 1.1em; box-shadow: 0 0.4em 1.5em #0008;
  font-family: "Courier New", ui-monospace, monospace; pointer-events: none; z-index: 60;
  opacity: 0; transition: opacity 0.25s ease, transform 0.25s ease; }
#pa-card.on { opacity: 1; transform: translate(-50%, 0); }
#pa-card canvas { flex: none; width: 3.2em; height: 3.2em; }
#pa-card .pa-body { min-width: 0; }
#pa-card .pa-head { font-size: 0.7em; letter-spacing: 0.08em; border-bottom: 2px solid #2a2418; padding-bottom: 0.25em; }
#pa-card .pa-text { margin: 0.4em 0 0; font-weight: 600; font-size: clamp(1em, 2.4vh, 1.4em); line-height: 1.3; }
`;

function drawSeal(canvas) {
  const g = canvas.getContext('2d');
  if (!g) return;
  const S = 96;
  canvas.width = S; canvas.height = S;
  const cx = 48, cy = 36, r = 28;
  // tie behind the ball's chin
  g.fillStyle = '#b3261e';
  g.beginPath(); // knot
  g.moveTo(cx - 7, cy + r - 4); g.lineTo(cx + 7, cy + r - 4); g.lineTo(cx + 5, cy + r + 8); g.lineTo(cx - 5, cy + r + 8); g.closePath(); g.fill();
  g.beginPath(); // blade
  g.moveTo(cx - 5, cy + r + 8); g.lineTo(cx + 5, cy + r + 8); g.lineTo(cx + 10, S - 4); g.lineTo(cx, S - 1); g.lineTo(cx - 10, S - 4); g.closePath(); g.fill();
  g.fillStyle = '#7d1812';
  g.fillRect(cx - 1, cy + r + 8, 2, S - cy - r - 12);
  // ball
  const grad = g.createRadialGradient(cx - 9, cy - 10, 3, cx, cy, r);
  grad.addColorStop(0, '#ffffff'); grad.addColorStop(1, '#d9d4c4');
  g.fillStyle = grad;
  g.strokeStyle = '#2a2418'; g.lineWidth = 2.5;
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); g.stroke();
  // dimples
  g.fillStyle = 'rgba(42,36,24,0.22)';
  for (const [dx, dy] of [[-12, -12], [2, -16], [14, -8], [-16, 2], [-3, -3], [10, 7], [-9, 13], [4, 17], [18, 8]]) {
    g.beginPath(); g.arc(cx + dx, cy + dy, 2.4, 0, Math.PI * 2); g.fill();
  }
  // face: dimples (the cheeks), flat mouth
  g.fillStyle = '#2a2418';
  g.beginPath(); g.arc(cx - 8, cy - 2, 2.2, 0, Math.PI * 2); g.arc(cx + 8, cy - 2, 2.2, 0, Math.PI * 2); g.fill();
  g.fillRect(cx - 6, cy + 10, 12, 2);
}

export function createPA({ root, audio } = {}) {
  let voiceEnabled = true;
  let volume = 1;     // settings PA volume, 0..1
  let queue = [];
  let playing = null; // { timer }
  let lastPlayed = new Map(); // id -> ms
  let voices = [];
  let card = null, textEl = null, built = false;

  const synth = (typeof window !== 'undefined' && window.speechSynthesis) || null;
  const Utter = (typeof window !== 'undefined' && window.SpeechSynthesisUtterance) || null;

  function loadVoices() {
    try { voices = synth ? synth.getVoices() || [] : []; } catch { voices = []; }
  }
  if (synth) {
    loadVoices();
    try {
      if (synth.addEventListener) synth.addEventListener('voiceschanged', loadVoices);
      else synth.onvoiceschanged = loadVoices;
    } catch { /* ignore */ }
  }

  function pickVoice() {
    if (!voices.length) loadVoices();
    const en = voices.filter((v) => /^en([-_]|$)/i.test(v.lang || ''));
    const pref = en.filter((v) => /^en[-_](US|GB)/i.test(v.lang));
    const pool = pref.length ? pref : en;
    return pool.find((v) => v.localService && /David|Mark|George|Daniel|Guy|Alex/.test(v.name))
      || pool.find((v) => v.localService)
      || pool[0] || null;
  }

  function build() {
    if (built) return !!card;
    built = true;
    if (typeof document === 'undefined') return false;
    const host = root || document.body;
    if (!host) return false;
    if (!document.getElementById(CSS_ID)) {
      const st = document.createElement('style');
      st.id = CSS_ID; st.textContent = CSS;
      document.head.appendChild(st);
    }
    card = document.createElement('div');
    card.id = 'pa-card';
    card.setAttribute('role', 'status');
    card.setAttribute('aria-live', 'polite');
    const cv = document.createElement('canvas');
    cv.setAttribute('aria-hidden', 'true');
    drawSeal(cv);
    const body = document.createElement('div');
    body.className = 'pa-body';
    const head = document.createElement('div');
    head.className = 'pa-head';
    head.textContent = 'FAIRWAY HOLDINGS INTERNATIONAL · CORPORATE PA';
    textEl = document.createElement('p');
    textEl.className = 'pa-text';
    body.append(head, textEl);
    card.append(cv, body);
    host.appendChild(card);
    return true;
  }

  function isMuted() {
    try {
      const h = audio && audio();
      if (!h) return false;
      const m = h.isMuted;
      return typeof m === 'function' ? !!m() : !!m;
    } catch { return false; }
  }

  function chime() {
    try {
      const h = audio && audio();
      if (!h || !h.ctx || isMuted()) return 0;
      const { ctx } = h;
      const dest = ctx.createGain(); dest.gain.value = volume; dest.connect(h.pa || h.master || ctx.destination);
      if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
      const t0 = ctx.currentTime + 0.02;
      // 60 ms bandpass mic-click
      const n = Math.max(1, Math.floor(ctx.sampleRate * 0.06));
      const buf = ctx.createBuffer(1, n, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const click = ctx.createBufferSource();
      click.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 1.2;
      const cg = ctx.createGain(); cg.gain.value = 0.25;
      click.connect(bp); bp.connect(cg); cg.connect(dest);
      click.start(t0);
      // tannoy ring: short feedback delay
      const bus = ctx.createGain(); bus.gain.value = 1;
      const delay = ctx.createDelay(0.5); delay.delayTime.value = 0.13;
      const fb = ctx.createGain(); fb.gain.value = 0.35;
      const wet = ctx.createGain(); wet.gain.value = 0.4;
      bus.connect(dest); bus.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(dest);
      // G5, E5, C5, 180 ms each, triangle
      [783.99, 659.25, 523.25].forEach((f, i) => {
        const t = t0 + 0.08 + i * 0.18;
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        o.connect(g); g.connect(bus);
        o.start(t); o.stop(t + 0.2);
      });
      return 700; // ms until speech
    } catch { return 0; }
  }

  function speak(text) {
    if (!synth || !Utter || !voiceEnabled || isMuted()) return;
    loadVoices();
    if (!voices.length) return; // captions only
    try {
      synth.cancel();
      const u = new Utter(text);
      const v = pickVoice();
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-US';
      u.rate = 0.92; u.pitch = 0.9; u.volume = 0.9 * volume;
      synth.speak(u);
    } catch { /* captions still show */ }
  }

  // Duck SFX and ambience while the PA speaks (the audio handle's duck(on); a no-op without it).
  function duck(on) {
    try { const h = audio && audio(); if (h && typeof h.duck === 'function') h.duck(on); } catch { /* ignore */ }
  }

  function finish() {
    if (playing) { clearTimeout(playing.timer); clearTimeout(playing.speakTimer); }
    playing = null;
    if (card) card.classList.remove('on');
    if (!queue.length) duck(false);
    const next = queue.shift();
    if (next) setTimeout(() => { if (!playing) play(next); }, 300);
  }

  function play(item) {
    const words = item.text.split(/\s+/).filter(Boolean).length;
    const ms = Math.max(MIN_SHOW_MS, words * 380 + 1000);
    const ok = build();
    if (ok) {
      textEl.textContent = '“' + item.text + '”';
      card.classList.add('on');
    }
    duck(true);
    const lead = chime();
    playing = { timer: setTimeout(finish, ms + lead), speakTimer: null };
    if (lead) playing.speakTimer = setTimeout(() => speak(item.text), lead);
    else speak(item.text);
  }

  function say(id, vars = {}) {
    let text = PA_LINES[id];
    if (!text) return false;
    text = text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
    const now = Date.now();
    const last = lastPlayed.get(id);
    if (last != null && now - last < REPEAT_GUARD_MS) return false;
    lastPlayed.set(id, now);
    const item = { id, text };
    if (playing) {
      queue.push(item);
      while (queue.length > MAX_QUEUE) queue.shift();
    } else play(item);
    return true;
  }

  function stop() {
    queue = [];
    if (playing) { clearTimeout(playing.timer); clearTimeout(playing.speakTimer); playing = null; }
    if (card) card.classList.remove('on');
    duck(false);
    try { if (synth) synth.cancel(); } catch { /* ignore */ }
  }

  return {
    say,
    stop,
    get muted() { return isMuted() || !voiceEnabled; },
    setVolume(v) { volume = Math.min(1, Math.max(0, +v || 0)); },
    setVoiceEnabled(on) {
      voiceEnabled = !!on;
      if (!voiceEnabled) { try { if (synth) synth.cancel(); } catch { /* ignore */ } }
    },
  };
}
