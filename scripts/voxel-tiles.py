"""Đóng gói hoạ tiết khối voxel → public/world/voxel/tiles.png (dải dọc TILE_PX × (TILE_PX · N)).

Dùng: python scripts/voxel-tiles.py <thư-mục-ảnh-nguồn>
  - nguồn: <tên>.png cho mỗi tên trong TILE_NAMES (lib/world/voxel/tiles.ts), ảnh pixel-art vuông bất kỳ cỡ;
  - thu về TILE_PX × TILE_PX bằng trung bình ô (BOX);
  - lớp "màu": nhân từng kênh để trung bình = màu gốc BLOCK_RGB (địa hình xa / vật phẩm vẫn khớp màu);
  - lớp "chi tiết" (grass_top): xám = độ sáng / độ sáng trung bình × 0,5;
  - lớp "thô" (RAW — đuốc: nền tối, chuẩn hoá sẽ cháy trắng): giữ màu ảnh; hệ số chuẩn hoá các lớp khác kẹp ≤ 2,5.
Bảng màu gốc và danh sách lớp được đọc thẳng từ mã TypeScript để không lệch.
"""
import re
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
TILES_TS = (ROOT / "lib/world/voxel/tiles.ts").read_text(encoding="utf-8")
VOX_TS = (ROOT / "lib/world/voxels.ts").read_text(encoding="utf-8")
BLOCKS_TS = (ROOT / "lib/world/blocks.ts").read_text(encoding="utf-8")

names = re.findall(r'"([a-z_]+)"', TILES_TS.split("export const TILE_NAMES = [")[1].split("] as const")[0])
px = int(re.search(r"TILE_PX = (\d+)", TILES_TS).group(1))
detail = set(re.findall(r"L\.([a-z_]+)", TILES_TS.split("DETAIL_TILES")[1].split(";")[0]))
blocks = re.findall(r'"([a-z]+)"', BLOCKS_TS.split("export const BLOCKS = [")[1].split("] as const")[0])
rgb = {}
for m in re.finditer(r"\[B\.([a-z]+)\]: \[\[([\d., ]+)\], \[([\d., ]+)\]\]", VOX_TS):
    rgb[m.group(1)] = ([float(v) for v in m.group(2).split(",")], [float(v) for v in m.group(3).split(",")])
tile_of = {}
for m in re.finditer(r"\[B\.([a-z]+)\]: \[L\.([a-z_]+), L\.([a-z_]+), L\.([a-z_]+)\]", TILES_TS):
    tile_of[m.group(1)] = (m.group(2), m.group(3), m.group(4))


def base_of(layer):
    """màu gốc của lớp = mặt đầu tiên dùng lớp này (giống tileBase trong tiles.ts)"""
    for b in blocks:
        t = tile_of.get(b)
        if t and layer in t:
            k = t.index(layer)
            c = rgb.get(b)
            return None if c is None else (c[0] if k == 0 else c[1])
    return None


RAW = {"torch"}
src = Path(sys.argv[1])
out = Image.new("RGBA", (px, px * len(names)))
for i, n in enumerate(names):
    im = Image.open(src / f"{n}.png").convert("RGB")
    s = min(im.size)
    im = im.crop(((im.width - s) // 2, (im.height - s) // 2, (im.width - s) // 2 + s, (im.height - s) // 2 + s))
    im = im.resize((px, px), Image.BOX)
    p = [tuple(c / 255 for c in im.getpixel((x, y))) for y in range(px) for x in range(px)]
    if n in detail:
        lum = [0.3 * r + 0.59 * g + 0.11 * b for r, g, b in p]
        avg = sum(lum) / len(lum)
        # tương phản × 1,6 (mặt cỏ nhìn chéo + mipmap làm nhạt chi tiết)
        vals = [(min(1.0, max(0.0, 0.5 * (1 + (l / avg - 1) * 1.6))),) * 3 for l in lum]
    elif n in RAW:
        vals = p
    else:
        base = base_of(n) or [0.5, 0.5, 0.5]
        avg = [sum(c[k] for c in p) / len(p) for k in range(3)]
        f = [min(2.5, base[k] / max(1e-3, avg[k])) for k in range(3)]
        vals = [tuple(min(1.0, c[k] * f[k]) for k in range(3)) for c in p]
    for j, v in enumerate(vals):
        out.putpixel((j % px, i * px + j // px), tuple(round(c * 255) for c in v) + (255,))
    print(f"{i:2d} {n:12s} {'chi tiết' if n in detail else 'thô' if n in RAW else 'màu'}")
dst = ROOT / "public/world/voxel/tiles.png"
dst.parent.mkdir(parents=True, exist_ok=True)
out.save(dst, optimize=True)
print("→", dst, dst.stat().st_size, "B")

# ── sprite đuốc (hai mặt bắt chéo, components/world/voxel/TorchSprites.tsx): nền tối của ảnh nguồn → trong suốt ──
im = Image.open(src / "torch.png").convert("RGB")
s = min(im.size)
im = im.crop(((im.width - s) // 2, (im.height - s) // 2, (im.width - s) // 2 + s, (im.height - s) // 2 + s)).resize((px, px), Image.BOX)
bg = im.getpixel((1, 1))
spr = Image.new("RGBA", (px, px))
for y in range(px):
    for x in range(px):
        c = im.getpixel((x, y))
        d = sum(abs(a - b) for a, b in zip(c, bg))
        spr.putpixel((x, y), c + ((255 if d > 60 else 0),))
dst2 = ROOT / "public/world/voxel/torch_sprite.png"
spr.save(dst2, optimize=True)
print("→", dst2, dst2.stat().st_size, "B")
