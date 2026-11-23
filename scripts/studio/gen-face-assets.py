"""
Sinh ảnh phụ cho nhân vật vẽ tay (public/studio/characters.webp: 8 ô 332x272, thứ tự PRESETS):
  char-hair.webp / char-eyes.webp : vùng tóc / tròng mắt (RGB = độ sáng đã chuẩn hoá, A = mặt nạ)
                                    -> đổi màu tóc/mắt ngay trên tranh bằng phép nhân (Chibi.tsx)
  faces.webp / faces-eyes.webp    : mặt của 6 mẫu (bỏ hiệp sĩ, nhà du hành vì đội mũ kín), căn theo mắt nhân vật SVG,
                                    tóc/mũ/áo lẫn trong vùng mặt được lấp bằng màu da
Chạy:
  python3 -m venv /tmp/v && /tmp/v/bin/pip install numpy scipy pillow
  /tmp/v/bin/python scripts/studio/gen-face-assets.py
Script in màu da của từng mặt -> chép vào FACES trong lib/game/presets.ts.
"""
import json
import os

import numpy as np
from PIL import Image
from scipy import ndimage as nd

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
OUT = os.path.join(ROOT, "public", "studio")
CELL = 332
HAIR_CELLS = {0, 1, 2, 4, 6, 7}  # hiệp sĩ (3), nhà du hành (5): mũ kín, không đổi màu tóc
FACE_CELLS = [0, 1, 2, 4, 6, 7]  # thứ tự ô trong faces.webp = FACES trong lib/game/presets.ts

im = np.array(Image.open(os.path.join(OUT, "characters.webp")).convert("RGBA")).astype(float) / 255
rgb, a = im[..., :3], im[..., 3]
H, W = a.shape
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
mx, mn = rgb.max(-1), rgb.min(-1)
sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
d = mx - mn + 1e-6
hue = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
yy, xx = np.mgrid[0:H, 0:W]
cell_of = xx // CELL
lum = 0.299 * r + 0.587 * g + 0.114 * b

# Vùng nâu / tối ở phần đầu -> tách thành mảng: mảng lớn = tóc, mảng vừa quanh tầm mắt = tròng mắt
cand = (a > 0.5) & (yy < 175) & (mx < 0.72) & (mx > 0.12) & (
    (((hue < 50) | (hue > 330)) & (sat > 0.18)) | ((sat < 0.25) & (mx < 0.55))
)
lab, n = nd.label(cand)
areas = nd.sum(cand, lab, range(1, n + 1))
hair = np.zeros((H, W), bool)
eyes = np.zeros((H, W), bool)
eye_at = {}
for i, area in enumerate(areas, 1):
    m = lab == i
    ys, xs = np.where(m)
    cx, cy = xs.mean(), ys.mean()
    c, lx = int(cx // CELL), cx % CELL
    if area > 700 and c in HAIR_CELLS:
        hair |= m
    elif 250 <= area <= 700 and 95 <= cy <= 135 and 110 <= lx <= 210 and c != 5:
        eyes |= m
        eye_at.setdefault(c, []).append((cx, cy))
hair &= ~((cell_of == 7) & (xx % CELL > 222) & (yy < 80))  # hoa cài của cô gái kimono


def shade(mask, pct):
    """RGB = độ sáng / phân vị pct của vùng (kẹp 0..1), A = mặt nạ làm mềm mép"""
    out = np.zeros((H, W, 4))
    for c in range(8):
        cm = mask & (cell_of == c)
        if cm.any():
            out[cm, :3] = np.clip(lum[cm] / np.percentile(lum[cm], pct), 0, 1)[:, None]
    soft = nd.gaussian_filter(mask.astype(float), 0.6)
    out[..., 3] = np.clip(np.maximum(mask * 1.0, soft), 0, 1) * a
    edge = (~mask) & (out[..., 3] > 0)
    out[edge, :3] = np.clip(lum[edge] / 0.6, 0, 1)[:, None]
    return out


hair_sh, eye_sh = shade(hair, 80), shade(eyes, 85)
Image.fromarray((hair_sh * 255).astype(np.uint8), "RGBA").save(os.path.join(OUT, "char-hair.webp"), lossless=True)
Image.fromarray((eye_sh * 255).astype(np.uint8), "RGBA").save(os.path.join(OUT, "char-eyes.webp"), lossless=True)

# ---- Mặt: vùng x 26..94, y 44..90 theo đơn vị của Chibi (viewBox 120x140), 3 px / đơn vị; mắt SVG ở (45.5, 61) và (74.5, 61)
X0, Y0, K = 26, 44, 3
PW, PH = (94 - X0) * K, (90 - Y0) * K
cool = (a > 0.5) & (sat > 0.25) & (hue > 190) & (hue < 300)  # áo choàng, micro... lọt vào vùng mặt
fill = (nd.binary_dilation(hair, iterations=3) | nd.binary_dilation(cool, iterations=2)) & ~nd.binary_dilation(eyes, iterations=4)
pv, pu = np.mgrid[0:PH, 0:PW]
u, v = X0 + (pu + 0.5) / K, Y0 + (pv + 0.5) / K
ell = np.clip((1 - np.sqrt(((u - 60) / 30) ** 2 + ((v - 64.5) / 16) ** 2)) / 0.16, 0, 1)  # elip viền mờ
faces = np.zeros((PH, PW * len(FACE_CELLS), 4))
face_eyes = np.zeros_like(faces)
skin_hex = []
for j, c in enumerate(FACE_CELLS):
    (lx, ly), (rx, ry) = sorted(eye_at[c])
    k = np.hypot(rx - lx, ry - ly) / 29.0
    sx, sy = (lx + rx) / 2 + (u - 60) * k, (ly + ry) / 2 + (v - 61) * k
    # màu da: giữa hai mắt, dưới tầm mắt (tránh mũ/áo cùng tông như mũ hồng của cô bé mũ mèo)
    box = (u > 57) & (u < 63) & (v > 62) & (v < 66)
    skin = np.median(rgb[sy[box].round().astype(int), sx[box].round().astype(int)], 0)
    filled = im.copy()
    filled[fill, :3] = skin
    filled[fill, 3] = 1
    for ch in range(4):
        faces[:, j * PW:(j + 1) * PW, ch] = nd.map_coordinates(filled[..., ch], [sy, sx], order=1)
        face_eyes[:, j * PW:(j + 1) * PW, ch] = nd.map_coordinates(eye_sh[..., ch], [sy, sx], order=1)
    # Dọn vết dư: dải trán (mép mũ/tóc) và nét tối ngoài mắt, miệng (tai nghe, ngọn tóc); mặt Học giả giữ kính
    patch = faces[:, j * PW:(j + 1) * PW]
    glasses = c == 4
    erx, ery = (13, 13) if glasses else (9.5, 11)
    keep = (((u - 45.5) / erx) ** 2 + ((v - 61) / ery) ** 2 < 1) | (((u - 74.5) / erx) ** 2 + ((v - 61) / ery) ** 2 < 1)
    keep |= (u > 50) & (u < 70) & (v > 66) & (v < 77)
    if glasses:
        keep |= (u > 52) & (u < 68) & (v > 55) & (v < 66)  # cầu kính
    dark = patch[..., :3].mean(-1) < 0.62  # nét xám của tai nghe; má hồng sáng hơn (~0.78) nên giữ
    clean = ~keep & ((v < 53) | (dark & (not glasses)))
    patch[clean, :3] = skin
    faces[:, j * PW:(j + 1) * PW, 3] *= ell
    face_eyes[:, j * PW:(j + 1) * PW, 3] *= ell
    skin_hex.append("#%02x%02x%02x" % tuple(int(round(x * 255)) for x in skin))
Image.fromarray((np.clip(faces, 0, 1) * 255).astype(np.uint8), "RGBA").save(os.path.join(OUT, "faces.webp"), lossless=True)
Image.fromarray((np.clip(face_eyes, 0, 1) * 255).astype(np.uint8), "RGBA").save(os.path.join(OUT, "faces-eyes.webp"), lossless=True)
print(json.dumps({"patch": [PW, PH], "skin": skin_hex}))
