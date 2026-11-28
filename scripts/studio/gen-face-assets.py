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
    if not len(ys):
        continue
    ref = ys[0] + 5
    for yy_ in range(ys[0], ref):
        if heads[yy_, x, :3].mean() > heads[ref, x, :3].mean() + 0.03:
            heads[yy_, x], hair_ext[yy_, x] = heads[ref, x], hair_ext[ref, x]

# ======================= Kiểu tóc vẽ thêm (ô 9–14): đầu tóc bob / tóc ngắn + tóc vẽ theo nét tranh =======================
# Lớp trước (bím, lọn dài) nằm dưới đầu trong char-heads; lớp sau (đuôi ngựa, tóc dài, búi, tóc dựng, mohawk) trong
# char-hairback.webp (ô 332×(272+TOP), có TOP px trống trên đầu), Chibi vẽ trước thân.
import sys
from types import SimpleNamespace
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hair_paint import Layer, bez, chain, lock_edges, paint_lock, palette, under  # noqa: E402

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


def L(layer, p, root_l, root_r, tip, cl, cr, n=30, **kw):
    """Một lọn tóc vẽ kiểu anime (hair_paint.paint_lock)"""
    le, ri = lock_edges(root_l, root_r, tip, cl, cr, n=n)
    paint_lock(layer, le, ri, p, **kw)


def M(pt):
    """Lật điểm qua trục giữa đầu tóc bob (x = 155)"""
    return (310 - pt[0], pt[1])


def Lm(layer, p, root_l, root_r, tip, cl, cr, **kw):
    """Lọn đối xứng của L qua giữa đầu (đổi mép trái ↔ phải)"""
    L(layer, p, M(root_r), M(root_l), M(tip), [M(q) for q in cr], [M(q) for q in cl], **kw)


def tie(layer, p, cx, cy, rx, ry, rot=0.0):
    """Dây buộc tóc (chun vải): hai lớp elip + nếp"""
    layer.paint(ellipse(cx, cy, rx, ry, rot), p, color=TIE, hair=False, outline=1.6,
                strands=[bez((cx - rx * 0.5, cy - ry * 0.6), (cx, cy), (cx - rx * 0.3, cy + ry * 0.7), n=8)],
                lights=[bez((cx + rx * 0.1, cy - ry * 0.6), (cx + rx * 0.45, cy - ry * 0.1), n=6)])


def ponytail(front, back, p, over=None):
    """Đuôi ngựa buộc cao bên phải: 3 lọn xoắn nhẹ, ngọn cong vào trong"""
    L(back, p, (202, 22), (214, 72), (250, 238), [(282, -2), (318, 118)], [(238, 100), (262, 178)], ring=(0.12, 0.24), strands=10, root=0.5, seed=1)
    L(back, p, (220, 28), (226, 56), (282, 190), [(272, 24), (304, 120)], [(250, 70), (284, 140)], ring=(0.14, 0.27), strands=5, root=0.45, seed=2)
    L(back, p, (226, 66), (236, 80), (238, 214), [(262, 110), (258, 180)], [(250, 120), (244, 180)], ring=None, strands=3, dark=0.15, seed=3)
    tie(back, p, 224, 42, 9, 13, 0.35)


def braid(layer, p, top, bot, n=6, seed=0):
    """Bím tết: các múi lệch trái/phải xen kẽ (múi dưới vẽ sau), dây buộc + chùm đuôi"""
    (x0, y0), (x1, y1) = top, bot
    step = (y1 - y0) / n
    for i in range(n):
        fr = (i + 0.5) / n
        cx, cy = x0 + (x1 - x0) * fr, y0 + (y1 - y0) * fr
        w, h, sg = 27 - i * 1.4, step * 1.5, (1 if i % 2 else -1)
        tp, bt = (cx + 5 * sg, cy - h / 2), (cx - 4 * sg, cy + h / 2)
        L(layer, p, (tp[0] - 0.5, tp[1]), (tp[0] + 0.5, tp[1]), bt, [(cx - w / 2 - 4, cy - h * 0.3), (cx - w / 2, cy + h * 0.25)], [(cx + w / 2 + 4, cy - h * 0.3), (cx + w / 2, cy + h * 0.25)],
          n=18, ring=(0.2, 0.42), strands=3, lights=1, root=0.25, seed=seed + i, nf=12)
    for k_, (dx, tipx) in enumerate(((-4, -13), (0, -1), (4, 12))):
        L(layer, p, (x1 + dx - 4, y1 + 1), (x1 + dx + 4, y1 + 1), (x1 + tipx, y1 + 24 - abs(tipx) * 0.4), [(x1 + dx - 6, y1 + 8), (x1 + tipx - 2, y1 + 16)], [(x1 + dx + 5, y1 + 8), (x1 + tipx + 2, y1 + 16)],
          n=12, ring=None, strands=2, lights=0, root=0.3, seed=seed + 20 + k_, nf=8)
    band = chain(bez((x1 - 9, y1 - 4), (x1, y1 - 6), (x1 + 9, y1 - 4), n=8), bez((x1 + 9, y1 + 4), (x1, y1 + 6), (x1 - 9, y1 + 4), n=8))
    layer.paint(band, p, color=TIE, hair=False, outline=1.5)


def twin(front, back, p, over=None):
    braid(front, p, (97, 126), (92, 222), seed=10)
    braid(front, p, (213, 126), (218, 222), seed=30)


def long_hair(front, back, p, over=None):
    """Tóc dài thẳng: lớp sau tối (khối), 3 lọn mỗi bên có ngọn nhọn + 2 lọn trước vai"""
    panel = chain(bez((112, 10), (66, 30), (62, 120), (66, 230), n=20), [(155, 236)], bez((244, 230), (248, 120), (244, 30), (198, 10), n=20), bez((198, 10), (155, -12), (112, 10), n=12))
    back.paint(panel, p, dark=0.45, edge=0.3)
    for side in (L, Lm):
        side(back, p, (108, 12), (140, 6), (60, 250), [(60, 34), (52, 150)], [(98, 60), (80, 180)], ring=(0.1, 0.2), strands=8, root=0.4, seed=40 if side is L else 50)
        side(back, p, (90, 50), (120, 40), (84, 258), [(68, 110), (72, 200)], [(114, 110), (102, 210)], ring=(0.13, 0.24), strands=6, root=0.35, seed=41 if side is L else 51)
        side(back, p, (116, 46), (150, 40), (112, 246), [(104, 120), (104, 200)], [(146, 120), (130, 200)], ring=None, strands=5, dark=0.2, seed=42 if side is L else 52)
        side(front, p, (80, 110), (106, 112), (92, 238), [(72, 150), (78, 200)], [(114, 150), (108, 200)], ring=(0.2, 0.33), strands=6, root=0.45, seed=43 if side is L else 53)


def bun(front, back, p, over=None):
    """Búi củ tỏi trên đỉnh: củ tròn có ngọn xoắn, sợi quấn vòng, dây buộc ở chân búi"""
    L(back, p, (130, 18), (180, 18), (155, -38), [(108, 0), (128, -32)], [(202, 0), (182, -32)], n=34, ring=(0.42, 0.58), strands=0, lights=1, root=0.0, seed=60, nf=22)
    for k_, (a0, a1, r) in enumerate(((200, 330, 18), (190, 345, 10), (215, 320, 25))):
        tt = np.radians(np.linspace(a0, a1, 24))
        arc = np.stack([155 + r * 1.15 * np.cos(tt), 2 + r * 0.95 * np.sin(tt)], 1)
        sm = back.lines([arc], 1.1) * (back.img[..., 3] > 0.5)  # sợi quấn vòng (cả lớp độ sáng để tô màu tóc)
        back.img[..., :3] = back.img[..., :3] * (1 - 0.5 * sm[..., None]) + p["line"] * 0.5 * sm[..., None]
        back.shade[..., :3] *= 1 - 0.5 * sm[..., None]
    L(back, p, (149, -24), (161, -24), (158, -39), [(147, -30), (152, -37)], [(163, -30), (162, -36)], n=12, ring=None, strands=1, lights=0, root=0.2, seed=61, nf=6)
    band = chain(bez((128, 3), (155, 9), (182, 3), n=12), bez((184, 12), (155, 18), (126, 12), n=12))
    back.paint(band, p, color=TIE, hair=False)


def _dir(a):
    return np.array([np.cos(np.radians(a)), np.sin(np.radians(a))])


def spiky(front, back, p, over=None):
    """Tóc dựng: mảng nhọn to quanh đầu, mỗi mảng có vòng sáng + sợi tóc"""
    c = np.array([162.0, 100.0])
    # khối tóc nền sau các mảng nhọn: lấp khe giữa các mảng thành một mái tóc liền
    mass = np.stack([c[0] + 106 * np.cos(np.radians(np.linspace(-190, 10, 40))), c[1] + 104 * np.sin(np.radians(np.linspace(-190, 10, 40)))], 1)
    back.paint(chain(mass, [(c[0] + 60, c[1] + 30), (c[0] - 60, c[1] + 30)]), p, dark=0.35, edge=0.35, strands=[bez(tuple(c + 80 * _dir(a_)), tuple(c + 102 * _dir(a_ + 4))) for a_ in range(-170, 0, 22)])
    spikes = [(-178, 128), (-150, 138), (-120, 140), (-92, 137), (-62, 140), (-32, 138), (-4, 128)]
    for i, (a, rt) in enumerate(sorted(spikes, key=lambda s: -abs(s[0] + 90))):
        sw = 8 if a < -95 else -8 if a > -85 else 3
        d = _dir(a + sw)
        if c[1] + rt * d[1] < -37:
            rt = (c[1] + 37) / -d[1]
        tip = c + rt * d
        bl, br = c + 62 * _dir(a - 21), c + 62 * _dir(a + 21)
        m1, m2 = 62 + (rt - 62) * 0.35, 62 + (rt - 62) * 0.75
        L(back, p, tuple(bl), tuple(br), tuple(tip), [tuple(c + m1 * _dir(a - 17 + sw / 3)), tuple(c + m2 * _dir(a - 9 + sw / 2))], [tuple(c + m1 * _dir(a + 17 + sw / 3)), tuple(c + m2 * _dir(a + 9 + sw / 2))],
          n=24, ring=(0.42, 0.56), strands=4, lights=1, root=0.55, seed=70 + i, nf=14)


def mohawk(front, back, p, over=None):
    """Mohawk: mào hẹp giữa đầu gồm 5 ngọn ngả ra sau (giữa cao nhất), khác tóc dựng xoè quanh đầu"""
    tips = [(128, -14), (196, -14), (142, -28), (182, -28), (162, -38)]
    for i, (tx, ty) in enumerate(tips):
        x0 = tx - 20 + (6 if tx < 162 else -6 if tx > 162 else 0)
        L(back, p, (x0, 60), (x0 + 40, 60), (tx, ty), [(x0 - 6, 24), (tx - 10, ty + 22)], [(x0 + 46, 24), (tx + 10, ty + 22)],
          n=26, ring=(0.45, 0.6), strands=4, lights=1, root=0.6, seed=80 + i, nf=14)


def dome(back, p, cx=155):
    """Đỉnh đầu tròn sau tóc bob (tranh gốc chạm mép trên → đỉnh phẳng)"""
    back.paint(ellipse(cx, 62, 64, 66, n=72), p, strands=[bez((cx - 30, 4), (cx - 10, -2), (cx + 10, -2), (cx + 30, 4))], edge=0.4)


# ======================= Kiểu tóc thêm theo giới (23/11): nam (đầu tóc ngắn ô 0), nữ (đầu tóc bob ô 8) =======================
def Lx(layer, p, ax, root_l, root_r, tip, cl, cr, **kw):
    """Lọn đối xứng của L qua trục x = ax"""
    mm = lambda q: (2 * ax - q[0], q[1])
    L(layer, p, mm(root_r), mm(root_l), mm(tip), [mm(q) for q in cr], [mm(q) for q in cl], **kw)


def wave(edge, amp, waves, ph=0.0):
    """Lượn sóng mép lọn (tăng dần về ngọn) — tóc xoăn sóng"""
    e = np.asarray(edge, float).copy()
    t = np.linspace(0, 1, len(e))
    e[:, 0] += amp * np.sin(2 * np.pi * waves * t + ph) * np.clip(t * 1.6, 0, 1)
    return e


def Lw(layer, p, root_l, root_r, tip, cl, cr, amp=6, waves=2.2, ph=0.0, n=40, **kw):
    le, ri = lock_edges(root_l, root_r, tip, cl, cr, n=n)
    paint_lock(layer, wave(le, amp, waves, ph), wave(ri, amp, waves, ph), p, **kw)


def manbun(front, back, p, over=None):
    """Búi samurai: búi tròn nhỏ trên đỉnh + dây buộc tối"""
    L(back, p, (138, 14), (186, 14), (162, -36), [(124, -2), (132, -30)], [(200, -2), (192, -30)], n=30, ring=(0.4, 0.56), strands=3, lights=1, root=0.2, seed=90, nf=18)
    band = chain(bez((140, 6), (162, 11), (184, 6), n=12), bez((186, 14), (162, 20), (138, 14), n=12))
    back.paint(band, p, color="#3b2a22", hair=False, outline=1.4)


def longm(front, back, p, over=None):
    """Dài lãng tử: tóc sau chấm vai + lọn mai trước tai"""
    panel = chain(bez((100, 30), (66, 50), (64, 130), (70, 200), n=16), [(162, 206)], bez((254, 200), (260, 130), (258, 50), (224, 30), n=16))
    back.paint(panel, p, dark=0.45, edge=0.3)
    for side in (L, lambda *a, **k: Lx(*a[:2], 162, *a[2:], **k)):
        side(back, p, (96, 30), (128, 22), (66, 208), [(62, 60), (56, 150)], [(110, 80), (90, 170)], ring=(0.1, 0.2), strands=7, root=0.4, seed=91)
        side(back, p, (90, 70), (118, 64), (92, 214), [(74, 120), (78, 180)], [(118, 120), (108, 186)], ring=None, strands=5, dark=0.15, seed=92)
        side(front, p, (68, 110), (92, 108), (78, 196), [(62, 140), (66, 176)], [(98, 140), (92, 176)], ring=(0.18, 0.3), strands=5, root=0.45, seed=93)


def wolf(front, back, p, over=None):
    """Tóc wolf: tầng tóc nhọn xoè ở gáy + lọn mai lởm chởm"""
    for side in (L, lambda *a, **k: Lx(*a[:2], 162, *a[2:], **k)):
        for k_, (rx_, tipx, tipy) in enumerate(((84, 52, 196), (98, 70, 210), (112, 92, 204), (70, 44, 168))):
            side(back, p, (rx_, 96), (rx_ + 30, 104), (tipx, tipy), [(rx_ - 14, 130), (tipx - 4, tipy - 40)], [(rx_ + 26, 140), (tipx + 12, tipy - 34)], n=24, ring=(0.15, 0.28), strands=4, root=0.45, seed=94 + k_, nf=14)
        side(front, p, (66, 112), (88, 116), (70, 178), [(56, 140), (60, 162)], [(92, 146), (80, 166)], n=20, ring=None, strands=3, root=0.4, seed=99)


def curly(front, back, p, over=None):
    """Xoăn bồng: vòng lọn xoăn tròn quanh mái (khối tóc nền + từng búp xoăn có xoáy)"""
    c = np.array([162.0, 96.0])
    mass = np.stack([c[0] + 112 * np.cos(np.radians(np.linspace(-200, 20, 48))), c[1] + 104 * np.sin(np.radians(np.linspace(-200, 20, 48)))], 1)
    back.paint(chain(mass, [(c[0] + 70, c[1] + 40), (c[0] - 70, c[1] + 40)]), p, dark=0.4, edge=0.35)
    for i, a in enumerate(np.linspace(-196, 16, 13)):
        q = c + np.array([112 * np.cos(np.radians(a)), 102 * np.sin(np.radians(a))])
        q[1] = max(q[1], -18)
        r = 22 if -150 < a < -30 else 19
        back.paint(ellipse(q[0], q[1], r, r * 0.92, n=40), p, edge=0.55,
                   strands=[bez((q[0] - r * 0.5, q[1] + r * 0.1), (q[0], q[1] - r * 0.55), (q[0] + r * 0.45, q[1] + r * 0.05), (q[0], q[1] + r * 0.35))],
                   lights=[bez((q[0] - r * 0.45, q[1] - r * 0.2), (q[0] - r * 0.1, q[1] - r * 0.55), n=6)])


def twintail(front, back, p, over=None):
    """
    Hai đuôi cao (vẽ lại 28/11 — bản cũ đuôi mảnh, thẳng như râu, dây buộc bị đầu che):
    đuôi buộc ở hai bên đỉnh đầu, phồng to rồi thuôn xuống ngang ngực, 2 lọn chồng cho dày, dây buộc vẽ đè lên đầu.
    """
    for side in (L, Lm):
        sd = 0 if side is L else 10
        # lọn chính: mép ngoài phồng ra xa, ngọn cong vào dưới vai
        side(back, p, (70, 38), (96, 54), (58, 208), [(20, 34), (10, 150)], [(94, 112), (82, 170)], ring=(0.12, 0.24), strands=5, lights=2, root=0.4, seed=200 + sd)
        # lọn trong (đè lên lọn chính, hơi tối) → đuôi dày, có lớp
        side(back, p, (80, 44), (94, 54), (74, 196), [(46, 70), (42, 150)], [(96, 116), (88, 166)], ring=(0.16, 0.29), strands=3, lights=1, dark=0.12, root=0.35, seed=201 + sd)
        # ngọn tách lọn nhỏ
        side(back, p, (40, 150), (56, 156), (34, 214), [(30, 176), (30, 200)], [(54, 182), (42, 204)], ring=None, strands=2, lights=0, root=0.2, seed=202 + sd, nf=10)
    if over is not None:  # dây buộc nằm trên đầu → luôn nhìn thấy
        tie(over, p, 86, 46, 9, 12, -0.6)
        tie(over, p, 224, 46, 9, 12, 0.6)


def sidetail(front, back, p, over=None):
    """Đuôi lệch vai: tóc gom sang trái, buộc dưới tai, đuôi thả trước vai"""
    L(front, p, (80, 140), (106, 146), (84, 250), [(64, 180), (62, 222)], [(114, 188), (104, 226)], ring=(0.12, 0.25), strands=8, root=0.5, seed=120)
    L(front, p, (90, 150), (102, 152), (104, 238), [(92, 190), (100, 214)], [(110, 186), (110, 214)], ring=None, strands=3, dark=0.12, seed=121)
    tie(front, p, 93, 146, 12, 9, -0.2)


def odango(front, back, p, over=None):
    """Búi đôi: hai búi tròn trên đỉnh hai bên + dây buộc"""
    for (bx, sd) in ((108, 130), (202, 131)):
        L(back, p, (bx - 24, 22), (bx + 24, 22), (bx, -30), [(bx - 40, 4), (bx - 30, -26)], [(bx + 40, 4), (bx + 30, -26)], n=30, ring=(0.4, 0.56), strands=2, lights=1, root=0.15, seed=sd, nf=18)
        for k_, r in enumerate((10, 18)):
            tt = np.radians(np.linspace(200, 340, 20))
            arc = np.stack([bx + r * 1.1 * np.cos(tt), 2 + r * np.sin(tt)], 1)
            sm = back.lines([arc], 1.0) * (back.img[..., 3] > 0.5)
            back.img[..., :3] = back.img[..., :3] * (1 - 0.45 * sm[..., None]) + p["line"] * 0.45 * sm[..., None]
            back.shade[..., :3] *= 1 - 0.45 * sm[..., None]
        band = chain(bez((bx - 20, 14), (bx, 19), (bx + 20, 14), n=10), bez((bx + 21, 22), (bx, 27), (bx - 21, 22), n=10))
        back.paint(band, p, color=TIE, hair=False, outline=1.4)


def wavy(front, back, p, over=None):
    """Xoăn sóng dài: lọn tóc lượn sóng tới hông, lọn trước vai cũng sóng"""
    panel = chain(bez((112, 10), (64, 30), (58, 120), (62, 236), n=20), [(155, 242)], bez((248, 236), (252, 120), (246, 30), (198, 10), n=20), bez((198, 10), (155, -12), (112, 10), n=12))
    back.paint(panel, p, dark=0.45, edge=0.3)
    for side, ph in ((L, 0.0), (Lm, 1.2)):
        sw = (lambda *a, **k: Lw(*a, **k)) if side is L else (lambda lay, pp, rl, rr, tp, cl, cr, **k: Lw(lay, pp, M(rr), M(rl), M(tp), [M(q) for q in cr], [M(q) for q in cl], **k))
        sw(back, p, (106, 12), (138, 6), (54, 252), [(56, 36), (46, 150)], [(96, 64), (76, 180)], amp=7, ph=ph, ring=(0.1, 0.2), strands=8, root=0.4, seed=130)
        sw(back, p, (88, 52), (118, 42), (82, 258), [(66, 110), (68, 200)], [(114, 110), (102, 210)], amp=6, ph=ph + 1, ring=(0.13, 0.24), strands=6, root=0.35, seed=131)
        sw(front, p, (80, 110), (106, 112), (92, 236), [(70, 150), (74, 200)], [(116, 150), (108, 200)], amp=6, ph=ph + 2, ring=(0.2, 0.33), strands=6, root=0.45, seed=132)


# ---- Đầu trọc (xoá tóc, lấp da trán + đỉnh đầu) → vẽ chỏm tóc + mái mới; toạ độ theo đơn vị mặt (mắt 45.5/74.5, 61)
def make_bald(c):
    hd = cellv(heads, c).copy()
    hm = nd.binary_dilation(cellv(hair_ext, c)[..., 3] > 0.3, iterations=2)
    hd[hm] = 0
    lab_b, n_b = nd.label(hd[..., 3] > 0.1)
    for i_, sz in enumerate(nd.sum(np.ones_like(lab_b), lab_b, range(1, n_b + 1)), 1):
        if sz < 150:
            hd[lab_b == i_] = 0
    gx, gy, dist = eye_geo[c]
    sc = dist / 29
    ly, lx = np.mgrid[0:H, 0:CELL]
    uu, vv = 60 + (lx - gx) / sc, 61 + (ly - gy) / sc
    skull = (((uu - 60) / 37) ** 2 + ((vv - 46) / 40) ** 2 < 1) & (vv < 66)
    sk = is_skin(hd)
    tone = np.median(hd[sk & (np.abs(uu - 60) < 8) & (vv > 62) & (vv < 68), :3], 0)
    fill = skull & (hd[..., 3] < 0.6)
    # nét tóc cũ vắt qua trán (sợi mảnh không thuộc mảng tóc lớn) → lấp da
    lumb = hd[..., :3] @ _lw
    fill |= skull & (hd[..., 3] > 0.5) & (lumb < 0.55) & ((vv < 52.5) | ((vv < 57) & (np.abs(uu - 60) < 8.5)))
    hd[fill, :3] = tone * (0.97 + 0.03 * np.clip((vv[fill] - 20) / 40, 0, 1))[:, None]
    hd[fill, 3] = 1
    # vành tai: phần trên vốn bị tóc che → vẽ bù tai (da + viền) nằm dưới đầu
    ears = Layer(H, CELL, 0)
    hx = "#%02x%02x%02x" % tuple(int(round(x * 255)) for x in tone)
    small = c == 8  # đầu nữ: tai vốn bị tóc che hết → tai nhỏ, sát mặt hơn
    for eu, rot in (((23.2 if small else 21.8), 0.18), ((96.8 if small else 98.2), -0.18)):
        cx_, cy_ = gx + (eu - 60) * sc, gy + (63 - 61) * sc
        ears.paint(ellipse(cx_, cy_, (4.4 if small else 5.4) * sc, (7.0 if small else 8.6) * sc, rot), PAL[8], color=hx, hair=False, outline=1.6, edge=0.25,
                   strands=[bez((cx_ + (1 if eu < 60 else -1) * 1.8 * sc, cy_ - 4 * sc), (cx_ - (1 if eu < 60 else -1) * 1.2 * sc, cy_), (cx_ + (1 if eu < 60 else -1) * 1.4 * sc, cy_ + 4 * sc), n=10)])
    hd, _ = under(hd, np.zeros_like(hd), ears)
    return hd, np.zeros_like(hd)


def unit_map(c):
    gx, gy, dist = eye_geo[c]
    sc = dist / 29
    return lambda u, v: (gx + (u - 60) * sc, gy + (v - 61) * sc)


def LU(layer, p, U, root_l, root_r, tip, cl, cr, **kw):
    L(layer, p, U(*root_l), U(*root_r), U(*tip), [U(*q) for q in cl], [U(*q) for q in cr], **kw)


def cap(layer, p, U, hairline, rx=38.5, ry=41.5, cy=46, top=None, **kw):
    """Chỏm tóc: phần elip đầu nằm trên đường chân tóc (hairline: danh sách điểm trái → phải)"""
    a0 = np.degrees(np.arctan2((hairline[-1][1] - cy) / ry, (hairline[-1][0] - 60) / rx))
    a1 = np.degrees(np.arctan2((hairline[0][1] - cy) / ry, (hairline[0][0] - 60) / rx)) - 360
    tt = np.radians(np.linspace(a0, a1, 60))
    arc = [(60 + rx * np.cos(t_), cy + ry * np.sin(t_) - ((top or 0) * max(0, -np.sin(t_)) ** 3)) for t_ in tt]
    pts = [U(*q) for q in list(hairline) + arc]  # chân tóc trái → phải, rồi vòng đỉnh phải → trái
    layer.paint(np.array(pts), p, **kw)


def buzz(front, back, p, over=None, U=None):
    """Đầu đinh: chỏm sát da đầu, chân tóc gọn, vân tóc lởm chởm ngắn"""
    hl = [(22.5, 62), (24.5, 52), (31, 44), (45, 39.5), (60, 38.5), (75, 39.5), (89, 44), (95.5, 52), (97.5, 62)]
    rng = np.random.default_rng(7)
    stub = []
    for _ in range(170):
        u0, v0 = rng.uniform(24, 96), rng.uniform(8, 50)
        if ((u0 - 60) / 37) ** 2 + ((v0 - 46) / 40) ** 2 > 0.92:
            continue
        d = np.array([u0 - 60, v0 - 62]); d = d / (np.linalg.norm(d) + 1e-6)
        stub.append(np.array([U(u0, v0), U(u0 + 2.2 * d[0], v0 + 2.2 * d[1])]))
    for lay in (back, over):  # lớp sau có khoảng trống trên đầu → đỉnh không bị cắt phẳng
        cap(lay, p, U, hl, rx=38.6, ry=41.4, strands=stub, lights=[np.array([U(40, 16), U(52, 11), U(66, 11)])], dark=0.12, edge=0.55)


def slick(front, back, p, over=None, U=None):
    """Vuốt ngược: trán thoáng, tóc chải ngược phồng nhẹ phía trước"""
    hl = [(23, 60), (25.5, 47), (33, 39), (46, 34), (60, 33), (74, 34), (87, 39), (94.5, 47), (97, 60)]
    locks = [((26, 50), (34, 39), (32, 14), [(22, 36), (24, 20)], [(38, 30), (36, 18)]),
             ((86, 39), (94, 50), (88, 14), [(84, 30), (84, 18)], [(98, 36), (96, 20)]),
             ((33, 40), (47, 34), (44, 4), [(30, 26), (34, 10)], [(48, 24), (48, 10)]),
             ((73, 34), (87, 40), (76, 4), [(72, 24), (72, 10)], [(90, 26), (86, 10)]),
             ((45, 34.5), (75, 34.5), (60, 0), [(42, 20), (46, 4)], [(78, 20), (74, 4)])]
    for lay in (back, over):
        cap(lay, p, U, hl, rx=39, ry=42.5, top=2, dark=0.35, edge=0.4)
        for i, (rl, rr, tp, cl, cr) in enumerate(locks):
            LU(lay, p, U, rl, rr, tp, cl, cr, ring=(0.55, 0.72), strands=6, lights=1, root=0.25, seed=140 + i, nf=16)


def side_part(front, back, p, over=None, U=None, female=False):
    """Rẽ ngôi lệch: chỏm tóc + mái chải chéo sang phải, tóc mai vuốt nhọn; nữ (tóc tém): mái dài, mai ôm má, gáy bồng nhẹ"""
    f = female
    hl = [(22, 64), (24, 50), (32, 42), (46, 37), (60, 36), (74, 37), (88, 42), (96, 50), (98, 64)]
    if f:  # gáy bồng nhẹ hai bên (sau đầu)
        for side_u in (1, -1):
            m_ = lambda q: (60 + side_u * (q[0] - 60), q[1])
            LU(back, p, U, m_((26, 40)), m_((40, 30)), m_((22, 84)), [m_((16, 56)), m_((16, 74))], [m_((36, 56)), m_((30, 76))], ring=(0.2, 0.34), strands=4, root=0.4, seed=180 + side_u, nf=12)
    tip_v = 54 if f else 53
    bangs = [((34, 16), (42, 12), (29, tip_v + 2), [(26, 28), (26, 44)], [(42, 30), (36, 46)]),
             ((38, 18), (46, 14), (43, tip_v), [(36, 32), (40, 44)], [(48, 28), (46, 44)]),
             ((42, 14), (50, 12), (60, tip_v + 1), [(42, 30), (52, 46)], [(52, 24), (60, 42)]),
             ((44, 13), (52, 11), (76, tip_v), [(52, 26), (66, 44)], [(60, 16), (76, 38)]),
             ((44, 11), (54, 9), (90, tip_v - 2), [(62, 16), (82, 30)], [(70, 10), (92, 28)]),
             ((82, 30), (93, 40), (91, tip_v + 5), [(84, 42), (88, 52)], [(97, 46), (94, 54)])]
    mai = 76 if f else 67
    for lay in (back, over):
        cap(lay, p, U, hl, rx=38.5 if f else 39.5, ry=41.5 if f else 42.5, top=3, dark=0.3, edge=0.4)
        for i, (rl, rr, tp, cl, cr) in enumerate(bangs):
            LU(lay, p, U, rl, rr, tp, cl, cr, ring=(0.12, 0.26), strands=4, lights=1, root=0.15, seed=150 + i + (20 if f else 0), nf=14)
    # tóc mai: gốc dưới chỏm, ngọn nhọn chỉa về má
    LU(over, p, U, (23, 44), (32, 46), (34 if f else 29, mai), [(19, 58), (26, mai - 6)], [(33, 56), (35, mai - 10)], ring=(0.2, 0.36) if f else None, strands=3, root=0.3, seed=170 + (20 if f else 0), nf=10)
    LU(over, p, U, (88, 46), (97, 44), (86 if f else 91, mai), [(87, 56), (85, mai - 10)], [(101, 58), (94, mai - 6)], ring=(0.2, 0.36) if f else None, strands=3, root=0.3, seed=171 + (20 if f else 0), nf=10)


def pixie(front, back, p, over=None, U=None):
    """
    Tóc ngắn xoè (vẽ lại 28/11 — bản cũ dựng từ đầu trọc: mặt bè, mảng tóc che đuôi mắt, lộ tai):
    giữ nguyên tóc bob vẽ tay, thêm đuôi tóc xoè ra hai bên ngang cằm, phồng nhẹ phía sau, kẹp tóc hồng.
    """
    for side in (L, Lm):
        sd = 0 if side is L else 10
        # phồng sau gáy (sau đầu) → dáng tròn hơn bob
        side(back, p, (84, 70), (100, 60), (70, 150), [(62, 90), (60, 130)], [(96, 110), (86, 140)], ring=(0.2, 0.34), strands=2, lights=1, dark=0.18, root=0.3, seed=220 + sd, nf=12)
        # đuôi xoè ra ngoài ở mép dưới tóc hai bên (dưới đầu → chỉ thấy phần thò ra)
        side(front, p, (82, 128), (100, 140), (60, 168), [(74, 146), (64, 158)], [(96, 154), (78, 166)], ring=None, strands=2, lights=1, root=0.25, seed=221 + sd, nf=10)
        side(front, p, (92, 136), (104, 148), (82, 176), [(90, 156), (84, 166)], [(104, 160), (94, 172)], ring=None, strands=1, lights=0, dark=0.1, root=0.2, seed=222 + sd, nf=8)
    if over is not None:  # kẹp tóc hồng bên trái
        over.paint(chain(bez((88, 70), (100, 58), (116, 58), n=10), bez((118, 66), (102, 66), (91, 77), n=10)), p, color=TIE, hair=False, outline=1.5,
                   lights=[bez((94, 67), (104, 61), (113, 61), n=6)])
        over.paint(ellipse(116, 62, 5.5, 5.5), p, color="#fde68a", hair=False, outline=1.4)


NEW_HAIR_G = [("hair-buzz", 0, buzz, True), ("hair-sidepart", 0, side_part, True), ("hair-slick", 0, slick, True), ("hair-curly", 0, curly, False),
              ("hair-wolf", 0, wolf, False), ("hair-longm", 0, longm, False), ("hair-manbun", 0, manbun, False),
              ("hair-pixie", 8, pixie, False), ("hair-twintail", 8, twintail, False), ("hair-sidetail", 8, sidetail, False),
              ("hair-odango", 8, odango, False), ("hair-wavy", 8, wavy, False)]


NEW_HAIR = [(h, b, f, False) for h, b, f in [("hair-ponytail", 8, ponytail), ("hair-twin", 8, twin), ("hair-long", 8, long_hair), ("hair-bun", 8, bun), ("hair-spiky", 0, spiky), ("hair-mohawk", 0, mohawk)]] + NEW_HAIR_G
first = heads.shape[1] // CELL  # 9
ncell = first + len(NEW_HAIR)
back_img = np.zeros((H + TOP, ncell * CELL, 4))
back_sh = np.zeros_like(back_img)
add_h, add_s, add_e, add_f = [], [], [], []
new_cells = {}
for j, (hid, base, fn, is_bald) in enumerate(NEW_HAIR):
    c = first + j
    front, back, over = Layer(H, CELL, 0), Layer(H + TOP, CELL, -TOP), Layer(H, CELL, 0)
    if base == 8 and not is_bald:
        dome(back, PAL[8])
    if is_bald:
        fn(front, back, PAL[base], over, U=unit_map(base))
        bh, bs = make_bald(base)
        hd, hs = under(bh, bs, front)
    else:
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
    hc[fr, :3] = PAL[8 if c == 8 else new_cells[c][1]]["line"]
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

# ======================= Màu da (skinTone): vùng da + độ sáng chuẩn hoá → Chibi tô lại da bằng phép nhân =======================
def skin_shade(img, cw, exclude=None, min_sat=0.14, feather=True):
    """min_sat: độ bão hoà trung bình tối thiểu của mảng da (tai rất nhạt ~0.1; giáp kim loại ánh ấm cũng ~0.1 nên tranh nguyên mẫu giữ 0.14);
    feather=False: không nhân alpha của ảnh (mặt dán có viền mờ — tô cả viền để không lộ vòng sáng)"""
    h_, s_, v_, l_, a_ = hsv(img)
    hs_ = (h_ + 30) % 360  # quay sắc độ: tai, má hồng (~350°) liền với tông da (~20°)
    m = (a_ > (0.3 if feather else 0.01)) & (v_ > 0.72) & (s_ > 0.05) & (s_ < 0.45) & (hs_ > 5) & (hs_ < 66)
    if exclude is not None:
        m &= ~exclude
    # chỉ giữ mảng liền mang tông da (bỏ giáp kim loại ánh ấm, viền vàng áo choàng, đai kimono…)
    lab_k, n_k = nd.label(m, structure=np.ones((3, 3)))
    if n_k:
        idx_k = np.arange(1, n_k + 1)
        area = nd.sum(m, lab_k, idx_k)
        ms, mh = nd.mean(s_, lab_k, idx_k), nd.mean(hs_, lab_k, idx_k) - 30
        core = nd.sum(nd.binary_opening(m, iterations=2), lab_k, idx_k)  # nét mảnh (viền áo) không còn lõi
        sl = nd.find_objects(lab_k)
        hw = np.array([(q[0].stop - q[0].start, q[1].stop - q[1].start) for q in sl])
        flat = (hw[:, 1] > 2.5 * hw[:, 0]) | (hw[:, 0] > 2.5 * hw[:, 1])  # dải ngang (đai) / vệt dọc (viền áo)
        ok = (area >= 40) & (ms >= min_sat) & (mh >= 0) & (mh <= 32) & (core >= 12) & ~flat
        m = ok[np.maximum(lab_k - 1, 0)] & (lab_k > 0)
    out = np.zeros(img.shape[:2] + (4,))
    for c0 in range(0, img.shape[1], cw):
        cm = np.zeros_like(m); cm[:, c0:c0 + cw] = m[:, c0:c0 + cw]
        if cm.sum() > 20:
            out[cm, :3] = np.clip(l_[cm] / np.percentile(l_[cm], 75), 0, 1)[:, None]
    soft = nd.gaussian_filter(m.astype(float), 0.6)
    out[..., 3] = np.clip(np.maximum(m * 1.0, soft), 0, 1) * (a_ if feather else 1)
    edge = (~m) & (out[..., 3] > 0)
    out[edge, :3] = np.clip(l_[edge] / 0.75, 0, 1)[:, None]
    return out


for name, img_, cw_, ex_, kw_ in (
    ("characters-skin.webp", im, CELL, None, {}),
    ("char-skin.webp", heads, CELL, hair_ext[..., 3] > 0.5, {"min_sat": 0.07}),
    ("char-bodies-skin.webp", strip, CELL, None, {"min_sat": 0.07}),
    ("faces-skin.webp", faces, PW, None, {"min_sat": 0.07, "feather": False}),
    ("faces-blank-skin.webp", blank, PW, None, {"min_sat": 0.07, "feather": False}),
):
    Image.fromarray((np.clip(skin_shade(img_, cw_, ex_, **kw_), 0, 1) * 255).astype(np.uint8), "RGBA").save(os.path.join(OUT, name), lossless=True)
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
