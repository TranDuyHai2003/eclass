"""
Vẽ thêm tóc theo nét của tranh nhân vật (viền tối, nền, tối dần ra mép, vệt sáng + sợi tóc), dùng cho gen-face-assets.py.
Toạ độ theo px của ô 332×272; lớp vẽ có thể bắt đầu ở hàng `oy` < 0 (khoảng trống trên đầu cho búi, tóc dựng).
"""
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd

SS = 4  # siêu lấy mẫu để mép mịn


def bez(*p, n=28):
    """Đường Bézier bậc 2/3 qua các điểm điều khiển → n điểm"""
    p = np.array(p, float)
    t = np.linspace(0, 1, n)[:, None]
    if len(p) == 2:
        return (1 - t) * p[0] + t * p[1]
    if len(p) == 3:
        return (1 - t) ** 2 * p[0] + 2 * (1 - t) * t * p[1] + t ** 2 * p[2]
    return (1 - t) ** 3 * p[0] + 3 * (1 - t) ** 2 * t * p[1] + 3 * (1 - t) * t ** 2 * p[2] + t ** 3 * p[3]


def chain(*parts):
    return np.concatenate([np.asarray(q, float) for q in parts], 0)


def palette(rgb, mask, lum):
    """Bảng màu tóc lấy từ vùng tóc của tranh gốc: viền, bóng, nền, sáng + mốc chuẩn hoá độ sáng (phân vị 80)"""
    px, l = rgb[mask], lum[mask]
    o = np.argsort(l)
    at = lambda q: px[o[int((len(o) - 1) * q)]]
    return {"line": at(0.03) * 0.9, "shadow": at(0.14), "base": at(0.55), "light": np.minimum(at(0.95) * 1.08, 1), "p80": float(np.percentile(l, 80))}


class Layer:
    """Lớp RGBA (thẳng, không nhân alpha) + lớp độ sáng tóc (RGB = độ sáng chuẩn hoá, A = vùng tóc) để tô màu tóc"""

    def __init__(self, h, w, oy=0):
        self.h, self.w, self.oy = h, w, oy
        self.img = np.zeros((h, w, 4))
        self.shade = np.zeros((h, w, 4))

    def _hi(self):
        return Image.new("L", (self.w * SS, self.h * SS), 0)

    def _pts(self, pts):
        return [(float(x) * SS, (float(y) - self.oy) * SS) for x, y in pts]

    def _down(self, im):
        a = np.asarray(im, float) / 255
        return a.reshape(self.h, SS, self.w, SS).mean((1, 3))

    def lines(self, polylines, width):
        im = self._hi()
        dr = ImageDraw.Draw(im)
        for ln in polylines:
            dr.line(self._pts(ln), fill=255, width=max(1, int(round(width * SS))), joint="curve")
        return self._down(im)

    def paint(self, poly, pal, *, strands=(), lights=(), color=None, edge=0.5, dark=0.0, root=None, root_r=60, outline=2.0, hair=True):
        """Tô một mảng tóc (đa giác `poly`); `color` → mảng không phải tóc (dây buộc), không tô lại theo màu tóc"""
        hi = self._hi()
        ImageDraw.Draw(hi).polygon(self._pts(poly), fill=255)
        hib = np.asarray(hi) > 127
        cov = self._down(hi)
        dist = nd.distance_transform_edt(hib).reshape(self.h, SS, self.w, SS).mean((1, 3)) / SS
        if color is not None:
            c0 = np.array([int(color[i:i + 2], 16) for i in (1, 3, 5)]) / 255
            base, shadow, light, line = c0, c0 * 0.72, np.minimum(c0 * 1.25 + 0.08, 1), pal["line"]
        else:
            base, shadow, light, line = pal["base"], pal["shadow"], pal["light"], pal["line"]
        k = np.zeros((self.h, self.w))
        k += edge * np.exp(-dist / 4.5)  # tối dần ra mép → khối tròn
        k += dark
        if root is not None:
            yy, xx = np.mgrid[0:self.h, 0:self.w]
            k += 0.45 * np.clip(1 - np.hypot(xx - root[0], yy + self.oy - root[1]) / root_r, 0, 1)
        k = np.clip(k, 0, 0.9)[..., None]
        col = base * (1 - k) + shadow * k
        if lights:
            lm = nd.gaussian_filter(self.lines(lights, 3.2), 0.9)
            col = col * (1 - 0.75 * lm[..., None]) + light * 0.75 * lm[..., None]
        if strands:
            sm = self.lines(strands, 1.1)
            col = col * (1 - 0.55 * sm[..., None]) + line * 0.55 * sm[..., None]
        o = np.clip((outline - dist) / 1.0, 0, 1)[..., None]
        col = col * (1 - o) + line * o
        self._over(self.img, col, cov)
        if hair:
            l = (col @ np.array([0.299, 0.587, 0.114])) / pal["p80"]
            self._over(self.shade, np.repeat(np.clip(l, 0, 1)[..., None], 3, -1), cov)
        else:
            self.shade[..., 3] *= 1 - cov

    @staticmethod
    def _over(dst, rgb, a):
        da = dst[..., 3]
        na = a + da * (1 - a)
        safe = np.maximum(na, 1e-6)[..., None]
        dst[..., :3] = (rgb * a[..., None] + dst[..., :3] * (da * (1 - a))[..., None]) / safe
        dst[..., 3] = na


def lock(left, right):
    """Lọn tóc từ hai mép (cùng số điểm, gốc → ngọn): đa giác + sợi tóc + vệt sáng nội suy giữa hai mép"""
    left, right = np.asarray(left, float), np.asarray(right, float)
    poly = chain(left, right[::-1])
    n = len(left)
    mid = lambda f, t0, t1: (left * (1 - f) + right * f)[int(n * t0):max(int(n * t0) + 2, int(n * t1))]
    strands = [mid(0.3, 0.12, 0.8), mid(0.62, 0.2, 0.92), mid(0.82, 0.08, 0.6)]
    lights = [mid(0.42, 0.14, 0.34)]
    return poly, strands, lights


def under(top, top_shade_a, layer):
    """Đặt lớp `layer` (Layer) dưới ảnh `top` (RGBA): ảnh ghép + lớp độ sáng tóc ghép (tóc của `top` che lớp dưới)"""
    ta = top[..., 3]
    out = top.copy()
    la = layer.img[..., 3] * (1 - ta)
    na = ta + la
    out[..., :3] = (top[..., :3] * ta[..., None] + layer.img[..., :3] * la[..., None]) / np.maximum(na, 1e-6)[..., None]
    out[..., 3] = na
    sa = top_shade_a[..., 3]
    ls = layer.shade[..., 3] * (1 - ta)
    sh = top_shade_a.copy()
    nsa = sa + ls
    sh[..., :3] = (top_shade_a[..., :3] * sa[..., None] + layer.shade[..., :3] * ls[..., None]) / np.maximum(nsa, 1e-6)[..., None]
    sh[..., 3] = nsa
    return out, sh


def _at(edge, t):
    """Điểm trên mép (mảng điểm) tại tham số t ∈ [0, 1]"""
    x = np.clip(t, 0, 1) * (len(edge) - 1)
    i = np.minimum(x.astype(int), len(edge) - 2)
    w = (x - i)[:, None]
    return edge[i] * (1 - w) + edge[i + 1] * w


def _smooth(v, m, s=1.2):
    return nd.gaussian_filter(v * m, s) / np.maximum(nd.gaussian_filter(m.astype(float), s), 1e-6)


def paint_lock(layer, left, right, pal, *, ring=(0.16, 0.3), strands=7, lights=2, dark=0.0, root=0.35, seed=0, outline=1.9, nf=18):
    """
    Lọn tóc kiểu anime: hai mép (gốc → ngọn), tô theo toạ độ lọn (t dọc lọn, f ngang lọn):
    khối tròn (tối hai mép), gốc tối, vòng sáng lượn sóng ("angel ring"), sợi tóc thuôn dần + vệt sáng, viền tối.
    """
    left, right = np.asarray(left, float), np.asarray(right, float)
    n = len(left)
    hi = Image.new("I", (layer.w * SS, layer.h * SS), 0)
    dr = ImageDraw.Draw(hi)
    for i in range(n - 1):
        for j in range(nf):
            f0, f1 = j / nf, (j + 1) / nf
            q = [left[i] * (1 - f0) + right[i] * f0, left[i] * (1 - f1) + right[i] * f1, left[i + 1] * (1 - f1) + right[i + 1] * f1, left[i + 1] * (1 - f0) + right[i + 1] * f0]
            dr.polygon(layer._pts(q), fill=1 + i * nf + j)
    idx = np.asarray(hi, np.int64)
    hib = idx > 0
    ti = np.where(hib, ((idx - 1) // nf + 0.5) / (n - 1), 0.0)
    fj = np.where(hib, ((idx - 1) % nf + 0.5) / nf, 0.0)
    down = lambda a: a.reshape(layer.h, SS, layer.w, SS).mean((1, 3))
    cov = down(hib.astype(float))
    m = cov > 0
    t = _smooth(down(ti) / np.maximum(cov, 1e-6), m)
    f = _smooth(down(fj) / np.maximum(cov, 1e-6), m)
    dist = nd.distance_transform_edt(hib).reshape(layer.h, SS, layer.w, SS).mean((1, 3)) / SS
    cyl = np.abs(2 * f - 1) ** 1.6
    k = 0.55 * cyl + root * np.clip(1 - t / 0.22, 0, 1) + dark + 0.12 * np.clip((t - 0.7) / 0.3, 0, 1)
    k = np.clip(k, 0, 0.92)[..., None]
    col = pal["base"] * (1 - k) + pal["shadow"] * k
    if ring:
        ph = seed * 1.7
        r0 = ring[0] + 0.03 * np.sin(f * np.pi * 6 + ph)
        r1 = ring[1] + 0.045 * np.sin(f * np.pi * 5 + ph * 2) - 0.03 * cyl
        band = np.clip((t - r0) / 0.025, 0, 1) * np.clip((r1 - t) / 0.04, 0, 1) * (1 - cyl) ** 1.5
        col = col * (1 - 0.7 * band[..., None]) + pal["light"] * 0.7 * band[..., None]
    rng = np.random.default_rng(seed)

    def path(fv, t0, t1, k_=24):
        tt = np.linspace(t0, t1, k_)
        return _at(left, tt) * (1 - fv) + _at(right, tt) * fv

    for _ in range(strands):
        fv, t0, t1 = rng.uniform(0.12, 0.88), rng.uniform(0.02, 0.2), rng.uniform(0.55, 0.97)
        tm = (t0 + t1) / 2
        for (a, b, w, op) in ((t0, tm, 1.25, 0.55), (tm, t1, 0.75, 0.4)):
            sm = layer.lines([path(fv, a, b)], w)
            col = col * (1 - op * sm[..., None]) + pal["line"] * op * sm[..., None]
    for _ in range(lights):
        fv, t0 = rng.uniform(0.25, 0.6), rng.uniform(0.05, 0.25)
        lm = nd.gaussian_filter(layer.lines([path(fv, t0, t0 + rng.uniform(0.18, 0.35))], 1.1), 0.5)
        col = col * (1 - 0.6 * lm[..., None]) + pal["light"] * 0.6 * lm[..., None]
    o = np.clip((outline - dist) / 1.0, 0, 1)[..., None]
    col = col * (1 - o) + pal["line"] * o
    layer._over(layer.img, col, cov)
    l = (col @ np.array([0.299, 0.587, 0.114])) / pal["p80"]
    layer._over(layer.shade, np.repeat(np.clip(l, 0, 1)[..., None], 3, -1), cov)


def lock_edges(root_l, root_r, tip, cl, cr, n=30):
    """Mép trái/phải của một lọn: gốc (hai điểm) → ngọn chung, mỗi mép 2 điểm điều khiển"""
    return bez(root_l, cl[0], cl[1], tip, n=n), bez(root_r, cr[0], cr[1], tip, n=n)
