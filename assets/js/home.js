import { initPage, cardHTML, bindCard } from './ui.js';
import { clamp, smooth } from './dessert3d.js';
import { byId } from './products.js';

const { stage, modal, watch } = initPage();
const html = document.documentElement;

/* ---------- первый экран: манго в центре, перед надписью ---------- */
const hero = document.querySelector('.hero');
const heroStage = document.querySelector('.hero-stage');
const title = document.querySelector('.hero-title');
const rings = document.querySelector('.hero-rings');
const foot = document.querySelector('.hero-foot');
const cue = document.querySelector('.cue-wrap');
const panels = [...document.querySelectorAll('.hero-panel')];
const labels = [...document.querySelectorAll('.hero-label')];
const decos = [...document.querySelectorAll('.hero .deco')].map(el => ({ el, depth: +el.dataset.depth || 0, base: el.style.transform || '' }));
const mobile = () => innerWidth < 820;
const qp = new URLSearchParams(location.search), DBG = qp.has('p') ? +qp.get('p') : null;

let ps = 0, t0 = null;
const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
addEventListener('pointermove', e => { ptr.tx = e.clientX / innerWidth - .5; ptr.ty = e.clientY / innerHeight - .5; }, { passive: true });

// Манго отрендерено в Blender: кадр выбирается по прокрутке, соседние кадры мягко смешиваются
const ANIM = 'assets/anim/mango/';
const cv = document.createElement('canvas'); cv.className = 'hero-frames'; heroStage.appendChild(cv);
const ctx = cv.getContext('2d');
let meta = null; const frames = [];
fetch(ANIM + 'meta.json').then(r => r.json()).then(m => {
  meta = m;
  const load = i => new Promise(res => { const im = new Image(); im.decoding = 'async'; im.onload = () => { frames[i] = im; res(); }; im.onerror = res; im.src = `${ANIM}f${String(i).padStart(3, '0')}.webp`; });
  // сначала первый кадр, затем опорные, затем все остальные
  load(0).then(async () => {
    const order = []; for (let st = 16; st >= 1; st >>= 1) for (let i = 0; i < m.frames; i += st) if (!order.includes(i)) order.push(i);
    for (let k = 0; k < order.length; k += 6) await Promise.all(order.slice(k, k + 6).map(load));
  });
});
const nearest = i => { for (let r = 0; r < frames.length + 2; r++) { if (frames[i - r]) return i - r; if (frames[i + r]) return i + r; } return -1; };

let last = performance.now();
function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(.05, (now - last) / 1000); last = now; const t = now / 1000;
  if (!meta || !frames[0]) return;
  if (t0 === null) { if (!html.classList.contains('loaded') && DBG === null) return; t0 = t + .1; }
  const r = hero.getBoundingClientRect();
  if (r.bottom < 0) return;
  const p = DBG ?? clamp(-r.top / (r.height - innerHeight));
  ps += (p - ps) * (1 - Math.exp(-dt * 7)); if (DBG !== null) { ps = p; t0 = -10; }
  ptr.x += (ptr.tx - ptr.x) * .05; ptr.y += (ptr.ty - ptr.y) * .05;

  const open = smooth(.08, .3, ps) * (1 - smooth(.86, .98, ps));
  const explode = smooth(.34, .62, ps) * (1 - smooth(.78, .92, ps));
  const a = Math.min(2, open + explode);             // 0 целое · 1 раскрыто · 2 слои
  const fpos = a / meta.a_max * (meta.frames - 1);

  // размер холста и вписывание кадра: целое манго крупно, разлёт слоёв — по ширине экрана
  const W = heroStage.clientWidth, H = heroStage.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const [FW, FH] = meta.size, m = mobile();
  const sWhole = Math.min(H * (m ? .78 : .9) / FH, W * (m ? 1.9 : 1.3) / FW), sFit = Math.min(sWhole, W * (m ? 1.05 : .98) / FW);
  const s = sWhole + (sFit - sWhole) * smooth(0, 1.6, a);
  const dw = FW * s, dh = FH * s, cy = H * (m ? .45 : .52);
  const i = clamp((t - t0) / 2.2), ie = 1 - Math.pow(1 - i, 3);
  const bob = Math.sin(t * 1.05) * 4 * (1 - a / 2);
  const dx = (W - dw) / 2 + ptr.x * 18, dy = cy - dh / 2 + (1 - ie) * 40 + bob + ptr.y * 10;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
  ctx.imageSmoothingQuality = 'high';
  const f0 = Math.floor(fpos), k = fpos - f0, A = nearest(f0), B = nearest(Math.min(meta.frames - 1, f0 + 1));
  ctx.globalAlpha = smooth(0, .7, i);
  if (A >= 0) ctx.drawImage(frames[A], dx, dy, dw, dh);
  if (B >= 0 && B !== A && k > .01) { ctx.globalAlpha *= k; ctx.drawImage(frames[B], dx, dy, dw, dh); }
  ctx.globalAlpha = 1;
  cv.style.filter = i < 1 ? `blur(${(1 - ie) * 10}px)` : '';

  // надпись позади: при раскрытии отходит в глубину
  const back = Math.max(open, explode);
  title.style.opacity = 1 - .82 * back;
  title.style.transform = `scale(${1 - .08 * back})`;
  title.style.filter = back > .01 ? `blur(${back * 3}px)` : '';
  rings.style.transform = `scale(${1 + .18 * open - .25 * explode})`;
  rings.style.opacity = 1 - explode * .7;
  foot.style.opacity = 1 - smooth(.02, .08, ps);
  foot.style.pointerEvents = ps > .05 ? 'none' : '';
  cue.style.opacity = 1 - smooth(.01, .05, ps);

  decos.forEach(o => {
    const kd = o.depth;
    o.el.style.transform = `translate3d(${ptr.x * kd * 46}px, ${ptr.y * kd * 30 - ps * kd * 220 + Math.sin(t * .6 + kd * 3) * 6 * Math.abs(kd)}px, 0) ${o.base}`;
  });
  panels.forEach(pn => {
    const pa = +pn.dataset.from, pb = +pn.dataset.to;
    const vis = smooth(pa, pa + .05, ps) * (1 - smooth(pb - .05, pb, ps));
    pn.style.opacity = vis; pn.style.transform = `translateY(${(1 - vis) * 26}px)`;
    pn.style.pointerEvents = vis > .5 ? 'auto' : 'none';
  });

  // подписи слоёв — по точкам, которые Blender посчитал для каждого кадра
  const lv = smooth(.55, .62, ps) * (1 - smooth(.78, .82, ps));
  const an = meta.anchors[Math.round(fpos)], sr = heroStage.getBoundingClientRect();
  labels.forEach((lb, k2) => {
    const up = k2 % 2 === 1; lb.classList.toggle('up', up);
    const [ax, ay0, ay1] = an[k2];
    lb.style.transform = `translate(${sr.left + dx + ax * dw}px, ${sr.top + dy + (up ? ay1 : ay0) * dh}px)`;
    lb.style.opacity = lv;
  });
}
requestAnimationFrame(tick);

// подписи живут в слое поверх холста — прячем их, когда первый экран ушёл
const labelsLayer = document.querySelector('.hero-labels');
const syncLabels = () => { labelsLayer.style.visibility = hero.getBoundingClientRect().bottom > innerHeight * .98 ? 'visible' : 'hidden'; };
addEventListener('scroll', syncLabels, { passive: true }); syncLabels();

/* ---------- хиты ---------- */
const hits = document.querySelector('.hits-grid');
['pistachio', 'mango', 'blueberry'].forEach((id, i) => hits.insertAdjacentHTML('beforeend', cardHTML(byId(id), i)));
hits.querySelectorAll('.card').forEach(c => bindCard(c, stage, modal));
watch();
