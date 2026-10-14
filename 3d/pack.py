# Кадры Blender (PNG) -> WebP для сайта: python3 3d/pack.py <папка кадров> <папка сайта> [ширина]
import sys, os, glob, json, shutil
from PIL import Image
import numpy as np
from scipy.ndimage import distance_transform_edt, binary_dilation
src, dst = sys.argv[1], sys.argv[2]; W = int(sys.argv[3]) if len(sys.argv) > 3 else 1120
os.makedirs(dst, exist_ok=True); total = 0
for f in sorted(glob.glob(os.path.join(src, 'f*.png'))):
    im = Image.open(f).convert('RGBA'); h = round(im.size[1] * W / im.size[0])
    im = im.resize((W, h), Image.LANCZOS)
    out = os.path.join(dst, os.path.basename(f)[:-4] + '.webp')
    im.save(out, 'WEBP', quality=82, alpha_quality=90, method=6); total += os.path.getsize(out)
m = json.load(open(os.path.join(src, 'meta.json'))); m['size'] = [W, round(m['size'][1] * W / m['size'][0])]
json.dump(m, open(os.path.join(dst, 'meta.json'), 'w'))
print('frames', len(glob.glob(os.path.join(dst, '*.webp'))), 'MB', round(total / 1e6, 1))
