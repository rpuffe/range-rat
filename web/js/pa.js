// The Corporate PA: a three-tone chime, a flat TTS voice, and an always-on caption card.
// No top-level DOM access; everything happens inside createPA().

// The voice speaks the full `line`; the card shows the `caption` (8 words or fewer: council round 7 #3, the one-text rule).
export const PA_LINES = {
  welcome: { line: 'Good morning, Range Rats. Corporate pays per ball. Corporate is always counting.', caption: 'Good morning, Range Rats. Corporate is counting.' },
  glow: { line: 'Last call. The balls are now glowing. This is a lighting decision, not a medical one.', caption: 'Last call. The balls are glowing.' },
  square: { line: 'Corporate has introduced a square ball. It does not roll. Neither does Corporate.', caption: 'A square ball. It does not roll.' },
  gold: { line: 'A gold ball has been hit. It belongs to Corporate. You may hold it briefly.', caption: 'A gold ball. It belongs to Corporate.' },
  lead: { line: 'Corporate has sourced a heavier ball. The pond is now a department.', caption: 'A heavier ball. The pond is a department.' },
  splitter: { line: 'A ball has divided into three. Corporate considers this growth.', caption: 'A ball divided into three. Growth.' },
  bouncy: { line: 'The members have requested a livelier ball. Please do not chase it. It can tell.', caption: 'A livelier ball. Do not chase it.' },
  gary: { line: 'Gary from Regional is on site. Look busy. Then be busy.', caption: 'Gary from Regional is on site.' },
  garyIntro: { line: 'This is Gary. Gary is the Regional Manager. Gary has a clipboard, and Gary is not afraid to use it.', caption: 'Gary. Regional Manager. He has a clipboard.' },   // owner playtest 3 §6.1: the drive-by, once ever
  mower: { line: 'Corporate has deployed an autonomous mower. It has been trained on your movements.', caption: 'A robot mower. Trained on your movements.' },
  treasure: { line: 'An item has been recovered from the pond. Corporate will be keeping it in a glass case. Corporate keeps everything in a glass case.', caption: 'Recovered from the pond. Now in a case.' },
  huddle: { line: 'Gary from Regional is satisfied. Gary has never been satisfied.', caption: 'Gary is satisfied. Gary is never satisfied.' },
  cart: { line: 'Corporate has issued you a vehicle. Corporate has not issued you a license.', caption: 'You have a cart. Not a license.' },
  jackpot: { line: 'A jackpot has occurred. Please do not get used to this.', caption: 'A jackpot. Do not get used to it.' },
  record: { line: 'A record shift. Congratulations. This is now the baseline.', caption: 'A record shift. Now the baseline.' },
  club: { line: 'Congratulations on your promotion to the Range Club. Your duties and parking are unchanged.', caption: 'Promoted to the Range Club. Parking unchanged.' },
  cctv: { line: "For your safety, Corporate has installed cameras. For Corporate's safety, they were always there.", caption: 'Cameras installed. They were always there.' },
  deck: { line: 'A guest has left the Upper Deck by the fastest available route. Corporate reminds you that beer is not a ladder.', caption: 'A guest fell. Beer is not a ladder.' },
  tiered: { line: 'Corporate has discovered the word experiential. Please be experiential.', caption: 'Please be experiential.' },
  fleet: { line: 'You now operate more carts than Corporate has parking. That is a you problem.', caption: 'More carts than parking. A you problem.' },
  stadium: { line: 'Your Ball Value is now on a jumbotron. Please wave. Please keep picking up.', caption: 'Your Ball Value is on a jumbotron.' },
  drones: { line: 'Corporate has deployed drones. They are not watching you. They are watching the balls. Mostly.', caption: 'Drones deployed. They watch the balls. Mostly.' },
  county: { line: 'Fairway Holdings has acquired the county. Please do not hit the county.', caption: 'Fairway Holdings owns the county now.' },
  orbital: { line: 'Earth has been fully retrieved. Please look up.', caption: 'Earth is fully retrieved. Please look up.' },
  eva: { line: 'A Range Rat has left the atmosphere. Corporate will hold their locker.', caption: 'A Range Rat has left the atmosphere.' },
  one: { line: 'Balls Outstanding: one. Ball Number One is coming home.', caption: 'Ball Number One is coming home.' },
  last: { line: 'There are no more balls. Corporate has no further use for a range. Every ball mattered.', caption: 'No more balls. Every ball mattered.' },
  endless: { line: 'Under New Management. The balls keep coming. This announcement was not approved by anyone.', caption: 'Under New Management. Approved by nobody.' },   // playthrough 4 C4: the first endless morning's one text
  statue: { line: 'Corporate has commissioned a statue. Of you. Reluctantly.', caption: 'A statue. Of you. Reluctantly.' },   // round 7 #9: the Owner's third project
};

const MIN_SHOW_MS = 4000;
const REPEAT_GUARD_MS = 10000;
const CHIME_MS = 700;      // the chime before the voice
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

// enqueue(item): the centre-text queue (say.js); item = { id, caption, secs, show(), hide() }.
export function createPA({ root, audio, enqueue = null } = {}) {
  let voiceEnabled = true;
  let volume = 1;     // settings PA volume, 0..1
  let playing = null; // { item, speakTimer }
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
      return CHIME_MS; // ms until speech
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

  // The card and the voice for one line. The centre-text queue (say.js) decides when: it calls show() when the
  // line's turn comes and hide() when its time is up or the bell's stamp preempts it. No queue of its own here.
  function show(item) {
    if (playing) end();
    if (build()) {
      textEl.textContent = '“' + item.caption + '”';
      card.classList.add('on');
    }
    duck(true);
    const lead = chime();
    playing = { item, speakTimer: null };
    if (lead) playing.speakTimer = setTimeout(() => speak(item.line), lead);
    else speak(item.line);
  }
  function end(item) {
    if (item && playing?.item !== item) return;
    if (playing) clearTimeout(playing.speakTimer);
    playing = null;
    if (card) card.classList.remove('on');
    duck(false);
  }
  // How long the card holds: the spoken line's length (the chime's lead included).
  const secsFor = line => (Math.max(MIN_SHOW_MS, line.split(/\s+/).filter(Boolean).length * 380 + 1000) + CHIME_MS) / 1000;

  function say(id) {
    const entry = PA_LINES[id];
    if (!entry) return false;
    const now = Date.now();
    const last = lastPlayed.get(id);
    if (last != null && now - last < REPEAT_GUARD_MS) return false;
    lastPlayed.set(id, now);
    const item = { id, line: entry.line, caption: entry.caption };
    if (enqueue) enqueue({ id, caption: item.caption, secs: secsFor(item.line), show: () => show(item), hide: () => end(item) });
    else show(item);   // no queue (tests, tools): play now
    return true;
  }

  function stop() {
    if (playing) end();
    try { if (synth) synth.cancel(); } catch { /* ignore */ }
  }

  return {
    say,
    stop,
    secsFor,
    get muted() { return isMuted() || !voiceEnabled; },
    setVolume(v) { volume = Math.min(1, Math.max(0, +v || 0)); },
    setVoiceEnabled(on) {
      voiceEnabled = !!on;
      if (!voiceEnabled) { try { if (synth) synth.cancel(); } catch { /* ignore */ } }
    },
  };
}
