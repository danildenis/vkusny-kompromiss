import * as THREE from 'three';
import { initPage, cardHTML, bindCard } from './ui.js';
import { createDessert, addLights, clamp, smooth, ease } from './dessert3d.js';
import { byId } from './products.js';

const { stage, modal } = initPage();

/* ---------- первый экран: манго появляется и раскрывается по слоям ---------- */
const hero = document.querySelector('.hero');
const heroStage = document.querySelector('.hero-stage');
const panels = [...document.querySelectorAll('.hero-panel')];
const labels = [...document.querySelectorAll('.hero-label')];
const halo = document.querySelector('.hero-halo');
const mango = byId('mango');
const mobile = () => innerWidth < 820;

let d, ps = 0, t0 = null;
const qp = new URLSearchParams(location.search), DBG = qp.has('p') ? +qp.get('p') : null;
const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
addEventListener('pointermove', e => { ptr.tx = e.clientX / innerWidth - .5; ptr.ty = e.clientY / innerHeight - .5; }, { passive: true });

const v3 = new THREE.Vector3();
stage.add({
  el: heroStage,
  init(st) {
    this.scene = new THREE.Scene();
    addLights(this.scene, st.env);
    d = createDessert(mango, { quality: 1.5, hideVec: new THREE.Vector3(0, -.6, 0) });
    this.scene.add(d.root);
    this.camera = new THREE.PerspectiveCamera(24, 1, .1, 80);
    document.documentElement.classList.add('hero-ready');
  },
  update(dt, t, rect) {
    if (t0 === null) t0 = t;
    const r = hero.getBoundingClientRect();
    const p = DBG ?? clamp(-r.top / (r.height - innerHeight));
    ps += (p - ps) * (1 - Math.exp(-dt * 7));
    if (DBG !== null) { ps = p; t0 = -10; }
    ptr.x += (ptr.tx - ptr.x) * .06; ptr.y += (ptr.ty - ptr.y) * .06;

    // появление
    const i = clamp((t - t0 - .15) / 1.9), ie = 1 - Math.pow(1 - i, 3);
    const back = 1 + 2.2 * Math.pow(i - 1, 3) + 1.2 * Math.pow(i - 1, 2);
    // сценарий скролла
    const open = smooth(.08, .3, ps) * (1 - smooth(.86, .98, ps));
    const explode = smooth(.34, .6, ps) * (1 - smooth(.8, .92, ps));
    d.set(open, explode, explode);

    d.root.scale.setScalar(.35 + .65 * back);
    d.root.rotation.y = (1 - ie) * -2.4 + Math.sin(t * .45) * .12 * (1 - explode) + ptr.x * .3 - explode * .25;
    d.root.rotation.x = ptr.y * .12 + explode * .08;
    d.root.position.y = (1 - ie) * 1.2 + Math.sin(t * 1.1) * .03;

    // камера и смещение кадра
    const cam = this.camera, W = rect.width, H = rect.height, m = mobile();
        const dist = d.radius * (m ? 1.25 : 1.05) * (1 + explode * (m ? .32 : .62)) / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2)) / (m ? Math.max(W / H, .5) : 1);
    cam.position.set(0, Math.sin(.18) * dist, Math.cos(.18) * dist);
    cam.lookAt(0, 0, 0);
    const cx = m ? .5 : THREE.MathUtils.lerp(.7, .64, explode), cy = m ? THREE.MathUtils.lerp(.34, .4, explode) : .5;
    cam.setViewOffset(W, H, -(cx - .5) * W, -(cy - .5) * H, W, H);
    halo.style.transform = `translate(-50%,-50%) scale(${(.6 + .4 * ie) * (1 + .15 * open - .1 * explode)})`;
    halo.style.left = cx * 100 + '%'; halo.style.top = cy * 100 + '%';

    // тексты
    panels.forEach(pn => {
      const a = +pn.dataset.from, b = +pn.dataset.to;
      const vis = a === 0 ? (1 - smooth(b - .05, b, ps)) * ie : smooth(a, a + .05, ps) * (1 - smooth(b - .05, b, ps));
      pn.style.opacity = vis; pn.style.transform = `translateY(${(1 - vis) * 24}px)`;
      pn.style.pointerEvents = vis > .5 ? 'auto' : 'none';
    });
    document.querySelector('.scroll-cue').style.opacity = (1 - smooth(.02, .06, ps)) * ie;

    // подписи слоёв
    const lv = smooth(.55, .62, ps) * (1 - smooth(.78, .82, ps));
    cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    d.root.updateMatrixWorld(true);
    labels.forEach((lb, k) => {
      const up = k % 2 === 1; lb.classList.toggle('up', up);
      d.anchor(k, v3, up).project(cam);
      const x = (v3.x * .5 + .5) * W, y = (-v3.y * .5 + .5) * H;
      lb.style.transform = `translate(${x}px, ${y}px)`;
      lb.style.opacity = lv;
    });
  },
});

// подписи живут в отдельном слое поверх холста — прячем их, когда первый экран ушёл
const labelsLayer = document.querySelector('.hero-labels');
const syncLabels = () => { labelsLayer.style.visibility = hero.getBoundingClientRect().bottom > innerHeight * .98 ? 'visible' : 'hidden'; };
addEventListener('scroll', syncLabels, { passive: true }); syncLabels();

/* ---------- хиты ---------- */
const hits = document.querySelector('.hits-grid');
['pistachio', 'mango', 'blueberry'].forEach(id => hits.insertAdjacentHTML('beforeend', cardHTML(byId(id))));
hits.querySelectorAll('.card').forEach(c => bindCard(c, stage, modal));
