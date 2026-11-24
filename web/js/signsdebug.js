// ?signs: a debug view for sign orientation. Loaded by main.js only when the URL has ?signs, so none of this is
// on the normal render path. Each second it walks the scene for meshes tagged by signs.js tagSign(), works out
// each one's readable world normal from its matrixWorld, and compares it (and its position) with the table.
//   green arrow  = the table's facing, and the mesh agrees
//   red arrow    = the mesh disagrees (a cyan arrow shows the mesh's actual facing); logged with console.warn
//   yellow arrow = the table says this sign is up at this venue but no tagged mesh is showing
// It also logs untracked text planes (a PlaneGeometry carrying a CanvasTexture with no sign tag), so a new sign that
// never made it into signs.js shows up too. window.signsReport() returns the latest results.
import * as THREE from 'three';
import { SIGN_BY_ID, signsAt } from './signs.js';

const MAX_DEG = 5, MAX_POS = 0.6;

export function installSignDebug({ scene, venue = () => 0 }) {
  const group = new THREE.Group(); group.name = 'signs-debug';
  scene.add(group);
  const warned = new Set();
  let report = [];
  const n = new THREE.Vector3(), p = new THREE.Vector3(), nm = new THREE.Matrix3();
  const shown = o => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };
  const warn = (key, ...msg) => { if (!warned.has(key)) { warned.add(key); console.warn('[signs]', ...msg); } };

  function arrow(pos, dir, color, len = 2.2) {
    const a = new THREE.ArrowHelper(new THREE.Vector3(dir.x, dir.y, dir.z).normalize(), new THREE.Vector3(pos.x, pos.y, pos.z), len, color, 0.5, 0.3);
    a.traverse(o => { if (o.material) { o.material.depthTest = false; o.material.transparent = true; } o.renderOrder = 20; });
    group.add(a);
  }

  function check() {
    for (const c of [...group.children]) { group.remove(c); c.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); }
    scene.updateMatrixWorld();
    const seen = new Map(); report = [];
    scene.traverse(o => {
      if (!o.isMesh || o.parent === group) return;
      const id = o.userData.sign;
      if (!id) {
        const map = o.material?.map;   // a tiled pattern (the nets) is not a sign; userData.notSign opts out
        if (o.geometry?.type === 'PlaneGeometry' && map?.isCanvasTexture && map.wrapS !== THREE.RepeatWrapping && !o.userData.notSign && shown(o))
          warn('untracked:' + o.uuid, 'untracked text plane (tag it and add it to signs.js):', o.name || o.uuid, o.getWorldPosition(p).toArray().map(v => +v.toFixed(2)));
        return;
      }
      if (!shown(o)) return;
      const s = SIGN_BY_ID[id];
      if (!s) { warn('unknown:' + id, `mesh tagged "${id}" is not in signs.js`); return; }
      const ln = o.userData.signNormal ?? { x: 0, y: 0, z: 1 };
      n.set(ln.x, ln.y, ln.z).applyMatrix3(nm.getNormalMatrix(o.matrixWorld)).normalize();
      o.getWorldPosition(p);
      const deg = THREE.MathUtils.radToDeg(Math.acos(Math.max(-1, Math.min(1, n.x * s.normal.x + n.y * s.normal.y + n.z * s.normal.z))));
      const off = Math.hypot(p.x - s.pos.x, p.y - s.pos.y, p.z - s.pos.z);
      const ok = deg <= MAX_DEG && off <= MAX_POS;
      const double = o.material?.side === THREE.DoubleSide;
      seen.set(id, ok);
      report.push({ id, ok, deg: +deg.toFixed(1), off: +off.toFixed(2), doubleSide: double, normal: n.toArray().map(v => +v.toFixed(2)) });
      if (!ok) {
        warn(`bad:${id}:${Math.round(deg)}:${Math.round(off * 10)}`, `${id}: mesh faces ${n.toArray().map(v => v.toFixed(2))} at`, p.toArray().map(v => +v.toFixed(2)),
          `but signs.js says ${JSON.stringify(s.normal)} at ${JSON.stringify(s.pos)} (${deg.toFixed(1)} deg, ${off.toFixed(2)} m off)`);
        arrow(p, n, 0x33e0ff);
      }
    });
    for (const s of signsAt(venue())) {
      const ok = seen.get(s.id);
      arrow(s.pos, s.normal, ok === true ? 0x3ad45a : ok === false ? 0xff3030 : 0xffd400, s.id.startsWith('mat.') ? 0.8 : 2.2);
      if (ok === undefined) report.push({ id: s.id, ok: false, missing: true });
    }
  }

  check();
  setInterval(check, 1000);      // venues build lazily, so look again
  window.signsReport = () => report;
  window.signsDebug = { scene, check, group };
  console.info('[signs] debug view on: green = agrees with signs.js, red = disagrees (cyan = actual), yellow = no mesh. signsReport() for details.');
  return { check, group };
}
