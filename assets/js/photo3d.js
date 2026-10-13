// Десерт из настоящей фотографии: по силуэту фото строится объём (как надутый шар),
// спереди — сама фотография, внутри — вложенные слои с настоящим срезом.
import * as THREE from 'three';
import { clamp, ease, layerMaterial, layerTexture, shadowTexture } from './dessert3d.js';

const imgCache = new Map();
export function loadImage(src) {
  if (!imgCache.has(src)) imgCache.set(src, new Promise((res, rej) => { const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = rej; i.src = src; }));
  return imgCache.get(src);
}

/* ---------- маска и поле расстояний ---------- */
function analyze(img, spec, G) {
  const sc = G / Math.max(img.width, img.height);
  const W = Math.max(8, Math.round(img.width * sc)), H = Math.max(8, Math.round(img.height * sc));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, W, H);
  const px = g.getImageData(0, 0, W, H).data;
  const N = W * H, alpha = new Float32Array(N), fruit = new Uint8Array(N);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i, r = px[k * 4], gg = px[k * 4 + 1], b = px[k * 4 + 2], a = px[k * 4 + 3] / 255;
    alpha[k] = a;
    const leaf = spec.leafy && j < H * (spec.leafTop ?? .42) && gg > r * 1.05 && gg > b * 1.15;
    fruit[k] = a > .5 && !leaf ? 1 : 0;
  }
  // расстояние до края (два прохода, шаги 1 и √2)
  const INF = 1e9, d = new Float32Array(N);
  for (let k = 0; k < N; k++) d[k] = fruit[k] ? INF : 0;
  const S2 = Math.SQRT2;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i; if (!d[k]) continue;
    let v = d[k];
    if (i > 0) v = Math.min(v, d[k - 1] + 1); else v = Math.min(v, 1);
    if (j > 0) { v = Math.min(v, d[k - W] + 1); if (i > 0) v = Math.min(v, d[k - W - 1] + S2); if (i < W - 1) v = Math.min(v, d[k - W + 1] + S2); } else v = Math.min(v, 1);
    d[k] = v;
  }
  for (let j = H - 1; j >= 0; j--) for (let i = W - 1; i >= 0; i--) {
    const k = j * W + i; if (!d[k]) continue;
    let v = d[k];
    if (i < W - 1) v = Math.min(v, d[k + 1] + 1); else v = Math.min(v, 1);
    if (j < H - 1) { v = Math.min(v, d[k + W] + 1); if (i < W - 1) v = Math.min(v, d[k + W + 1] + S2); if (i > 0) v = Math.min(v, d[k + W - 1] + S2); } else v = Math.min(v, 1);
    d[k] = v;
  }
  let dmax = 0, cx = 0, cy = 0, n = 0, x0 = W, x1 = 0, y0 = H, y1 = 0;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i; if (!fruit[k]) continue;
    if (d[k] > 0) d[k] -= .5;
    dmax = Math.max(dmax, d[k]); cx += i; cy += j; n++;
    x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, j); y1 = Math.max(y1, j);
  }
  cx /= n; cy /= n;
  // текстура поля расстояний — по ней внутренние слои получают гладкий край
  const dt = new Uint8Array(N * 4);
  for (let k = 0; k < N; k++) { const v = Math.round(clamp(d[k] / dmax) * 255); dt[k * 4] = v; dt[k * 4 + 3] = 255; }
  const distTex = new THREE.DataTexture(dt, W, H, THREE.RGBAFormat);
  distTex.flipY = true; distTex.magFilter = distTex.minFilter = THREE.LinearFilter; distTex.needsUpdate = true;
  // расширенная маска: сетка заходит за край фото, сам край режет альфа-канал фотографии
  const wide = new Float32Array(N), R = 3;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    let m = 0;
    for (let y = Math.max(0, j - R); y <= Math.min(H - 1, j + R) && m < .5; y++) for (let x = Math.max(0, i - R); x <= Math.min(W - 1, i + R); x++) if (alpha[y * W + x] > m) m = alpha[y * W + x];
    wide[j * W + i] = m;
  }
  return { W, H, alpha, wide, fruit, d, dmax, cx, cy, bw: x1 - x0, bh: y1 - y0, distTex };
}

function bilinear(arr, W, H, x, y) {
  x = clamp(x, 0, W - 1); y = clamp(y, 0, H - 1);
  const i = Math.floor(x), j = Math.floor(y), i1 = Math.min(i + 1, W - 1), j1 = Math.min(j + 1, H - 1), fx = x - i, fy = y - j;
  return (arr[j * W + i] * (1 - fx) + arr[j * W + i1] * fx) * (1 - fy) + (arr[j1 * W + i] * (1 - fx) + arr[j1 * W + i1] * fx) * fy;
}

/* ---------- геометрия ---------- */
function axisList(n, cut, side, step) {
  const out = [];
  if (side < 0) { for (let v = 0; v < cut; v += step) out.push(v); out.push(cut); }
  else { out.push(cut); for (let v = Math.ceil(cut / step) * step; v <= n - 1; v += step) if (v > cut + 1e-3) out.push(v); if (out[out.length - 1] < n - 1) out.push(n - 1); }
  return out;
}

function surface(A, xs, ys, hFn, covFn, u, front) {
  const nx = xs.length, ny = ys.length;
  const pos = new Float32Array(nx * ny * 3), uv = new Float32Array(nx * ny * 2), cov = new Uint8Array(nx * ny);
  let k = 0;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++, k++) {
    const x = xs[i], y = ys[j], h = hFn(x, y);
    pos[k * 3] = (x - A.cx) * u; pos[k * 3 + 1] = -(y - A.cy) * u; pos[k * 3 + 2] = front ? h : -h - .004;
    uv[k * 2] = (x + .5) / A.W; uv[k * 2 + 1] = 1 - (y + .5) / A.H;
    cov[k] = covFn(x, y) ? 1 : 0;
  }
  const idx = [];
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, e = c + 1;
    if (!(cov[a] | cov[b] | cov[c] | cov[e])) continue;
    if (front) idx.push(a, c, b, b, c, e); else idx.push(a, b, c, b, e, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// срез слоя: полосы между профилем слоя и следующего вложенного слоя
function capGeo(A, split, hk, hk1, u, normal, pb) {
  const T = split === 'x' ? A.H : A.W, pos = [], uv = [], idx = [];
  const P = (t, z) => {
    if (split === 'x') pos.push(0, -(t - A.cy) * u, z); else pos.push((t - A.cx) * u, 0, z);
    if (pb) uv.push(pb.c[0] + (t - pb.t0) / (pb.t1 - pb.t0) * (pb.c[2] - pb.c[0]), pb.c[3] - (z + pb.h) / (2 * pb.h) * (pb.c[3] - pb.c[1]));
    else uv.push((t - (split === 'x' ? A.cy : A.cx)) * u / 3.2 + .5, z / 3.2 + .5);
    return pos.length / 3 - 1;
  };
  const step = .5, rows = [];
  for (let t = 0; t <= T - 1; t += step) rows.push([t, hk(t), hk1 ? hk1(t) : 0]);
  const nrm = new THREE.Vector3(...normal), va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
  const tri = (a, b, c) => {
    va.fromArray(pos, a * 3); vb.fromArray(pos, b * 3).sub(va); vc.fromArray(pos, c * 3).sub(va);
    if (vb.cross(vc).dot(nrm) < 0) idx.push(a, c, b); else idx.push(a, b, c);
  };
  for (let r = 0; r < rows.length - 1; r++) {
    const [t0, o0, i0] = rows[r], [t1, o1, i1] = rows[r + 1];
    if (o0 <= 0 && o1 <= 0) continue;
    const bands = hk1 ? [[i0, o0, i1, o1], [-o0, -i0, -o1, -i1]] : [[-o0, o0, -o1, o1]];
    for (const [a0, b0, a1, b1] of bands) {
      const p = P(t0, a0), q = P(t0, b0), r1 = P(t1, a1), s = P(t1, b1);
      tri(p, q, r1); tri(q, s, r1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const nor = new Float32Array(pos.length); for (let k = 0; k < nor.length; k += 3) { nor[k] = normal[0]; nor[k + 1] = normal[1]; nor[k + 2] = normal[2]; }
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

// внутренний слой обрезается по полю расстояний — край получается гладким
function clipMaterial(mat, distTex, thr) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uDist = { value: distTex }; sh.uniforms.uThr = { value: thr };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 gridUv;\nvarying vec2 vGrid;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGrid = gridUv;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uDist;\nuniform float uThr;\nvarying vec2 vGrid;')
      .replace('void main() {', 'void main() {\n  if (texture2D(uDist, vGrid).r < uThr) discard;');
  };
  mat.customProgramCacheKey = () => 'clip';
  return mat;
}

/* ---------- сборка ---------- */
const DEF_SR = { 3: [1, .9, .5], 4: [1, .9, .64, .36] };

export async function createPhotoDessert(product, opts = {}) {
  const spec = product.three, img = await loadImage(product.photo);
  const A = analyze(img, spec, opts.grid ?? 150);
  const n = spec.layers.length;
  const layers = spec.layers.map((L, k) => ({ ...L, off: (1 - (L.sr ?? DEF_SR[n][k])) * A.dmax }));
  const u = 2.2 / Math.max(A.W, A.H), depth = (spec.depth ?? 1) * u;
  const split = spec.split || (A.bw > A.bh * 1.05 ? 'y' : 'x');
  const cut = split === 'x' ? A.cx : A.cy;
  const D = (x, y) => bilinear(A.d, A.W, A.H, x, y);
  const hOf = off => (x, y) => { const e = D(x, y) - off, R = A.dmax - off; return e <= 0 ? 0 : depth * Math.sqrt(e * Math.max(0, 2 * R - e)); };
  const hLine = off => t => split === 'x' ? hOf(off)(A.cx, t) : hOf(off)(t, A.cy);
  const covPhoto = (x, y) => bilinear(A.wide, A.W, A.H, x, y) > .02;
  const covFruit = off => (x, y) => D(x, y) - off > -1.2;

  const tex = new THREE.Texture(img); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; tex.needsUpdate = true;
  const tint = new THREE.Color(spec.photoTint || '#ffffff');
  const front = new THREE.MeshBasicMaterial({ map: tex, color: tint, transparent: true, alphaTest: .04, side: THREE.DoubleSide });
  const back = new THREE.MeshBasicMaterial({ map: tex, color: tint.clone().multiplyScalar(.72), transparent: true, alphaTest: .04, side: THREE.DoubleSide });
  const mats = layers.map((L, k) => clipMaterial(layerMaterial(L), A.distTex, L.off / A.dmax));
  // стенка слоя k — это поверхность слоя k+1, обрезаем её по его же краю
  const wallMats = layers.map((L, k) => k < n - 1 ? clipMaterial(layerMaterial(L), A.distTex, layers[k + 1].off / A.dmax + .004) : null);
  const withGrid = g => { g.setAttribute('gridUv', g.getAttribute('uv')); return g; };
  // настоящий срез: фото мякоти растягивается на весь срез, слои — оттенками
  let capMats = null, pb = null;
  if (spec.capPhoto) {
    const cimg = await loadImage(spec.capPhoto.src);
    const ctex = new THREE.Texture(cimg); ctex.colorSpace = THREE.SRGBColorSpace; ctex.anisotropy = 8; ctex.needsUpdate = true;
    const T = split === 'x' ? A.H : A.W, h0 = hLine(0); let t0 = T, t1 = 0, hm = 0;
    for (let t = 0; t <= T - 1; t += .5) { const h = h0(t); if (h > 0) { t0 = Math.min(t0, t); t1 = Math.max(t1, t); hm = Math.max(hm, h); } }
    const c = spec.capPhoto.crop || [0, 0, 1, 1];
    pb = { t0, t1, h: hm, c: [c[0], 1 - c[3], c[2], 1 - c[1]] };
    capMats = layers.map((L, k) => new THREE.MeshBasicMaterial({ map: ctex, color: new THREE.Color((spec.capPhoto.tints || [])[k] || '#ffffff'), side: THREE.DoubleSide }));
  }

  const sA = split === 'x' ? -1 : 1; // знак стороны A в мировых координатах
  const halves = [-1, 1].map(side => {
    const group = new THREE.Group();
    const step0 = 1, stepI = Math.max(1.5, A.W / 70);
    const geos = layers.map((L, k) => {
      const st = k ? stepI : step0;
      const xs = split === 'x' ? axisList(A.W, cut, side, st) : axisList(A.W, -1, 1, st).filter(v => v >= 0);
      const ys = split === 'y' ? axisList(A.H, cut, side, st) : axisList(A.H, -1, 1, st).filter(v => v >= 0);
      const h = hOf(L.off);
      if (k === 0) return { f: surface(A, xs, ys, h, covPhoto, u, true), b: surface(A, xs, ys, h, covPhoto, u, false) };
      return { f: withGrid(surface(A, xs, ys, h, covFruit(L.off), u, true)), b: withGrid(surface(A, xs, ys, h, covFruit(L.off), u, false)) };
    });
    // нормаль среза смотрит в сторону второй половины
    const sideSign = side < 0 ? -sA : sA; // для половины A нормаль = -sA
    const capN = split === 'x' ? [side < 0 ? 1 : -1, 0, 0] : [0, side < 0 ? -1 : 1, 0];
    const pieces = layers.map((L, k) => {
      const piece = new THREE.Group();
      if (k === 0) { const mb = new THREE.Mesh(geos[0].b, back), mf = new THREE.Mesh(geos[0].f, front); mb.renderOrder = 1; mf.renderOrder = 2; piece.add(mb, mf); }
      else { piece.add(new THREE.Mesh(geos[k].f, mats[k]), new THREE.Mesh(geos[k].b, mats[k])); }
      if (k < n - 1) { const wm = wallMats[k]; piece.add(new THREE.Mesh(geos[k + 1].f, wm), new THREE.Mesh(geos[k + 1].b, wm)); }
      piece.add(new THREE.Mesh(capGeo(A, split, hLine(L.off), k < n - 1 ? hLine(layers[k + 1].off) : null, u, capN, pb), capMats ? capMats[k] : layerMaterial(L)));
      group.add(piece);
      return piece;
    });
    void sideSign;
    return { group, pieces };
  });
  // в мировых координатах: половина «−» по x — слева, по y — сверху (строки картинки идут вниз)
  const [H0, H1] = halves;
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body); body.add(H0.group, H1.group);

  // раскрытие книжкой: каждая половина поворачивается срезом к зрителю
  const Z = new THREE.Vector3(0, 0, 1), I = new THREE.Quaternion();
  const dir0 = split === 'x' ? new THREE.Vector3(-1, 0, 0) : new THREE.Vector3(0, 1, 0); // куда уходит половина H0
  const ext = (split === 'x' ? A.bw : A.bh) * u;
  const ang = spec.openAngle ?? .78;
  const q0 = new THREE.Quaternion().slerpQuaternions(I, new THREE.Quaternion().setFromUnitVectors(dir0.clone().negate(), Z), ang);
  const q1 = new THREE.Quaternion().slerpQuaternions(I, new THREE.Quaternion().setFromUnitVectors(dir0, Z), ang);
  const gap = ext * .34 + .12;
  const ex = new THREE.Vector3(...(spec.explode || [1.25, -.04, .35]));
  const qInv = new THREE.Quaternion(), tmp = new THREE.Vector3();
  const main = spec.explodeHalf === 0 ? H0 : H1, other = main === H0 ? H1 : H0;
  const mainQ = main === H0 ? q0 : q1, mainDir = main === H0 ? dir0 : dir0.clone().negate();
  const state = { open: 0, explode: 0, hide: 0 };
  function apply() {
    const o = ease(clamp(state.open)), e = ease(clamp(state.explode)), h = ease(clamp(state.hide));
    H0.group.position.copy(dir0).multiplyScalar(gap * o); H0.group.quaternion.slerpQuaternions(I, q0, o);
    H1.group.position.copy(dir0).multiplyScalar(-gap * o); H1.group.quaternion.slerpQuaternions(I, q1, o);
    other.group.scale.setScalar(Math.max(.001, 1 - h));
    other.group.position.add(tmp.set(0, -.8 * h, -.5 * h));
    main.group.position.multiplyScalar(1 - h);
    void mainQ; void mainDir;
    qInv.copy(main.group.quaternion).invert();
    main.pieces.forEach((p, k) => p.position.copy(tmp.copy(ex).multiplyScalar((k - (n - 1) / 2) * e * ext * .55)).applyQuaternion(qInv));
  }
  apply();
  const box = new THREE.Box3().setFromObject(body), size = box.getSize(new THREE.Vector3());
  state.open = 1; apply(); const boxO = new THREE.Box3().setFromObject(body); state.open = 0; apply();
  const radius = Math.max(size.length() / 2 * 1.02, boxO.getSize(new THREE.Vector3()).length() / 2 * .9);

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, opacity: spec.shadow ?? .9 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = box.min.y - .06;
  shadow.scale.set(size.x * 1.25, Math.max(size.x, size.y) * .55, 1); shadow.renderOrder = -1;
  root.add(shadow);
  const sb = shadow.scale.clone();

  return {
    root, layers, radius, size, split, ready: true,
    set(open, explode = 0, hide = 0) {
      state.open = open; state.explode = explode; state.hide = hide; apply();
      shadow.scale.set(sb.x * (1 + .4 * clamp(open) + .5 * clamp(explode)), sb.y, 1);
      shadow.material.opacity = (spec.shadow ?? .9) * (1 - .4 * clamp(explode));
    },
    anchor(k, target, top = false) {
      const b = new THREE.Box3().setFromObject(main.pieces[k]);
      b.getCenter(target); target.y = top ? b.max.y : b.min.y; target.z = b.max.z;
      return target;
    },
    dispose() { root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); tex.dispose(); A.distTex.dispose(); },
  };
}

export { layerTexture };
