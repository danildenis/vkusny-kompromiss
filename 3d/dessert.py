# Корпусные десерты каталога: одна схема — бархатный корпус, творожный крем, начинка.
# Запуск: Blender -b -P 3d/dessert.py -- <id> <still|frames> <папка> [размер] [кадров] [сэмплы]
import sys, os, math, json
sys.path.insert(0, os.path.dirname(__file__))
import bpy
from mathutils import Vector, Matrix, noise
from bpy_extras.object_utils import world_to_camera_view
import kit

argv = sys.argv[sys.argv.index('--') + 1:]
PID, MODE, OUT = argv[0], argv[1], argv[2]
SIZE = int(argv[3]) if len(argv) > 3 else 640
NF = int(argv[4]) if len(argv) > 4 else 36
SPP = int(argv[5]) if len(argv) > 5 else 24
V = lambda *a: Vector(a)


# ---------- формы: точка единичной сферы -> точка поверхности (z — вверх) ----------
def S_mango(p):
    x, y, z = p
    X, Y, Z = x * 3.15, y * 2.55, z * 4.55
    k = 1 - .14 * z; X *= k; Y *= k
    if X < 0: X *= .86
    X += .55 * z * z - .3 + .55 * max(0, z) ** 3
    Y *= 1 - .08 * max(0, -x)
    n = noise.noise(V(X * .35, Y * .35, Z * .35)) * .05
    return X * (1 + n), Y * (1 + n), Z


def S_pistachio(p):
    x, y, z = p
    X, Y, Z = x * 1.75, y * 1.55, z * 3.9
    k = 1 - .12 * z; X *= k; Y *= k
    X += .35 * z * z - .1
    f = 1 + noise.noise(V(x * 1.6, y * 1.6, z * 1.1)) * .1 + noise.noise(V(x * 3.5 + 5, y * 3.5, z * 3.5)) * .03
    return X * f, Y * f, Z


def S_blueberry(p):
    x, y, z = p
    r, th = math.hypot(x, y), math.atan2(y, x)
    X, Y, Z = x * 2.6, y * 2.6, z * 2.25
    if z > 0:   # «корона» сверху: ямка и пять лепестков
        Z -= .5 * math.exp(-(r / .2) ** 2)
        Z += .13 * max(0, math.cos(5 * th)) * math.exp(-((r - .23) / .07) ** 2)
    return X, Y, Z


def S_banana(p):
    x, y, z = p                        # длинная ось — x
    r, th = math.hypot(y, z), math.atan2(z, y)
    rs = 1.45 * max(0, 1 - x * x) ** .34 * (1 + .06 * math.cos(5 * th))
    sc = rs / (r + 1e-9)
    X, Y, Z = x * 4.3, y * sc, z * sc
    Z += -1.5 * x * x + .75              # изгиб «улыбкой»
    return X, Y, Z


# центры костянок малины — равномерно по сфере (спираль Фибоначчи)
_RB = []
for i in range(110):
    zz = 1 - 2 * (i + .5) / 110; rr = math.sqrt(1 - zz * zz); ph = i * 2.39996
    _RB.append(Vector((rr * math.cos(ph), rr * math.sin(ph), zz)))


def S_raspberry(p):
    x, y, z = p
    v = Vector((x, y, z)); best = 0.0
    for c in _RB:
        dd = (v - c).length
        if dd < .2: best = max(best, math.sqrt(.04 - dd * dd) / .2)
    b = .12 * best                                    # круглые костянки
    k = 1 + .16 * z
    X, Y, Z = x * 2.2 * k * (1 + b), y * 2.2 * k * (1 + b), z * 2.55 * (1 + b)
    if z > .6: Z -= .35 * math.exp(-(math.hypot(x, y) / .25) ** 2)
    return X, Y, Z


def S_lemon(p):
    x, y, z = p                        # длинная ось — x
    X, Y, Z = x * 3.1, y * 2.3, z * 2.25
    X += math.copysign(.55 * math.exp(-(math.hypot(y, z) / .28) ** 2), x)   # «носики»
    f = 1 + noise.noise(V(x * 2, y * 2, z * 2)) * .03
    return X * f, Y * f, Z * f


def S_gum(p):
    x, y, z = p
    return x * 2.4, y * 2.4, z * 2.25


def S_popcorn(p):
    v = V(*p)
    n = noise.noise(v * 1.3 + V(2, 1, 0)) * .32 + noise.noise(v * 2.8 + V(7, 3, 1)) * .14 + noise.noise(v * 6 + V(1, 9, 4)) * .04
    f = 2.3 * (1 + n)
    return p[0] * f, p[1] * f * .9, p[2] * f


def S_coffee(p):
    x, y, z = p
    X, Y, Z = x * 2.1, y * 1.3, z * 3.0
    if y < 0:   # бороздка на лицевой стороне
        xs = X - .18 * math.sin(z * 2.4)
        Y += .55 * math.exp(-(xs / .16) ** 2) * max(0, 1 - z * z) ** .5
    return X, Y, Z


# ---------- рецепты ----------
C = {
    'mango': dict(shape=S_mango, shell=dict(stops=[(0, '#f7c51f'), (.45, '#f6a414'), (.72, '#f0701c'), (1, '#d93a22')], axis=(.62, 0, .78), span=(-3.6, 4.2), speck=.35),
                  inside='#f2dfb4', cream=('#f8f4ee', '#cdbda5'), core=('jam', '#f69516', '#e2620c'), coresize=.45),
    'pistachio': dict(shape=S_pistachio, shell=dict(stops=[(0, '#6f9238'), (.5, '#86a64a'), (1, '#9bb35a')], axis=(0, 0, 1), span=(-3.5, 3.5), speck=.4,
                      marks=[('streak', '#8a4d5c', 2.2, .75, (1.6, 1.6, .35))], rough=.5, sheen=.18),
                      inside='#e9e4c4', cream=('#eef0d8', '#c4c8a2'), core=('sponge', '#8f9a4c', '#5d6a2c'), coresize=.42),
    'blueberry': dict(shape=S_blueberry, shell=dict(stops=[(0, '#26315a'), (.6, '#2f3c6c'), (1, '#3c4a7c')], axis=(0, 0, 1), span=(-2.4, 2.4), speck=.5,
                      marks=[('spots', '#5a678f', 22, .35)], rough=.62, sheen=.35),
                      inside='#efe6ee', cream=('#ece2ef', '#bfb0c6'), core=('jam', '#5b1f52', '#2a0b28'), coresize=.42),
    'banana': dict(shape=S_banana, shell=dict(stops=[(0, '#c9a52c'), (.12, '#f5d544'), (.88, '#f7d84c'), (1, '#b8952a')], axis=(1, 0, 0), span=(-4.8, 4.8), speck=.4,
                   marks=[('spots', '#4a2a12', 2.4, .95)]),
                   inside='#f3e7c0', cream=('#f8f4ec', '#cfc2ad'), core=('jam', '#d89a3e', '#9a581c'), coresize=.38),
    'raspberry': dict(shape=S_raspberry, shell=dict(stops=[(0, '#c8304f'), (.6, '#dc4763'), (1, '#e5607a')], axis=(0, 0, 1), span=(-2.6, 2.6), speck=.45, rough=.6),
                      inside='#f5dfe4', cream=('#f9f1f2', '#d6c0c4'), core=('jam', '#c81e3e', '#7a0c22'), coresize=.42),
    'lemon': dict(shape=S_lemon, shell=dict(stops=[(0, '#e9bd1e'), (.5, '#f5d23c'), (1, '#e9bd1e')], axis=(1, 0, 0), span=(-3.6, 3.6), speck=.7, rough=.55),
                  inside='#f6eebe', cream=('#fbf7ea', '#d9ceb2'), core=('jam', '#f6cf2a', '#dda411'), coresize=.42),
    'gum': dict(shape=S_gum, shell=dict(stops=[(0, '#e9799f'), (.6, '#f08fb2'), (1, '#f5a8c4')], axis=(0, 0, 1), span=(-2.4, 2.4), speck=.3, rough=.5),
                inside='#f8dbe7', cream=('#f8d7e5', '#d6aebf'), core=('jam', '#e0306a', '#a0123f'), coresize=.42),
    'popcorn': dict(shape=S_popcorn, shell=dict(stops=[(0, '#ecd8a2'), (.5, '#f5e8c0'), (1, '#fbf3da')], axis=(0, 0, 1), span=(-2.6, 2.6), speck=.4,
                    marks=[('streak', '#e7bf52', 1.8, .55, (1, 1, 1)), ('spots', '#5a3015', 3.2, .9)], rough=.66),
                    inside='#f4e6c6', cream=('#efd8ac', '#c9ae80'), core=('jam', '#c27a2a', '#7a3e10'), coresize=.4),
    'coffee': dict(shape=S_coffee, shell=dict(stops=[(0, '#4a2a1b'), (.5, '#5c3622'), (1, '#6a4029')], axis=(0, 0, 1), span=(-3, 3), speck=.3,
                   rough=.3, sheen=0, coat=.45),
                   inside='#5a3524', cream=('#d8b88f', '#a8865e'), core=('sponge', '#3e2418', '#24120a'), coresize=.4, porous=True),
}
R = C[PID]


def bubbles(x, z, scale, rmax, seed):
    d, pts = noise.voronoi(V(x * scale, seed, z * scale))
    best = 0.0
    for dist, pt in zip(d[:3], pts[:3]):
        r = rmax * (.25 + .75 * (abs(math.sin(pt.x * 12.9898 + pt.z * 78.233) * 43758.5) % 1))
        dd = dist / scale
        if dd < r: best = max(best, math.sqrt(r * r - dd * dd))
    return best


def curd_relief(x, z, d, dj):
    t = min(1, d / .15)
    grain = .007 * noise.fractal(V(x * 22, 1.7, z * 22), .5, 2.0, 3)
    f = noise.voronoi(V(x * 9, 3.3, z * 9))[0]
    crev = -.016 * (1 - min(1, (f[1] - f[0]) / .16))
    smear = .005 * noise.fractal(V(x * .8, 4.4, z * 14), .6, 2.0, 3)
    holes = bubbles(x, z, 9.0, .03, 2.0) * .8
    if R.get('porous'): holes += bubbles(x, z, 4.5, .09, 6.0) * .8 + bubbles(x, z, 12, .04, 3.0) * .7   # воздушный кофейный крем
    return t * (grain + crev + smear - holes)


def sponge_relief(x, z, d, dj=0):
    t = min(1, d / .1)
    return t * (.012 * noise.fractal(V(x * 6, 2.2, z * 6), .6, 2.0, 4) - bubbles(x, z, 16, .05, 4.0) - bubbles(x, z, 7, .08, 9.0) * .7)


def jam_relief(x, z, d, dj=0):
    return .13 * (1 - math.exp(-d / .2)) + .004 * noise.fractal(V(x * 3, 9.1, z * 3), .7, 2.0, 3)


# ---------- сборка ----------
sc = kit.reset(samples=SPP)
kit.world(.3); kit.studio()
wn = sc.world.node_tree.nodes
for nd in list(wn):
    if nd.type == 'TEX_ENVIRONMENT': wn.remove(nd)
wn['Background'].inputs['Color'].default_value = (.92, .89, .86, 1); wn['Background'].inputs['Strength'].default_value = .45
sc.cycles.max_bounces = 6; sc.cycles.glossy_bounces = 3; sc.cycles.transmission_bounces = 4
sc.render.use_persistent_data = True; sc.cycles.seed = 7

velour = kit.mat_velour('shell', **R['shell'])
shell_in = kit.mat_chocolate('shell_in', R['inside'], .35)
ctype, c1, c2 = R['core']
cream_mat = kit.mat_curd_jam('cream', (c1, c2), *R['cream']) if ctype == 'jam' else kit.mat_curd('cream', *R['cream'])
core_mat = kit.mat_jam('core', c1, c2) if ctype == 'jam' else kit.mat_curd('core', c1, c2)

M = kit.mesh_from('body', R['shape'])
pts = [v.co for v in M.data.vertices]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))); hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
ctr, half = (lo + hi) / 2, (hi - lo) / 2
T = .15
cream = kit.offset(M, 'cream', T + .004); kit.setmat(cream, cream_mat)
shell = M; kit.setmat(shell, velour); shell.data.materials.append(shell_in)
sol = shell.modifiers.new('s', 'SOLIDIFY'); sol.thickness = T; sol.offset = -1; sol.use_even_offset = True; sol.material_offset = 1
kit.apply_all(shell)
k = R['coresize']


def S_core(p):
    x, y, z = p
    n = noise.noise(V(x * 1.4 + 3, y * 1.4, z * 1.4)) * .2
    return ctr.x + x * half.x * k * (1 + n), y * half.y * k * 1.15 * (1 + n), ctr.z + z * half.z * k * (1 + n) - half.z * .04


J = kit.mesh_from('core', S_core, 128, 64); kit.setmat(J, core_mat)
vein = (lambda x, z, d, dj: .45 * math.exp(-dj / .025) if dj < .3 else 0.0) if ctype == 'jam' else None

halves = {}
for side in (-1, 1):
    parts = [kit.cut_half(shell, side, shell_in),
             kit.cut_half(cream, side, cream_mat, curd_relief, .018, inner=J, paint=vein),
             kit.cut_half(J, side, core_mat, jam_relief if ctype == 'jam' else sponge_relief, .02)]
    halves[side] = (kit.group('front' if side < 0 else 'back', parts), parts)
for o in (shell, cream, J): o.hide_render = True
gf, pf = halves[-1]; gb, pb = halves[1]

# камера: десерт занимает ~70% кадра, к разлёту слоёв отъезжает
size = max(half.x, half.z * 1.0, 2.2)
D = size / .2
cam = kit.camera((ctr.x, -D, ctr.z + D * .22), (ctr.x, 0, ctr.z - size * .05), 60)
u = max(2 * half.x, 4.0)
L2 = min(60 * .64, 11 * D / u)

ease = lambda t: t * t * (3 - 2 * t)
lerp = lambda a, b, t: a + (b - a) * t
cl = lambda x: max(0.0, min(1.0, x))


def pose(a):
    o = ease(cl(a)); e = cl(a - 1)
    lift, spread = ease(cl(e / .5)), ease(cl((e - .2) / .8))
    cam.data.lens = lerp(lerp(60, 60 * R.get('open_zoom', .64), o), L2, ease(cl((a - .85) / 1.0)))
    gf.location = (lerp(0, -.52 * u, o) + lerp(0, -.45 * u, spread), lerp(0, .18 * u, o) + lerp(0, .2 * u, spread), 0)
    gf.rotation_euler = (0, 0, math.radians(lerp(0, -150, o) + lerp(0, -6, spread)))
    gb.location = (lerp(0, .52 * u, o) + lerp(0, -.72 * u, spread), lerp(0, .18 * u, o) + lerp(0, .2 * u, spread), 0)
    gb.rotation_euler = (0, 0, math.radians(lerp(0, -30, o) + lerp(0, 10, spread)))
    Rm = Matrix.Rotation(gb.rotation_euler.z, 4, 'Z').inverted()
    for kk, p in enumerate(pb):
        p.location = Vector((0, -1, 0)) * (lift * kk * .24 * u) + Rm @ Vector((spread * kk * .7 * u, -spread * kk * .06 * u, 0))


def anchors():
    bpy.context.view_layer.update()
    res = []
    for p in pb + [gf]:
        objs = [p] if p.type == 'MESH' else list(p.children)
        pp = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
        lo_, hi_ = min(v.z for v in pp), max(v.z for v in pp); c = sum(pp, Vector()) / len(pp)
        pr = [world_to_camera_view(sc, cam, v) for v in pp]
        a_ = world_to_camera_view(sc, cam, Vector((c.x, c.y, lo_))); b_ = world_to_camera_view(sc, cam, Vector((c.x, c.y, hi_)))
        res.append([round(a_.x, 4), round(1 - a_.y, 4), round(1 - b_.y, 4), round(min(q.x for q in pr), 4), round(max(q.x for q in pr), 4)])
    return res


os.makedirs(OUT, exist_ok=True)
sc.render.resolution_x = sc.render.resolution_y = SIZE
if MODE == 'still':
    for a, nm in ((0, 'whole'), (1, 'cut'), (2, 'layers')):
        pose(a); sc.render.filepath = os.path.join(OUT, f'{PID}_{nm}.png'); bpy.ops.render.render(write_still=True)
else:
    meta = {'frames': NF, 'a_max': 2.0, 'size': [SIZE, SIZE], 'anchors': []}
    for i in range(NF):
        a = 2.0 * i / (NF - 1); pose(a); meta['anchors'].append(anchors())
        sc.render.filepath = os.path.join(OUT, f'f{i:03d}.png'); bpy.ops.render.render(write_still=True)
    json.dump(meta, open(os.path.join(OUT, 'meta.json'), 'w'))
