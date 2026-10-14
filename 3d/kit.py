# Общие детали для корпусных десертов в Blender: сцена, свет, материалы, слои и разрез.
import bpy, bmesh, math
from mathutils import Vector

BL = '/Applications/Blender.app/Contents/Resources/5.2/datafiles/studiolights/world/'


# ---------- сцена ----------
def reset(samples=160):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'; prefs.get_devices()
    for d in prefs.devices: d.use = True
    sc.cycles.device = 'GPU'
    sc.cycles.samples = samples; sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    for vt in ('Khronos PBR Neutral', 'AgX'):
        try: sc.view_settings.view_transform = vt; break
        except Exception: pass
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
    return sc


def world(strength=.5):
    w = bpy.data.worlds.new('W'); bpy.context.scene.world = w; w.use_nodes = True
    nt = w.node_tree; bg = nt.nodes['Background']
    env = nt.nodes.new('ShaderNodeTexEnvironment'); env.image = bpy.data.images.load(BL + 'studio.exr')
    nt.links.new(env.outputs['Color'], bg.inputs['Color']); bg.inputs['Strength'].default_value = strength


def area(name, loc, target, size, power, color=(1, 1, 1)):
    l = bpy.data.lights.new(name, 'AREA'); l.size = size; l.energy = power; l.color = color
    o = bpy.data.objects.new(name, l); bpy.context.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    return o


def studio():
    area('key', (-13, -9, 11), (0, 0, 0), 12, 2600, (1, .97, .93))
    area('fill', (12, -10, 7), (0, 0, 0), 16, 800, (.96, .97, 1))
    area('rim', (3, 13, 10), (0, 0, 0), 7, 1500)
    area('top', (0, -2, 16), (0, 0, 0), 8, 500)


def camera(loc, target, lens=70):
    c = bpy.data.cameras.new('cam'); c.lens = lens
    o = bpy.data.objects.new('cam', c); bpy.context.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.camera = o
    return o


def floor(z):
    me = bpy.data.meshes.new('floor'); bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=100); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('floor', me); bpy.context.collection.objects.link(o)
    o.location.z = z; o.is_shadow_catcher = True
    return o


# ---------- узлы ----------
class N:
    def __init__(self, mat):
        mat.use_nodes = True; self.nt = mat.node_tree; self.nt.nodes.clear()
    def __call__(self, kind, **inp):
        n = self.nt.nodes.new(kind)
        for k, v in inp.items():
            if k.startswith('_'): setattr(n, k[1:], v)
            else: self.set(n, k, v)
        return n
    def set(self, n, k, v):
        if hasattr(v, 'bl_idname') or isinstance(v, bpy.types.NodeSocket):
            out = v if isinstance(v, bpy.types.NodeSocket) else v.outputs[0]
            self.nt.links.new(out, n.inputs[k])
        else: n.inputs[k].default_value = v
    def link(self, a, b): self.nt.links.new(a, b)


def ramp(n, fac, stops):
    r = n('ShaderNodeValToRGB'); n.link(fac if isinstance(fac, bpy.types.NodeSocket) else fac.outputs[0], r.inputs['Fac'])
    el = r.color_ramp.elements
    while len(el) > len(stops): el.remove(el[-1])
    while len(el) < len(stops): el.new(0)
    for e, (p, c) in zip(el, stops): e.position = p; e.color = (*c, 1) if len(c) == 3 else c
    return r


def hexc(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4 for x in c)


def principled(n, **kw):
    p = n('ShaderNodeBsdfPrincipled')
    for k, v in kw.items(): n.set(p, k, v)
    out = n('ShaderNodeOutputMaterial'); n.link(p.outputs[0], out.inputs['Surface'])
    return p, out


# ---------- материалы ----------
def mat_velour(name, stops, axis=(0, 0, 1), span=(-1, 1), speck=1.0):
    """Бархатное напыление какао-масла: цветовой переход по оси + мелкие капли спрея."""
    m = bpy.data.materials.new(name); n = N(m)
    tc = n('ShaderNodeTexCoord')
    dot = n('ShaderNodeVectorMath', _operation='DOT_PRODUCT'); n.link(tc.outputs['Object'], dot.inputs[0]); dot.inputs[1].default_value = axis
    # лёгкая неровность перехода — как от аэрографа
    wob = n('ShaderNodeTexNoise', Scale=1.2, Detail=3.0); n.link(tc.outputs['Object'], wob.inputs['Vector'])
    wob2 = n('ShaderNodeMath', _operation='MULTIPLY_ADD'); n.link(wob.outputs['Fac'], wob2.inputs[0]); wob2.inputs[1].default_value = .9; wob2.inputs[2].default_value = -.45
    add = n('ShaderNodeMath', _operation='ADD'); n.link(dot.outputs['Value'], add.inputs[0]); n.link(wob2.outputs[0], add.inputs[1])
    mr = n('ShaderNodeMapRange'); n.link(add.outputs[0], mr.inputs['Value']); mr.inputs['From Min'].default_value = span[0]; mr.inputs['From Max'].default_value = span[1]
    col = ramp(n, mr.outputs[0], [(p, hexc(c)) for p, c in stops])
    # капли спрея: мелкие светлые и тёмные точки
    vor = n('ShaderNodeTexVoronoi', Scale=95 * speck, Randomness=1.0); n.link(tc.outputs['Object'], vor.inputs['Vector'])
    dots = ramp(n, vor.outputs['Distance'], [(0, (0, 0, 0)), (.32, (1, 1, 1))])
    tone = n('ShaderNodeTexNoise', Scale=160 * speck, Detail=2.0); n.link(tc.outputs['Object'], tone.inputs['Vector'])
    mix1 = n('ShaderNodeMix', _data_type='RGBA', _blend_type='MULTIPLY'); mix1.inputs['Factor'].default_value = .16
    n.link(col.outputs['Color'], mix1.inputs['A']); n.link(dots.outputs['Color'], mix1.inputs['B'])
    mix2 = n('ShaderNodeMix', _data_type='RGBA', _blend_type='OVERLAY'); mix2.inputs['Factor'].default_value = .25
    n.link(mix1.outputs['Result'], mix2.inputs['A']); n.link(tone.outputs['Color'], mix2.inputs['B'])
    bump = n('ShaderNodeBump', Strength=.45, Distance=.015); n.link(vor.outputs['Distance'], bump.inputs['Height'])
    p, _ = principled(n, Roughness=.58, **{'Sheen Weight': .22, 'Sheen Roughness': .45, 'Subsurface Weight': .04, 'Specular IOR Level': .35})
    n.link(mix2.outputs['Result'], p.inputs['Base Color']); n.link(bump.outputs['Normal'], p.inputs['Normal'])
    return m


def mat_chocolate(name, color, rough=.38):
    """Срез тонкой шоколадной оболочки."""
    m = bpy.data.materials.new(name); n = N(m)
    tc = n('ShaderNodeTexCoord'); no = n('ShaderNodeTexNoise', Scale=40, Detail=4.0); n.link(tc.outputs['Object'], no.inputs['Vector'])
    bump = n('ShaderNodeBump', Strength=.12, Distance=.01); n.link(no.outputs['Fac'], bump.inputs['Height'])
    p, _ = principled(n, **{'Base Color': (*hexc(color), 1), 'Roughness': rough, 'Subsurface Weight': .15, 'Subsurface Radius': (.3, .2, .12)})
    n.link(bump.outputs['Normal'], p.inputs['Normal'])
    return m


def _curd_bsdf(n, tc, color, shade):
    ao = n('ShaderNodeAmbientOcclusion', Distance=.08, _samples=16)
    grain = n('ShaderNodeTexNoise', Scale=220, Detail=2.0); n.link(tc.outputs['Object'], grain.inputs['Vector'])
    blot = n('ShaderNodeTexNoise', Scale=3.5, Detail=4.0); n.link(tc.outputs['Object'], blot.inputs['Vector'])
    base = ramp(n, blot.outputs['Fac'], [(.35, hexc('#f3ecdf')), (.65, hexc(color))])
    col = n('ShaderNodeMix', _data_type='RGBA'); n.link(ao.outputs['AO'], col.inputs['Factor'])
    col.inputs['A'].default_value = (*hexc(shade), 1); n.link(base.outputs['Color'], col.inputs['B'])
    bump = n('ShaderNodeBump', Strength=.3, Distance=.003); n.link(grain.outputs['Fac'], bump.inputs['Height'])
    p = n('ShaderNodeBsdfPrincipled', Roughness=.8, **{'Subsurface Weight': .12, 'Subsurface Radius': (.3, .3, .28), 'Subsurface Scale': .04, 'Specular IOR Level': .32})
    n.link(col.outputs['Result'], p.inputs['Base Color']); n.link(bump.outputs['Normal'], p.inputs['Normal'])
    return p


def _jam_bsdf(n, tc, color, deep, fruit=True):
    no = n('ShaderNodeTexNoise', Scale=3, Detail=2.0); n.link(tc.outputs['Object'], no.inputs['Vector'])
    fib = n('ShaderNodeTexNoise', Scale=18, Detail=6.0, Distortion=2.5); n.link(tc.outputs['Object'], fib.inputs['Vector'])
    c = ramp(n, no.outputs['Fac'], [(.2, hexc(deep)), (.75, hexc(color))])
    fl = ramp(n, fib.outputs['Fac'], [(.55, (0, 0, 0)), (.7, (1, 1, 1))])
    mixf = n('ShaderNodeMix', _data_type='RGBA', _blend_type='SCREEN')
    n.link(c.outputs['Color'], mixf.inputs['A']); mixf.inputs['B'].default_value = (*hexc('#ffb347'), 1)
    f2 = n('ShaderNodeMath', _operation='MULTIPLY'); n.link(fl.outputs['Color'], f2.inputs[0]); f2.inputs[1].default_value = .35 if fruit else 0
    n.link(f2.outputs[0], mixf.inputs['Factor'])
    bump = n('ShaderNodeBump', Strength=.05, Distance=.01); n.link(fib.outputs['Fac'], bump.inputs['Height'])
    p = n('ShaderNodeBsdfPrincipled', Roughness=.06, **{'Subsurface Weight': .7, 'Subsurface Radius': (1.0, .55, .25), 'Subsurface Scale': .18,
                                                     'Coat Weight': .7, 'Coat Roughness': .03, 'Specular IOR Level': .65})
    n.link(mixf.outputs['Result'], p.inputs['Base Color']); n.link(bump.outputs['Normal'], p.inputs['Normal'])
    return p


def _out(n, sock):
    o = n('ShaderNodeOutputMaterial'); n.link(sock, o.inputs['Surface'])


def mat_curd(name, color='#f8f4ee', shade='#cdbda5'):
    """Творожный крем на срезе: плотный, матовый; рельеф — в геометрии, в лунках мягкая тень."""
    m = bpy.data.materials.new(name); n = N(m); tc = n('ShaderNodeTexCoord')
    _out(n, _curd_bsdf(n, tc, color, shade).outputs[0])
    return m


def mat_curd_jam(name, jam=('#f69516', '#e2620c'), color='#f8f4ee', shade='#cdbda5'):
    """Крем с прожилками и потёками джема: доля джема — атрибут вершин 'vein'."""
    m = bpy.data.materials.new(name); n = N(m); tc = n('ShaderNodeTexCoord')
    a = _curd_bsdf(n, tc, color, shade); b = _jam_bsdf(n, tc, *jam)
    at = n('ShaderNodeAttribute', _attribute_name='vein')
    mix = n('ShaderNodeMixShader'); n.link(at.outputs['Fac'], mix.inputs[0]); n.link(a.outputs[0], mix.inputs[1]); n.link(b.outputs[0], mix.inputs[2])
    _out(n, mix.outputs[0])
    return m


def mat_jam(name, color='#e8740c', deep='#b8430a', fruit=True):
    """Конфи: глянцевый полупрозрачный гель с тонкими волокнами фрукта."""
    m = bpy.data.materials.new(name); n = N(m); tc = n('ShaderNodeTexCoord')
    _out(n, _jam_bsdf(n, tc, color, deep, fruit).outputs[0])
    return m


# ---------- геометрия ----------
def mesh_from(name, fn, u=192, v=96):
    """Гладкое тело из единичной сферы: fn((x, y, z)) -> (X, Y, Z)."""
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=1)
    # полюса сферы смотрят по оси y — плоскость разреза y=0 проходит через ровный «экватор»
    for vert in bm.verts: c = vert.co; vert.co = Vector(fn((c.x, c.z, c.y)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    for f in bm.faces: f.smooth = True
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    return o


def offset(src, name, d):
    """Копия тела, сдвинутая внутрь по нормалям на d."""
    me = src.data.copy(); me.name = name
    bm = bmesh.new(); bm.from_mesh(me); bm.normal_update()
    for v in bm.verts: v.co = v.co - v.normal * d
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    return o


def apply_all(o):
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    o.modifiers.clear(); old = o.data; o.data = me; bpy.data.meshes.remove(old)


def boolean(o, cutter, op):
    m = o.modifiers.new('b', 'BOOLEAN'); m.operation = op; m.object = cutter; m.solver = 'EXACT'
    try: m.material_mode = 'TRANSFER'
    except Exception: pass
    apply_all(o)


def box(name, center, size, mat=None):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    for v in bm.verts: v.co = Vector((v.co.x * size[0] + center[0], v.co.y * size[1] + center[1], v.co.z * size[2] + center[2]))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    if mat: me.materials.append(mat)
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o); o.hide_render = True
    return o


def setmat(o, m):
    o.data.materials.clear(); o.data.materials.append(m)


def _loops(bm):
    """Упорядоченные контуры открытого края после рассечения."""
    edges = [e for e in bm.edges if len(e.link_faces) == 1]
    left = set(edges); loops = []
    while left:
        e = left.pop(); a, b = e.verts; loop = [a, b]
        while True:
            nxt = [x for x in loop[-1].link_edges if x in left]
            if not nxt: break
            x = nxt[0]; left.discard(x); v = x.other_vert(loop[-1])
            if v is loop[0]: break
            loop.append(v)
        loops.append(loop)
    return loops


def _pip(px, pz, poly):
    """Точки внутри многоугольника (numpy, чётность пересечений)."""
    import numpy as np
    inside = np.zeros(px.shape, bool); n = len(poly)
    for i in range(n):
        x1, z1 = poly[i]; x2, z2 = poly[(i + 1) % n]
        c = ((z1 > pz) != (z2 > pz)) & (px < (x2 - x1) * (pz - z1) / (z2 - z1 + 1e-12) + x1)
        inside ^= c
    return inside


def _bdist(px, pz, polys):
    import numpy as np
    pts = np.concatenate([np.array(p) for p in polys]); d = np.full(px.shape, 1e9)
    for k in range(0, len(pts), 256):
        q = pts[k:k + 256]
        dd = np.sqrt((px[:, None] - q[None, :, 0]) ** 2 + (pz[:, None] - q[None, :, 1]) ** 2).min(1)
        d = np.minimum(d, dd)
    return d


def cut_half(src, side, cap_mat, relief=None, step=.03, inner=None, paint=None):
    """Половина тела, рассечённого плоскостью y=0, с настоящей плоскостью среза.
    relief(x, z, dist_to_edge, dist_to_inner) -> сдвиг среза наружу (поры, выпуклость джема).
    paint(x, z, dist_to_edge, dist_to_inner) -> 0..1, атрибут 'vein' (прожилки джема в креме).
    inner — объект, чей срез вырезается дыркой (джем внутри крема)."""
    import numpy as np
    from mathutils import geometry
    bm = bmesh.new(); bm.from_mesh(src.data)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], dist=1e-6, plane_co=(0, 0, 0), plane_no=(0, 1, 0),
                           clear_outer=side < 0, clear_inner=side > 0)
    for v in bm.verts:
        if abs(v.co.y) < 1e-5: v.co.y = 0
    polys = [[(v.co.x, v.co.z) for v in L] for L in _loops(bm)]
    n_outer = len(polys)
    if inner is not None:
        ib = bmesh.new(); ib.from_mesh(inner.data)
        bmesh.ops.bisect_plane(ib, geom=ib.verts[:] + ib.edges[:] + ib.faces[:], dist=1e-6, plane_co=(0, 0, 0), plane_no=(0, 1, 0), clear_outer=side < 0, clear_inner=side > 0)
        polys += [[(v.co.x, v.co.z) for v in L] for L in _loops(ib)]; ib.free()
    # точки внутри среза (внешний контур минус дырки)
    allp = np.concatenate([np.array(p) for p in polys])
    xs = np.arange(allp[:, 0].min(), allp[:, 0].max(), step); zs = np.arange(allp[:, 1].min(), allp[:, 1].max(), step * .866)
    gx, gz = np.meshgrid(xs, zs); gx[1::2] += step / 2; gx = gx.ravel(); gz = gz.ravel()
    ins = np.zeros(gx.shape, bool)
    for p in polys: ins ^= _pip(gx, gz, p)
    gx, gz = gx[ins], gz[ins]
    d = _bdist(gx, gz, polys); keep = d > step * .6; gx, gz, d = gx[keep], gz[keep], d[keep]
    coords = [(x, z) for p in polys for (x, z) in p] + list(zip(gx.tolist(), gz.tolist()))
    edges, o = [], 0
    for p in polys:
        n = len(p); edges += [(o + i, o + (i + 1) % n) for i in range(n)]; o += n
    vo, eo, fo, _, _, _ = geometry.delaunay_2d_cdt(coords, edges, [], 3, 1e-7)
    # оставляем только треугольники внутри среза (кольцо корпуса не заливает крем)
    cxs = np.array([(vo[f[0]][0] + vo[f[1]][0] + vo[f[2]][0]) / 3 for f in fo]); czs = np.array([(vo[f[0]][1] + vo[f[1]][1] + vo[f[2]][1]) / 3 for f in fo])
    okf = np.zeros(cxs.shape, bool)
    for p in polys: okf ^= _pip(cxs, czs, p)
    fo = [f for f, ok in zip(fo, okf) if ok]
    # высота среза: 0 на контуре, рельеф внутри
    vx = np.array([v[0] for v in vo]); vz = np.array([v[1] for v in vo])
    vd = _bdist(vx, vz, polys)
    vj = _bdist(vx, vz, polys[n_outer:]) if inner is not None else np.full(vx.shape, 1e9)
    sgn = 1 if side < 0 else -1          # нормаль среза смотрит к отсутствующей половине
    mi = len(bm.verts) and max(len(src.data.materials), 1)
    cap_idx = len(src.data.materials)
    new = []
    lay = bm.verts.layers.float.get('vein') or bm.verts.layers.float.new('vein')
    for (x, z), dd, dj in zip(vo, vd, vj):
        h = relief(x, z, dd, dj) if relief and dd > 1e-4 else 0.0
        v = bm.verts.new((x, sgn * h, z))
        if paint: v[lay] = paint(x, z, dd, dj)
        new.append(v)
    for f in fo:
        # ориентация по плоской раскладке, до рельефа: нормаль среза смотрит наружу (+y·sgn)
        (ax, az), (bx, bz), (cx, cz) = vo[f[0]], vo[f[1]], vo[f[2]]
        cross = (bx - ax) * (cz - az) - (bz - az) * (cx - ax)   # компонента y нормали = -cross
        idx = list(f) if -cross * sgn > 0 else list(f)[::-1]
        try:
            ff = bm.faces.new([new[i] for i in idx]); ff.material_index = cap_idx; ff.smooth = relief is not None
        except ValueError: pass
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-5)
    me = bpy.data.meshes.new(src.name + ('_L' if side < 0 else '_R')); bm.to_mesh(me); bm.free()
    for m in src.data.materials: me.materials.append(m)
    me.materials.append(cap_mat)
    ob = bpy.data.objects.new(me.name, me); bpy.context.collection.objects.link(ob)
    return ob


def group(name, objs):
    e = bpy.data.objects.new(name, None); bpy.context.collection.objects.link(e)
    for o in objs: o.parent = e
    return e


def render(path, res=(1100, 1100)):
    sc = bpy.context.scene; sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.filepath = path; bpy.ops.render.render(write_still=True)
