// Один WebGL-холст на страницу: каждый десерт рисуется в прямоугольник своего HTML-элемента.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.LinearToneMapping;
    r.toneMappingExposure = 1;
    r.setClearColor(0x000000, 0);
    r.autoClear = false;
    const pmrem = new THREE.PMREMGenerator(r);
    this.env = pmrem.fromScene(new RoomEnvironment(), .04).texture;
    this.views = [];
    this.clock = new THREE.Clock();
    this.paused = false;
    const loop = () => { requestAnimationFrame(loop); if (!this.paused) this.frame(); };
    requestAnimationFrame(loop);
  }
  add(view) { view.ready = false; this.views.push(view); return view; }
  remove(view) { this.views = this.views.filter(v => v !== view); }
  frame() {
    const r = this.renderer, cv = this.canvas;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.floor(w * r.getPixelRatio()) || cv.height !== Math.floor(h * r.getPixelRatio())) r.setSize(w, h, false);
    const dt = Math.min(this.clock.getDelta(), .05), t = this.clock.elapsedTime;
    r.setScissorTest(false); r.clear(); r.setScissorTest(true);
    const c = cv.getBoundingClientRect();
    for (const v of this.views) {
      const b = v.el.getBoundingClientRect();
      const x = b.left - c.left, y = b.top - c.top;
      if (b.width < 2 || b.height < 2 || y + b.height < 0 || y > h || x + b.width < 0 || x > w) { v.visible = false; continue; }
      if (!v.ready) { v.init(this); v.ready = true; }
      v.visible = true;
      const bottom = h - (y + b.height);
      r.setViewport(x, bottom, b.width, b.height);
      const sx = Math.max(0, x), sy = Math.max(0, bottom);
      r.setScissor(sx, sy, Math.min(x + b.width, w) - sx, Math.min(bottom + b.height, h) - sy);
      v.camera.aspect = b.width / b.height;
      v.update?.(dt, t, b);
      v.camera.updateProjectionMatrix();
      r.render(v.scene, v.camera);
    }
  }
}
