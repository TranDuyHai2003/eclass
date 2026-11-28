"""Mê cung Hoạ âm (nhánh W) — đóng gói tranh cắt dán Codex → atlas alpha-test cho bầu trời multiplane + thác ký hiệu.

Dùng: python scripts/siren-collage.py [thư-mục-nguồn]   (mặc định blender-src/siren-src)
  nguồn (Codex, nền xanh chroma #00FF00, lưới 4 × 4 đều):
    collage_a.png — 8 vật thể × 2 khung tay A/B (cột 1–2 / 3–4 của mỗi hàng)
    collage_b.png — 16 bóng lớn cho lớp xa
    notes_atlas.png — 16 ký hiệu nhạc cắt giấy
  ra:
    public/world/siren/collage.webp — 2048 × 1024, 8 cột × 4 hàng (cột 0–3 = tờ A, 4–7 = tờ B), ô 256 px
    public/world/siren/notes.webp   — 1024 × 1024, 4 × 4, ô 256 px
Mỗi ô: tách nền xanh (khoá chroma + khử loang xanh ở mép), cắt theo khung bao của mảnh, đặt giữa ô (giữ tỉ lệ, chừa lề),
mép alpha cứng (alpha-test 0,5 trong shader), rồi "nở" màu ra vùng trong suốt để mipmap không viền xanh / đen.
Thứ tự ô = thứ tự trong lib/world/sirenWorld.ts (COLLAGE_COLS / NOTES_COLS, NOTE_REST_CELL = ô 10).
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "blender-src/siren-src"
OUT = ROOT / "public/world/siren"
CELL = 256
MARGIN = 10


def key_green(rgb: np.ndarray) -> np.ndarray:
    """alpha 0…1 từ độ "xanh trội" (g − max(r, b)); khử loang xanh ở mép"""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    spill = g - np.maximum(r, b)
    a = 1.0 - np.clip((spill - 40.0) / 80.0, 0.0, 1.0)
    # khử loang: kẹp kênh xanh không vượt trung bình đỏ / lam nhiều
    lim = np.maximum(r, b) + 12.0
    rgb[..., 1] = np.minimum(g, lim)
    return a


def cells(path: Path, n=4):
    im = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    h, w = im.shape[:2]
    for j in range(n):
        for i in range(n):
            y0, y1 = round(j * h / n), round((j + 1) * h / n)
            x0, x1 = round(i * w / n), round((i + 1) * w / n)
            yield im[y0:y1, x0:x1].copy()


def fit(rgb: np.ndarray, bottom=True) -> Image.Image:
    a = key_green(rgb)
    # bỏ vụn: chỉ giữ alpha ≥ 0,5 làm mặt nạ cứng, khung bao theo mặt nạ
    mask = a >= 0.5
    ys, xs = np.nonzero(mask)
    if len(xs) == 0:
        return Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgba = np.dstack([rgb, (a * 255.0)]).clip(0, 255).astype(np.uint8)[y0:y1, x0:x1]
    piece = Image.fromarray(rgba, "RGBA")
    s = (CELL - 2 * MARGIN) / max(piece.width, piece.height)
    piece = piece.resize((max(1, round(piece.width * s)), max(1, round(piece.height * s))), Image.LANCZOS)
    cell = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    # đặt sát đáy ô (mảnh "đứng" trên chân — trời đặt gốc mảnh ở cùng độ cao)
    # ký hiệu nhạc: đặt giữa ô (lật / xoay quanh tâm)
    y = CELL - MARGIN - piece.height if bottom else (CELL - piece.height) // 2
    cell.paste(piece, ((CELL - piece.width) // 2, y), piece)
    return bleed(cell)


def bleed(cell: Image.Image) -> Image.Image:
    """nở màu ra vùng trong suốt (giữ alpha) → mipmap / lọc tuyến tính không lấy viền tối"""
    arr = np.asarray(cell).astype(np.float32)
    rgb, a = arr[..., :3], arr[..., 3:] / 255.0
    acc = rgb * a
    w = a.copy()
    for _ in range(4):
        accb = np.asarray(Image.fromarray(acc.clip(0, 255).astype(np.uint8)).filter(ImageFilter.BoxBlur(4))).astype(np.float32)
        wb = np.asarray(Image.fromarray((w[..., 0] * 255).astype(np.uint8)).filter(ImageFilter.BoxBlur(4))).astype(np.float32)[..., None] / 255.0
        fill = accb / np.maximum(wb, 1e-3)
        rgb = np.where(a > 0.5, rgb, fill)
        acc, w = rgb * np.maximum(a, wb), np.maximum(a, wb)
    hard = np.where(a >= 0.5, 255, 0).astype(np.uint8)
    return Image.fromarray(np.dstack([rgb.clip(0, 255).astype(np.uint8), hard[..., 0]]), "RGBA")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    atlas = Image.new("RGBA", (CELL * 8, CELL * 4), (0, 0, 0, 0))
    for k, c in enumerate(cells(SRC / "collage_a.png")):
        atlas.paste(fit(c), ((k % 4) * CELL, (k // 4) * CELL))
    for k, c in enumerate(cells(SRC / "collage_b.png")):
        atlas.paste(fit(c), ((4 + k % 4) * CELL, (k // 4) * CELL))
    atlas.save(OUT / "collage.webp", "WEBP", quality=88, method=6)
    notes = Image.new("RGBA", (CELL * 4, CELL * 4), (0, 0, 0, 0))
    for k, c in enumerate(cells(SRC / "notes_atlas.png")):
        notes.paste(fit(c, bottom=False), ((k % 4) * CELL, (k // 4) * CELL))
    notes.save(OUT / "notes.webp", "WEBP", quality=90, method=6)
    for f in ("collage.webp", "notes.webp"):
        print(f, (OUT / f).stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
