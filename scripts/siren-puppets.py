"""Atlas bộ phận con rối giấy của Mê cung Hoạ âm (tranh khắc + giấy cắt sinh bằng Codex, nền trắng).

Dùng: python scripts/siren-puppets.py [thư-mục-nguồn]   (mặc định blender-src/siren-src/puppets — gitignored)
  - mỗi <tên>.png: nền trắng loang từ mép ảnh → trong suốt (không đục phần sáng bên trong vật), cắt sát khung,
    thu vừa ô (giữ tỉ lệ, lề 6 px) của atlas 4 × 4 → public/world/siren/puppets.webp (CELL × 4 mỗi cạnh);
  - ô 14 = bóng đổ (elip trắng, shader tô màu), ô 15 = dây treo (trắng đặc);
  - ghi khung uv thật của từng ô → lib/world/sirenPuppetAtlas.ts (thứ tự ô = CELL trong lib/world/sirenPuppets.ts).
"""
import sys
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
src = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "blender-src/siren-src/puppets"
ORDER = [
    "hammer_head", "hammer_shank", "leg_strip", "peg_half", "clip_arm", "metronome_body", "metronome_arm", "windup_key",
    "fork_body", "fork_wing", "face_0", "face_1", "face_2", "collar",
]
CELL = 384
PAD = 6
GRID = 4
S = CELL * GRID


def cutout(path: Path) -> Image.Image:
    im = Image.open(path).convert("RGBA")
    W, H = im.size
    px = im.load()
    near_white = lambda c: c[0] > 232 and c[1] > 232 and c[2] > 232
    seen = bytearray(W * H)
    q = deque([(x, y) for x in range(W) for y in (0, H - 1)] + [(x, y) for y in range(H) for x in (0, W - 1)])
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
    # mép mềm 1 px (alpha-test ở 0,5 vẫn sắc, mip xa không vỡ vụn)
    a = im.getchannel("A").filter(ImageFilter.GaussianBlur(0.8))
    im.putalpha(a)
    bbox = a.point(lambda v: 255 if v > 20 else 0).getbbox()
    return im.crop(bbox)


atlas = Image.new("RGBA", (S, S), (255, 255, 255, 0))
rects = []
for i, name in enumerate(ORDER):
    part = cutout(src / f"{name}.png")
    w, h = part.size
    k = min((CELL - 2 * PAD) / w, (CELL - 2 * PAD) / h)
    nw, nh = max(1, round(w * k)), max(1, round(h * k))
    part = part.resize((nw, nh), Image.LANCZOS)
    cx, cy = (i % GRID) * CELL, (i // GRID) * CELL
    ox, oy = cx + (CELL - nw) // 2, cy + (CELL - nh) // 2
    atlas.alpha_composite(part, (ox, oy))
    rects.append((ox / S, 1 - (oy + nh) / S, (ox + nw) / S, 1 - oy / S))
    print(f"{i:2d} {name:16s} {w}x{h} -> {nw}x{nh}")

# ô 14: bóng đổ elip; ô 15: dây treo (trắng đặc, lấy phần giữa ô để mip không lẫn ô bên)
d = ImageDraw.Draw(atlas)
cx, cy = (14 % GRID) * CELL, (14 // GRID) * CELL
d.ellipse((cx + PAD, cy + CELL * 0.3, cx + CELL - PAD, cy + CELL * 0.7), fill=(255, 255, 255, 255))
rects.append((cx / S + PAD / S, 1 - (cy + CELL * 0.7) / S, (cx + CELL - PAD) / S, 1 - (cy + CELL * 0.3) / S))
cx, cy = (15 % GRID) * CELL, (15 // GRID) * CELL
d.rectangle((cx + PAD, cy + PAD, cx + CELL - PAD, cy + CELL - PAD), fill=(255, 255, 255, 255))
rects.append(((cx + CELL * 0.4) / S, 1 - (cy + CELL * 0.6) / S, (cx + CELL * 0.6) / S, 1 - (cy + CELL * 0.4) / S))

# điểm ảnh trong suốt mang màu giấy (không phải trắng / đen) → viền mip không loé trắng
bg = Image.new("RGBA", (S, S), (210, 190, 160, 0))
bg.alpha_composite(atlas)
out = ROOT / "public/world/siren/puppets.webp"
out.parent.mkdir(parents=True, exist_ok=True)
bg.save(out, "WEBP", quality=86, method=6, exact=True)
print(out, out.stat().st_size // 1024, "KB")

ts = ROOT / "lib/world/sirenPuppetAtlas.ts"
rows = ",\n".join(f"  [{a:.5f}, {b:.5f}, {c:.5f}, {e:.5f}]" for a, b, c, e in rects)
ts.write_text(
    "// SINH TỰ ĐỘNG bởi scripts/siren-puppets.py — đừng sửa tay.\n"
    f"// Khung uv (u0, v0, u1, v1; gốc dưới-trái như WebGL) của phần hình thật trong từng ô atlas {GRID} × {GRID} public/world/siren/puppets.webp.\n"
    'export const PUPPET_ATLAS = "siren/puppets.webp";\n'
    f"export const PUPPET_RECTS: readonly (readonly [number, number, number, number])[] = [\n{rows},\n];\n",
    encoding="utf-8",
    newline="\n",
)
print(ts)
