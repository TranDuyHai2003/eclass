"""Tài sản 2D cho ba khu mở rộng Mê cung Hoạ âm (giai đoạn 2 — docs/ai-reviews/siren-witch/PHASE2_PLAN.md).

Nguồn sinh bằng Codex (tranh khắc + giấy cắt dán, nguyên bản): blender-src/siren-src/zones/ (gitignored, xem BRIEF.md).
Dùng: python scripts/siren-zones.py [thư-mục-nguồn]
  - hình cắt giấy (nền trắng loang từ mép → trong suốt; tấm vé: lỗ bấm giữa cũng trong suốt) → atlas 4 × 4
    public/world/siren/zones_cut.webp (CELL × 4 mỗi cạnh) + khung uv / tỉ lệ thật → lib/world/zones/cutAtlas.ts (sinh);
  - vân lặp (terrazzo, đồng, cát, giấy than, sứ): làm liền mép (trộn với bản dời nửa ô theo mặt nạ chéo) → *.webp 1024².
"""
import sys
from collections import deque
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
src = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "blender-src/siren-src/zones"
OUT = ROOT / "public/world/siren"
CUTS = ["ticket_machine", "ticket", "chair", "board", "curtain", "beetle_a", "beetle_b", "tower", "crab_a", "crab_b", "door"]
TEX = {"terrazzo": 1024, "bronze": 1024, "sand": 512, "carbon": 1024, "porcelain": 512}
CELL = 512
PAD = 8
GRID = 4
S = CELL * GRID


def flood_clear(im: Image.Image, seeds) -> None:
    W, H = im.size
    px = im.load()
    near_white = lambda c: c[0] > 228 and c[1] > 228 and c[2] > 228
    seen = bytearray(W * H)
    q = deque(seeds)
    while q:
        x, y = q.popleft()
        if seen[y * W + x] or not near_white(px[x, y]):
            continue
        seen[y * W + x] = 1
        px[x, y] = (255, 255, 255, 0)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < W and 0 <= ny < H and not seen[ny * W + nx]:
                q.append((nx, ny))


def cutout(name: str) -> Image.Image:
    im = Image.open(src / f"{name}.png").convert("RGBA")
    W, H = im.size
    flood_clear(im, [(x, y) for x in range(W) for y in (0, H - 1)] + [(x, y) for y in range(H) for x in (0, W - 1)])
    if name == "ticket":
        # lỗ bấm tròn giữa vé: loang từ tâm
        flood_clear(im, [(W // 2, H // 2)])
    if name == "chair":
        # khoảng trống kín giữa khung ghế (lưng, chân): mọi điểm trắng tinh còn lại làm hạt loang
        px = im.load()
        flood_clear(im, [(x, y) for y in range(0, H, 6) for x in range(0, W, 6) if px[x, y][3] and min(px[x, y][:3]) > 246])
    a = im.getchannel("A").filter(ImageFilter.GaussianBlur(0.8))
    im.putalpha(a)
    bbox = a.point(lambda v: 255 if v > 20 else 0).getbbox()
    return im.crop(bbox)


def seamless(name: str, size: int) -> Image.Image:
    im = Image.open(src / f"{name}.png").convert("RGB").resize((size, size), Image.LANCZOS)
    off = ImageChops.offset(im, size // 2, size // 2)
    # mặt nạ: 1 ở giữa ô (giữ ảnh gốc), 0 ở mép (dùng bản dời — mép của nó là giữa ảnh gốc, liền nhau)
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    steps = 48
    for i in range(steps):
        k = i / steps
        inset = int(k * size * 0.32)
        d.rectangle((inset, inset, size - 1 - inset, size - 1 - inset), fill=int(255 * min(1, k * 1.15)))
    m = m.filter(ImageFilter.GaussianBlur(size / 40))
    return Image.composite(im, off, m)


OUT.mkdir(parents=True, exist_ok=True)
atlas = Image.new("RGBA", (S, S), (255, 255, 255, 0))
rects = []
for i, name in enumerate(CUTS):
    part = cutout(name)
    w, h = part.size
    k = min((CELL - 2 * PAD) / w, (CELL - 2 * PAD) / h)
    nw, nh = max(1, round(w * k)), max(1, round(h * k))
    part = part.resize((nw, nh), Image.LANCZOS)
    cx, cy = (i % GRID) * CELL, (i // GRID) * CELL
    ox, oy = cx + (CELL - nw) // 2, cy + (CELL - nh) // 2
    atlas.alpha_composite(part, (ox, oy))
    rects.append((name, ox / S, 1 - (oy + nh) / S, (ox + nw) / S, 1 - oy / S, w / h))
    print(f"{i:2d} {name:16s} {w}x{h} -> {nw}x{nh}")
# ô 11: bóng đổ elip trắng (shader tô màu)
d = ImageDraw.Draw(atlas)
i = len(CUTS)
cx, cy = (i % GRID) * CELL, (i // GRID) * CELL
d.ellipse((cx + PAD, cy + CELL * 0.3, cx + CELL - PAD, cy + CELL * 0.7), fill=(255, 255, 255, 255))
rects.append(("shadow", (cx + PAD) / S, 1 - (cy + CELL * 0.7) / S, (cx + CELL - PAD) / S, 1 - (cy + CELL * 0.3) / S, (CELL - 2 * PAD) / (CELL * 0.4)))

bg = Image.new("RGBA", (S, S), (200, 180, 150, 0))
bg.alpha_composite(atlas)
p = OUT / "zones_cut.webp"
bg.save(p, "WEBP", quality=84, method=6, exact=True)
print(p, p.stat().st_size // 1024, "KB")

ts = ROOT / "lib/world/zones/cutAtlas.ts"
lines = [
    "// SINH TỰ ĐỘNG bởi scripts/siren-zones.py — đừng sửa tay.",
    "/** Khung uv (u0, v0, u1, v1 — v từ dưới lên) + tỉ lệ rộng / cao thật của từng hình cắt trong public/world/siren/zones_cut.webp */",
    "export const CUT = {",
]
for name, u0, v0, u1, v1, asp in rects:
    lines.append(f"  {name}: {{ uv: [{u0:.5f}, {v0:.5f}, {u1:.5f}, {v1:.5f}] as const, aspect: {asp:.4f} }},")
lines.append("} as const;")
lines.append("export type CutName = keyof typeof CUT;")
ts.write_text("\n".join(lines) + "\n", encoding="utf-8")
print(ts)

for name, size in TEX.items():
    im = seamless(name, size)
    p = OUT / f"{name}.webp"
    im.save(p, "WEBP", quality=80, method=6)
    print(p, p.stat().st_size // 1024, "KB")
