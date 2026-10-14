# Кадры каталога -> WebP + обрезанная картинка целого десерта: python3 3d/pack_cat.py <id> [ширина]
import sys, os, glob, json
from PIL import Image
pid = sys.argv[1]; W = int(sys.argv[2]) if len(sys.argv) > 2 else 560
src, dst = f'3d/renders/cat/{pid}', f'assets/anim/cat/{pid}'
os.makedirs(dst, exist_ok=True); total = 0
for f in sorted(glob.glob(os.path.join(src, 'f*.png'))):
    im = Image.open(f).convert('RGBA').resize((W, W), Image.LANCZOS)
    out = os.path.join(dst, os.path.basename(f)[:-4] + '.webp'); im.save(out, 'WEBP', quality=84, alpha_quality=90, method=6); total += os.path.getsize(out)
m = json.load(open(os.path.join(src, 'meta.json'))); m['size'] = [W, W]; json.dump(m, open(os.path.join(dst, 'meta.json'), 'w'))
im = Image.open(os.path.join(src, 'f000.png')).convert('RGBA'); bb = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
p = 6; im = im.crop((max(0, bb[0] - p), max(0, bb[1] - p), min(im.width, bb[2] + p), min(im.height, bb[3] + p))); im.thumbnail((420, 420), Image.LANCZOS)
im.save(os.path.join(dst, 'thumb.webp'), 'WEBP', quality=88, alpha_quality=95, method=6)
print(pid, 'frames', len(glob.glob(os.path.join(dst, 'f*.webp'))), 'MB', round(total / 1e6, 2))
