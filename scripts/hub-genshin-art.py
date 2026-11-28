"""Quảng trường Khởi nguyên kiểu Genshin — texture vẽ tay (ảnh Codex sinh, nguồn trong blender-src/hub-src/, gitignore).

Dùng: python scripts/hub-genshin-art.py
  Nguồn (xem blender-src/hub-src/BRIEF.md):
    stone_paint.png   1024² lặp liền — vân đá sa thạch kem vẽ tay (không ron)
    grass_paint.png   1024² lặp liền — thảm cỏ vẽ tay nhìn từ trên
    flower_atlas.png  1024² — 2×2 khóm hoa nhìn ngang trên nền magenta (cúc trắng, cosmos hồng, mao lương vàng, chuông tím)
    petal_atlas.png   512² — 2×2 cánh / lá bay trên nền magenta (cánh anh đào, hạt bồ công anh, lá bạch quả, lá xanh)
  Kết quả (public/world/fx/tex/hub/):
    stone_paint.jpg   512² — CHI TIẾT đã chuẩn hoá quanh 1,0 (nhân lên màu nền trong shader): trung bình ≈ 0,5 trong sRGB 8 bit
    grass_paint.jpg   512² — màu cỏ (sRGB)
    flower_atlas.png  512² RGBA — 4 ô 256², alpha cắt từ magenta, màu viền đã "chảy" ra nền (không lem hồng khi mip)
    petal_atlas.png   256² RGBA — 4 ô 128², như trên
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "blender-src/hub-src"
OUT = ROOT / "public/world/fx/tex/hub"


def rgb(name: str) -> np.ndarray:
    return np.asarray(Image.open(SRC / name).convert("RGB"), dtype=np.float32) / 255.0


def seamless(a: np.ndarray, blend: int) -> np.ndarray:
    """bảo đảm lặp liền: trộn mép đối diện (ảnh nguồn đã gần liền; chỉ làm mịn vài chục điểm ảnh sát mép)"""
    h, w = a.shape[:2]
    out = a.copy()
    t = np.linspace(0.0, 1.0, blend, dtype=np.float32)
    for i in range(blend):
        k = 0.5 * (1 - t[i])
        out[:, i] = a[:, i] * (1 - k) + a[:, w - 1 - i] * k
        out[:, w - 1 - i] = a[:, w - 1 - i] * (1 - k) + a[:, i] * k
    a = out.copy()
    for i in range(blend):
        k = 0.5 * (1 - t[i])
        out[i] = a[i] * (1 - k) + a[h - 1 - i] * k
        out[h - 1 - i] = a[h - 1 - i] * (1 - k) + a[i] * k
    return out


def save_rgb(a: np.ndarray, name: str, size: int, q: int = 88):
    im = Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8), "RGB").resize((size, size), Image.LANCZOS)
    im.save(OUT / name, quality=q, optimize=True, progressive=True)
    print(name, im.size, (OUT / name).stat().st_size // 1024, "KB")


def key_magenta(a: np.ndarray) -> np.ndarray:
    """alpha từ khoảng cách tới magenta: nền (R, B cao, G thấp) → 0"""
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    k = np.minimum(r, b) - g  # magenta tinh ≈ 1; hoa hồng / tím ≤ 0,35
    alpha = 1.0 - np.clip((k - 0.42) / (0.7 - 0.42), 0, 1)
    return alpha


def bleed(col: np.ndarray, alpha: np.ndarray, iters: int = 48) -> np.ndarray:
    """màu viền chảy ra vùng trong suốt (mip / lọc song tuyến không kéo magenta vào mép)"""
    col = col.copy()
    known = alpha > 0.85
    col[~known] = 0
    for _ in range(iters):
        if known.all():
            break
        acc = np.zeros_like(col)
        cnt = np.zeros(alpha.shape, np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            sh = np.roll(np.roll(col, dy, 0), dx, 1)
            kn = np.roll(np.roll(known, dy, 0), dx, 1)
            acc += sh * kn[..., None]
            cnt += kn
        new = (~known) & (cnt > 0)
        col[new] = acc[new] / cnt[new][:, None]
        known = known | new
    return col


def atlas(name: str, out: str, size: int):
    a = rgb(name)
    alpha = key_magenta(a)
    # khử ánh magenta ở điểm ảnh bán trong suốt: kéo R, B về mức G cho phần "nền" còn lẫn
    spill = np.clip(np.minimum(a[..., 0], a[..., 2]) - a[..., 1], 0, 1) * (1 - alpha)
    a[..., 0] -= spill
    a[..., 2] -= spill
    col = bleed(a, alpha)
    if out == "petal_atlas.png":
        # hạt bồ công anh (ô trên phải): lông tơ mảnh còn lẫn magenta → đưa về trắng kem (giữ sáng tối)
        h, w = col.shape[:2]
        q = col[: h // 2, w // 2 :]
        lum = q.mean(axis=2, keepdims=True)
        col[: h // 2, w // 2 :] = np.clip(0.35 + 0.75 * lum, 0, 1) * np.array([1.0, 0.98, 0.93], np.float32)
    rgba = np.concatenate([col, alpha[..., None]], -1)
    im = Image.fromarray((np.clip(rgba, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA").resize((size, size), Image.LANCZOS)
    im.save(OUT / out, optimize=True)
    print(out, im.size, (OUT / out).stat().st_size // 1024, "KB", "cover", round(float((alpha > 0.5).mean()), 3))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    stone = seamless(rgb("stone_paint.png"), 24)
    # chi tiết quanh 1,0: chia trung bình rồi nén biên độ (×0,5 → lưu 0,5 = "không đổi")
    lum = stone.mean(axis=2, keepdims=True)
    detail = stone / max(1e-3, float(lum.mean()))
    detail = 1.0 + (detail - 1.0) * 1.25
    save_rgb(detail * 0.5, "stone_paint.jpg", 512)
    save_rgb(seamless(rgb("grass_paint.png"), 24), "grass_paint.jpg", 512)
    atlas("flower_atlas.png", "flower_atlas.png", 512)
    atlas("petal_atlas.png", "petal_atlas.png", 256)


if __name__ == "__main__":
    main()
