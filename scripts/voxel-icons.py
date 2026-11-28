"""Icon vật phẩm khối (isometric, kiểu Minecraft) từ hoạ tiết đã đóng gói public/world/voxel/tiles.png.

Dùng: python scripts/voxel-icons.py   → public/world/items/vox/<khối>.png (96 × 96, nền trong suốt)
  - mặt trên = lớp "trên" của khối, hai mặt cạnh = lớp "cạnh" (bóng 0,86 / 0,7) — đúng ánh xạ lib/world/voxel/tiles.ts;
  - lớp "chi tiết" (cỏ trên, ảnh xám) nhân màu gốc BLOCK_RGB × 2 như shader; lấy mẫu gần nhất (giữ chất pixel-art);
  - viền mực tím sẫm 1 px quanh khối (khớp viền mực trong game).
"""
import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
TILES_TS = (ROOT / "lib/world/voxel/tiles.ts").read_text(encoding="utf-8")
VOX_TS = (ROOT / "lib/world/voxels.ts").read_text(encoding="utf-8")
names = re.findall(r'"([a-z_]+)"', TILES_TS.split("export const TILE_NAMES = [")[1].split("] as const")[0])
px = int(re.search(r"TILE_PX = (\d+)", TILES_TS).group(1))
detail = set(re.findall(r"L\.([a-z_]+)", TILES_TS.split("DETAIL_TILES")[1].split(";")[0]))
rgb = {m.group(1): [float(v) for v in m.group(2).split(",")] for m in re.finditer(r"\[B\.([a-z]+)\]: \[\[([\d., ]+)\]", VOX_TS)}
tile_of = {m.group(1): (m.group(2), m.group(3)) for m in re.finditer(r"\[B\.([a-z]+)\]: \[L\.([a-z_]+), L\.([a-z_]+), L\.[a-z_]+\]", TILES_TS)}

strip = Image.open(ROOT / "public/world/voxel/tiles.png").convert("RGB")


def tile(name, block):
    i = names.index(name)
    t = strip.crop((0, i * px, px, i * px + px))
    if name in detail:  # ảnh xám × 0,5 → nhân màu gốc × 2
        base = rgb[block]
        data = [tuple(min(255, round(c * 2 * b)) for c, b in zip(p, base)) for p in t.getdata()]
        t = Image.new("RGB", (px, px))
        t.putdata(data)
    return t


S = 96
OUT = ROOT / "public/world/items/vox"
OUT.mkdir(parents=True, exist_ok=True)
INK = (43, 30, 64, 255)
for block, (top_n, side_n) in tile_of.items():
    top, side = tile(top_n, block), tile(side_n, block)
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    # khối đơn vị chiếu isometric: tâm (cx, cy), cạnh a; đỉnh trên (cx, cy − a), mặt trên là hình thoi
    a = 40.0
    cx, cy = S / 2, S / 2 + 2
    h = a  # chiều cao mặt cạnh (px)
    for y in range(S):
        for x in range(S):
            X, Y = x + 0.5 - cx, y + 0.5 - cy
            col = None
            # mặt trên: (u, v) ∈ [0,1]²: X = (u − v)·a·0,866, Y = (u + v − 1)·a·0,5 − h/2
            yy = Y + h / 2
            u = (X / (a * 0.866) + yy / (a * 0.5) + 1) / 2
            v = (yy / (a * 0.5) + 1 - X / (a * 0.866)) / 2
            if 0 <= u < 1 and 0 <= v < 1:
                col = top.getpixel((min(px - 1, int(u * px)), min(px - 1, int(v * px))))
                k = 1.0
            else:
                # mặt trái (X < 0) / phải (X ≥ 0): s ngang, t dọc
                # s: 0 ở đỉnh bên (trái / phải) → 1 ở cạnh trước; mép trên của mặt ở y = −h/2 + a·0,5·s
                s = 1 + X / (a * 0.866) if X < 0 else 1 - X / (a * 0.866)
                t = (Y - (-h / 2 + a * 0.5 * s)) / h
                k = 0.86 if X < 0 else 0.7
                if 0 <= s < 1 and 0 <= t < 1:
                    su = s if X < 0 else 1 - s
                    col = side.getpixel((min(px - 1, int(su * px)), min(px - 1, int(t * px))))
            if col is not None:
                im.putpixel((x, y), tuple(round(c * k) for c in col) + (255,))
    # viền mực: điểm trong suốt cạnh điểm đặc
    alpha = im.split()[3]
    ink = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    for y in range(S):
        for x in range(S):
            if alpha.getpixel((x, y)):
                continue
            if any(0 <= x + dx < S and 0 <= y + dy < S and alpha.getpixel((x + dx, y + dy)) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                ink.putpixel((x, y), INK)
    im = Image.alpha_composite(ink, im)
    im.save(OUT / f"{block}.png", optimize=True)
    print(block, top_n, side_n)
