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
_skin = (a > 0.5) & (mx > 0.8) & (sat > 0.05) & (sat < 0.4) & ((hue < 40) | (hue > 340))
# Tóc kimono màu tím xám (lọc nâu chỉ bắt phần tối): mọi điểm trên đầu không phải da / mắt / hoa / trắng / cổ áo
_c7 = cell_of == 7
_dx7 = np.abs(xx % CELL - 155)
_white = (mx > 0.88) & (sat < 0.12)
hair |= _c7 & (a > 0.5) & (yy < 200) & ~nd.binary_fill_holes(_skin & _c7) & ~_skin & ~nd.binary_dilation(eyes, iterations=6) \
    & ~((xx % CELL > 205) & (yy < 100)) & ~_white & ((yy < 146) | ((_dx7 > 42) & (mx < 0.6) & (yy < 185))) & (_dx7 < 95)


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

# ---- Mặt trơn (xoá mắt + miệng, lấp da bằng nội suy điều hoà) → phối bộ phận mặt (mắt/miệng/trang điểm) trong Chibi
blank = faces.copy()
for j, c in enumerate(FACE_CELLS):
    P = blank[:, j * PW:(j + 1) * PW]
    gl = c == 4
    rx, ry = (14.5, 13.5) if gl else (12.0, 12.5)
    E = (((u - 45.5) / rx) ** 2 + ((v - 61) / ry) ** 2 < 1) | (((u - 74.5) / rx) ** 2 + ((v - 61) / ry) ** 2 < 1)
    E |= (u > 51.5) & (u < 68.5) & (v > 66) & (v < 78)
    if gl:
        E |= ((u > 52) & (u < 68) & (v > 54) & (v < 66)) | (((u < 34) | (u > 86)) & (v > 53) & (v < 68))  # cầu + gọng kính
    E &= (pu > 0) & (pu < PW - 1) & (pv > 0) & (pv < PH - 1)
    col = P[..., :3].copy()
    col[E] = col[~E & (P[..., 3] > 0.9)].mean(0)
    for _ in range(600):
        avg = (np.roll(col, 1, 0) + np.roll(col, -1, 0) + np.roll(col, 1, 1) + np.roll(col, -1, 1)) / 4
        col[E] = avg[E]
    P[..., :3] = col
Image.fromarray((np.clip(blank, 0, 1) * 255).astype(np.uint8), "RGBA").save(os.path.join(OUT, "faces-blank.webp"), lossless=True)

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

# ---- Đầu biến thể ô 8: tóc bob không hoa / búi (từ cô gái kimono): soi gương nửa trái (tóc bob sạch) sang nửa phải,
#      giữ da mặt + mắt gốc ở nửa phải để mắt không bị lật
ly8, lx8 = np.mgrid[0:H, 0:CELL]
AX = int(round(anchor[7][0]))  # trục đối xứng = giữa hai mắt
def mirror(arr):
    out = arr.copy()
    src = 2 * AX - lx8
    ok = (lx8 > AX) & (src >= 0)
    out[ok] = arr[ly8[ok], src[ok]]
    out[(lx8 > AX) & (src < 0)] = 0
    return out
h7 = heads[:, 7 * CELL:8 * CELL]
hm7 = hair[:, 7 * CELL:8 * CELL]
skin7 = (nd.binary_fill_holes(skin_all[:, 7 * CELL:8 * CELL]) | nd.binary_dilation(eyes[:, 7 * CELL:8 * CELL], iterations=9)) & (np.abs(lx8 - AX) < 60) & (ly8 > anchor[7][2] - 30)  # không lấy cánh hoa
hm_m = mirror(hm7)
take = (lx8 > AX + 4) & ~(skin7 & ~hm_m & (ly8 < anchor[7][1]))  # nửa phải: lấy ảnh soi gương trừ da mặt gốc
h8 = h7.copy(); h8[take] = mirror(h7)[take]
hm8 = hm7.copy(); hm8[take] = hm_m[take]
heads = np.concatenate([heads, h8], 1)
c8 = hair_sh[:, 7 * CELL:8 * CELL].copy(); c8[take] = mirror(hair_sh[:, 7 * CELL:8 * CELL])[take]
hair_ext = np.concatenate([hair_sh, c8], 1)
e8 = eye_sh[:, 7 * CELL:8 * CELL].copy(); e8[take & ~skin7] = 0
eye_ext = np.concatenate([eye_sh, e8], 1)
flower = take  # vùng đổi ở ô 8 (dùng cho mặt nạ mặt bên dưới)
Image.fromarray((hair_ext * 255).astype(np.uint8), "RGBA").save(os.path.join(OUT, "char-hair.webp"), lossless=True)
Image.fromarray((eye_ext * 255).astype(np.uint8), "RGBA").save(os.path.join(OUT, "char-eyes.webp"), lossless=True)

# ---- Vùng mặt từng đầu (da + mắt, trừ tóc) → dán khuôn mặt đã chọn lên tranh mà không đè tóc/mũ/tai nghe
lab_s, _ = nd.label(skin_all)
SWAP_CELLS = [0, 1, 2, 3, 4, 6, 7]
facemask = np.zeros((H, W + CELL))
eye_geo = {}
for c in SWAP_CELLS:
    (lx_, ly_), (rx_, ry_) = sorted(eye_at[c])
    mxp, myp = (lx_ + rx_) / 2, (ly_ + ry_) / 2
    box = lab_s[int(myp + 12):int(myp + 35), int(mxp - 20):int(mxp + 20)]
    l = np.bincount(box[box > 0]).argmax()
    m = nd.binary_fill_holes(lab_s == l) & (yy < myp + 62)
    m |= nd.binary_dilation(eyes & (cell_of == c), iterations=9)
    m &= ~nd.binary_dilation(hair, iterations=1) & (cell_of == c)
    facemask[:, :W] = np.maximum(facemask[:, :W], nd.gaussian_filter(m.astype(float), 0.8) * m.astype(float) + m * 0)
    eye_geo[c] = (round(mxp - c * CELL, 1), round(myp, 1), round(float(np.hypot(rx_ - lx_, ry_ - ly_)), 1))
facemask[:, 8 * CELL:] = facemask[:, 7 * CELL:8 * CELL] * ~(flower & hm8)
eye_geo[8] = eye_geo[7]
anchor[8] = anchor[7]
HEAD_CELLS = HEAD_CELLS + [8]

# Đỉnh tóc kimono chạm mép trên ô (bị phẳng) → hạ ô 8 xuống SHIFT px rồi vẽ nối đỉnh tròn theo cung đầu
SHIFT = 8
def shift8(arr):
    c8_ = arr[:, 8 * CELL:].copy()
    arr[:, 8 * CELL:] = 0
    arr[SHIFT:, 8 * CELL:] = c8_[:-SHIFT]
for arr in (heads, hair_ext, eye_ext):
    shift8(arr)
fm8 = facemask[:, 8 * CELL:].copy(); facemask[:, 8 * CELL:] = 0; facemask[SHIFT:, 8 * CELL:] = fm8[:-SHIFT]
top = heads[SHIFT, 8 * CELL:]
xs = np.where(top[:, 3] > 0.5)[0]
if len(xs):
    x0, x1 = xs.min(), xs.max()
    w0, cxm, R = (x1 - x0) / 2, (x0 + x1) / 2, 95.0
    dd = np.sqrt(max(R * R - w0 * w0, 0))
    for hgt in range(1, SHIFT + 1):
        y = SHIFT - hgt
        w = np.sqrt(max(R * R - (dd + hgt) ** 2, 0))
        for x in range(int(np.ceil(cxm - w)), int(cxm + w) + 1):
            edge = x < cxm - w + 2 or x > cxm + w - 2
            src = heads[SHIFT + 2, 8 * CELL + x].copy()  # màu tóc ngay dưới (bỏ qua viền)
            heads[y, 8 * CELL + x] = (0.14, 0.11, 0.1, 1) if edge else src
            hair_ext[y, 8 * CELL + x] = (0.3, 0.3, 0.3, 1) if edge else hair_ext[SHIFT + 2, 8 * CELL + x]
        # viền đỉnh
        heads[y, 8 * CELL + int(np.ceil(cxm - w)):8 * CELL + int(cxm + w) + 1][:1] = (0.14, 0.11, 0.1, 1)
    xs_top = np.where(heads[0, 8 * CELL:, 3] > 0.5)[0]
    heads[0, 8 * CELL + xs_top] = (0.14, 0.11, 0.1, 1)
    hair_ext[0, 8 * CELL + xs_top] = (0.3, 0.3, 0.3, 1)
    # bỏ viền phẳng cũ ở hàng SHIFT (giờ nằm giữa tóc)
    for r in range(SHIFT, SHIFT + 2):
        row = heads[r, 8 * CELL:]
        dark = (row[:, :3].mean(1) < 0.25) & (row[:, 3] > 0.5)
        idx = np.where(dark)[0]
        idx = idx[(idx > x0 + 3) & (idx < x1 - 3)]
        heads[r, 8 * CELL + idx] = heads[SHIFT + 3, 8 * CELL + idx]
        hair_ext[r, 8 * CELL + idx] = hair_ext[SHIFT + 3, 8 * CELL + idx]
anchor[8] = (anchor[7][0], anchor[7][1] + SHIFT, anchor[7][2] + SHIFT)
eye_geo[8] = (eye_geo[7][0], round(eye_geo[7][1] + SHIFT, 1), eye_geo[7][2])
# nét cổ áo kimono lọt dưới cằm (thành vạch lạ trên áo khác)
for arr in (heads, hair_ext):
    arr[anchor[8][1] + 18:, 8 * CELL:9 * CELL] = 0
# hàng trên cùng của đầu tóc bob sáng hơn tóc bên dưới (mép cắt của tranh) → lộ vạch sáng trên đỉnh khi tô màu tóc
for x in range(8 * CELL, 9 * CELL):
    ys = np.where(heads[:40, x, 3] > 0.5)[0]
    if len(ys) and heads[ys[0], x, :3].mean() > heads[ys[0] + 1, x, :3].mean() + 0.04:
        heads[ys[0], x], hair_ext[ys[0], x] = heads[ys[0] + 1, x], hair_ext[ys[0] + 1, x]

# ======================= Kiểu tóc vẽ thêm (ô 9–14): đầu tóc bob / tóc ngắn + tóc vẽ theo nét tranh =======================
# Lớp trước (bím, lọn dài) nằm dưới đầu trong char-heads; lớp sau (đuôi ngựa, tóc dài, búi, tóc dựng, mohawk) trong
# char-hairback.webp (ô 332×(272+TOP), có TOP px trống trên đầu), Chibi vẽ trước thân.
import sys
from types import SimpleNamespace
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hair_paint import Layer, bez, chain, lock, palette, under  # noqa: E402

TOP = 40
TIE = "#f472b6"
cellv = lambda arr, c: arr[:, c * CELL:(c + 1) * CELL]
_lw = np.array([0.299, 0.587, 0.114])
PAL = {c: palette(cellv(heads, c)[..., :3], cellv(hair_ext, c)[..., 3] > 0.9, cellv(heads, c)[..., :3] @ _lw) for c in (0, 8)}
mir = lambda pts, cx: np.stack([2 * cx - np.asarray(pts)[:, 0], np.asarray(pts)[:, 1]], 1)


def ellipse(cx, cy, rx, ry, rot=0.0, n=40):
    t = np.linspace(0, 2 * np.pi, n, endpoint=False)
    x, y = rx * np.cos(t), ry * np.sin(t)
    c, s = np.cos(rot), np.sin(rot)
    return np.stack([cx + x * c - y * s, cy + x * s + y * c], 1)


def ponytail(front, back, p, over=None):
    outer = chain(bez((212, 18), (266, 12), (300, 70), (288, 140)), bez((288, 140), (280, 188), (266, 208), (252, 230)))
    inner = chain(bez((212, 64), (242, 76), (258, 112), (257, 150)), bez((257, 150), (256, 186), (254, 206), (252, 230)))
    _paint(back, _lk(inner, outer), p, root=(214, 42), root_r=55)
    o2 = chain(bez((250, 96), (276, 124), (280, 176), (266, 218)))
    i2 = chain(bez((244, 110), (258, 140), (262, 182), (266, 218)))
    _paint(back, _lk(i2, o2), p, edge=0.35)
    back.paint(ellipse(225, 40, 9, 13, 0.35), p, color=TIE, hair=False)


def _lk(left, right):
    poly, strands, lights = lock(left, right)
    return poly, None, strands, lights


def _paint(layer, item, p, **kw):
    poly, _, strands, lights = item
    layer.paint(poly, p, strands=strands, lights=lights, **kw)


def braid(layer, p, top, bot, n=6):
    (x0, y0), (x1, y1) = top, bot
    step = (y1 - y0) / n
    for i in range(n):
        f = (i + 0.5) / n
        cx, cy = x0 + (x1 - x0) * f, y0 + (y1 - y0) * f
        w, h, s = 27 - i * 1.3, step * 1.45, (1 if i % 2 else -1)
        left = bez((cx + 4 * s, cy - h / 2), (cx - w / 2 - 3, cy - h * 0.25), (cx - w / 2, cy + h * 0.25), (cx - 3 * s, cy + h / 2), n=16)
        right = bez((cx + 4 * s, cy - h / 2), (cx + w / 2 + 3, cy - h * 0.25), (cx + w / 2, cy + h * 0.25), (cx - 3 * s, cy + h / 2), n=16)
        layer.paint(chain(left, right[::-1]), p, strands=[bez((cx - w * 0.3 * s, cy - h * 0.3), (cx, cy), (cx + w * 0.2 * s, cy + h * 0.4), n=10)],
                    lights=[bez((cx - w * 0.15, cy - h * 0.32), (cx + w * 0.05, cy - h * 0.18), n=6)], edge=0.55)
    tuft = chain(bez((x1 - 6, y1), (x1 - 12, y1 + 8), (x1 - 15, y1 + 20), n=10), [(x1 - 8, y1 + 15), (x1 - 2, y1 + 24), (x1 + 4, y1 + 15), (x1 + 11, y1 + 22)],
                 bez((x1 + 11, y1 + 22), (x1 + 11, y1 + 8), (x1 + 6, y1), n=10))
    layer.paint(tuft, p, strands=[bez((x1 - 2, y1 + 2), (x1 - 4, y1 + 12), (x1 - 6, y1 + 18), n=8), bez((x1 + 3, y1 + 2), (x1 + 4, y1 + 10), (x1 + 6, y1 + 17), n=8)])
    band = chain(bez((x1 - 9, y1 - 3), (x1, y1 - 5), (x1 + 9, y1 - 3), n=8), bez((x1 + 9, y1 + 4), (x1, y1 + 6), (x1 - 9, y1 + 4), n=8))
    layer.paint(band, p, color=TIE, hair=False, outline=1.6)


def twin(front, back, p, over=None):
    braid(front, p, (97, 128), (92, 222))
    braid(front, p, (213, 128), (218, 222))


def long_hair(front, back, p, over=None):
    left = chain(bez((112, 8), (70, 28), (60, 90), (63, 150)), bez((63, 150), (66, 196), (60, 226), (58, 250)))
    zig = [(70, 240), (82, 254), (96, 242), (110, 252), (126, 240), (155, 246), (184, 240), (200, 252), (214, 242), (228, 254), (240, 240)]
    right = mir(left, 155)[::-1]
    poly = chain(left, zig, right, bez((198, 8), (155, -12), (112, 8), n=12))
    strands = [bez((78, 60), (70, 150), (72, 240)), bez((92, 74), (84, 160), (88, 246)), bez((232, 60), (240, 150), (238, 240)), bez((218, 74), (226, 160), (222, 246))]
    lights = [bez((80, 70), (74, 100), (74, 126)), bez((230, 70), (236, 100), (236, 126))]
    back.paint(poly, p, strands=strands, lights=lights, dark=0.18)
    l_out = bez((80, 112), (74, 150), (78, 192), (92, 234))
    l_in = bez((104, 112), (112, 150), (108, 196), (92, 234))
    _paint(front, _lk(l_out, l_in), p, edge=0.45)
    _paint(front, _lk(mir(l_in, 155), mir(l_out, 155)), p, edge=0.45)


def bun(front, back, p, over=None):
    poly = chain(bez((131, 16), (116, -2), (126, -26), (155, -37)), bez((155, -37), (184, -26), (194, -2), (179, 16)), bez((179, 16), (155, 24), (131, 16), n=12))
    strands = [bez((140, 12), (132, -10), (150, -31)), bez((170, 12), (180, -10), (160, -31)), bez((155, 14), (151, -10), (156, -33))]
    back.paint(poly, p, strands=strands, lights=[bez((134, -6), (138, -20), (150, -28))], edge=0.6)
    band = chain(bez((128, 2), (155, 8), (182, 2), n=12), bez((184, 11), (155, 17), (126, 11), n=12))
    back.paint(band, p, color=TIE, hair=False)


def _dir(a):
    return np.array([np.cos(np.radians(a)), np.sin(np.radians(a))])


def spiky(front, back, p, over=None):
    """Tóc dựng: các mảng nhọn to quanh đỉnh và hai bên đầu (gốc khuất sau tóc, ngọn nhô ra ~40px)"""
    c = np.array([162.0, 100.0])
    spikes = [(-178, 128), (-150, 138), (-120, 140), (-92, 137), (-62, 140), (-32, 138), (-4, 128)]
    for a, rt in sorted(spikes, key=lambda s: -abs(s[0] + 90)):
        sw = 8 if a < -95 else -8 if a > -85 else 3  # ngọn hơi vuốt ra ngoài
        d = _dir(a + sw)
        if c[1] + rt * d[1] < -37:
            rt = (c[1] + 37) / -d[1]
        tip = c + rt * d
        bl, br = c + 66 * _dir(a - 21), c + 66 * _dir(a + 21)
        m = (66 + rt) / 2
        left = bez(bl, c + m * _dir(a - 13 + sw / 2), tip, n=22)
        right = bez(br, c + m * _dir(a + 13 + sw / 2), tip, n=22)
        _paint(back, _lk(left, right), p, root=tuple(c), root_r=105, edge=0.45)


def mohawk(front, back, p, over=None):
    """Mào liền giữa đầu (răng cưa nhỏ trên đỉnh) + lọn mào đổ ra trước đỉnh đầu"""
    left = bez((134, 50), (124, 10), (134, -20), (149, -36))
    right = bez((178, -37), (192, -20), (200, 10), (190, 50))
    poly = chain(left, [(156, -27), (163, -39), (170, -28)], right)
    strands = [bez((146, 40), (140, 0), (150, -28)), bez((162, 40), (161, 0), (163, -34)), bez((178, 40), (184, 0), (175, -30))]
    back.paint(poly, p, strands=strands, lights=[bez((154, 16), (153, -4), (157, -24))], root=(162, 60), root_r=60, edge=0.4)
    l_ = bez((142, -16), (136, 8), (148, 30), (166, 50))
    r_ = bez((184, -16), (190, 8), (180, 30), (166, 50))
    _paint(over, _lk(l_, r_), p, edge=0.35)


def dome(back, p, cx=155):
    """Đỉnh đầu tròn sau tóc bob (tranh gốc chạm mép trên → đỉnh phẳng)"""
    back.paint(ellipse(cx, 62, 64, 66, n=72), p, strands=[bez((cx - 30, 4), (cx - 10, -2), (cx + 10, -2), (cx + 30, 4))], edge=0.4)


NEW_HAIR = [("hair-ponytail", 8, ponytail), ("hair-twin", 8, twin), ("hair-long", 8, long_hair), ("hair-bun", 8, bun), ("hair-spiky", 0, spiky), ("hair-mohawk", 0, mohawk)]
first = heads.shape[1] // CELL  # 9
ncell = first + len(NEW_HAIR)
back_img = np.zeros((H + TOP, ncell * CELL, 4))
back_sh = np.zeros_like(back_img)
add_h, add_s, add_e, add_f = [], [], [], []
new_cells = {}
for j, (hid, base, fn) in enumerate(NEW_HAIR):
    c = first + j
    front, back, over = Layer(H, CELL, 0), Layer(H + TOP, CELL, -TOP), Layer(H, CELL, 0)
    if base == 8:
        dome(back, PAL[8])
    fn(front, back, PAL[base], over)
    hd, hs = under(cellv(heads, base), cellv(hair_ext, base), front)
    if over.img[..., 3].any():  # lớp đè lên đầu (lọn mào mohawk)
        hd, hs = under(over.img, over.shade, SimpleNamespace(img=hd, shade=hs))
    add_h.append(hd); add_s.append(hs); add_e.append(cellv(eye_ext, base)); add_f.append(cellv(facemask, base))
    back_img[:, c * CELL:(c + 1) * CELL] = back.img
    back_sh[:, c * CELL:(c + 1) * CELL] = back.shade
    anchor[c], eye_geo[c] = anchor[base], eye_geo[base]
    new_cells[c] = (hid, base)
b8 = Layer(H + TOP, CELL, -TOP)
dome(b8, PAL[8])
back_img[:, 8 * CELL:9 * CELL], back_sh[:, 8 * CELL:9 * CELL] = b8.img, b8.shade
new_back = [8]
heads = np.concatenate([heads, *add_h], 1)
for c in [8, *new_cells]:  # mép đầu còn ánh nền trắng của tranh → lộ chấm trắng trên tóc sau lưng
    hc = cellv(heads, c)
    fr = (hc[..., 3] > 0.02) & (hc[..., 3] < 0.95) & ((hc[..., :3] @ _lw) > 0.5)
    hc[fr, :3] = PAL[8 if c < 13 else 0]["line"]
hair_ext = np.concatenate([hair_ext, *add_s], 1)
eye_ext = np.concatenate([eye_ext, *add_e], 1)
facemask = np.concatenate([facemask, *add_f], 1)
HEAD_CELLS = HEAD_CELLS + list(new_cells)
Image.fromarray((np.clip(back_img, 0, 1) * 255).astype(np.uint8), "RGBA").save(os.path.join(OUT, "char-hairback.webp"), lossless=True)
Image.fromarray((np.clip(back_sh, 0, 1) * 255).astype(np.uint8), "RGBA").save(os.path.join(OUT, "char-hairback-shade.webp"), lossless=True)
Image.fromarray((np.clip(hair_ext, 0, 1) * 255).astype(np.uint8), "RGBA").save(os.path.join(OUT, "char-hair.webp"), lossless=True)
Image.fromarray((np.clip(eye_ext, 0, 1) * 255).astype(np.uint8), "RGBA").save(os.path.join(OUT, "char-eyes.webp"), lossless=True)
fm = np.zeros((H, facemask.shape[1], 4)); fm[..., :3] = 1; fm[..., 3] = np.clip(facemask, 0, 1)
Image.fromarray((fm * 255).astype(np.uint8), "RGBA").save(os.path.join(OUT, "char-facemask.webp"), lossless=True)
Image.fromarray((np.clip(heads, 0, 1) * 255).astype(np.uint8), "RGBA").save(os.path.join(OUT, "char-heads.webp"), lossless=True)
strip = np.concatenate(bodies, 1)
Image.fromarray((np.clip(strip, 0, 1) * 255).astype(np.uint8), "RGBA").save(os.path.join(OUT, "char-bodies.webp"), lossless=True)
ts = [
    "/** Sinh bởi scripts/studio/gen-face-assets.py — không sửa tay. Mốc ghép đầu/thân của tranh nhân vật (đơn vị px của ô 332×272). */",
    f"export const BODY_H = {H + EXT};",
    "/** Ô trong characters.webp có đầu rời (char-heads.webp) → [tâm x, đường cằm y] */",
    "export const HEAD_ANCHOR: Record<number, [number, number]> = { " + ", ".join(f"{c}: [{anchor[c][0]}, {anchor[c][1]}]" for c in HEAD_CELLS) + " };",
    "/** Số ô của char-heads / char-hair / char-eyes / char-facemask / char-hairback (8 ô tranh + ô 8 = tóc bob không hoa + kiểu tóc vẽ thêm) */",
    f"export const HEAD_CELLS_N = {ncell};",
    "/** Đầu vẽ thêm kiểu tóc: ô → [kiểu tóc, mẫu gốc (màu tóc/mắt/mặt gốc)] */",
    "export const HAIR_HEADS: Record<number, [string, number]> = { " + ", ".join(f'{c}: ["{h}", {7 if b == 8 else b}]' for c, (h, b) in new_cells.items()) + " };",
    "/** Ô có tóc sau lưng trong char-hairback.webp (ô cao 272 + HAIR_BACK_TOP, vẽ trước thân) */",
    f"export const HAIR_BACK_TOP = {TOP};",
    "export const HAIR_BACK: number[] = [" + ", ".join(str(c) for c in [*new_back, *new_cells] if back_img[:, c * CELL:(c + 1) * CELL, 3].any()) + "];",
    "/** Mắt của từng ô (dán khuôn mặt đã chọn): [giữa hai mắt x, y, khoảng cách hai mắt] */",
    "export const EYE_GEO: Record<number, [number, number, number]> = { " + ", ".join(f"{c}: [{g[0]}, {g[1]}, {g[2]}]" for c, g in sorted(eye_geo.items())) + " };",
    "/** Thân theo trang phục: thứ tự ô trong char-bodies.webp, [tâm x, đường cằm y] của tranh gốc */",
    "export const BODIES: { outfit: string; anchor: [number, number] }[] = [",
    *[f'  {{ outfit: "{o}", anchor: [{an[0]}, {an[1]}] }},' for o, an in zip(body_ids, body_anchor)],
    "];",
    "",
]
open(os.path.join(ROOT, "lib", "game", "painted-data.ts"), "w").write("\n".join(ts))
print(json.dumps({"anchors": {c: anchor[c][:2] for c in anchor}, "bodies": body_ids}))
