// Карточки десертов, окно «Состав и КБЖУ», общие элементы страниц.
import { clamp, smooth } from './util.js';
import { frameSet, drawFrames } from './frames.js';
import { byId, rub } from './products.js';
import { cart, mountCart, flyToCart } from './cart.js';

export const isTouch = matchMedia('(hover: none)').matches;

// Десерт из кадров Blender внутри HTML-элемента: 0 — целый, 1 — в разрезе, 2 — по слоям
export function dessertView(el, product, opts = {}) {
  const cv = document.createElement('canvas'); cv.className = 'dessert-frames'; el.appendChild(cv);
  const ctx = cv.getContext('2d'), set = frameSet(product.id);
  const st = { a: 0, open: opts.open ?? 0, explode: 0, app: opts.revealEl ? 0 : 1, since: null };
  const ptr = { x: 0, y: 0, tx: 0, ty: 0 }, phase = Math.random() * 10;
  set.load(0, opts.all ? 99 : Math.ceil((set.meta?.frames ?? 36) / 2));
  const view = {
    el, product,
    frame(dt, t) {
      if (!set.meta || !set.frames[0]) return;
      const target = st.explode ? 2 : st.open ? 1 : 0;
      st.a += (target - st.a) * (1 - Math.exp(-dt * (opts.speed ?? 5)));
      if (Math.abs(target - st.a) < .002) st.a = target;
      ptr.x += (ptr.tx - ptr.x) * (1 - Math.exp(-dt * 5)); ptr.y += (ptr.ty - ptr.y) * (1 - Math.exp(-dt * 5));
      const ready = !opts.revealEl || (opts.revealEl.classList.contains('in') && document.documentElement.classList.contains('loaded'));
      if (ready && st.since == null) st.since = t;
      if (document.documentElement.classList.contains('shot')) st.app = 1;
      st.app += ((ready && t - st.since > .25 ? 1 : 0) - st.app) * (1 - Math.exp(-dt * 2.4));
      const W = el.clientWidth, H = el.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      const ae = st.app > .998 ? 1 : st.app * st.app * (3 - 2 * st.app);
      const sz = Math.min(W, H) * (opts.fill ?? 1.02) * (1 - (opts.shrink ?? .17) * smooth(0, 1, st.a)), dw = sz, dh = sz;
      const bob = Math.sin(t * 1.25 + phase) * 3 * (1 - st.a / 2);
      const dx = (W - dw) / 2 + ptr.x * 10, dy = H * (opts.cy ?? .47) - dh / 2 + bob + ptr.y * 6 + (1 - ae) * 24;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = ae;
      drawFrames(ctx, set, st.a, dx, dy, dw, dh, .18);
      ctx.globalAlpha = 1;
    },
    setOpen(v) { st.open = v; if (v) set.load(0, 99); }, setExplode(v) { st.explode = v; if (v) set.load(0, 99); }, setHide() {},
    pointer(x, y) { ptr.tx = x; ptr.ty = y; },
    dispose() { view.disposed = true; cv.remove(); },
  };
  return view;
}

// один цикл анимации на страницу: рисуются только видимые десерты
export function createStage() {
  const views = new Set(); let last = performance.now();
  const loop = now => {
    requestAnimationFrame(loop);
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    for (const v of views) {
      const r = v.el.getBoundingClientRect();
      if (r.bottom < -50 || r.top > innerHeight + 50 || !r.width) continue;
      v.frame(dt, now / 1000);
    }
  };
  requestAnimationFrame(loop);
  return { add(v) { views.add(v); return v; }, remove(v) { views.delete(v); } };
}

export function cardHTML(p, i = 0) {
  return `<article class="card reveal${i % 3 ? ' d' + (i % 3) : ''}" data-id="${p.id}" style="--tint:${p.tint};--accent:${p.accent}">
    <div class="card-stage" data-stage>
      <span class="card-hint">${isTouch ? 'Нажмите' : 'Наведите'} — разрежем</span>
      <span class="card-num">${String(i + 1).padStart(2, '0')}</span>
      <ul class="card-layers">${p.three.layers.map(l => `<li><i style="background:${l.color}"></i>${l.label}</li>`).join('')}</ul>
    </div>
    <div class="card-body">
      <div class="card-title"><h3>${p.name}</h3><span class="price">${rub(p.price)}<small>/ шт</small></span></div>
      <p>${p.short}</p>
      <div class="card-actions">
        <button class="btn small" data-add>В корзину</button>
        <button class="btn ghost small" data-info>Состав и КБЖУ</button>
      </div>
    </div>
  </article>`;
}

export function bindCard(card, stage, modal) {
  const p = byId(card.dataset.id);
  const stageEl = card.querySelector('[data-stage]');
  const view = stage.add(dessertView(stageEl, p, { revealEl: card }));
  card._view = view;
  const setOpen = v => { view.setOpen(v); card.classList.toggle('is-open', !!v); };
  if (/[?&]open\b/.test(location.search)) setOpen(1);
  if (isTouch) {
    stageEl.addEventListener('click', () => setOpen(card.classList.contains('is-open') ? 0 : 1));
  } else {
    card.addEventListener('pointerenter', () => setOpen(1));
    card.addEventListener('pointerleave', () => { setOpen(0); view.pointer(0, 0); });
    stageEl.addEventListener('pointermove', e => {
      const r = stageEl.getBoundingClientRect();
      view.pointer(((e.clientX - r.left) / r.width - .5) * 2, ((e.clientY - r.top) / r.height - .5) * 2);
    });
  }
  card.querySelector('[data-add]').addEventListener('click', e => { cart.add(p.id); flyToCart(e.currentTarget, p); toast(`${p.name} — в корзине`); });
  card.querySelector('[data-info]').addEventListener('click', () => modal.open(p.id));
  return view;
}

// окно с подробностями
export function mountModal() {
  const el = document.createElement('div');
  el.className = 'modal-root';
  el.innerHTML = `
    <div class="modal-backdrop" data-close></div>
    <section class="modal" role="dialog" aria-modal="true">
      <button class="icon-btn modal-close" data-close aria-label="Закрыть"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
      <div class="modal-visual">
        <div class="modal-stage"></div>
        <div class="seg" role="tablist">
          <button data-mode="0">Целиком</button><button data-mode="1" class="on">В разрезе</button><button data-mode="2">По слоям</button>
        </div>
      </div>
      <div class="modal-info"></div>
    </section>`;
  document.body.appendChild(el);
  const stageEl = el.querySelector('.modal-stage'), info = el.querySelector('.modal-info');
  let stage = null, view = null, mode = 1, qty = 1, current = null;

  const setMode = m => {
    mode = m;
    el.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', +b.dataset.mode === m));
    if (!view) return;
    view.setOpen(m > 0 ? 1 : 0); view.setExplode(m === 2 ? 1 : 0); view.setHide(m === 2 ? 1 : 0);
  };
  el.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => setMode(+b.dataset.mode)));

  function renderInfo(p) {
    info.innerHTML = `
      <p class="eyebrow">Корпусный десерт</p>
      <h2>${p.name}</h2>
      <p class="modal-price">${rub(p.price)} <small>за десерт</small></p>
      <p class="modal-short">${p.short}</p>
      <p class="modal-desc">${p.desc}</p>
      <h4>Что внутри</h4>
      <ol class="layer-list">${p.three.layers.map((l, i) => `<li><i style="background:${l.color}"></i><span>${l.label}</span><em>${i + 1}</em></li>`).join('')}</ol>
      <h4>КБЖУ на 100 г</h4>
      <div class="kbju">
        <div><b>${p.kbju.k}</b><span>ккал</span></div><div><b>${p.kbju.b}</b><span>белки</span></div>
        <div><b>${p.kbju.j}</b><span>жиры</span></div><div><b>${p.kbju.u}</b><span>углеводы</span></div>
      </div>
      <p class="muted small">Значения ориентировочные — точные цифры Елена подтвердит.</p>
      <ul class="facts">${p.facts.map(f => `<li>${f}</li>`).join('')}</ul>
      <div class="modal-buy">
        <div class="stepper big"><button type="button" data-dec aria-label="Меньше">−</button><span data-qty>1</span><button type="button" data-inc aria-label="Больше">+</button></div>
        <button class="btn" data-add>В корзину · <span data-sum>${rub(p.price)}</span></button>
      </div>`;
    const upd = () => { info.querySelector('[data-qty]').textContent = qty; info.querySelector('[data-sum]').textContent = rub(p.price * qty); };
    info.querySelector('[data-inc]').onclick = () => { qty++; upd(); };
    info.querySelector('[data-dec]').onclick = () => { qty = Math.max(1, qty - 1); upd(); };
    info.querySelector('[data-add]').onclick = e => { cart.add(p.id, qty); flyToCart(e.currentTarget, p); toast(`${p.name} × ${qty} — в корзине`); close(); };
  }

  function open(id) {
    const p = byId(id); current = p; qty = 1;
    el.querySelector('.modal').style.setProperty('--tint', p.tint);
    el.querySelector('.modal').style.setProperty('--accent', p.accent);
    renderInfo(p);
    document.documentElement.classList.add('modal-open');
    if (!stage) stage = createStage();
    if (view) { stage.remove(view); view.dispose(); }
    view = stage.add(dessertView(stageEl, p, { all: true, fill: .96, cy: .46, speed: 4 }));
    setMode(0);
    setTimeout(() => current === p && setMode(1), 450);
  }
  function close() { document.documentElement.classList.remove('modal-open'); }
  el.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  return { open, close };
}

let toastTimer;
export function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

export function initPage() {
  const html = document.documentElement;
  mountCart();
  const modal = mountModal();
  const stage = createStage();

  // занавес: логотип появляется, затем занавес уходит вверх
  const reveal = () => requestAnimationFrame(() => html.classList.add('loaded'));
  if (location.search.includes('shot')) {
    html.classList.add('loaded', 'shot');
    const go = new URLSearchParams(location.search).get('go');
    if (go) document.querySelectorAll('main > *').forEach(el => { if (el.id !== go && !el.classList.contains(go)) el.style.display = 'none'; });
  }
  reveal();
  addEventListener('pageshow', e => { if (e.persisted) { html.classList.remove('leaving'); html.classList.add('loaded'); } });

  // плавный уход на другую страницу
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a || a.target || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    const samePage = url.pathname === location.pathname || (url.pathname.endsWith('/') && location.pathname.endsWith('index.html')) || (location.pathname.endsWith('/') && url.pathname.endsWith('index.html'));
    if (samePage) {
      if (a.classList.contains('logo-mark')) { e.preventDefault(); boop(a); scrollTo({ top: 0, behavior: 'smooth' }); }
      else if (url.hash) { const t = document.querySelector(url.hash); if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth' }); } }
      html.classList.remove('menu-open');
      return;
    }
    e.preventDefault();
    if (a.classList.contains('logo-mark')) boop(a);
    html.classList.remove('menu-open');
    html.classList.add('leaving'); html.classList.remove('loaded');
    setTimeout(() => { location.href = a.href; }, 180);
  });
  const boop = el => { el.classList.remove('boop'); void el.offsetWidth; el.classList.add('boop'); };

  // шапка
  const head = document.querySelector('.site-head');
  const onScroll = () => head.classList.toggle('scrolled', scrollY > 10);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  document.querySelector('.menu-btn')?.addEventListener('click', () => html.classList.toggle('menu-open'));

  // появление блоков
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12, rootMargin: '0px 0px -6% 0px' });
  const watch = () => document.querySelectorAll('.reveal:not(.in)').forEach(n => html.classList.contains('shot') ? n.classList.add('in') : io.observe(n));
  watch();
  return { stage, modal, watch };
}

export { clamp };
