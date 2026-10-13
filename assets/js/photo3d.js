// Десерт из настоящей фотографии: по силуэту фото строится гладкий объём,
// спереди — сама фотография, на срезе — настоящие фото начинок, сложенные по слоям.
import * as THREE from 'three';
import { clamp, ease, shadowTexture } from './dessert3d.js';

const imgCache = new Map();
export function loadImage(src) {
  if (!imgCache.has(src)) imgCache.set(src, new Promise((res, rej) => { const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = rej; i.src = src; }));
  return imgCache.get(src);
}
const FILL = name => `assets/img/fill/${name}.webp`;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/* ---------- точное поле расстояний (Felzenszwalb) и размытие ---------- */
function dt1(f, n, d, v, z) {
  let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
}
// расстояние от каждой точки маски до ближайшей точки вне её
function edt(mask, W, H) {
  const n = Math.max(W, H), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  const g = new Float64Array(W * H);
  for (let k = 0; k < W * H; k++) g[k] = mask[k] ? 1e12 : 0;
  for (let x = 0; x < W; x++) { for (let y = 0; y < H; y++) f[y] = g[y * W + x]; dt1(f, H, d, v, z); for (let y = 0; y < H; y++) g[y * W + x] = d[y]; }
  for (let y = 0; y < H; y++) { const o = y * W; for (let x = 0; x < W; x++) f[x] = g[o + x]; dt1(f, W, d, v, z); for (let x = 0; x < W; x++) g[o + x] = d[x]; }
  const out = new Float32Array(W * H); for (let k = 0; k < W * H; k++) out[k] = Math.sqrt(g[k]);
  return out;
}
function blur(a, W, H, s) {
  const r = Math.ceil(s * 2.5), w = new Float32Array(2 * r + 1); let sum = 0;
  for (let i = -r; i <= r; i++) { w[i + r] = Math.exp(-i * i / (2 * s * s)); sum += w[i + r]; }
  for (let i = 0; i < w.length; i++) w[i] /= sum;
  const t = new Float32Array(W * H), o = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) {
      let v = 0;
      if (x >= r && x < W - r) for (let i = 0, k = row + x - r; i < w.length; i++, k++) v += a[k] * w[i];
      else for (let i = -r; i <= r; i++) v += a[row + Math.min(W - 1, Math.max(0, x + i))] * w[i + r];
      t[row + x] = v;
    }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = 0;
    if (y >= r && y < H - r) for (let i = 0, k = (y - r) * W + x; i < w.length; i++, k += W) v += t[k] * w[i];
    else for (let i = -r; i <= r; i++) v += t[Math.min(H - 1, Math.max(0, y + i)) * W + x] * w[i + r];
    o[y * W + x] = v;
  }
  return o;
}

/* ---------- маска фрукта, тонкие части (листья, хвостик) и покрытие ---------- */
function analyze(img, spec, G) {
  const F = Math.min(520, Math.round(G * 1.8));
  const sc = F / Math.max(img.width, img.height);
  const W = Math.max(16, Math.round(img.width * sc)), H = Math.max(16, Math.round(img.height * sc)), N = W * H;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, W, H);
  const px = g.getImageData(0, 0, W, H).data;
  const alpha = new Float32Array(N), solid = new Uint8Array(N), body = new Uint8Array(N), bg = new Uint8Array(N);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i, r = px[k * 4], gg = px[k * 4 + 1], b = px[k * 4 + 2], a = px[k * 4 + 3] / 255;
    const edge = i < 2 || j < 2 || i > W - 3 || j > H - 3;
    alpha[k] = a; bg[k] = a <= .02 ? 1 : 0;
    solid[k] = a > .5 && !edge ? 1 : 0;
    const leaf = spec.leafy && j < H * (spec.leafTop ?? .42) && gg >= r * .92 && gg > b * 1.15;
    body[k] = solid[k] && !leaf ? 1 : 0;
  }
  // убираем тонкие перешейки (хвостики, чашелистики): сжать и расширить тело
  const d0 = edt(body, W, H); let m0 = 0; for (let k = 0; k < N; k++) m0 = Math.max(m0, d0[k]);
  const rr = m0 * (spec.neck ?? .12), outCore = new Uint8Array(N);
  for (let k = 0; k < N; k++) outCore[k] = d0[k] > rr ? 0 : 1;
  const dc = edt(outCore, W, H);
  const fruit = new Uint8Array(N), out = new Uint8Array(N);
  for (let k = 0; k < N; k++) { fruit[k] = body[k] && dc[k] <= rr + .75 ? 1 : 0; out[k] = fruit[k] ? 0 : 1; }
  // знаковое расстояние, сглаженное — объём без ступенек
  const din = edt(fruit, W, H), dout = edt(out, W, H), sd = new Float32Array(N);
  for (let k = 0; k < N; k++) sd[k] = fruit[k] ? din[k] - .5 : -(dout[k] - .5);
  const d = blur(sd, W, H, 1.4);
  // тонкие части — плоские линзы
  const thin = new Uint8Array(N); for (let k = 0; k < N; k++) thin[k] = solid[k] && !fruit[k] ? 1 : 0;
  const lt = blur(edt(thin, W, H), W, H, 1.2);
  // покрытие сеткой — с запасом за край фото, сам край режет альфа фотографии
  const dbg = edt(bg, W, H), cov = new Float32Array(N), covR = Math.max(3, 2.5 * F / G);
  for (let k = 0; k < N; k++) cov[k] = dbg[k] <= covR ? 1 : 0;

  let dmax = 0, lmax = 0, cx = 0, cy = 0, n = 0, x0 = W, x1 = 0, y0 = H, y1 = 0;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i; lmax = Math.max(lmax, lt[k]); if (!fruit[k]) continue;
    dmax = Math.max(dmax, d[k]); cx += i; cy += j; n++;
    x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, j); y1 = Math.max(y1, j);
  }
  cx /= n; cy /= n;
  const dt = new Uint8Array(N * 4);
  for (let k = 0; k < N; k++) { const v = Math.round(clamp(d[k] / dmax) * 255); dt[k * 4] = v; dt[k * 4 + 3] = 255; }
  const distTex = new THREE.DataTexture(dt, W, H, THREE.RGBAFormat);
  distTex.flipY = true; distTex.magFilter = distTex.minFilter = THREE.LinearFilter; distTex.needsUpdate = true;
  return { W, H, step: F / G, alpha, px, d, lt, lmax: Math.max(lmax, 1), cov, dmax, cx, cy, bw: x1 - x0, bh: y1 - y0, distTex };
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

// лицевая и обратная поверхности по одной сетке высот
function surfaces(A, xs, ys, hFn, covFn, u) {
  const nx = xs.length, ny = ys.length, N = nx * ny;
  const hs = new Float32Array(N), uv = new Float32Array(N * 2), cov = new Uint8Array(N);
  let k = 0;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++, k++) {
    const x = xs[i], y = ys[j];
    hs[k] = hFn(x, y); cov[k] = covFn(x, y) ? 1 : 0;
    uv[k * 2] = (x + .5) / A.W; uv[k * 2 + 1] = 1 - (y + .5) / A.H;
  }
  const fi = [], bi = [];
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, e = c + 1;
    if (!(cov[a] | cov[b] | cov[c] | cov[e])) continue;
    fi.push(a, c, b, b, c, e); bi.push(a, b, c, b, e, c);
  }
  return [true, false].map(front => {
    const pos = new Float32Array(N * 3);
    let k = 0;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++, k++) {
      pos[k * 3] = (xs[i] - A.cx) * u; pos[k * 3 + 1] = -(ys[j] - A.cy) * u; pos[k * 3 + 2] = front ? hs[k] : -hs[k] - .003;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(front ? fi : bi); g.computeVertexNormals();
    return g;
  });
}

// срез: полосы между профилем слоя и следующего вложенного слоя (или сплошной)
function capGeo(A, split, hk, hk1, u, normal, map) {
  const T = split === 'x' ? A.H : A.W, pos = [], uv = [], idx = [];
  const P = (t, z) => {
    if (split === 'x') pos.push(0, -(t - A.cy) * u, z); else pos.push((t - A.cx) * u, 0, z);
    uv.push(...map(t, z));
    return pos.length / 3 - 1;
  };
  const rows = [];
  for (let t = 0; t <= T - 1; t += .5) rows.push([t, hk(t), hk1 ? hk1(t) : 0]);
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
      if (Math.abs(b0 - a0) < 1e-7 && Math.abs(b1 - a1) < 1e-7) continue;
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

/* ---------- настоящий срез: фото начинок по форме слоёв ---------- */
function skinColor(A, split) {
  // цвет кожицы у линии разреза
  let r = 0, g = 0, b = 0, n = 0;
  const T = split === 'x' ? A.H : A.W;
  for (let t = 0; t < T; t++) for (let o = -2; o <= 2; o++) {
    const x = Math.round(split === 'x' ? A.cx + o : t), y = Math.round(split === 'x' ? t : A.cy + o);
    if (x < 0 || y < 0 || x >= A.W || y >= A.H) continue;
    const k = y * A.W + x, e = A.d[k];
    if (e > 1 && e < 1 + A.dmax * .07 && A.alpha[k] > .95) { r += A.px[k * 4]; g += A.px[k * 4 + 1]; b += A.px[k * 4 + 2]; n++; }
  }
  return n ? [r / n, g / n, b / n] : [220, 200, 170];
}

function capCanvas(A, split, layers, hLines, t0, t1, hm, u, imgs) {
  const CW = 1024, CH = Math.round(clamp(CW * 2 * hm / ((t1 - t0) * u), 64, 1024));
  const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH;
  const g = cv.getContext('2d');
  const T = split === 'x' ? A.H : A.W;
  const X = t => (t - t0) / (t1 - t0) * CW, Y = z => (hm - z) / (2 * hm) * CH;
  const pathOf = h => {
    const top = [], bot = [];
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let t = 0; t <= T - 1; t += .5) {
      const v = h(t); if (v <= 0) continue;
      top.push([X(t), Y(v)]); bot.push([X(t), Y(-v)]);
      x0 = Math.min(x0, X(t)); x1 = Math.max(x1, X(t)); y0 = Math.min(y0, Y(v)); y1 = Math.max(y1, Y(-v));
    }
    if (!top.length) return null;
    const p = new Path2D();
    p.moveTo(top[0][0], CH / 2);
    top.forEach(([x, y]) => p.lineTo(x, y));
    p.lineTo(top[top.length - 1][0], CH / 2);
    for (let i = bot.length - 1; i >= 0; i--) p.lineTo(bot[i][0], bot[i][1]);
    p.closePath();
    return { p, x0, x1, y0, y1 };
  };
  const cover = (img, b, k = 1.08) => {
    const w = b.x1 - b.x0, h = b.y1 - b.y0, s = Math.max(w / img.width, h / img.height) * k;
    g.drawImage(img, (b.x0 + b.x1) / 2 - img.width * s / 2, (b.y0 + b.y1) / 2 - img.height * s / 2, img.width * s, img.height * s);
  };
  const [sr, sg, sb] = skinColor(A, split);
  layers.forEach((L, k) => {
    const sh = pathOf(hLines[k]); if (!sh) return;
    g.save();
    if (k > 0) { // мягкая тень по границе слоя — как на настоящем разрезе
      g.shadowColor = 'rgba(70, 30, 15, .3)'; g.shadowBlur = CW * .012; g.fillStyle = L.color; g.fill(sh.p); g.shadowColor = 'transparent';
    }
    g.clip(sh.p);
    if (k === 0) {
      const c = new THREE.Color(L.color), m = .45; // кожица у разреза, смягчённая цветом корпуса
      g.fillStyle = `rgb(${sr * (1 - m) + c.r * 255 * m | 0},${sg * (1 - m) + c.g * 255 * m | 0},${sb * (1 - m) + c.b * 255 * m | 0})`; g.fillRect(0, 0, CW, CH);
      if (imgs.cream) { g.globalAlpha = .4; g.globalCompositeOperation = 'soft-light'; cover(imgs.cream, sh, 1.6); }
    } else if (imgs[L.tex]) {
      cover(imgs[L.tex], sh);
      if (L.tint) { g.globalCompositeOperation = 'multiply'; g.fillStyle = L.tint; g.fillRect(0, 0, CW, CH); }
      if (L.lift) { g.globalCompositeOperation = 'screen'; g.globalAlpha = L.lift; g.fillStyle = '#fff'; g.fillRect(0, 0, CW, CH); }
    } else { g.fillStyle = L.color; g.fillRect(0, 0, CW, CH); }
    g.restore();
  });
  // объём среза: чуть темнее к краю, мягкий блик
  const outer = pathOf(hLines[0]);
  if (outer) {
    g.save(); g.clip(outer.p);
    const cx = (outer.x0 + outer.x1) / 2, cy = CH / 2, R = Math.max(outer.x1 - outer.x0, outer.y1 - outer.y0) * .62;
    const vg = g.createRadialGradient(cx, cy, R * .45, cx, cy, R);
    vg.addColorStop(0, 'rgba(255,255,255,0)'); vg.addColorStop(1, 'rgba(200,150,120,.35)');
    g.globalCompositeOperation = 'multiply'; g.fillStyle = vg; g.fillRect(0, 0, CW, CH);
    const hl = g.createLinearGradient(outer.x0, outer.y0, outer.x1, outer.y1);
    hl.addColorStop(0, 'rgba(255,255,255,.16)'); hl.addColorStop(.5, 'rgba(255,255,255,0)');
    g.globalCompositeOperation = 'screen'; g.fillStyle = hl; g.fillRect(0, 0, CW, CH);
    g.restore();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return tex;
}

/* ---------- сборка ---------- */
const DEF_SR = { 3: [1, .93, .52], 4: [1, .93, .66, .38] };

let queue = Promise.resolve();
const idle = () => new Promise(r => setTimeout(r, 16));
export function createPhotoDessert(product, opts = {}) {
  const job = queue.then(idle).then(() => buildPhotoDessert(product, opts));
  queue = job.catch(() => {});
  return job;
}

async function buildPhotoDessert(product, opts) {
  const spec = product.three, withLayers = !!opts.layers;
  const texNames = [...new Set(['cream', ...spec.layers.map(L => L.tex).filter(Boolean)])];
  const [img, ...fills] = await Promise.all([loadImage(product.photo), ...texNames.map(n => loadImage(FILL(n)).catch(() => null))]);
  const imgs = Object.fromEntries(texNames.map((n, i) => [n, fills[i]]));
  const A = analyze(img, spec, opts.grid ?? 150);
  const n = spec.layers.length;
  const layers = spec.layers.map((L, k) => ({ ...L, off: (1 - (L.sr ?? DEF_SR[n][k])) * A.dmax }));
  const u = 2.2 / Math.max(A.W, A.H), depth = (spec.depth ?? 1) * u;
  const split = spec.split || (A.bw > A.bh * 1.05 ? 'y' : 'x');
  const cut = split === 'x' ? A.cx : A.cy;
  const D = (x, y) => bilinear(A.d, A.W, A.H, x, y);
  const hOf = off => (x, y) => { const e = D(x, y) - off, R = A.dmax - off; return e <= 0 ? 0 : depth * Math.sqrt(e * Math.max(0, 2 * R - e)); };
  const lDepth = depth * (spec.thinDepth ?? .55);
  const hThin = (x, y) => { const e = bilinear(A.lt, A.W, A.H, x, y); return e <= 0 ? 0 : lDepth * Math.sqrt(e * Math.max(0, 2 * A.lmax - e)); };
  const h0 = hOf(0), hShell = (x, y) => Math.max(h0(x, y), hThin(x, y));
  const hLine = off => { const f = hOf(off); return t => split === 'x' ? f(A.cx, t) : f(t, A.cy); };
  const hLines = layers.map(L => hLine(L.off));
  const covPhoto = (x, y) => bilinear(A.cov, A.W, A.H, x, y) > .02;
  const covFruit = off => (x, y) => D(x, y) - off > -2;

  const tex = new THREE.Texture(img); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; tex.needsUpdate = true;
  const tint = new THREE.Color(spec.photoTint || '#ffffff');

  // срез: одна картинка на весь разрез, слои — кольца этой же картинки
  const T = split === 'x' ? A.H : A.W; let t0 = T, t1 = 0, hm = 0;
  for (let t = 0; t <= T - 1; t += .5) { const h = hLines[0](t); if (h > 0) { t0 = Math.min(t0, t); t1 = Math.max(t1, t); hm = Math.max(hm, h); } }
  t0 -= 1; t1 += 1; hm *= 1.02;
  const capTex = capCanvas(A, split, layers, hLines, t0, t1, hm, u, imgs);
  const capMap = (t, z) => [(t - t0) / (t1 - t0), (z + hm) / (2 * hm)];
  const fillTex = {};
  for (const L of layers) if (L.tex && imgs[L.tex] && !fillTex[L.tex]) { const t = new THREE.Texture(imgs[L.tex]); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; fillTex[L.tex] = t; }
  const preMap = new THREE.MeshBasicMaterial({ map: tex, alphaTest: .5, colorWrite: false, side: THREE.DoubleSide });
  const preBasic = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
  const skin = skinColor(A, split);

  const withGrid = g => { g.setAttribute('gridUv', g.getAttribute('uv')); return g; };
  const mainSide = spec.explodeHalf === 0 ? -1 : 1;

  const halves = [-1, 1].map(side => {
    const group = new THREE.Group(), mats = [], pres = [], walls = [], inner = [];
    const reg = mat => { mat.transparent = true; mats.push(mat); return mat; };
    const add = (parent, geo, mat, photo = false, order = 0) => {
      const m = new THREE.Mesh(geo, mat); m.renderOrder = order; parent.add(m);
      // невидимый проход глубины: при растворении видна только ближняя поверхность
      const p = new THREE.Mesh(geo, photo ? preMap : preBasic); p.renderOrder = -10; p.visible = false; m.add(p); pres.push(p);
      return m;
    };
    const st = A.step;
    const xs = split === 'x' ? axisList(A.W, cut, side, st) : axisList(A.W, -1, 1, st).filter(v => v >= 0);
    const ys = split === 'y' ? axisList(A.H, cut, side, st) : axisList(A.H, -1, 1, st).filter(v => v >= 0);
    const capN = split === 'x' ? [side < 0 ? 1 : -1, 0, 0] : [0, side < 0 ? -1 : 1, 0];
    const front = reg(new THREE.MeshBasicMaterial({ map: tex, color: tint, alphaTest: .01, side: THREE.DoubleSide }));
    const back = reg(new THREE.MeshBasicMaterial({ map: tex, color: tint.clone().multiplyScalar(.7), alphaTest: .5, side: THREE.DoubleSide }));
    const capMat = reg(new THREE.MeshBasicMaterial({ map: capTex, side: THREE.DoubleSide }));
    const layered = withLayers && side === mainSide;
    const pieces = [];
    for (let k = 0; k < (layered ? n : 1); k++) {
      const L = layers[k], piece = new THREE.Group();
      if (k === 0) {
        const [sf, sb] = surfaces(A, xs, ys, hShell, covPhoto, u);
        add(piece, sb, back, true, 1); add(piece, sf, front, true, 2);
      } else {
        const ft = fillTex[L.tex];
        const m = reg(clipMaterial(new THREE.MeshStandardMaterial({ map: ft || null, color: new THREE.Color(ft ? L.tint || '#ffffff' : L.color), roughness: .62, side: THREE.DoubleSide }), A.distTex, L.off / A.dmax));
        const h = hOf(L.off), cf = covFruit(L.off);
        const [sf, sb] = surfaces(A, xs, ys, h, cf, u);
        inner.push(add(piece, withGrid(sf), m), add(piece, withGrid(sb), m));
      }
      // стенка полости — поверхность следующего слоя изнутри
      if (layered && k < n - 1) {
        const ft = k ? fillTex[L.tex] : null, N1 = layers[k + 1];
        const col = k ? new THREE.Color(ft ? L.tint || '#ffffff' : L.color) : new THREE.Color(`rgb(${skin.map(v => v | 0).join(',')})`).lerp(new THREE.Color(L.color), .6);
        const wm = reg(clipMaterial(new THREE.MeshBasicMaterial({ map: ft || null, color: col, vertexColors: true, side: THREE.DoubleSide }), A.distTex, Math.max(0, N1.off / A.dmax - .006)));
        const h = hOf(N1.off), cf = covFruit(N1.off);
        const [sf, sb] = surfaces(A, xs, ys, h, cf, u);
        // полость: мягкая тень вглубь вместо освещения — без полос
        const hmx = depth * (A.dmax - N1.off);
        [sf, sb].forEach(g => {
          const p = g.getAttribute('position'), c = new Float32Array(p.count * 3);
          for (let i = 0; i < p.count; i++) { const v = .97 - .3 * smoothstep(0, 1, Math.abs(p.getZ(i)) / hmx); c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = v; }
          g.setAttribute('color', new THREE.BufferAttribute(c, 3));
        });
        walls.push(add(piece, withGrid(sf), wm), add(piece, withGrid(sb), wm));
      }
      // внутренний край кольца чуть заходит на полость — без щелей между срезом и стенкой
      const inner1 = layered && k < n - 1 ? (t => Math.max(0, hLines[k + 1](t) - hm * .02)) : null;
      add(piece, capGeo(A, split, hLines[k], inner1, u, capN, capMap), capMat);
      group.add(piece); pieces.push(piece);
    }
    return { group, pieces, mats, pres, walls, inner, layered, alpha: 1, capN: new THREE.Vector3(...capN) };
  });
  const [H0, H1] = halves;
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body); body.add(H0.group, H1.group);

  // раскрытие книжкой: каждая половина поворачивается срезом к зрителю
  const Z = new THREE.Vector3(0, 0, 1), I = new THREE.Quaternion();
  const dir0 = split === 'x' ? new THREE.Vector3(-1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const ext = (split === 'x' ? A.bw : A.bh) * u;
  const ang = spec.openAngle ?? .78;
  const q0 = new THREE.Quaternion().slerpQuaternions(I, new THREE.Quaternion().setFromUnitVectors(dir0.clone().negate(), Z), ang);
  const q1 = new THREE.Quaternion().slerpQuaternions(I, new THREE.Quaternion().setFromUnitVectors(dir0, Z), ang);
  const gap = ext * (spec.gap ?? .34) + .12;
  const main = mainSide < 0 ? H0 : H1, other = main === H0 ? H1 : H0;
  const otherDir = other === H0 ? dir0.clone() : dir0.clone().negate();
  const qInv = new THREE.Quaternion(), tmp = new THREE.Vector3(), wx = new THREE.Vector3();
  const state = { open: 0, explode: 0, hide: 0, opacity: 1 };

  function setAlpha(H, a) {
    a = clamp(a);
    if (Math.abs(a - H.alpha) < 1e-4) return;
    H.alpha = a; H.group.visible = a > .004;
    const fade = a < .999;
    H.mats.forEach(m => { m.opacity = a; });
    H.pres.forEach(p => { p.visible = fade; });
  }
  function apply() {
    const o = ease(clamp(state.open)), e = main.layered ? clamp(state.explode) : 0, h = ease(clamp(state.hide));
    H0.group.position.copy(dir0).multiplyScalar(gap * o); H0.group.quaternion.slerpQuaternions(I, q0, o);
    H1.group.position.copy(dir0).multiplyScalar(-gap * o); H1.group.quaternion.slerpQuaternions(I, q1, o);
    // вторая половина тихо растворяется, отплывая назад, — без сжатия в точку
    other.group.position.addScaledVector(otherDir, ext * .45 * h).add(tmp.set(0, -.12 * h, -.7 * h));
    main.group.position.multiplyScalar(1 - .85 * h);
    setAlpha(main, state.opacity);
    setAlpha(other, state.opacity * (1 - smoothstep(.05, .75, clamp(state.hide))));
    // слои: сначала выходят из полости к зрителю, потом расходятся в стороны
    const lift = ease(clamp(e / .55)), spread = ease(clamp((e - .28) / .72));
    qInv.copy(main.group.quaternion).invert();
    main.pieces.forEach((p, k) => {
      p.position.copy(main.capN).multiplyScalar(lift * k * ext * .2);
      p.position.add(wx.set((k - (n - 1) / 2) * spread * ext * (spec.spread ?? 1.05), -.04 * k * spread, .1 * k * spread).applyQuaternion(qInv));
    });
    const ex = e > .002;
    main.walls.forEach(m => { m.visible = ex; });
    main.inner.forEach(m => { m.visible = ex; });
  }
  apply();
  const box = new THREE.Box3().setFromObject(body), size = box.getSize(new THREE.Vector3());
  state.open = 1; apply(); const boxO = new THREE.Box3().setFromObject(body); state.open = 0; apply();
  const radius = Math.max(size.length() / 2 * 1.02, boxO.getSize(new THREE.Vector3()).length() / 2 * .9);

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, opacity: spec.shadow ?? .9 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = box.min.y - .06;
  shadow.scale.set(size.x * 1.25, Math.max(size.x, size.y) * .55, 1); shadow.renderOrder = -20;
  root.add(shadow);
  const sb = shadow.scale.clone();
  const updShadow = () => {
    shadow.scale.set(sb.x * (1 + .4 * clamp(state.open) + .5 * clamp(state.explode)), sb.y, 1);
    shadow.material.opacity = (spec.shadow ?? .9) * (1 - .4 * clamp(state.explode)) * state.opacity;
  };

  return {
    root, layers, radius, size, split, ready: true,
    set(open, explode = 0, hide = 0) { state.open = open; state.explode = explode; state.hide = hide; apply(); updShadow(); },
    setOpacity(a) { if (Math.abs(a - state.opacity) < 1e-4) return; state.opacity = clamp(a); apply(); updShadow(); },
    anchor(k, target, top = false) {
      const b = new THREE.Box3().setFromObject(main.pieces[Math.min(k, main.pieces.length - 1)]);
      b.getCenter(target); target.y = top ? b.max.y : b.min.y; target.z = b.max.z;
      return target;
    },
    dispose() {
      root.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      tex.dispose(); capTex.dispose(); A.distTex.dispose(); Object.values(fillTex).forEach(t => t.dispose());
    },
  };
}
