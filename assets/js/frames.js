// Десерты, отрендеренные в Blender: наборы кадров (целый → разрез → слои) и их рисование на холсте.
const sets = new Map();

// Загрузка кадров по порядку: анимация идёт только по уже готовым (раскодированным) кадрам, без прыжков
export function frameLoader(base, onMeta) {
  const set = { meta: null, frames: [], upto: -1, started: false, done: false };
  set.ready = fetch(base + 'meta.json').then(r => r.json()).then(m => { set.meta = m; onMeta?.(m); return m; });
  const one = i => new Promise(res => {
    const im = new Image(); im.decoding = 'async';
    im.onload = () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => { set.frames[i] = im; res(); });
    im.onerror = res;
    im.src = `${base}f${String(i).padStart(3, '0')}.webp`;
  });
  const bump = () => { while (set.frames[set.upto + 1]) set.upto++; set.done = set.upto >= set.meta.frames - 1; };
  set.load = () => {
    if (set.started) return set.ready; set.started = true;
    return set.ready.then(async m => {
      await one(0); bump();
      let next = 1;
      const worker = async () => { while (next < m.frames) { const i = next++; await one(i); bump(); } };
      await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);
      bump();
    });
  };
  return set;
}

export function frameSet(id) {
  if (!sets.has(id)) sets.set(id, frameLoader(`assets/anim/cat/${id}/`));
  return sets.get(id);
}

// Плавный переход между соседними кадрами на чистом холсте: A·(1−k) + B·k — сложение без просвечивания
export function drawBlend(ctx, A, B, k, dx, dy, dw, dh) {
  ctx.imageSmoothingQuality = 'medium';   // 'high' (бикубика) на больших холстах роняет частоту кадров вдвое
  if (!B || k < .004) return ctx.drawImage(A, dx, dy, dw, dh);
  if (k > .996) return ctx.drawImage(B, dx, dy, dw, dh);
  const ga = ctx.globalAlpha;
  ctx.globalAlpha = ga * (1 - k); ctx.drawImage(A, dx, dy, dw, dh);
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = ga * k; ctx.drawImage(B, dx, dy, dw, dh);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = ga;
}

const lerpA = (A, B, k) => A.map((v, n) => v + (B[n] - v) * k);

// мягкие тени под кусками; где куски стоят вместе, тени не складываются
export function drawShadows(ctx, an, dx, dy, dw, dh, shade) {
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
}

// кадр по дробному номеру fpos на очищенном холсте: смешивание соседних кадров + тени по опорным точкам
export function drawAt(ctx, set, fpos, dx, dy, dw, dh, shade = .2) {
  const m = set.meta; if (!m || !set.frames[0]) return null;
  fpos = Math.max(0, Math.min(m.frames - 1, set.upto, fpos));
  const f0 = Math.floor(fpos), f1 = Math.min(m.frames - 1, f0 + 1), kf = fpos - f0;
  const an = m.anchors[f0].map((v, n) => lerpA(v, m.anchors[f1][n], kf));
  drawBlend(ctx, set.frames[f0], set.frames[f1], kf, dx, dy, dw, dh);
  ctx.globalCompositeOperation = 'destination-over';      // тени — позади десерта
  drawShadows(ctx, an, dx, dy, dw, dh, shade);
  ctx.globalCompositeOperation = 'source-over';
  return an;
}

// положение a (0 целый · 1 разрез · 2 слои) → дробный номер кадра
export const framePos = (set, a) => a / set.meta.a_max * (set.meta.frames - 1);

export function drawFrames(ctx, set, a, dx, dy, dw, dh, shade = .2) {
  if (!set.meta) return null;
  return drawAt(ctx, set, framePos(set, a), dx, dy, dw, dh, shade);
}
