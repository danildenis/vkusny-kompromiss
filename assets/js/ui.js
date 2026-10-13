// Карточки десертов, окно «Состав и КБЖУ», общие элементы страниц.
import * as THREE from 'three';
import { Stage } from './stage.js';
import { createDessert, addLights, clamp } from './dessert3d.js';
import { byId, rub } from './products.js';
import { cart, mountCart, flyToCart } from './cart.js';

export const isTouch = matchMedia('(hover: none)').matches;

// 3D-вид одного десерта внутри HTML-элемента
export function dessertView(el, product, opts = {}) {
  const st = { open: 0, explode: 0, hide: 0, tOpen: opts.open ?? 0, tExplode: 0, tHide: 0 };
  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  const phase = Math.random() * 10;
  let d;
  const view = {
    el, product,
    init(stage) {
      view.scene = new THREE.Scene();
      addLights(view.scene, stage.env);
      d = view.dessert = createDessert(product, { quality: opts.quality ?? .8, hideVec: new THREE.Vector3(0, -.2, -6) });
      view.scene.add(d.root);
      view.camera = new THREE.PerspectiveCamera(opts.fov ?? 24, 1, .1, 60);
    },
    update(dt, t, rect) {
      const k = 1 - Math.exp(-dt * (opts.speed ?? 4.5));
      st.open += (st.tOpen - st.open) * k; st.explode += (st.tExplode - st.explode) * k; st.hide += (st.tHide - st.hide) * k;
      ptr.x += (ptr.tx - ptr.x) * k; ptr.y += (ptr.ty - ptr.y) * k;
      d.set(st.open, st.explode, st.hide);
      d.root.rotation.y = Math.sin(t * .55 + phase) * .16 * (1 - st.explode * .6) + ptr.x * .35;
      d.root.rotation.x = ptr.y * .18;
      d.root.position.y = Math.sin(t * 1.25 + phase) * .025;
      const cam = view.camera, aspect = rect.width / rect.height;
      const fit = (opts.fit ?? .9) * (1 + st.explode * (opts.explodeZoom ?? .45));
      let dist = d.radius * fit / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2));
      if (aspect < 1) dist /= Math.max(aspect, .55);
      const el2 = opts.elev ?? .2;
      cam.position.set(0, Math.sin(el2) * dist, Math.cos(el2) * dist);
      cam.lookAt(0, (opts.lookY ?? -.04) * d.radius, 0);
    },
    setOpen(v) { st.tOpen = v; }, setExplode(v) { st.tExplode = v; }, setHide(v) { st.tHide = v; },
    pointer(x, y) { ptr.tx = x; ptr.ty = y; },
    dispose() { d?.dispose(); },
  };
  return view;
}

export function cardHTML(p) {
  return `<article class="card" data-id="${p.id}" style="--tint:${p.tint};--accent:${p.accent}">
    <div class="card-stage" data-stage>
      <span class="card-hint">${isTouch ? 'Нажмите' : 'Наведите'} — разрежем</span>
      <ul class="card-layers">${p.three.layers.map(l => `<li><i style="background:${l.color}"></i>${l.label}</li>`).join('')}</ul>
    </div>
    <div class="card-body">
      <div class="card-title"><h3>${p.name}</h3><span class="price">${rub(p.price)}</span></div>
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
  const view = stage.add(dessertView(stageEl, p, { quality: .75 }));
  card._view = view;
  const setOpen = v => { view.setOpen(v); view.setExplode(v ? .14 : 0); card.classList.toggle('is-open', !!v); };
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
        <div class="modal-stage"><canvas class="modal-gl"></canvas></div>
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
      <p class="modal-short">${p.short}</p>
      <p>${p.desc}</p>
      <h4>Что внутри</h4>
      <ol class="layer-list">${p.three.layers.map((l, i) => `<li><i style="background:${l.color}"></i><span>${l.label}</span><em>${String(i + 1).padStart(2, '0')}</em></li>`).join('')}</ol>
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
    if (!stage) stage = new Stage(el.querySelector('.modal-gl'));
    if (view) { stage.remove(view); view.dispose(); }
    view = stage.add(dessertView(stageEl, p, { quality: 1.1, fit: .95, explodeZoom: .22, elev: .22 }));
    stage.paused = false;
    setMode(0);
    setTimeout(() => current === p && setMode(1), 450);
  }
  function close() { document.documentElement.classList.remove('modal-open'); if (stage) setTimeout(() => { if (!document.documentElement.classList.contains('modal-open')) stage.paused = true; }, 400); }
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
  mountCart();
  const modal = mountModal();
  const stage = new Stage(document.getElementById('gl'));
  // шапка: тень при скролле, мобильное меню
  const head = document.querySelector('.site-head');
  const onScroll = () => head.classList.toggle('scrolled', scrollY > 10);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  document.querySelector('.menu-btn')?.addEventListener('click', () => document.documentElement.classList.toggle('menu-open'));
  document.querySelectorAll('.site-nav a').forEach(a => a.addEventListener('click', () => document.documentElement.classList.remove('menu-open')));
  // появление блоков
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .15 });
  document.querySelectorAll('.reveal').forEach(n => io.observe(n));
  return { stage, modal };
}

export { clamp };
