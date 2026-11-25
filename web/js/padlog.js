// Owner playtest 3 §7.3: the ?padlog overlay (debug only, bottom-left). On every change it prints the pad
// buttons held, the menu root, the focused element, and whether the page is in full screen / pointer lock,
// so whatever kicks a pad player out of full screen shows itself on the console.
const NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'L3', 'R3', 'Up', 'Down', 'Left', 'Right'];

const describe = el => !el ? '-' : el.id ? `${el.tagName.toLowerCase()}#${el.id}` : el.dataset?.buy ? `buy:${el.dataset.buy}` : el.tagName?.toLowerCase() ?? '?';

// Pure: one line of state.
export function padlogLine({ down = [], root = null, active = null, fullscreen = null, lock = null }) {
  const held = down.map((d, i) => (d ? NAMES[i] ?? 'b' + i : null)).filter(Boolean).join('+') || '-';
  return `pad ${held} · menu ${root?.id ?? '-'} · focus ${describe(active)} · fs ${fullscreen ? describe(fullscreen) : 'OFF'} · lock ${lock ? describe(lock) : 'off'}`;
}

export function createPadlog(on) {
  if (!on) return { update() {} };
  const el = document.createElement('pre');
  el.id = 'padlog';
  el.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:999;margin:0;max-width:60vw;font:11px/1.35 monospace;color:#cfe;background:#000b;padding:4px 6px;pointer-events:none;white-space:pre-wrap';
  document.body.appendChild(el);
  const lines = [];
  let lastLine = '';
  return {
    update(state) {
      const line = padlogLine(state);
      if (line === lastLine) return;
      lastLine = line;
      lines.push(`${(performance.now() / 1000).toFixed(1)}s ${line}`);
      while (lines.length > 8) lines.shift();
      el.textContent = lines.join('\n');
    },
  };
}
