# Анимация для главной: манго раскрывается книжкой, затем слои задней половины расходятся.
# Запуск: Blender -b -P 3d/mango_anim.py -- <папка кадров> <кадров> <ширина> <высота> <сэмплы> [a1,a2,...]
import sys, os, math, json
sys.path.insert(0, os.path.dirname(__file__))
argv = sys.argv[sys.argv.index('--') + 1:]
OUT, NF, W, H, SPP = argv[0], int(argv[1]), int(argv[2]), int(argv[3]), int(argv[4])
ONLY = [float(v) for v in argv[5].split(',')] if len(argv) > 5 else None
sys.argv = ['x', '--', OUT, 'none']
exec(open(os.path.join(os.path.dirname(__file__), 'mango.py')).read())   # строит слои и материалы, ничего не рендерит

import bpy
from mathutils import Vector, Matrix, Euler
from bpy_extras.object_utils import world_to_camera_view

sc = bpy.context.scene
sc.cycles.samples = SPP; sc.cycles.adaptive_threshold = .02
sc.cycles.max_bounces = 6; sc.cycles.glossy_bounces = 3; sc.cycles.transmission_bounces = 4
sc.render.use_persistent_data = True
wn = sc.world.node_tree.nodes
for nd in list(wn):
    if nd.type == 'TEX_ENVIRONMENT': wn.remove(nd)
wn['Background'].inputs['Color'].default_value = (.92, .89, .86, 1); wn['Background'].inputs['Strength'].default_value = .45

halves = {}
for side in (-1, 1):
    parts = [kit.cut_half(shell, side, shell_cut),
             kit.cut_half(cream, side, curd, curd_relief, .016, inner=J, paint=vein),
             kit.cut_half(J, side, conf, jam_relief, .03)]
    halves[side] = (kit.group('front' if side < 0 else 'back', parts), parts)
for o in (shell, cream, J): o.hide_render = True
for o in list(sc.objects):
    if o.type == 'CAMERA': bpy.data.objects.remove(o)
cam = kit.camera((0, -40, 10), (0, 0, -.2), 76)
for o in list(sc.objects):
    if o.name.startswith('floor'): bpy.data.objects.remove(o)
sc.cycles.seed = 7; sc.cycles.use_animated_seed = False

ease = lambda t: t * t * (3 - 2 * t)
lerp = lambda a, b, t: a + (b - a) * t
cl = lambda x: max(0.0, min(1.0, x))
gf, pf = halves[-1]; gb, pb = halves[1]


def pose(a):
    """a: 0 — целое, 1 — раскрыто книжкой, 2 — слои разошлись."""
    o = ease(cl(a)); e = cl(a - 1)
    lift, spread = ease(cl(e / .5)), ease(cl((e - .2) / .8))
    # к разлёту камера мягко отъезжает, чтобы все слои уместились
    cam.data.lens = lerp(76, 52, ease(cl((a - .85) / 1.0)))
    # передняя половина уходит влево, поворачиваясь срезом к зрителю
    gf.location = (lerp(0, -3.5, o) + lerp(0, -4.6, spread), lerp(0, 1.2, o) + lerp(0, 1.5, spread), 0)
    gf.rotation_euler = (0, 0, math.radians(lerp(0, -150, o) + lerp(0, -6, spread)))
    gb.location = (lerp(0, 3.5, o) + lerp(0, -5.8, spread), lerp(0, 1.2, o) + lerp(0, 1.5, spread), 0)
    gb.rotation_euler = (0, 0, math.radians(lerp(0, -30, o) + lerp(0, 10, spread)))
    # слои задней половины: сначала выходят из корпуса к зрителю, потом расходятся вправо без нахлёста
    R = Matrix.Rotation(gb.rotation_euler.z, 4, 'Z').inverted()
    for k, p in enumerate(pb):
        out = Vector((0, -1, 0)) * (lift * k * 1.6)                     # нормаль среза в локальных осях
        side = R @ Vector((spread * k * 5.9, -spread * k * .4, 0))
        p.location = out + side


def anchors():
    """Для каждого слоя задней половины и для передней половины: x центра, низ, верх, левый и правый край (доли кадра)."""
    bpy.context.view_layer.update()
    res = []
    for p in pb + [gf]:
        objs = [p] if p.type == 'MESH' else list(p.children)
        pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
        lo = min(v.z for v in pts); hi = max(v.z for v in pts)
        ctr = sum(pts, Vector()) / len(pts)
        pr = [world_to_camera_view(sc, cam, v) for v in pts]
        a = world_to_camera_view(sc, cam, Vector((ctr.x, ctr.y, lo))); b = world_to_camera_view(sc, cam, Vector((ctr.x, ctr.y, hi)))
        res.append([round(a.x, 4), round(1 - a.y, 4), round(1 - b.y, 4), round(min(q.x for q in pr), 4), round(max(q.x for q in pr), 4)])
    return res


os.makedirs(OUT, exist_ok=True)
sc.render.resolution_x, sc.render.resolution_y = W, H
meta = {'frames': NF, 'a_max': 2.0, 'size': [W, H], 'anchors': []}
vals = ONLY if ONLY is not None else [2.0 * i / (NF - 1) for i in range(NF)]
for i, a in enumerate(vals):
    pose(a)
    meta['anchors'].append(anchors())
    name = f'f{i:03d}.png' if ONLY is None else f'test_{a:.2f}.png'
    sc.render.filepath = os.path.join(OUT, name)
    bpy.ops.render.render(write_still=True)
json.dump(meta, open(os.path.join(OUT, 'meta.json' if ONLY is None else 'meta_test.json'), 'w'))
