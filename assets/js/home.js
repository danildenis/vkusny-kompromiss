import { initPage, cardHTML, bindCard } from './ui.js';
import { clamp, smooth } from './util.js';
import { frameLoader, framePos, drawAt } from './frames.js';
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

// Манго отрендерено в Blender: кадр выбирается по прокрутке, соседние кадры плавно смешиваются
const cv = document.createElement('canvas'); cv.className = 'hero-frames'; heroStage.appendChild(cv);
const ctx = cv.getContext('2d');
const anim = frameLoader('assets/anim/mango/'); anim.load();

// надпись в глубине: вместо размытия на каждом кадре — заранее размытая копия, которая проявляется
const ghost = title.cloneNode(true); ghost.removeAttribute('class'); ghost.className = 'hero-title hero-title-blur';
ghost.setAttribute('aria-hidden', 'true'); ghost.querySelectorAll('[aria-label]').forEach(e => e.removeAttribute('aria-label'));
const ghostEl = document.createElement('div'); ghostEl.innerHTML = ghost.outerHTML.replace(/^<h1/, '<div').replace(/h1>$/, 'div>');
title.after(ghostEl.firstChild); const titleBlur = title.nextElementSibling;

let last = performance.now(), fs = 0, drawn = '', an = null, box = null;
function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(.05, (now - last) / 1000); last = now; const t = now / 1000;
  const meta = anim.meta;
  if (!meta || !anim.frames[0]) return;
  if (t0 === null) { if (!html.classList.contains('loaded') && DBG === null) return; t0 = t + .1; }
  const r = hero.getBoundingClientRect();
  if (r.bottom < 0) return;
  const p = DBG ?? clamp(-r.top / (r.height - innerHeight));
  ps += (p - ps) * (1 - Math.exp(-dt * 6)); if (DBG !== null) { ps = p; t0 = -10; }
  ptr.x += (ptr.tx - ptr.x) * .05; ptr.y += (ptr.ty - ptr.y) * .05;

  const open = smooth(.08, .3, ps) * (1 - smooth(.86, .98, ps));
  const explode = smooth(.34, .62, ps) * (1 - smooth(.78, .92, ps));
  const a = Math.min(2, open + explode);             // 0 целое · 1 раскрыто · 2 слои
  const target = Math.min(anim.upto, framePos(anim, a));   // дальше загруженных кадров не идём
  fs += (target - fs) * (1 - Math.exp(-dt * 9)); if (DBG !== null) fs = target;   // мягкое движение по кадрам
  if (Math.abs(target - fs) < .002) fs = target;

  const W = heroStage.clientWidth, H = heroStage.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
  const [FW, FH] = meta.size, m = mobile();
  // камера в Blender сама отъезжает к разлёту слоёв — здесь масштаб почти постоянный
  const fa = fs / (meta.frames - 1) * meta.a_max;
  const s = m ? Math.min(H * .8 / FH, W * (1.45 - .45 * smooth(0, 2, fa)) / FW) : Math.min(H * .84 / FH, W * .88 / FW) * (1 + .14 * smooth(.6, 2, fa));
  const dw = FW * s, dh = FH * s, cy = H * (m ? .46 : .53);
  const dx = (W - dw) / 2, dy = cy - dh / 2;

  // появление, покачивание и отклик на курсор — сдвигом холста, без перерисовки
  const i = clamp((t - t0) / 2.2), ie = 1 - Math.pow(1 - i, 3);
  const bob = Math.sin(t * 1.05) * 3 * (1 - a / 2);
  const ox = ptr.x * 14, oy = (1 - ie) * 36 + bob + ptr.y * 8;
  cv.style.transform = `translate3d(${ox.toFixed(2)}px, ${oy.toFixed(2)}px, 0)`;
  cv.style.opacity = smooth(0, .7, i).toFixed(3);
  cv.style.filter = i < 1 ? `blur(${((1 - ie) * 10).toFixed(1)}px)` : '';

  const key = `${fs.toFixed(4)}|${W}|${H}`;
  if (key !== drawn) {
    drawn = key;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    an = drawAt(ctx, anim, fs, dx, dy, dw, dh, .2);
  }

  // надпись позади: при раскрытии отходит в глубину
  const back = Math.max(open, explode);
  const tb = smooth(0, 1, back), to = 1 - .82 * back;
  title.style.opacity = to * (1 - tb); titleBlur.style.opacity = to * tb;
  title.style.transform = titleBlur.style.transform = `scale(${1 - .08 * back})`;
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
  const sr = heroStage.getBoundingClientRect();
  labels.forEach((lb, k2) => {
    const up = k2 % 2 === 1; lb.classList.toggle('up', up);
    const [ax, ay0, ay1] = an[k2];
    lb.style.transform = `translate(${sr.left + ox + dx + ax * dw}px, ${sr.top + oy + dy + (up ? ay1 : ay0) * dh}px)`;
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
