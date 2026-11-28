"""T24 — art 2D cho hiệu ứng phép vẽ: atlas nét cọ + 5 rune phép, từ ảnh Codex sinh (nguồn trong blender-src/fx-src/, gitignore).

Dùng: python scripts/spell-fx-art.py
  Nguồn (trắng trên nền đen tinh, 1024²):
    b1_strokes.png  4 nét cọ khô nằm ngang (2 trên: dải đều, 2 dưới: chấm vuốt nhọn hai đầu)
    b2_grain.png    vân lông cọ khô lặp được
    r1_shield.png … r5_wave.png   rune 5 phép (khiên, sét, xoắn, thiên thạch, sóng)
  Kết quả:
    public/world/fx/tex/brush_atlas.png  256 × 256 RGB — 4 hàng × 64 px (nét chiếm 52 px giữa, đệm đen 6 px trên / dưới
        chống lem mip); R = độ phủ nét cọ, G = vân vỡ (đã cân bằng histogram → ngưỡng xói đều 0..1), B = 0.
        Hàng 0–1 lặp liền theo chiều ngang (wrapS = Repeat), hàng 2–3 là nét đơn có hai đầu vuốt.
    public/world/fx/tex/spell_runes.png  1280 × 256 xám — 5 ô 256² theo thứ tự shield, bolt, vortex, meteor, wave.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "blender-src/fx-src"
OUT = ROOT / "public/world/fx/tex"


def gray(name: str) -> np.ndarray:
    return np.asarray(Image.open(SRC / name).convert("L"), dtype=np.float32) / 255.0


def lift(a: np.ndarray, lo: float = 0.1, hi: float = 0.9) -> np.ndarray:
    """bỏ nhiễu nền tối / nén trắng: tuyến tính lo..hi → 0..1"""
    return np.clip((a - lo) / (hi - lo), 0.0, 1.0)


def bands(a: np.ndarray, n: int) -> list[tuple[int, int]]:
    """tìm n dải ngang chứa nét (theo tổng hàng), lấy n dải dày nhất, sắp từ trên xuống"""
    rows = (a > 0.25).mean(axis=1) > 0.02
    runs, start = [], None
    for y, on in enumerate(rows):
        if on and start is None:
            start = y
        if not on and start is not None:
            runs.append((start, y))
            start = None
    if start is not None:
        runs.append((start, len(rows)))
    runs = sorted(sorted(runs, key=lambda r: r[1] - r[0], reverse=True)[:n])
    if len(runs) < n:
        raise SystemExit(f"chỉ tìm thấy {len(runs)} nét cọ trong b1_strokes.png (cần {n})")
    return runs


def seamless_x(a: np.ndarray, blend: int) -> np.ndarray:
    """ghép liền hai mép trái / phải: trộn tuyến tính `blend` cột cuối vào đầu rồi bỏ phần đuôi"""
    w = a.shape[1]
    t = np.linspace(0.0, 1.0, blend, dtype=np.float32)[None, :]
    out = a[:, : w - blend].copy()
    out[:, :blend] = a[:, w - blend :] * (1 - t) + a[:, :blend] * t
    return out


def seamless_xy(a: np.ndarray, blend: int) -> np.ndarray:
    return seamless_x(seamless_x(a, blend).T, blend).T


def resize(a: np.ndarray, w: int, h: int) -> np.ndarray:
    im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
    return np.asarray(im.resize((w, h), Image.LANCZOS), dtype=np.float32) / 255.0


def equalize(a: np.ndarray) -> np.ndarray:
    """cân bằng histogram → giá trị phân bố đều 0..1 (ngưỡng xói tăng đều theo thời gian)"""
    flat = a.ravel()
    order = flat.argsort(kind="stable")
    out = np.empty_like(flat)
    out[order] = np.linspace(0.0, 1.0, flat.size, dtype=np.float32)
    return out.reshape(a.shape)


def brush_atlas() -> None:
    a = lift(gray("b1_strokes.png"))
    grain = lift(gray("b2_grain.png"), 0.05, 0.95)
    rows_r = []
    for i, (y0, y1) in enumerate(bands(a, 4)):
        band = a[y0:y1]
        cols = np.where((band > 0.25).mean(axis=0) > 0.01)[0]
        band = band[:, cols[0] : cols[-1] + 1]
        if i < 2:
            # dải đều: cắt bớt hai đầu (thường loe / vuốt), ghép liền mép để lặp quanh vòng
            w = band.shape[1]
            band = seamless_x(band[:, int(w * 0.08) : int(w * 0.92)], max(8, int(w * 0.12)))
        rows_r.append(resize(band, 256, 52))
    R = np.zeros((256, 256), np.float32)
    for i, r in enumerate(rows_r):
        R[i * 64 + 6 : i * 64 + 58] = r
    g = seamless_xy(grain, 96)
    g = np.asarray(Image.fromarray((g * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3)), dtype=np.float32) / 255.0
    G = equalize(resize(g, 256, 256))
    rgb = np.stack([R, G, np.zeros_like(R)], axis=-1)
    OUT.mkdir(parents=True, exist_ok=True)
    Image.fromarray((rgb * 255 + 0.5).astype(np.uint8), "RGB").save(OUT / "brush_atlas.png", optimize=True)
    print("brush_atlas.png", R.mean().round(3), G.mean().round(3))


RUNES = ["r1_shield.png", "r2_bolt.png", "r3_vortex.png", "r4_meteor.png", "r5_wave.png"]


def runes() -> None:
    S = 256
    sheet = np.zeros((S, S * len(RUNES)), np.float32)
    for i, name in enumerate(RUNES):
        # nét rune gốc rất mảnh (~2 px / 1024) → nở 7 px + làm mềm trước khi thu về 232 px, không thì mất nét / răng cưa
        im = Image.open(SRC / name).convert("L").filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(1.2))
        a = lift(np.asarray(im, dtype=np.float32) / 255.0, 0.15, 0.85)
        ys, xs = np.where(a > 0.2)
        cy, cx = (ys.min() + ys.max()) / 2, (xs.min() + xs.max()) / 2
        half = max(ys.max() - ys.min(), xs.max() - xs.min()) / 2 * 1.08
        y0, x0 = int(max(0, cy - half)), int(max(0, cx - half))
        crop = a[y0 : int(cy + half), x0 : int(cx + half)]
        side = max(crop.shape)
        sq = np.zeros((side, side), np.float32)
        sq[(side - crop.shape[0]) // 2 : (side - crop.shape[0]) // 2 + crop.shape[0], (side - crop.shape[1]) // 2 : (side - crop.shape[1]) // 2 + crop.shape[1]] = crop
        # ô 256²: rune chiếm 232 px giữa (đệm chống lem mip giữa các ô)
        tile = np.zeros((S, S), np.float32)
        tile[12 : S - 12, 12 : S - 12] = resize(sq, S - 24, S - 24)
        sheet[:, i * S : (i + 1) * S] = tile
    Image.fromarray((sheet * 255 + 0.5).astype(np.uint8), "L").save(OUT / "spell_runes.png", optimize=True)
    print("spell_runes.png", sheet.shape)


if __name__ == "__main__":
    brush_atlas()
    runes()
