"""Icon vật phẩm (tranh anime sinh bằng Codex, nền trắng) + mặt nạ vết nứt khi đào.

Dùng: python scripts/voxel-items.py <thư-mục-nguồn>   (nguồn: blender-src/voxel-tiles/items)
  - <id>.png (id vật phẩm không phải khối) → public/world/items/vox/<id>.png 128 × 128, nền trắng → trong suốt
    (loang từ mép ảnh qua điểm gần trắng — không đục lỗ phần sáng bên trong vật);
  - crack_mask.png (nứt trắng trên nền đen) → public/world/voxel/crack.png 64 × 64 (R): điểm nứt = NGƯỠNG LỘ 1…255
    theo khoảng cách tới tâm (+ nhiễu nhỏ) → shader lộ dần vết nứt từ tâm ra theo tiến độ đào, cùng một hình vẽ.
"""
import random
import sys
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
src = Path(sys.argv[1])
ICONS = [
    "int_crystal", "ratio_copper", "survey_key", "axis_pick", "ratio_pick",
    # bậc boss (docs/ai-reviews/voxel-world/BOSSES.md) + khối nước (icon theo tên khối)
    "mirror_shard", "survey_lens", "phase_silk", "pattern_press", "draw_token", "chance_amber", "observatory_seal", "amber_pick", "water",
]
out_dir = ROOT / "public/world/items/vox"
out_dir.mkdir(parents=True, exist_ok=True)

for n in ICONS:
    im = Image.open(src / f"{n}.png").convert("RGBA")
    W, H = im.size
    px = im.load()
    near_white = lambda c: c[0] > 236 and c[1] > 236 and c[2] > 236
    seen = bytearray(W * H)
    q = deque((x, y) for x in range(W) for y in (0, H - 1)) + deque((x, y) for y in range(H) for x in (0, W - 1))
    while q:
        x, y = q.popleft()
        if seen[y * W + x] or not near_white(px[x, y]):
            continue
        seen[y * W + x] = 1
        px[x, y] = (255, 255, 255, 0)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if 0 <= x + dx < W and 0 <= y + dy < H and not seen[(y + dy) * W + x + dx]:
                q.append((x + dx, y + dy))
    bb = im.getbbox()
    im = im.crop(bb)
    s = max(im.size)
    sq = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    sq.paste(im, ((s - im.width) // 2, (s - im.height) // 2))
    out = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    out.alpha_composite(sq.resize((120, 120), Image.LANCZOS), (4, 4))
    out.save(out_dir / f"{n}.png", optimize=True)
    print(n, (out_dir / f"{n}.png").stat().st_size, "B")

# vết nứt
P = 64
m = Image.open(src / "crack_mask.png").convert("L").resize((P, P), Image.BOX)
random.seed(7)
crack = Image.new("L", (P, P), 0)
for y in range(P):
    for x in range(P):
        if m.getpixel((x, y)) > 110:
            d = ((x + 0.5 - P / 2) ** 2 + (y + 0.5 - P / 2) ** 2) ** 0.5 / (P / 2 * 1.414)
            crack.putpixel((x, y), max(1, min(255, round((d * 0.92 + random.random() * 0.08) * 255))))
dst = ROOT / "public/world/voxel/crack.png"
crack.save(dst, optimize=True)
print("crack", dst.stat().st_size, "B")
