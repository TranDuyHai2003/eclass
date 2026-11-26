"""
Tách tranh vẽ tay của khung viền / thú cưng ra khỏi nền pastel của ô sprite → WebP nền trong suốt.

Vì sao: sprite gốc (public/studio/items.webp, shop.webp) là ảnh RGB, mỗi ô có nền chuyển màu nhạt + mẩu của ô bên cạnh.
Trước đây web cắt ô bằng khung tròn / mặt nạ mờ → tai mèo, đầu rồng bị cụt, mép nhoè, Phượng hoàng dính ô nền hồng
(thầy báo 26/11/2026). Script này:
  1. loang từ mép ô (và từ tâm với khung viền) qua các điểm sáng đổi màu từ từ → nền; viền mực của tranh chặn lại;
  2. bỏ mẩu nhỏ chạm mép ô (tranh ô bên cạnh), giữ tranh chính + lấp lánh rời;
  3. mép mềm: độ trong theo khoảng cách màu tới nền, trừ màu nền khỏi điểm mép (không viền trắng);
  4. khung viền: căn theo TÂM LỖ của khung, bán kính lỗ = 30% cạnh ảnh (mặt nhân vật đặt inset 21% vừa khít);
     phần trang trí thò ra ngoài (tai, đầu rồng) → ảnh lớn hơn, ghi tỉ lệ vào lib/game/cut-art.ts để vẽ tràn ra.
Chạy: python scripts/studio/cut-item-art.py   (cần numpy, scipy, pillow)
"""
from collections import deque
import json
import os

import numpy as np
from PIL import Image
from scipy import ndimage as nd

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT_DIR = os.path.join(ROOT, "public", "studio", "cut")
TS_OUT = os.path.join(ROOT, "lib", "game", "cut-art.ts")

ITEMS = Image.open(os.path.join(ROOT, "public/studio/items.webp")).convert("RGB")
SHOP = Image.open(os.path.join(ROOT, "public/studio/shop.webp")).convert("RGB")
IW, IH = ITEMS.size[0] // 8, ITEMS.size[1] // 4
SW = SHOP.size[0] // 8

# id → (ảnh, cột, hàng)
FRAMES = {
    "frame-royal": (0, 2), "frame-laurel": (1, 2), "frame-sakura": (2, 2), "frame-neon": (3, 2),
    "frame-ice": (4, 2), "frame-catear": (5, 2), "frame-fire": (6, 2), "frame-moon": (7, 2),
}
PETS_ITEMS = {"pet-dragon": (1, 1), "pet-owl": (3, 1), "pet-bunny": (4, 1), "pet-slime": (5, 1), "pet-phoenix": (6, 1), "pet-robot": (7, 1)}
# Shiba ô sprite đồ vật đội mũ phù thuỷ → dùng ô tiệm (Shiba thường)
PETS_SHOP = {"pet-bi": 31, "pet-moka": 4, "pet-shiba": 27}
# Ảnh có mặt trắng sát nền (mèo Mướp Bi): loang chặt hơn để không ăn vào mặt
STEP_OF = {"pet-bi": 4.0, "pet-shiba": 3.0}

STEP = 9.0  # chênh màu tối đa giữa 2 điểm nền kề nhau (nền chuyển màu từ từ)
MIN_LUM = 175  # nền là màu sáng
HOLE_FRACTION = 0.30


def flood_bg(a: np.ndarray, seeds, step: float = STEP) -> np.ndarray:
    h, w, _ = a.shape
    lum = a.mean(axis=2)
    bg = np.zeros((h, w), bool)
    q = deque()
    for y, x in seeds:
        if lum[y, x] >= MIN_LUM and not bg[y, x]:
            bg[y, x] = True
            q.append((y, x))
    af = a.astype(np.float32)
    while q:
        y, x = q.popleft()
        c = af[y, x]
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not bg[ny, nx] and lum[ny, nx] >= MIN_LUM:
                if np.abs(af[ny, nx] - c).max() <= step:
                    bg[ny, nx] = True
                    q.append((ny, nx))
    return bg


def border_seeds(h, w):
    return [(0, x) for x in range(w)] + [(h - 1, x) for x in range(w)] + [(y, 0) for y in range(h)] + [(y, w - 1) for y in range(h)]


def cutout(cell: Image.Image, frame: bool, step: float = STEP):
    a = np.asarray(cell).copy()
    h, w, _ = a.shape
    seeds = border_seeds(h, w)
    if frame:
        cy, cx = h // 2, w // 2
        seeds += [(cy + dy, cx + dx) for dy in range(-12, 13, 4) for dx in range(-12, 13, 4)]
    bg = flood_bg(a, seeds, step)
    fg = ~bg
    # bỏ mẩu chạm mép ô (tranh ô bên cạnh) và vụn quá nhỏ
    lab, n = nd.label(fg)
    if n:
        sizes = nd.sum(fg, lab, range(1, n + 1))
        big = sizes.max()
        keep = np.zeros(n + 1, bool)
        for i in range(1, n + 1):
            sl = nd.find_objects((lab == i).astype(int))[0]
            touches = sl[0].start == 0 or sl[1].start == 0 or sl[0].stop == h or sl[1].stop == w
            area = sizes[i - 1]
            # mẩu nhỏ sát mép ô (≤ 12% cạnh) là tranh ô bên cạnh dù không chạm hẳn mép
            near = sl[0].start < 0.12 * h or sl[1].start < 0.12 * w or sl[0].stop > 0.88 * h or sl[1].stop > 0.88 * w
            keep[i] = area >= 0.25 * big or (not touches and area >= 40 and not (near and area < 0.05 * big))
        fg = keep[lab]
    # màu nền tại chỗ: trung bình các điểm nền lân cận (nội suy bằng làm mờ có trọng số)
    bgm = (~fg).astype(np.float32)
    af = a.astype(np.float32)
    k = 9
    wsum = nd.uniform_filter(bgm, k) + 1e-6
    local = np.stack([nd.uniform_filter(af[..., i] * bgm, k) / wsum for i in range(3)], axis=-1)
    far = nd.binary_dilation(~fg, iterations=12) == False  # noqa: E712 — sâu trong tranh: giữ nguyên
    local[far] = af[far]
    # độ trong ở mép: theo khoảng cách màu tới nền tại chỗ
    dist = np.sqrt(((af - local) ** 2).sum(axis=-1))
    alpha = np.clip(dist / 60.0, 0, 1)
    edge = nd.binary_dilation(fg, iterations=1) & ~nd.binary_erosion(fg, iterations=2)
    alpha = np.where(fg & ~edge, 1.0, np.where(edge, alpha, 0.0)).astype(np.float32)
    alpha = nd.gaussian_filter(alpha, 0.6)
    alpha[fg & ~edge] = 1.0
    # trừ màu nền khỏi điểm mép (khử quầng trắng)
    aa = alpha[..., None]
    rgb = np.where(aa > 0.02, (af - (1 - aa) * local) / np.maximum(aa, 0.02), 0)
    rgba = np.dstack([np.clip(rgb, 0, 255), np.clip(alpha * 255, 0, 255)]).astype(np.uint8)
    return rgba, fg, bg


def save(rgba: np.ndarray, name: str):
    os.makedirs(OUT_DIR, exist_ok=True)
    Image.fromarray(rgba, "RGBA").save(os.path.join(OUT_DIR, f"{name}.webp"), "WEBP", quality=90, method=6)


def frame_square(rgba: np.ndarray, fg: np.ndarray):
    h, w = fg.shape
    # lỗ giữa khung = vùng không phải tranh chứa tâm ô
    holes, _ = nd.label(~fg)
    hole = holes == holes[h // 2, w // 2]
    ys, xs = np.nonzero(hole)
    if ys.min() == 0 or xs.min() == 0 or ys.max() == h - 1 or xs.max() == w - 1:
        # khung hở (trăng khuyết): không có lỗ kín → căn theo khung bao của tranh
        return trim_square(rgba, pad=0.02), 1.0
    cy, cx = (ys.min() + ys.max()) / 2, (xs.min() + xs.max()) / 2
    r = ((ys.max() - ys.min()) + (xs.max() - xs.min())) / 4
    side = r / HOLE_FRACTION
    fy, fx = np.nonzero(rgba[..., 3] > 8)
    ext = max(np.abs(fy - cy).max(), np.abs(fx - cx).max()) + 2
    full = max(side / 2, ext) * 2
    scale = full / side
    n = int(round(full))
    out = np.zeros((n, n, 4), np.uint8)
    oy, ox = int(round(n / 2 - cy)), int(round(n / 2 - cx))
    y0, x0 = max(0, oy), max(0, ox)
    sy0, sx0 = y0 - oy, x0 - ox
    hh, ww = min(h - sy0, n - y0), min(w - sx0, n - x0)
    out[y0:y0 + hh, x0:x0 + ww] = rgba[sy0:sy0 + hh, sx0:sx0 + ww]
    return out, scale


def trim_square(rgba: np.ndarray, pad=0.04):
    ys, xs = np.nonzero(rgba[..., 3] > 8)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    side = int(max(y1 - y0, x1 - x0) * (1 + 2 * pad))
    out = np.zeros((side, side, 4), np.uint8)
    oy = (side - (y1 - y0)) // 2
    ox = (side - (x1 - x0)) // 2
    out[oy:oy + (y1 - y0), ox:ox + (x1 - x0)] = rgba[y0:y1, x0:x1]
    return out


def main():
    scales = {}
    for fid, (c, r) in FRAMES.items():
        cell = ITEMS.crop((c * IW, r * IH, (c + 1) * IW, (r + 1) * IH))
        rgba, fg, _ = cutout(cell, frame=True)
        sq, scale = frame_square(rgba, fg)
        save(sq, fid)
        scales[fid] = round(float(scale), 4)
    for pid, (c, r) in PETS_ITEMS.items():
        cell = ITEMS.crop((c * IW, r * IH, (c + 1) * IW, (r + 1) * IH))
        rgba, _, _ = cutout(cell, frame=False)
        save(trim_square(rgba), pid)
    for pid, i in PETS_SHOP.items():
        cell = SHOP.crop(((i % 8) * SW, (i // 8) * SW, (i % 8 + 1) * SW, (i // 8 + 1) * SW))
        rgba, _, _ = cutout(cell, frame=False, step=STEP_OF.get(pid, STEP))
        save(trim_square(rgba), pid)
    with open(TS_OUT, "w", encoding="utf-8") as f:
        f.write("// TỰ SINH bởi scripts/studio/cut-item-art.py — không sửa tay.\n")
        f.write("/** Tranh vẽ tay đã tách nền (public/studio/cut/<id>.webp). Khung: tỉ lệ ảnh / ô khung (>1 = trang trí thò ra ngoài) */\n")
        f.write(f"export const CUT_FRAME_SCALE: Record<string, number> = {json.dumps(scales)};\n")
        f.write(f"export const CUT_PETS = new Set<string>({json.dumps(sorted(list(PETS_ITEMS) + list(PETS_SHOP)))});\n")
    print("frames", scales)


if __name__ == "__main__":
    main()
