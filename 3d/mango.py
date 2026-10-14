# Корпусное манго: бархатный корпус, творожный крем, манговое конфи в центре.
# Запуск: Blender -b -P 3d/mango.py -- <папка вывода> [whole|cut|all]
import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
import bpy
from mathutils import Vector, noise
import kit

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else os.path.join(os.path.dirname(__file__), 'renders')
WHAT = argv[1] if len(argv) > 1 else 'all'


def smooth(a, b, x):
    t = max(0, min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t)


def mango(p):
    x, y, z = p
    u = z
    X, Y, Z = x * 3.15, y * 2.55, z * 4.55
    k = 1 - .14 * u                      # к верху уже, низ полнее
    X *= k; Y *= k
    if X < 0: X *= .86                   # спинка площе животика
    X += .55 * u * u - .3 + .55 * max(0, u) ** 3   # изгиб и носик вбок
    Y *= 1 - .08 * max(0, -x)            # чуть сплюснут со спинки
    # едва заметная неровность ручной формы
    n = noise.noise(Vector((X * .35, Y * .35, Z * .35))) * .05
    return X * (1 + n), Y * (1 + n), Z


def jam(p):
    x, y, z = p
    X, Y, Z = x * 1.25, y * 1.0, z * 2.3
    X += .35 * z * z - .05
    n = noise.noise(Vector((X * .9 + 3, Y * .9, Z * .9))) * .22
    return X * (1 + n) + .15, Y * (1 + n), Z * (1 + n * .5) - .25


sc = kit.reset(samples=110)
kit.world(.45); kit.studio()

velour = kit.mat_velour('velour', [(0, '#f7c51f'), (.45, '#f6a414'), (.72, '#f0701c'), (1, '#d93a22')], axis=(.62, 0, .78), span=(-3.6, 4.2), speck=.35)
shell_cut = kit.mat_chocolate('shell_cut', '#f2dfb4', .35)
curd = kit.mat_curd('curd', '#f8f4ee', '#c9b79c')
conf = kit.mat_jam('confit', '#f69516', '#e2620c')

M = kit.mesh_from('mango', mango)
T = .16
cream = kit.offset(M, 'cream', T + .004); kit.setmat(cream, curd)   # до утолщения корпуса
shell = M; kit.setmat(shell, velour)
sol = shell.modifiers.new('s', 'SOLIDIFY'); sol.thickness = T; sol.offset = -1; sol.use_even_offset = True
kit.apply_all(shell)
J = kit.mesh_from('jam', jam, 128, 64); kit.setmat(J, conf)


def bubbles(x, z, scale, rmax, seed):
    """Пузырьки воздуха: сферические лунки разного размера в ячейках Вороного."""
    d, pts = noise.voronoi(Vector((x * scale, seed, z * scale)))
    best = 0.0
    for dist, pt in zip(d[:3], pts[:3]):
        r = rmax * (.25 + .75 * (noise.hybrid_multi_fractal(pt * 3.1, .5, 2, 2, .5, 1) % 1 if False else (abs(math.sin(pt.x * 12.9898 + pt.z * 78.233) * 43758.5) % 1)))
        dd = dist / scale
        if dd < r: best = max(best, math.sqrt(r * r - dd * dd))
    return best


def curd_relief(x, z, d):
    t = min(1, d / .2)
    lump = noise.fractal(Vector((x * 6.0, 1.7, z * 6.0)), .6, 2.0, 4)
    holes = bubbles(x, z, 16.0, .035, 2.0) * .9 + bubbles(x, z, 6.0, .075, 5.0) * .75 + bubbles(x, z, 2.2, .14, 8.0) * .4
    return t * (.016 * lump - holes)


def jam_relief(x, z, d):
    return .13 * (1 - math.exp(-d / .2)) + .004 * noise.fractal(Vector((x * 3, 9.1, z * 3)), .7, 2.0, 3)


zmin = min(v.co.z for v in shell.data.vertices)
kit.floor(zmin)
os.makedirs(OUT, exist_ok=True)

if WHAT in ('whole', 'all'):
    kit.camera((0, -30, 7), (0, 0, -.2), 85)
    cream.hide_render = J.hide_render = True
    kit.render(os.path.join(OUT, 'mango_whole.png'), (1000, 1000))
    cream.hide_render = J.hide_render = False

if WHAT in ('cut', 'all'):
    halves = []
    for side in (-1, 1):
        parts = [kit.cut_half(shell, side, shell_cut),
                 kit.cut_half(cream, side, curd, curd_relief, .016, inner=J),
                 kit.cut_half(J, side, conf, jam_relief, .03)]
        halves.append(kit.group('front' if side < 0 else 'back', parts))
    for o in (shell, cream, J): o.hide_render = True
    gf, gb = halves
    # обе половины срезом к зрителю, чуть развёрнуты друг к другу
    gb.location = (3.4, 1.2, 0); gb.rotation_euler = (0, 0, math.radians(-30))
    gf.location = (-3.4, 1.2, 0); gf.rotation_euler = (0, 0, math.radians(180 + 30))
    for o in list(bpy.context.scene.objects):
        if o.type == 'CAMERA': bpy.data.objects.remove(o)
    kit.camera((0, -36, 12), (0, 0, -.4), 85)
    kit.render(os.path.join(OUT, 'mango_cut.png'), (1400, 1000))
