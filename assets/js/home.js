import * as THREE from 'three';
import { initPage, cardHTML, bindCard } from './ui.js';
import { createDessert, addLights, clamp, smooth } from './dessert3d.js';
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
const mobile = () => innerWidth < 820;
const qp = new URLSearchParams(location.search), DBG = qp.has('p') ? +qp.get('p') : null;

let d, ps = 0, t0 = null;
const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
addEventListener('pointermove', e => { ptr.tx = e.clientX / innerWidth - .5; ptr.ty = e.clientY / innerHeight - .5; }, { passive: true });
const v3 = new THREE.Vector3();
const backOut = x => 1 + 2.4 * Math.pow(x - 1, 3) + 1.4 * Math.pow(x - 1, 2);

stage.add({
  el: heroStage,
  init(st) {
    this.scene = new THREE.Scene();
    addLights(this.scene, st.env);
    d = createDessert(byId('mango'), { quality: 1.6, hideVec: new THREE.Vector3(0, -.6, 0) });
    this.scene.add(d.root);
    this.camera = new THREE.PerspectiveCamera(22, 1, .1, 80);
  },
  update(dt, t, rect) {
    // ждём, пока уйдёт занавес
    if (t0 === null) { if (!html.classList.contains('loaded') && DBG === null) { d.root.scale.setScalar(.001); return; } t0 = t + .55; }
    const r = hero.getBoundingClientRect();
    const p = DBG ?? clamp(-r.top / (r.height - innerHeight));
    ps += (p - ps) * (1 - Math.exp(-dt * 7));
    if (DBG !== null) { ps = p; t0 = -10; }
    ptr.x += (ptr.tx - ptr.x) * .05; ptr.y += (ptr.ty - ptr.y) * .05;

    // появление: падает сверху, вращаясь, и мягко пружинит
    const i = clamp((t - t0) / 2.1), ie = 1 - Math.pow(1 - i, 4);
    const open = smooth(.08, .3, ps) * (1 - smooth(.86, .98, ps));
    const explode = smooth(.34, .6, ps) * (1 - smooth(.8, .92, ps));
    d.set(open, explode, explode);
    d.root.scale.setScalar(Math.max(.001, .25 + .75 * backOut(i)));
    d.root.rotation.y = (1 - ie) * -3.4 + Math.sin(t * .4) * .14 * (1 - explode) + ptr.x * .35 - explode * .2;
    d.root.rotation.x = (1 - ie) * .6 + ptr.y * .14 + explode * .08;
    d.root.rotation.z = (1 - ie) * .5;
    d.root.position.y = (1 - ie) * 2.2 + Math.sin(t * 1.05) * .035 * ie;

    // камера: десерт крупно по центру
    const cam = this.camera, W = rect.width, H = rect.height, m = mobile();
    const fit = (m ? 1.05 : .82) * (1 + open * (m ? .25 : .42) + explode * (m ? .3 : .45));
    const dist = d.radius * fit / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2)) / (m ? Math.max(W / H, .5) : Math.min(1, W / H / 1.2));
    cam.position.set(0, Math.sin(.16) * dist, Math.cos(.16) * dist);
    cam.lookAt(0, 0, 0);
    const cy = m ? .45 : .52;
    cam.setViewOffset(W, H, 0, -(cy - .5) * H, W, H);

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

    panels.forEach(pn => {
      const a = +pn.dataset.from, b = +pn.dataset.to;
      const vis = smooth(a, a + .05, ps) * (1 - smooth(b - .05, b, ps));
      pn.style.opacity = vis; pn.style.transform = `translateY(${(1 - vis) * 26}px)`;
      pn.style.pointerEvents = vis > .5 ? 'auto' : 'none';
    });

    // подписи слоёв
    const lv = smooth(.55, .62, ps) * (1 - smooth(.78, .82, ps));
    cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    d.root.updateMatrixWorld(true);
    labels.forEach((lb, k) => {
      const up = k % 2 === 1; lb.classList.toggle('up', up);
      d.anchor(k, v3, up).project(cam);
      lb.style.transform = `translate(${(v3.x * .5 + .5) * W}px, ${(-v3.y * .5 + .5) * H}px)`;
      lb.style.opacity = lv;
    });
  },
});

// подписи живут в слое поверх холста — прячем их, когда первый экран ушёл
const labelsLayer = document.querySelector('.hero-labels');
const syncLabels = () => { labelsLayer.style.visibility = hero.getBoundingClientRect().bottom > innerHeight * .98 ? 'visible' : 'hidden'; };
addEventListener('scroll', syncLabels, { passive: true }); syncLabels();

/* ---------- хиты ---------- */
const hits = document.querySelector('.hits-grid');
['pistachio', 'mango', 'blueberry'].forEach((id, i) => hits.insertAdjacentHTML('beforeend', cardHTML(byId(id), i)));
hits.querySelectorAll('.card').forEach(c => bindCard(c, stage, modal));
watch();
