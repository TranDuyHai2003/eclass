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

# ======================= Đầu + thân rời: thay trang phục vẫn giữ đầu (mặt, tóc) của nhân vật =======================
# char-heads.webp : đầu của các mẫu lộ tóc (cùng toạ độ với characters.webp, cắt ở đường cằm)
# char-bodies.webp: thân theo trang phục, mỗi ô 332x(272+EXT); 5 thân có sẵn + 6 trang phục tạo thêm bằng cách tô lại thân có sẵn
# lib/game/painted-data.ts: mốc ghép (tâm, đường cằm) → Chibi dịch thân cho cổ khớp cằm
HEAD_CELLS = [0, 1, 4, 6, 7]
EXT = 40  # kéo dài chân xuống dưới (lặp hàng cuối) để thân dịch lên không hở đáy
L = lum
anchor = {}
for c, pts in eye_at.items():
    (lx, ly), (rx, ry) = sorted(pts)
    cx, ey = int(round((lx + rx) / 2)), (ly + ry) / 2
    chins = []
    for dx in (-8, 8):  # dò nét viền cằm ngay dưới miệng
        y = int(ey + 32)
        while y < H - 1 and not (L[y, cx + dx] < 0.5 and a[y, cx + dx] > 0.5):
            y += 1
        chins.append(y)
    anchor[c] = (cx % CELL, max(chins), ey)
skin_all = (a > 0.5) & (mx > 0.8) & (sat > 0.05) & (sat < 0.4) & ((hue < 40) | (hue > 340))

heads = np.zeros((H, W, 4))
body_cells = {}
for c in HEAD_CELLS:
    cx, chin, ey = anchor[c]
    lx = xx - c * CELL
    sl = cell_of == c
    m = sl & (yy <= chin) & ((np.abs(lx - cx) <= 92) | (yy < ey + 10))
    # sát cằm chỉ giữ phần trong đường hàm: cổ áo / vai của tranh gốc nằm cao hơn đường cằm ở hai bên
    m &= ~((yy > chin - 18) & (np.abs(lx - cx) > 26 + (chin - yy) * 1.8))
    m |= sl & hair & (yy < chin + 60) & (np.abs(lx - cx) < 85)
    if c == 1:  # quả cầu tím của gậy phép thuộc thân, không thuộc đầu
        m &= ~((np.abs(lx - cx) > 58) & (yy > ey + 8))
    heads[m] = im[m]

def hsv(cell):
    rgb_, a_ = cell[..., :3], cell[..., 3]
    mx_, mn_ = rgb_.max(-1), rgb_.min(-1)
    s_ = np.where(mx_ > 0, (mx_ - mn_) / np.maximum(mx_, 1e-6), 0)
    d_ = mx_ - mn_ + 1e-6
    r_, g_, b_ = rgb_[..., 0], rgb_[..., 1], rgb_[..., 2]
    h_ = np.where(mx_ == r_, ((g_ - b_) / d_) % 6, np.where(mx_ == g_, (b_ - r_) / d_ + 2, (r_ - g_) / d_ + 4)) * 60
    return h_, s_, mx_, 0.299 * r_ + 0.587 * g_ + 0.114 * b_, a_

def body_of(c):
    """Thân của tranh ô c: dưới đường cằm (+ đồ cầm hai bên như gậy phép), bỏ tóc, lấp lỗ tóc bằng điểm thân gần nhất"""
    cx, chin, ey = anchor[c]
    cell = im[:, c * CELL:(c + 1) * CELL].copy()
    ly, lx = np.mgrid[0:H, 0:CELL]
    hr = nd.binary_dilation(hair[:, c * CELL:(c + 1) * CELL], iterations=2)  # cả nét viền tóc
    side = (np.abs(lx - cx) > 72) & (ly > chin - 40) if c == 1 else False  # gậy phép của phù thuỷ
    keep = ((ly > chin - 1) | side) & ~hr
    hole = hr & (ly > chin - 1) & (cell[..., 3] > 0.5)
    src = keep & (cell[..., 3] > 0.5)
    _, (iy, ix) = nd.distance_transform_edt(~src, return_indices=True)
    out = np.zeros_like(cell)
    out[keep] = cell[keep]
    out[hole] = cell[iy[hole], ix[hole]]
    out[hole, 3] = 1
    if c == 7:  # nét đuôi búi tóc lòi xuống cạnh cổ cô gái kimono
        _, _, _, l7, _ = hsv(out)
        out[(np.abs(lx - cx) > 30) & (ly < chin + 22) & (l7 < 0.55)] = 0
    lab_, n_ = nd.label(out[..., 3] > 0.1)  # bỏ mảnh vụn rời (đuôi búi tóc, nét lẻ)
    for i_, sz in enumerate(nd.sum(np.ones_like(lab_), lab_, range(1, n_ + 1)), 1):
        if sz < 80:
            out[lab_ == i_] = 0
    return np.concatenate([out, np.repeat(out[-1:], EXT, 0)], 0), (cx, chin)

def hexrgb(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)]) / 255

def tint(cell, mask, color, pct=80):
    """Tô vùng `mask` bằng `color`, giữ bóng + nét (nhân với độ sáng đã chuẩn hoá)"""
    if not mask.any():
        return
    _, _, _, l_, _ = hsv(cell)
    sh = np.clip(l_ / np.percentile(l_[mask], pct), 0, 1)
    cell[mask, :3] = hexrgb(color)[None, :] * sh[mask, None]

def is_skin(cell):
    h_, s_, v_, _, a_ = hsv(cell)
    return (a_ > 0.5) & (v_ > 0.8) & (s_ > 0.05) & (s_ < 0.4) & ((h_ < 40) | (h_ > 340))

BODY_SRC = {"outfit-uniform": 0, "outfit-wizard": 1, "outfit-scientist": 4, "outfit-gamer": 6, "outfit-kimono": 7}
bodies, body_anchor, body_ids = [], [], []
for oid, c in BODY_SRC.items():
    b, an = body_of(c)
    bodies.append(b); body_anchor.append(an); body_ids.append(oid)

def derived(oid, c, paint):
    b, an = body_of(c)
    paint(b, an)
    bodies.append(b); body_anchor.append(an); body_ids.append(oid)

def hoodie(top, pants=None, cords=None):
    """Từ áo game thủ: áo (trên hông) + quần + dây mũ"""
    def paint(b, an):
        cx, chin = an
        ly, lx = np.mgrid[0:b.shape[0], 0:CELL]
        h_, s_, v_, l_, a_ = hsv(b)
        cloth = (a_ > 0.3) & ~is_skin(b) & (ly > chin)
        cord = cloth & (l_ > 0.33) & (s_ < 0.3) & (np.abs(lx - cx) < 22) & (ly < chin + 50)
        bottom = cloth & (ly >= 233) & (np.abs(lx - cx) < 36)
        top_m = cloth & ~bottom & ~cord
        tint(b, top_m, top)
        if pants:
            tint(b, bottom, pants)
        tint(b, cord, cords or "#ffffff", 95)
    return paint

def dress(b, an):
    """Váy hoa: kimono tô hồng + chấm hoa trắng"""
    cx, chin = an
    ly, lx = np.mgrid[0:b.shape[0], 0:CELL]
    h_, s_, v_, l_, a_ = hsv(b)
    cloth = (a_ > 0.5) & ~is_skin(b) & (ly > chin + 4) & (l_ > 0.45)
    tint(b, cloth, "#f9a8d4", 75)
    inner = nd.binary_erosion(cloth, iterations=4)
    for y0 in range(chin + 24, b.shape[0] - 6, 18):
        for x0 in range(cx - 70 + (9 if (y0 // 18) % 2 else 0), cx + 72, 18):
            if 0 <= y0 < b.shape[0] and 0 <= x0 < CELL and inner[y0, x0]:
                for dy, dx in ((0, 0), (-2, 0), (2, 0), (0, -2), (0, 2)):
                    b[y0 + dy, x0 + dx, :3] = (1, 1, 1) if (dy or dx) else hexrgb("#fde047")

def sport(b, an):
    """Đồ thể thao: đồng phục → áo khoác xanh lá, áo trong trắng"""
    cx, chin = an
    ly, lx = np.mgrid[0:b.shape[0], 0:CELL]
    h_, s_, v_, l_, a_ = hsv(b)
    body = (a_ > 0.5) & ~is_skin(b) & (ly > chin + 2) & (ly < 240)
    jacket = body & (s_ < 0.18) & (l_ > 0.62)
    inner = body & (h_ > 185) & (h_ < 235) & (s_ > 0.25) & (np.abs(lx - cx) < 26)
    tint(b, jacket, "#22c55e", 92)
    tint(b, inner, "#f8fafc", 90)

def royal(b, an):
    """Hoàng bào: áo choàng phù thuỷ tô đỏ thẫm, giữ viền vàng + gậy"""
    cx, chin = an
    ly, lx = np.mgrid[0:b.shape[0], 0:CELL]
    h_, s_, v_, l_, a_ = hsv(b)
    robe = (a_ > 0.5) & (h_ > 225) & (h_ < 300) & (s_ > 0.2) & (np.abs(lx - cx) < 62) & (ly > chin - 2)
    tint(b, robe, "#dc2626", 85)

derived("outfit-tee", 6, hoodie("#60a5fa", "#1e3a8a"))
derived("outfit-hoodie", 6, hoodie("#fb923c", None, "#ffffff"))
derived("outfit-ninja", 6, hoodie("#3f3f46", "#27272a", "#dc2626"))
derived("outfit-dress", 7, dress)
derived("outfit-sport", 0, sport)
derived("outfit-royal", 1, royal)

Image.fromarray((np.clip(heads, 0, 1) * 255).astype(np.uint8), "RGBA").save(os.path.join(OUT, "char-heads.webp"), lossless=True)
strip = np.concatenate(bodies, 1)
Image.fromarray((np.clip(strip, 0, 1) * 255).astype(np.uint8), "RGBA").save(os.path.join(OUT, "char-bodies.webp"), lossless=True)
ts = [
    "/** Sinh bởi scripts/studio/gen-face-assets.py — không sửa tay. Mốc ghép đầu/thân của tranh nhân vật (đơn vị px của ô 332×272). */",
    f"export const BODY_H = {H + EXT};",
    "/** Ô trong characters.webp có đầu rời (char-heads.webp) → [tâm x, đường cằm y] */",
    "export const HEAD_ANCHOR: Record<number, [number, number]> = { " + ", ".join(f"{c}: [{anchor[c][0]}, {anchor[c][1]}]" for c in HEAD_CELLS) + " };",
    "/** Thân theo trang phục: thứ tự ô trong char-bodies.webp, [tâm x, đường cằm y] của tranh gốc */",
    "export const BODIES: { outfit: string; anchor: [number, number] }[] = [",
    *[f'  {{ outfit: "{o}", anchor: [{an[0]}, {an[1]}] }},' for o, an in zip(body_ids, body_anchor)],
    "];",
    "",
]
open(os.path.join(ROOT, "lib", "game", "painted-data.ts"), "w").write("\n".join(ts))
print(json.dumps({"anchors": {c: anchor[c][:2] for c in anchor}, "bodies": body_ids}))
