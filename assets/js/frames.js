// Десерты, отрендеренные в Blender: наборы кадров (целый → разрез → слои) и их рисование на холсте.
const sets = new Map();

export function frameSet(id) {
  if (sets.has(id)) return sets.get(id);
  const base = `assets/anim/cat/${id}/`;
  const set = { meta: null, frames: [], asked: new Set() };
  set.ready = fetch(base + 'meta.json').then(r => r.json()).then(m => (set.meta = m));
  const one = i => new Promise(res => {
    const im = new Image(); im.decoding = 'async';
    im.onload = () => { set.frames[i] = im; res(); }; im.onerror = res;
    im.src = `${base}f${String(i).padStart(3, '0')}.webp`;
  });
  // кадры с from по to: сначала каждый четвёртый, потом остальные
  set.load = (from, to) => set.ready.then(async m => {
    const ids = [];
    for (let i = from; i <= Math.min(to, m.frames - 1); i++) if (!set.asked.has(i)) { set.asked.add(i); ids.push(i); }
    ids.sort((a, b) => (a % 4 !== 0) - (b % 4 !== 0) || a - b);
    if (ids[0] === 0 || ids.includes(0)) { await one(0); ids.splice(ids.indexOf(0), 1); }
    for (let k = 0; k < ids.length; k += 6) await Promise.all(ids.slice(k, k + 6).map(one));
  });
  set.nearest = i => { for (let r = 0; r <= set.frames.length; r++) { if (set.frames[i - r]) return set.frames[i - r]; if (set.frames[i + r]) return set.frames[i + r]; } return null; };
  sets.set(id, set);
  return set;
}

const lerpA = (A, B, k) => A.map((v, n) => v + (B[n] - v) * k);

// кадр по положению a (0 целый · 1 разрез · 2 слои) + мягкие тени под кусками
export function drawFrames(ctx, set, a, dx, dy, dw, dh, shade = .2) {
  const m = set.meta; if (!m) return null;
  const fpos = Math.max(0, Math.min(m.frames - 1, a / m.a_max * (m.frames - 1)));
  const f0 = Math.floor(fpos), kf = fpos - f0;
  const an = m.anchors[f0].map((v, n) => lerpA(v, m.anchors[Math.min(m.frames - 1, f0 + 1)][n], kf));
  const sh = an.map(([, by, , x0, x1]) => ({ x0: dx + x0 * dw, x1: dx + x1 * dw, y: dy + by * dh }));
  sh.forEach((e, n) => {
    let over = 0;
    sh.forEach((o, k) => { if (k !== n) over += Math.min(1, Math.max(0, Math.min(e.x1, o.x1) - Math.max(e.x0, o.x0)) / Math.max(1, e.x1 - e.x0)); });
    const cx = (e.x0 + e.x1) / 2, rw = (e.x1 - e.x0) * .62, rh = rw * .16;
    const g = ctx.createRadialGradient(cx, e.y, 0, cx, e.y, rw);
    g.addColorStop(0, `rgba(108, 21, 30, ${shade / (1 + over)})`); g.addColorStop(1, 'rgba(108, 21, 30, 0)');
    ctx.save(); ctx.translate(cx, e.y); ctx.scale(1, rh / rw); ctx.translate(-cx, -e.y);
    ctx.fillStyle = g; ctx.fillRect(cx - rw, e.y - rw, rw * 2, rw * 2); ctx.restore();
  });
  const im = set.nearest(Math.round(fpos));
  if (im) { ctx.imageSmoothingQuality = 'high'; ctx.drawImage(im, dx, dy, dw, dh); }
  return an;
}
