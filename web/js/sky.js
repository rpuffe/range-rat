// Golden-hour sky and sun, copied from Golden Hour Golf (web/js/world.js).
// The sun position follows the time of day of the current shift.

import * as THREE from 'three';

// ---------------------------------------------------------------- sky
const SKY_VS = `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`;
const SKY_FS = `
uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunCol;
varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 c = mix(horizon, mid, smoothstep(-0.02, 0.18, h));
  c = mix(c, top, smoothstep(0.18, 0.75, h));
  float s = max(dot(d, normalize(sunDir)), 0.0);
  c += sunCol * (pow(s, 900.0) * 3.0 + pow(s, 24.0) * 0.45 + pow(s, 4.0) * 0.18);
  if (h < 0.0) c = mix(c, horizon * 0.85, smoothstep(0.0, -0.1, h));
  gl_FragColor = vec4(c, 1.0);
}`;

// The light through one shift, opening to sunset. Golf's palette, re-keyed
// from "per hole" to "per moment of the day"; lightAt blends between keys.
const SHIFT_LIGHT = [
  { k: 0.00, elev: 38, az: -60, top: 0x4a74c4, mid: 0xa9c2e6, horizon: 0xf3dcb8, sun: 0xfff1d6, fog: 0xdfe3e4, sunI: 3.0, hemi: 1.05 },
  { k: 0.45, elev: 26, az: -35, top: 0x3d5fa8, mid: 0x9fb4d8, horizon: 0xffd29a, sun: 0xffe2a8, fog: 0xe9c99b, sunI: 3.0, hemi: 1.0 },
  { k: 0.75, elev: 11, az: 10,  top: 0x34428e, mid: 0xc48fb0, horizon: 0xffae76, sun: 0xffbf7e, fog: 0xe0a88c, sunI: 2.8, hemi: 1.15 },
  { k: 0.92, elev: 5,  az: 30,  top: 0x26235f, mid: 0x9b5f92, horizon: 0xff8650, sun: 0xff9a56, fog: 0xc07f7d, sunI: 2.4, hemi: 1.22 },
  { k: 1.00, elev: 2,  az: 35,  top: 0x1e1c58, mid: 0x7d4f8a, horizon: 0xff7440, sun: 0xff8a4a, fog: 0xa86a78, sunI: 1.9, hemi: 1.2 },
];
const WHITE = new THREE.Color(0xffffff);
const COLOR_KEYS = ['top', 'mid', 'horizon', 'sun', 'fog'];

export function lightAt(k) {
  k = Math.max(0, Math.min(1, k));
  let i = 0;
  while (i < SHIFT_LIGHT.length - 2 && k > SHIFT_LIGHT[i + 1].k) i++;
  const A = SHIFT_LIGHT[i], B = SHIFT_LIGHT[i + 1];
  const t = (k - A.k) / (B.k - A.k);
  const out = {};
  for (const n of ['elev', 'az', 'sunI', 'hemi']) out[n] = A[n] + (B[n] - A[n]) * t;
  for (const n of COLOR_KEYS) out[n] = new THREE.Color(A[n]).lerp(new THREE.Color(B[n]), t);
  return out;
}

export function createSky(scene) {
  const uni = {
    top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, horizon: { value: new THREE.Color() },
    sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() },
  };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 16),
    new THREE.ShaderMaterial({ uniforms: uni, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false }));
  sky.frustumCulled = false; sky.renderOrder = -1;
  scene.add(sky);
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 1; sc.far = 400;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  scene.add(sun); scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x4a3a20, 1);
  scene.add(hemi);
  scene.fog = new THREE.Fog(0xe9c99b, 120, 900);
  const sunDir = new THREE.Vector3();
  return {
    sky, sun, hemi, sunDir,
    // k is how far through the shift we are: 0 = opening, 1 = sunset.
    setTime(k) {
      const L = lightAt(k);
      const e = L.elev * Math.PI / 180, a = L.az * Math.PI / 180;
      sunDir.set(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)).normalize();
      uni.top.value.copy(L.top); uni.mid.value.copy(L.mid); uni.horizon.value.copy(L.horizon);
      uni.sunDir.value.copy(sunDir); uni.sunCol.value.copy(L.sun);
      sun.color.copy(L.sun); sun.intensity = L.sunI; hemi.intensity = L.hemi;
      hemi.color.copy(L.mid).lerp(WHITE, 0.35); hemi.groundColor.set(0x5a4a30); scene.fog.color.copy(L.fog);
      return L;
    },
    follow(p) { // keep the shadow frustum around the action
      sun.position.set(p.x + sunDir.x * 150, p.y + sunDir.y * 150, p.z + sunDir.z * 150);
      sun.target.position.copy(p);
    },
  };
}
