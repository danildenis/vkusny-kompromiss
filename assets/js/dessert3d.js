// 3D-модели корпусных десертов: форма фрукта, бархатный корпус и слои внутри.
// Каждый десерт собран из двух половин; каждая половина — из вложенных слоёв
// (корпус → мусс → начинка → ядро), у каждого слоя есть свой срез.
import * as THREE from 'three';

const PI = Math.PI, TAU = PI * 2;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/* ---------- шум ---------- */
const P = new Uint8Array(512);
(() => {
  const p = [...Array(256).keys()]; let s = 1337;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) P[i] = p[i & 255];
})();
const fade = t => t * t * t * (t * (t * 6 - 15) + 10), lerp = (a, b, t) => a + (b - a) * t;
const grad = (h, x, y, z) => { const u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14 ? x : z); return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); };
export function noise(x, y, z) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = fade(x), v = fade(y), w = fade(z);
  const A = P[X] + Y, AA = P[A] + Z, AB = P[A + 1] + Z, B = P[X + 1] + Y, BA = P[B] + Z, BB = P[B + 1] + Z;
  return lerp(lerp(lerp(grad(P[AA], x, y, z), grad(P[BA], x - 1, y, z), u), lerp(grad(P[AB], x, y - 1, z), grad(P[BB], x - 1, y - 1, z), u), v),
    lerp(lerp(grad(P[AA + 1], x, y, z - 1), grad(P[BA + 1], x - 1, y, z - 1), u), lerp(grad(P[AB + 1], x, y - 1, z - 1), grad(P[BB + 1], x - 1, y - 1, z - 1), u), v), w);
}
export const fbm = (x, y, z, o = 4) => { let s = 0, a = .5, f = 1; for (let i = 0; i < o; i++) { s += a * noise(x * f, y * f, z * f); a *= .5; f *= 2; } return s; };

/* ---------- формы ---------- */
const sp = (v, e) => Math.pow(Math.max(0, Math.sin(PI * v)), e);
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const FIB = (() => {
  const n = 70, pts = [], ga = PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) { const y = 1 - 2 * (i + .5) / n, r = Math.sqrt(1 - y * y), t = ga * i; pts.push([Math.cos(t) * r, y, Math.sin(t) * r]); }
  return pts;
})();
function drupe(s) {
  let best = -1;
  for (const p of FIB) { const d = s[0] * p[0] + s[1] * p[1] + s[2] * p[2]; if (d > best) best = d; }
  const a = Math.acos(Math.min(1, best));
  return Math.sqrt(Math.max(0, 1 - (a / .25) ** 2));
}
const coffeeGroove = (v, phi) => {
  const g = angDiff(phi, PI / 2 + .2 * Math.sin(TAU * v));
  return Math.exp(-((g / .15) ** 2)) * smooth(.05, .22, v) * smooth(.05, .22, 1 - v);
};

// v — от нижнего полюса (0) к верхнему (1), phi — угол вокруг длинной оси Y.
// Срез проходит по плоскости x = 0 (phi = 0 и phi = PI).
export const SHAPES = {
  mango: { L: 1, R: .64, ax: .74, prof: v => sp(v, .78) * (.8 + .32 * v), cz: v => .5 * (v - .55) ** 2 - .06 + .14 * (1 - v) ** 5,
    mod: (v, phi, d, s) => d ? 1 + .003 * noise(s[0] * 7, s[1] * 7, s[2] * 7) : 1 },
  banana: { L: 1.32, R: .3, prof: v => sp(v, .5) * (.9 + .14 * Math.sin(PI * v)) * (1 - .55 * smooth(.83, 1, v)),
    cz: v => .6 * Math.sin(PI * v) - .3, mod: (v, phi) => 1 + .05 * Math.cos(5 * phi) },
  coffee: { L: .9, R: .62, ax: .52, prof: v => sp(v, .6), mod: (v, phi) => 1 - .3 * coffeeGroove(v, phi) },
  blueberry: { L: .5, R: .6, prof: v => sp(v, 1),
    y: (v, phi) => -.5 * Math.cos(PI * v) - .1 * smooth(.84, 1, v) + .025 * Math.cos(5 * phi) * Math.exp(-(((v - .9) / .04) ** 2)) },
  raspberry: { L: .62, R: .52, prof: v => sp(v, .85) * (.82 + .3 * v), y: v => -.62 * Math.cos(PI * v) - .12 * smooth(.85, 1, v),
    mod: (v, phi, d, s) => d ? .97 + .085 * drupe(s) : 1 },
  lemon: { L: .86, R: .56, prof: v => sp(v, .85), y: v => { const c = Math.cos(PI * v); return -c * (.86 + .16 * Math.abs(c) ** 16); },
    mod: (v, phi, d, s) => d ? 1 + .01 * noise(s[0] * 28, s[1] * 28, s[2] * 28) : 1 },
  pistachio: { L: 1, R: .42, ax: .85, prof: v => sp(v, .72) * (1 - .22 * smooth(.55, 1, v)) * (.9 + .1 * Math.sin(PI * v)), cz: v => .14 * Math.sin(PI * v) - .07 },
  popcorn: { L: .6, R: .62, prof: v => sp(v, 1),
    mod: (v, phi, d, s) => 1 + .36 * fbm(s[0] * 2.1 + 2, s[1] * 2.1, s[2] * 2.1 + 5, 2) + (d ? .008 * noise(s[0] * 10, s[1] * 10, s[2] * 10) : 0) },
  gum: { L: .57, R: .58, prof: v => sp(v, 1) },
};

/* ---------- окраска корпуса ---------- */
const C = h => new THREE.Color(h);
const PAL = {
  mango: [C('#EFBE1E'), C('#F78C16'), C('#CC2B22')],
  banana: [C('#F3D24B'), C('#C9C552'), C('#6B4520'), C('#3B2614')],
  coffee: [C('#8E5230'), C('#3E2112'), C('#A9643C')],
  blueberry: [C('#2F3C72'), C('#7383B5'), C('#1D2040')],
  raspberry: [C('#D8456D'), C('#EE7C98'), C('#9E2448')],
  lemon: [C('#FFE234'), C('#E2DA44'), C('#FFD21F')],
  pistachio: [C('#8CAF4F'), C('#B6CC72'), C('#8B5E55')],
  popcorn: [C('#FFF4DA'), C('#F4C063'), C('#E8A94A')],
  gum: [C('#FF9CC4'), C('#FFFFFF'), C('#F27AAE')],
};
const MANGO_G = C('#9DAA3A');
const COLORS = {
  mango(o, v, phi, p, s) {
    const [Y, O, R] = PAL.mango;
    o.copy(Y).lerp(O, clamp(smooth(.25, .95, v) + .15 * fbm(s[0] * 3, s[1] * 3, s[2] * 3)));
    o.lerp(MANGO_G, smooth(.3, .02, v) * .55);
    const b = clamp(smooth(.1, .8, .55 * Math.cos(phi - PI / 2 - .5) + .45) * smooth(.3, 1, v) + .3 * fbm(s[0] * 2.2, s[1] * 2.2, s[2] * 2.2));
    o.lerp(R, b * .95);
  },
  banana(o, v, phi, p, s) {
    const [Y, G, B, D] = PAL.banana;
    o.copy(Y).lerp(G, smooth(.76, .95, v) * .7);
    const n = noise(p.x * 9 + 3, p.y * 9 + 1, p.z * 9 + 2) + .25 * noise(p.x * 30, p.y * 30, p.z * 30);
    o.lerp(B, smooth(.3, .4, n) * .85);
    o.lerp(D, Math.max(smooth(.05, .0, v), smooth(.965, .995, v)));
  },
  coffee(o, v, phi, p, s) {
    const [B, D, L] = PAL.coffee;
    o.copy(B).lerp(L, clamp(.5 + fbm(s[0] * 3, s[1] * 3, s[2] * 3)) * .5).lerp(D, coffeeGroove(v, phi) * .9);
  },
  blueberry(o, v, phi, p, s) {
    const [B, L, D] = PAL.blueberry;
    const star = smooth(.86, .93, v + .025 * Math.cos(5 * phi));
    o.copy(B).lerp(L, smooth(-.1, .5, fbm(s[0] * 3, s[1] * 3, s[2] * 3)) * .55).lerp(D, star * .85);
  },
  raspberry(o, v, phi, p, s) {
    const [B, L, D] = PAL.raspberry; const d = drupe(s);
    o.copy(D).lerp(B, smooth(.05, .5, d)).lerp(L, smooth(.6, 1, d) * .6);
  },
  lemon(o, v, phi, p, s) {
    const [Y, G, D] = PAL.lemon; const c = Math.abs(Math.cos(PI * v));
    o.copy(Y).lerp(D, clamp(.5 + fbm(s[0] * 4, s[1] * 4, s[2] * 4)) * .35).lerp(G, smooth(.85, .99, c) * .7);
  },
  pistachio(o, v, phi, p, s) {
    const [G, L, K] = PAL.pistachio;
    o.copy(G).lerp(L, clamp(.5 + fbm(s[0] * 3, s[1] * 3, s[2] * 3)) * .6);
    o.lerp(K, smooth(.14, .32, fbm(s[0] * 2.2 + 7, s[1] * 2.2, s[2] * 2.2)) * .55);
  },
  popcorn(o, v, phi, p, s) {
    const [W, Cc, D] = PAL.popcorn; const n = fbm(s[0] * 2 + 9, s[1] * 2, s[2] * 2, 3);
    o.copy(W).lerp(Cc, smooth(.04, .22, n) * .85).lerp(D, smooth(.28, .42, n) * .35);
  },
  gum(o, v, phi, p, s) {
    const [B, W, D] = PAL.gum;
    o.copy(B).lerp(D, clamp(.5 + fbm(s[0] * 3, s[1] * 3, s[2] * 3)) * .4).lerp(W, smooth(.55, .62, noise(s[0] * 40, s[1] * 40, s[2] * 40)) * .8);
  },
};

/* ---------- геометрия ---------- */
function evalPoint(shape, L, v, phi, detail, out) {
  const sv = Math.sin(PI * v), s = [sv * Math.sin(phi), -Math.cos(PI * v), sv * Math.cos(phi)];
  const y = shape.y ? shape.y(v, phi) : -shape.L * Math.cos(PI * v);
  let r = shape.R * shape.prof(v);
  if (shape.mod) r *= shape.mod(v, phi, detail, s);
  r *= L.sr;
  // для внутренних слоёв изгиб берём на той же высоте, что и у корпуса, иначе слой вылезает наружу
  const vc = L.sy < 1 && !shape.y ? Math.acos(clamp(Math.cos(PI * v) * L.sy, -1, 1)) / PI : v;
  const cz = shape.cz ? shape.cz(vc) : 0;
  out.set(r * Math.sin(phi) * (shape.ax ?? 1), y * L.sy, cz + r * Math.cos(phi) * (shape.az ?? 1));
  return s;
}

function surfaceGeo(shape, L, phi0, nv, np, detail, colorFn) {
  const N = (nv + 1) * (np + 1);
  const pos = new Float32Array(N * 3), nor = new Float32Array(N * 3), uv = new Float32Array(N * 2);
  const col = colorFn ? new Float32Array(N * 3) : null;
  const p = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), d = new THREE.Vector3();
  const tv = new THREE.Vector3(), tp = new THREE.Vector3(), n = new THREE.Vector3(), cc = new THREE.Color();
  const e = 1e-3;
  let k = 0;
  for (let i = 0; i <= nv; i++) {
    const v = i / nv;
    for (let j = 0; j <= np; j++, k++) {
      const phi = phi0 + PI * j / np;
      const s = evalPoint(shape, L, v, phi, detail, p);
      const v1 = clamp(v, 2e-3, 1 - 2e-3);
      evalPoint(shape, L, v1 + e, phi, detail, a); evalPoint(shape, L, v1 - e, phi, detail, b);
      evalPoint(shape, L, v1, phi + e, detail, c); evalPoint(shape, L, v1, phi - e, detail, d);
      tv.subVectors(a, b); tp.subVectors(c, d); n.crossVectors(tp, tv);
      if (n.lengthSq() < 1e-14) n.set(0, Math.sign(p.y) || 1, 0);
      n.normalize();
      pos.set([p.x, p.y, p.z], k * 3); nor.set([n.x, n.y, n.z], k * 3);
      uv.set([phi / TAU, v], k * 2);
      if (col) { colorFn(cc, v, phi, p, s); col.set([cc.r, cc.g, cc.b], k * 3); }
    }
  }
  const idx = [];
  for (let i = 0; i < nv; i++) for (let j = 0; j < np; j++) {
    const q = i * (np + 1) + j, r = q + np + 1;
    idx.push(q, r, q + 1, r, r + 1, q + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (col) g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

// контур среза слоя в плоскости x = 0: [y, z] по кругу
function outline(shape, L, nv, detail) {
  const p = new THREE.Vector3(), out = [];
  for (let i = 0; i <= nv; i++) { evalPoint(shape, L, i / nv, 0, detail, p); out.push([p.y, p.z]); }
  for (let i = nv - 1; i >= 1; i--) { evalPoint(shape, L, i / nv, PI, detail, p); out.push([p.y, p.z]); }
  return out;
}

const CAP_S = 1.6;
function capGeo(outer, inner, sgn) {
  const pos = [], uv = [], idx = [];
  const push = (y, z) => { pos.push(0, y, z); uv.push(z / (2 * CAP_S) + .5, y / (2 * CAP_S) + .5); return pos.length / 3 - 1; };
  const n = outer.length;
  if (inner) {
    const o = outer.map(q => push(q[0], q[1])), i = inner.map(q => push(q[0], q[1]));
    for (let k = 0; k < n; k++) { const k2 = (k + 1) % n; idx.push(o[k], o[k2], i[k], i[k], o[k2], i[k2]); }
  } else {
    let cy = 0, cz = 0; outer.forEach(q => { cy += q[0]; cz += q[1]; });
    const c = push(cy / n, cz / n), o = outer.map(q => push(q[0], q[1]));
    for (let k = 0; k < n; k++) idx.push(c, o[k], o[(k + 1) % n]);
  }
  // лицевая сторона должна смотреть по нормали, иначе DoubleSide перевернёт освещение
  if (sgn > 0) for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const nor = new Float32Array(pos.length); for (let k = 0; k < nor.length; k += 3) nor[k] = sgn;
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

/* ---------- текстуры начинок ---------- */
let seed = 7;
const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const shade = (hex, f) => { const c = C(hex); const hsl = {}; c.getHSL(hsl); c.setHSL(hsl.h, hsl.s, clamp(hsl.l + f)); return '#' + c.getHexString(); };
function grain(g, s, amt) {
  const im = g.getImageData(0, 0, s, s), d = im.data;
  for (let i = 0; i < d.length; i += 4) { const n = (rnd() - .5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(im, 0, 0);
}
const DRAW = {
  shell(g, s, c) { g.fillStyle = c; g.fillRect(0, 0, s, s); grain(g, s, 10); },
  mousse(g, s, c) {
    g.fillStyle = c; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 16; i++) { const x = rnd() * s, y = rnd() * s, r = 40 + rnd() * 120; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, shade(c, rnd() > .5 ? .04 : -.04) + '66'); gr.addColorStop(1, c + '00'); g.fillStyle = gr; g.fillRect(0, 0, s, s); }
    for (let i = 0; i < 420; i++) {
      const x = rnd() * s, y = rnd() * s, r = .6 + rnd() ** 3 * 3;
      g.fillStyle = shade(c, -.07) + '66'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      g.fillStyle = shade(c, .05) + '88'; g.beginPath(); g.arc(x - r * .2, y - r * .2, r * .5, 0, TAU); g.fill();
    }
    grain(g, s, 8);
  },
  cream(g, s, c) {
    g.fillStyle = c; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 46; i++) {
      g.strokeStyle = shade(c, rnd() > .5 ? .05 : -.05) + '55'; g.lineWidth = 2 + rnd() * 8; g.beginPath();
      const y = rnd() * s; g.moveTo(-20, y); g.bezierCurveTo(s * .3, y + (rnd() - .5) * 80, s * .7, y + (rnd() - .5) * 80, s + 20, y + (rnd() - .5) * 40); g.stroke();
    }
    grain(g, s, 6);
  },
  confit(g, s, c, a, L) {
    g.fillStyle = c; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 30; i++) { const x = rnd() * s, y = rnd() * s, r = 30 + rnd() * 100; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, shade(c, rnd() > .5 ? .1 : -.1) + '55'); gr.addColorStop(1, c + '00'); g.fillStyle = gr; g.fillRect(0, 0, s, s); }
    if (L.chunks) for (let i = 0; i < 46; i++) {
      const x = rnd() * s, y = rnd() * s, r = 7 + rnd() ** 1.5 * 20, rot = rnd() * TAU, m = 14, pts = [];
      for (let k = 0; k < m; k++) { const t = k / m * TAU, rr = r * (.75 + .35 * Math.sin(t * 2 + rot) * rnd() + .15 * rnd()); pts.push([x + Math.cos(t + rot) * rr, y + Math.sin(t + rot) * rr * (.6 + rnd() * .1)]); }
      g.beginPath(); pts.forEach((q, k) => { const nq = pts[(k + 1) % m]; const mx = (q[0] + nq[0]) / 2, my = (q[1] + nq[1]) / 2; k ? g.quadraticCurveTo(q[0], q[1], mx, my) : g.moveTo(mx, my); }); g.closePath();
      const gr = g.createRadialGradient(x - r * .25, y - r * .25, 1, x, y, r * 1.1); gr.addColorStop(0, shade(a, .1)); gr.addColorStop(1, shade(a, -.08));
      g.fillStyle = gr; g.fill(); g.strokeStyle = shade(a, -.18) + '77'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = '#ffffff55'; g.beginPath(); g.ellipse(x - r * .25, y - r * .25, r * .28, r * .12, -.6, 0, TAU); g.fill();
    }
    if (L.seeds) for (let i = 0; i < 220; i++) { const x = rnd() * s, y = rnd() * s; g.fillStyle = (L.seedColor || '#3a0a14') + 'bb'; g.beginPath(); g.ellipse(x, y, 1.5 + rnd() * 1.8, 1 + rnd(), rnd() * PI, 0, TAU); g.fill(); }
    if (L.berries) for (let i = 0; i < 18; i++) { const x = rnd() * s, y = rnd() * s, r = 10 + rnd() * 14; const gr = g.createRadialGradient(x - r * .3, y - r * .3, 1, x, y, r); gr.addColorStop(0, shade(a, .15)); gr.addColorStop(1, shade(a, -.12)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
    g.strokeStyle = '#ffffff22'; g.lineWidth = 3;
    for (let i = 0; i < 12; i++) { const x = rnd() * s, y = rnd() * s; g.beginPath(); g.arc(x, y, 20 + rnd() * 40, -2.6, -1.6); g.stroke(); }
    grain(g, s, 6);
  },
  caramel(g, s, c) {
    const gr = g.createLinearGradient(0, 0, s, s); gr.addColorStop(0, shade(c, .07)); gr.addColorStop(.5, c); gr.addColorStop(1, shade(c, -.08));
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 60; i++) { g.fillStyle = shade(c, .16) + '66'; g.beginPath(); g.arc(rnd() * s, rnd() * s, 1 + rnd() * 3, 0, TAU); g.fill(); }
    g.strokeStyle = '#ffffff1e'; g.lineWidth = 4; for (let i = 0; i < 10; i++) { g.beginPath(); const y = rnd() * s; g.moveTo(0, y); g.quadraticCurveTo(s / 2, y + (rnd() - .5) * 60, s, y); g.stroke(); }
    grain(g, s, 6);
  },
  crumble(g, s, c, a) {
    g.fillStyle = shade(c, -.06); g.fillRect(0, 0, s, s);
    const cols = [shade(c, -.2), shade(c, .14), c, shade(c, -.1), a];
    for (let i = 0; i < 9000; i++) { g.fillStyle = cols[(rnd() * cols.length) | 0]; const r = .8 + rnd() ** 2 * 4; g.beginPath(); g.ellipse(rnd() * s, rnd() * s, r, r * (.6 + rnd() * .4), rnd() * PI, 0, TAU); g.fill(); }
    grain(g, s, 12);
  },
  sponge(g, s, c) {
    g.fillStyle = c; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 2400; i++) { g.fillStyle = shade(c, -.2) + '99'; g.beginPath(); g.ellipse(rnd() * s, rnd() * s, 1 + rnd() ** 2 * 5, 1 + rnd() ** 2 * 3.5, rnd() * PI, 0, TAU); g.fill(); }
    for (let i = 0; i < 900; i++) { g.fillStyle = shade(c, .1) + '88'; g.beginPath(); g.arc(rnd() * s, rnd() * s, .8 + rnd() * 1.6, 0, TAU); g.fill(); }
    grain(g, s, 10);
  },
};
const texCache = new Map();
export function layerTexture(L) {
  const key = [L.type, L.color, L.accent, L.chunks, L.seeds, L.berries].join('|');
  if (texCache.has(key)) return texCache.get(key);
  const s = 512, cv = document.createElement('canvas'); cv.width = cv.height = s;
  seed = key.length * 97 + 13;
  (DRAW[L.type] || DRAW.mousse)(cv.getContext('2d'), s, L.color, L.accent || shade(L.color, .1), L);
  // лёгкое размытие убирает «нарисованность»
  const soft = document.createElement('canvas'); soft.width = soft.height = s;
  const sg = soft.getContext('2d'); sg.filter = 'blur(.9px)'; sg.drawImage(cv, 0, 0); cv.getContext('2d').drawImage(soft, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}
let sprayTex = null;
function spray() {
  if (sprayTex) return sprayTex;
  const s = 512, cv = document.createElement('canvas'); cv.width = cv.height = s; const g = cv.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, s, s); seed = 99; grain(g, s, 70);
  for (let i = 0; i < 2500; i++) { g.fillStyle = rnd() > .5 ? '#9a9a9a' : '#666666'; g.beginPath(); g.arc(rnd() * s, rnd() * s, .6 + rnd() * 1.4, 0, TAU); g.fill(); }
  sprayTex = new THREE.CanvasTexture(cv); sprayTex.wrapS = sprayTex.wrapT = THREE.RepeatWrapping; sprayTex.repeat.set(16, 8);
  return sprayTex;
}
let shadowTex = null;
export function shadowTexture() {
  if (shadowTex) return shadowTex;
  const s = 256, cv = document.createElement('canvas'); cv.width = cv.height = s; const g = cv.getContext('2d');
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, 'rgba(28,4,8,.5)'); gr.addColorStop(.45, 'rgba(28,4,8,.2)'); gr.addColorStop(1, 'rgba(28,4,8,0)');
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
  shadowTex = new THREE.CanvasTexture(cv);
  return shadowTex;
}

export function layerMaterial(L) {
  const map = layerTexture(L);
  const glossy = L.type === 'confit' || L.type === 'caramel';
  if (glossy) return new THREE.MeshStandardMaterial({ map, color: C('#e2d8d0'), roughness: .2, envMapIntensity: .7, side: THREE.DoubleSide });
  const rough = { shell: .78, mousse: .72, cream: .6, crumble: .95, sponge: .92 }[L.type] ?? .7;
  return new THREE.MeshStandardMaterial({ map, color: C('#d8cfc8'), roughness: rough, envMapIntensity: .6, side: THREE.DoubleSide });
}
/* ---------- натуральная фактура кожуры: шум прямо в шейдере ---------- */
const SKIN = {
  mango: { kind: 0, rough: .55, sheen: .0 }, banana: { kind: 1, rough: .5, sheen: .1 }, lemon: { kind: 2, rough: .46, sheen: 0 },
  blueberry: { kind: 3, rough: .58, sheen: .55 }, raspberry: { kind: 4, rough: .34, sheen: .3 }, pistachio: { kind: 5, rough: .62, sheen: .2 },
  coffee: { kind: 6, rough: .36, sheen: .1 }, popcorn: { kind: 7, rough: .82, sheen: .1 }, gum: { kind: 8, rough: .22, sheen: 0 },
};
const NOISE_GLSL = `
vec3 vk_m289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 vk_m289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 vk_perm(vec4 x){return vk_m289(((x*34.0)+1.0)*x);}
vec4 vk_tis(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float vk_snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=vk_m289(i);
  vec4 p=vk_perm(vk_perm(vk_perm(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 nr=vk_tis(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3))); p0*=nr.x; p1*=nr.y; p2*=nr.z; p3*=nr.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
// гасим мелкий шум, когда десерт маленький на экране (без мерцания)
float vk_aa(vec3 p, float f){ float w=length(fwidth(p))*f; return 1.0-smoothstep(0.35,1.0,w); }
void vk_skin(vec3 p, inout vec3 col, out float h, out float rm){
  h=0.0; rm=1.0;
  if(uKind==0){ // манго: гладкая кожица с мелкими светлыми крапинками
    float a=vk_aa(p,55.0); float dots=smoothstep(.6,.82,vk_snoise(p*55.0))*a;
    col=mix(col, col*vec3(1.02,1.06,.82)+vec3(.02,.02,.0), dots*.3);
    col*=.96+.08*vk_snoise(p*4.0);
    h=vk_snoise(p*3.0)*.003-dots*.0016; rm=1.0+dots*.15;
  } else if(uKind==1){ // банан: продольные волокна и веснушки
    float f=vk_snoise(vec3(p.x*34.0,p.y*2.5,p.z*34.0))*vk_aa(p,34.0);
    float fr=smoothstep(.6,.8,vk_snoise(p*26.0+3.0))*vk_aa(p,26.0);
    col*=1.0+f*.05; col=mix(col,vec3(.22,.12,.05),fr*.8);
    h=f*.0022-fr*.0012; rm=1.0+fr*.4;
  } else if(uKind==2){ // лимон: поры цедры
    float a=vk_aa(p,80.0); float pits=smoothstep(.2,.9,vk_snoise(p*80.0))*a;
    col*=1.0-pits*.03; col*=.98+.04*vk_snoise(p*5.0);
    h=-pits*.002+vk_snoise(p*5.0)*.003; rm=.9+pits*.4;
  } else if(uKind==3){ // черника: восковой налёт
    float b=vk_snoise(p*9.0)*.5+.5; float fine=vk_snoise(p*60.0)*vk_aa(p,60.0);
    col=mix(col,col*1.25+vec3(.08,.1,.16),b*.45+fine*.08);
    h=vk_snoise(p*24.0)*.0012; rm=1.0+b*.3;
  } else if(uKind==4){ // малина: блестящие костянки с переливом
    col*=.93+.12*vk_snoise(p*16.0); h=vk_snoise(p*70.0)*.0008*vk_aa(p,70.0);
  } else if(uKind==5){ // фисташка: морщинистая кожица
    float w=abs(vk_snoise(vec3(p.x*16.0,p.y*5.0,p.z*16.0)));
    col*=.9+.16*(1.0-w); h=-w*.006+vk_snoise(p*60.0)*.0006*vk_aa(p,60.0); rm=1.0+w*.2;
  } else if(uKind==6){ // кофейное зерно: обжарка, маслянистый блеск
    float n=vk_snoise(p*30.0)*vk_aa(p,30.0); col*=.9+.14*n+.06*vk_snoise(p*6.0);
    h=vk_snoise(p*9.0)*.003+n*.0012; rm=1.0-n*.2;
  } else if(uKind==7){ // попкорн: рыхлая поверхность
    float n=vk_snoise(p*14.0); col*=.96+.06*vk_snoise(p*40.0)*vk_aa(p,40.0); h=n*.0025; rm=1.0;
  } else { // жвачка: глянец с искрой
    float sp=smoothstep(.75,.9,vk_snoise(p*90.0))*vk_aa(p,90.0); col=mix(col,vec3(1.0),sp*.5); h=vk_snoise(p*5.0)*.002;
  }
}
vec3 vk_bump(vec3 n, float h){
  vec3 sx=dFdx(-vViewPosition), sy=dFdy(-vViewPosition);
  float dx=dFdx(h), dy=dFdy(h);
  vec3 r1=cross(sy,n), r2=cross(n,sx); float det=dot(sx,r1);
  vec3 g=sign(det)*(dx*r1+dy*r2);
  return normalize(abs(det)*n-g);
}
`;
function exteriorMaterial(spec) {
  const sk = SKIN[spec.shape] || { kind: 8, rough: .5, sheen: 0 };
  const mat = new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: sk.rough, metalness: 0,
    sheen: sk.sheen, sheenRoughness: .5, sheenColor: C(spec.sheen || '#fff4e0'), side: THREE.DoubleSide,
  });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uKind = { value: sk.kind };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;\nuniform int uKind;\n' + NOISE_GLSL)
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat vkH; float vkR; vec3 vkC = diffuseColor.rgb; vk_skin(vObj, vkC, vkH, vkR); diffuseColor.rgb = vkC;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor * vkR, .05, 1.0);')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = vk_bump(normal, vkH * .32);');
  };
  mat.envMapIntensity = .8;
  mat.customProgramCacheKey = () => 'vk-skin-' + sk.kind;
  return mat;
}

/* ---------- сборка десерта ---------- */
const DEF_SR = { 3: [1, .93, .52], 4: [1, .93, .66, .38] };
const DEF_SY = { 3: [1, .95, .58], 4: [1, .95, .72, .44] };

export function createDessert(product, opts = {}) {
  const spec = product.three, shape = SHAPES[spec.shape], q = opts.quality ?? 1;
  const n = spec.layers.length;
  const layers = spec.layers.map((L, k) => ({ ...L, sr: L.sr ?? DEF_SR[n][k], sy: L.sy ?? DEF_SY[n][k] }));
  const nvO = Math.round(130 * q), npO = Math.round(64 * q), nvI = Math.round(70 * q), npI = Math.round(34 * q), nvC = 110;
  const ext = exteriorMaterial(spec), mats = layers.map(layerMaterial);
  const outlines = layers.map((L, k) => outline(shape, L, nvC, k === 0));

  const halves = [0, 1].map(side => {
    const phi0 = side ? PI : 0, sgn = side ? 1 : -1;
    const group = new THREE.Group();
    const geos = layers.map((L, k) => surfaceGeo(shape, L, phi0, k ? nvI : nvO, k ? npI : npO, k === 0, k === 0 ? COLORS[spec.shape] : null));
    const pieces = layers.map((L, k) => {
      const piece = new THREE.Group();
      piece.add(new THREE.Mesh(geos[k], k === 0 ? ext : mats[k]));
      if (k < n - 1) piece.add(new THREE.Mesh(geos[k + 1], mats[k]));
      piece.add(new THREE.Mesh(capGeo(outlines[k], k < n - 1 ? outlines[k + 1] : null, sgn), mats[k]));
      group.add(piece);
      return piece;
    });
    return { group, pieces };
  });
  const [A, B] = halves;

  const root = new THREE.Group(), pivot = new THREE.Group(), body = new THREE.Group();
  root.add(pivot); pivot.add(body); body.add(A.group, B.group);

  // ориентация: clam — смотрим вдоль локальной z (срез ребром к камере), book — вдоль x (срез лицом к камере)
  const style = spec.style || 'clam';
  const qBase = new THREE.Quaternion();
  if (style === 'book') qBase.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -PI / 2);
  const qRoll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), spec.roll || 0);
  const qTilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), spec.tilt || 0);
  pivot.quaternion.copy(qTilt).multiply(qRoll).multiply(qBase);
  const qRollE = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1);

  const R = shape.R, Y = new THREE.Vector3(0, 1, 0);
  let poseA, poseB, arcA = new THREE.Vector3();
  if (style === 'book') {
    const w = 2 * R * (shape.az ?? 1) * 1.08 + .14;
    poseA = { pos: new THREE.Vector3(0, 0, -w / 2), q: new THREE.Quaternion().setFromAxisAngle(Y, PI) };
    poseB = { pos: new THREE.Vector3(0, 0, w / 2), q: new THREE.Quaternion() };
    arcA.set(R * 1.4, 0, 0);
  } else {
    const a = spec.openAngle ?? 1.08, d = R * Math.sin(a) * 1.02 + R * (shape.ax ?? 1) * .3 + .06;
    poseA = { pos: new THREE.Vector3(d, 0, 0), q: new THREE.Quaternion().setFromAxisAngle(Y, a) };
    poseB = { pos: new THREE.Vector3(-d, 0, 0), q: new THREE.Quaternion().setFromAxisAngle(Y, -a) };
  }
  // разлёт слоёв половины B: к камере (по нормали среза +x) и вбок
  // разлёт по слоям задаётся в координатах экрана: вправо, чуть вниз и к камере
  const ex = new THREE.Vector3(...(spec.explode || [1.3, -.06, .3])).multiplyScalar(R / .64);
  const I = new THREE.Quaternion(), qInv = new THREE.Quaternion(), tmp = new THREE.Vector3();

  const state = { open: 0, explode: 0, hideA: 0 };
  function apply() {
    const o = ease(clamp(state.open));
    A.group.position.copy(poseA.pos).multiplyScalar(o).addScaledVector(arcA, Math.sin(PI * o));
    A.group.quaternion.slerpQuaternions(I, poseA.q, o);
    B.group.position.copy(poseB.pos).multiplyScalar(o);
    B.group.quaternion.slerpQuaternions(I, poseB.q, o);
    const e = ease(clamp(state.explode)), h = ease(clamp(state.hideA));
    // при раскладке по слоям десерт встаёт вертикальнее — так слои крупнее и не налезают друг на друга
    if (spec.explodeRoll) { qRollE.setFromAxisAngle(Z, (spec.roll || 0) + spec.explodeRoll * e); pivot.quaternion.copy(qTilt).multiply(qRollE).multiply(qBase); }
    // половина A уходит, половина B встаёт в центр и раскладывается
    A.group.scale.setScalar(Math.max(.001, 1 - h));
    A.group.position.addScaledVector(opts.hideVec || new THREE.Vector3(0, -1, 0), h);
    B.group.position.multiplyScalar(1 - h);
    qInv.copy(pivot.quaternion).multiply(B.group.quaternion).invert();
    B.pieces.forEach((p, k) => p.position.copy(tmp.copy(ex).multiplyScalar((k - (n - 1) / 2) * e)).applyQuaternion(qInv));
  }

  // центрирование и тень
  apply();
  const box = new THREE.Box3().setFromObject(pivot);
  const center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  body.position.copy(center).applyQuaternion(pivot.quaternion.clone().invert()).multiplyScalar(-1);
  state.open = 1; apply(); pivot.updateMatrixWorld(true);
  const boxOpen = new THREE.Box3().setFromObject(pivot);
  state.open = 0; apply();
  const radius = Math.max(size.length() / 2 * 1.08, boxOpen.getSize(new THREE.Vector3()).length() / 2 * .92);

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
  shadow.rotation.x = -PI / 2; shadow.position.y = -size.y / 2 - .03;
  shadow.scale.set(size.x * 1.5, size.z * 1.9 + .4, 1); shadow.renderOrder = -1;
  root.add(shadow);
  const shadowBase = shadow.scale.clone();

  return {
    root, pivot, A, B, layers, radius, size, style,
    set(open, explode = 0, hideA = 0) {
      state.open = open; state.explode = explode; state.hideA = hideA; apply();
      shadow.scale.set(shadowBase.x * (1 + .35 * clamp(open)), shadowBase.y * (1 + .25 * clamp(open)), 1);
    },
    // точка на срезе слоя k половины B (в мировых координатах) — для подписей
    anchor(k, target, top = false) {
      const b = new THREE.Box3().setFromObject(B.pieces[k]);
      b.getCenter(target); target.y = top ? b.max.y : b.min.y; target.z = b.max.z;
      return target;
    },
    dispose() {
      root.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      ext.dispose(); mats.forEach(m => m.dispose());
    },
  };
}

export function addLights(scene, env) {
  scene.environment = env;
  const key = new THREE.DirectionalLight('#fff3e8', 2.1); key.position.set(2.5, 4.5, 5); scene.add(key);
  const fill = new THREE.DirectionalLight('#fff0f2', 1.1); fill.position.set(-4.5, 1, 4); scene.add(fill);
  const rim = new THREE.DirectionalLight('#ffffff', 1.8); rim.position.set(-2, 3.5, -4.5); scene.add(rim);
  scene.add(new THREE.HemisphereLight('#fffaf3', '#c98a7e', .6));
}
