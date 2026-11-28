"""Atlas bộ phận phù thuỷ GỐI XẾP IM (Mê cung Hoạ âm) — tranh khắc + nỉ / giấy cắt sinh bằng Codex trên nền XANH LÁ #00FF00.

Dùng: python scripts/siren-witch-goixepim.py [thư-mục-nguồn]   (mặc định blender-src/siren-src/witches/goixepim — gitignored)
  - mỗi <tên>.png: tách nền xanh theo SẮC ĐỘ (g trội hẳn r, b — bảng màu nhân vật không có xanh lá) → trong suốt,
    khử viền xanh (despill: g ≤ max(r, b) ở mép), mép mềm 1 px (alpha-test 0,5 vẫn sắc, mip xa không vụn), cắt sát khung,
    thu vừa ô (giữ tỉ lệ, lề 8 px) của atlas 4 × 4 → public/world/siren/witches/goixepim.webp (2048²);
  - ô 15 = bóng đổ (elip trắng, shader tô màu);
  - ghi khung uv thật của từng ô → lib/world/witchGoiXepImAtlas.ts (thứ tự ô = GX_CELL bên dưới).
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
src = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "blender-src/siren-src/witches/goixepim"
ORDER = [
    "pillow_front", "gusset", "eye_open", "eye_closed", "eye_unravel", "end_clamp", "pleat_panel", "seam_strip",
    "thread_0", "thread_1", "thread_2", "spool_body", "spool_thread", "clampling_jaw", "pouch",
]
CELL = 512
PAD = 8
GRID = 4
S = CELL * GRID


def key(path: Path) -> Image.Image:
    im = Image.open(path).convert("RGBA")
    px = im.load()
    W, H = im.size
    for y in range(H):
        for x in range(W):
            r, g, b, _ = px[x, y]
            m = max(r, b)
            # độ "xanh nền": 0 = không xanh, 1 = xanh thuần
            k = (g - m - 40) / 90.0
            if k >= 1:
                px[x, y] = (0, 0, 0, 0)
            elif k > 0:
                # pixel lẫn nền ở mép: giảm alpha + khử ánh xanh
                px[x, y] = (r, min(g, m), b, int(255 * (1 - k)))
            elif g > m:
                px[x, y] = (r, m + (g - m) // 3, b, 255)
    a = im.getchannel("A").filter(ImageFilter.GaussianBlur(0.7))
    im.putalpha(a)
    bbox = a.point(lambda v: 255 if v > 24 else 0).getbbox()
    return im.crop(bbox)


atlas = Image.new("RGBA", (S, S), (0, 0, 0, 0))
rects = []
for i, name in enumerate(ORDER):
    part = key(src / f"{name}.png")
    w, h = part.size
    k = min((CELL - 2 * PAD) / w, (CELL - 2 * PAD) / h)
    nw, nh = max(1, round(w * k)), max(1, round(h * k))
    part = part.resize((nw, nh), Image.LANCZOS)
    cx, cy = (i % GRID) * CELL, (i // GRID) * CELL
    ox, oy = cx + (CELL - nw) // 2, cy + (CELL - nh) // 2
    atlas.alpha_composite(part, (ox, oy))
    rects.append((ox / S, 1 - (oy + nh) / S, (ox + nw) / S, 1 - oy / S))
    print(f"{i:2d} {name:14s} {w}x{h} -> {nw}x{nh}")

# ô 15: bóng đổ elip
d = ImageDraw.Draw(atlas)
cx, cy = (15 % GRID) * CELL, (15 // GRID) * CELL
d.ellipse((cx + PAD, cy + CELL * 0.3, cx + CELL - PAD, cy + CELL * 0.7), fill=(255, 255, 255, 255))
rects.append((cx / S + PAD / S, 1 - (cy + CELL * 0.7) / S, (cx + CELL - PAD) / S, 1 - (cy + CELL * 0.3) / S))

# điểm ảnh trong suốt mang màu vải kem (không trắng / đen / xanh) → viền mip không loé
bg = Image.new("RGBA", (S, S), (226, 196, 180, 0))
bg.alpha_composite(atlas)
out = ROOT / "public/world/siren/witches/goixepim.webp"
out.parent.mkdir(parents=True, exist_ok=True)
bg.save(out, "WEBP", quality=84, method=6, exact=True)
print(out, out.stat().st_size // 1024, "KB")

ts = ROOT / "lib/world/witchGoiXepImAtlas.ts"
rows = ",\n".join(f"  [{a:.5f}, {b:.5f}, {c:.5f}, {e:.5f}]" for a, b, c, e in rects)
names = ", ".join(f"{n.replace('_', '')}: {i}" for i, n in enumerate(ORDER + ["shadow"]))
ts.write_text(
    "// SINH TỰ ĐỘNG bởi scripts/siren-witch-goixepim.py — đừng sửa tay.\n"
    f"// Khung uv (u0, v0, u1, v1; gốc dưới-trái như WebGL) của phần hình thật trong từng ô atlas {GRID} × {GRID}\n"
    "// public/world/siren/witches/goixepim.webp (tranh Codex: blender-src/siren-src/witches/goixepim/BRIEF.md).\n"
    'export const GX_ATLAS = "siren/witches/goixepim.webp";\n'
    f"export const GX_CELL = {{ {names} }} as const;\n"
    f"export const GX_RECTS: readonly (readonly [number, number, number, number])[] = [\n{rows},\n];\n",
    encoding="utf-8",
    newline="\n",
)
print(ts)
