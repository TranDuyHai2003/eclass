// AUTO-SINH từ lib/world/vault/*.ts bằng scripts/gen-realtime.mjs — ĐỪNG SỬA TAY (sửa file .ts rồi chạy lại script).
// ─────────── lib/world/vault/geom.ts ───────────
export function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
}
/** Khoảng cách từ (px, pz) tới đoạn AB trên mặt phẳng xz; t ∈ [0, 1] là vị trí chiếu trên đoạn */
export function segDist(px, pz, ax, az, bx, bz) {
    const dx = bx - ax;
    const dz = bz - az;
    const l2 = dx * dx + dz * dz;
    const t = l2 > 1e-9 ? clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1) : 0;
    const x = ax + dx * t - px;
    const z = az + dz * t - pz;
    return { d: Math.sqrt(x * x + z * z), t };
}
/** Khoảng cách tới đường gấp khúc pts = [x0, z0, x1, z1, …]; t ∈ [0, 1] theo chỉ số điểm (đều theo tham số) */
export function polyDist(px, pz, pts) {
    const n = pts.length / 2 - 1;
    let best = Infinity;
    let bt = 0;
    for (let i = 0; i < n; i++) {
        const r = segDist(px, pz, pts[i * 2], pts[i * 2 + 1], pts[i * 2 + 2], pts[i * 2 + 3]);
        if (r.d < best) {
            best = r.d;
            bt = (i + r.t) / n;
        }
    }
    return { d: best, t: bt };
}
/** Số ngẫu nhiên tất định (mulberry32) — cùng hạt giống ra cùng dãy trên client và server */
export function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
export function dist2(a, x, z) {
    return Math.hypot(a[0] - x, a[2] - z);
}

// ─────────── lib/world/vault/konigsberg.ts ───────────
/**
 * Hầm Bổ đề · Phòng I — Cầu Königsberg (Euler 1736). Logic thuần (client chơi một mình + server tổ đội).
 *
 * Ý toán: đồ thị liên thông có 2k đỉnh bậc lẻ được phủ bởi đúng k đường đi rời cạnh, không ít hơn (k ≥ 1).
 * → Số đảo lẻ cho biết CẦN BAO NHIÊU người đi và MỖI NGƯỜI PHẢI BẮT ĐẦU Ở ĐÂU.
 *
 * Luật chơi:
 *  - Mọi người xuất phát trên Đài quan sát (cao 9 m), lượn xuống một đảo: đảo đầu tiên đặt chân = điểm đầu sợi chỉ.
 *  - Đi trọn một cây cầu từ đầu sợi chỉ sang đảo bên kia → cầu sáng màu của bạn (đã đi, không đi lại được).
 *    Quay đầu giữa cầu = không tính.
 *  - Hết cầu chưa đi ở đảo đang đứng = "thắt nút" (kẹt) → tua lại: cầu của bạn tắt, bạn về Đài quan sát.
 *  - Xong màn khi MỌI cây cầu đều sáng.
 * Ba màn theo N người: S1 mỗi người một "thị trấn nhỏ" (2 đảo lẻ) · S2 Königsberg 1736 (4 đảo lẻ → 2 sợi chỉ) ·
 * S3 "Đại đồ thị" bánh xe 2N nan → 2N đảo lẻ → đúng N sợi chỉ.
 */

export const LOOK_Y = 9;
export const LOOK_R = 3.2;
export const BRIDGE_HALF = 0.85;
export const ARCH = 0.7;
export const FOG_Y = -30;
/** cao hơn mức này (so với mặt đảo) = đang bay / trên đài, không tính là đang ở đảo / trên cầu */
const AIR = 2.6;
// ───────────── Đồ thị theo màn + số người ─────────────
function rot(x, z, a) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return [x * c - z * s, x * s + z * c];
}
/** Thị trấn nhỏ: hình vuông + 1 đường chéo → bậc 3, 2, 3, 2 (2 đảo lẻ = 1 sợi chỉ, phải bắt đầu ở đảo lẻ) */
function littleTown(g, cx, cz, a) {
    const base = g.islands.length;
    const H = 5;
    for (const [x, z] of [
        [-H, -H],
        [H, -H],
        [H, H],
        [-H, H],
    ]) {
        const [rx, rz] = rot(x, z, a);
        g.islands.push({ x: cx + rx, z: cz + rz, r: 2.4 });
    }
    for (const [p, q] of [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 0],
        [0, 2],
    ])
        g.bridges.push({ a: base + p, b: base + q, bend: 0 });
}
/**
 * Königsberg 1736: Kneiphof (A) nối Bờ Bắc (B) 2 cầu, Bờ Nam (C) 2 cầu, Lomse (D) 1 cầu; B–D, C–D mỗi cặp 1 cầu.
 * Bậc A 5 · B 3 · C 3 · D 3 → 4 đảo lẻ. "today" = Kaliningrad ngày nay (5 cầu, bậc 3·2·2·3 → 2 đảo lẻ).
 * side = +1: D ở phía đông của A; −1: phía tây.
 */
function konigsberg(g, ax, side, today = false) {
    const base = g.islands.length;
    g.islands.push({ x: ax, z: 0, r: 3.4, name: "kneiphof" }, { x: ax, z: -12, r: 4.2, name: "north" }, { x: ax, z: 12, r: 4.2, name: "south" }, { x: ax + side * 12, z: 0, r: 4.2, name: "lomse" });
    const A = base;
    const B = base + 1;
    const C = base + 2;
    const D = base + 3;
    const list = today
        ? [
            [A, B, 0],
            [A, C, 0],
            [A, D, 0],
            [B, D, 0],
            [C, D, 0],
        ]
        : [
            [A, B, 2.4],
            [A, B, -2.4],
            [A, C, 2.4],
            [A, C, -2.4],
            [A, D, 0],
            [B, D, 0],
            [C, D, 0],
        ];
    for (const [a, b, bend] of list)
        g.bridges.push({ a, b, bend });
}
/** Bánh xe: đảo trung tâm (bậc 2m, chẵn) + vòng m đảo (bậc 3, lẻ) → m đảo lẻ */
function wheel(g, m) {
    const R = m >= 8 ? 14.5 : m >= 6 ? 12.5 : 11;
    g.islands.push({ x: 0, z: 0, r: m >= 6 ? 4.5 : 3.6, name: "hub" });
    for (let i = 0; i < m; i++) {
        const a = (i / m) * Math.PI * 2 - Math.PI / 2;
        g.islands.push({ x: Math.cos(a) * R, z: Math.sin(a) * R, r: 2.8 });
    }
    for (let i = 0; i < m; i++) {
        const p = 1 + i;
        const q = 1 + ((i + 1) % m);
        // vành: cong ra ngoài (chọn dấu theo hướng tâm → trung điểm)
        const A = g.islands[p];
        const B = g.islands[q];
        const dx = B.x - A.x;
        const dz = B.z - A.z;
        const out = -dz * (A.x + B.x) + dx * (A.z + B.z) > 0 ? 1 : -1;
        g.bridges.push({ a: p, b: q, bend: 1.6 * out });
    }
    for (let i = 0; i < m; i++)
        g.bridges.push({ a: 0, b: 1 + i, bend: 0 });
}
const CACHE = new Map();
/** id = "k<stage>n<N>" — client dựng lại đồ thị từ id gửi qua mạng */
export function graphById(id) {
    const hit = CACHE.get(id);
    if (hit)
        return hit;
    const m = /^k(\d)n(\d)$/.exec(id);
    const stage = m ? Number(m[1]) : 0;
    const n = m ? clamp(Number(m[2]), 2, 4) : 2;
    const g = { id, islands: [], bridges: [], look: { x: 0, z: 0 } };
    if (stage === 0) {
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + (n === 2 ? 0 : Math.PI / 4);
            littleTown(g, Math.cos(a) * 17, Math.sin(a) * 17, a);
        }
    }
    else if (stage === 1) {
        if (n === 2)
            konigsberg(g, 9, 1);
        else {
            konigsberg(g, -9, -1, n === 3);
            konigsberg(g, 9, 1);
        }
    }
    else
        wheel(g, 2 * n);
    CACHE.set(id, g);
    return g;
}
export const graphFor = (stage, n) => graphById(`k${stage}n${clamp(n, 2, 4)}`);
export const K_STAGES = 3;
export function degrees(g) {
    const d = g.islands.map(() => 0);
    for (const b of g.bridges) {
        d[b.a]++;
        d[b.b]++;
    }
    return d;
}
export function oddVertices(g) {
    return degrees(g)
        .map((d, i) => (d % 2 ? i : -1))
        .filter((i) => i >= 0);
}
/** Thành phần liên thông (chỉ tính đảo có cầu) */
export function components(g) {
    const seen = new Set();
    const adj = g.islands.map(() => []);
    for (const b of g.bridges) {
        adj[b.a].push(b.b);
        adj[b.b].push(b.a);
    }
    const out = [];
    for (let s = 0; s < g.islands.length; s++) {
        if (seen.has(s) || !adj[s].length)
            continue;
        const comp = [];
        const stack = [s];
        seen.add(s);
        while (stack.length) {
            const v = stack.pop();
            comp.push(v);
            for (const w of adj[v])
                if (!seen.has(w)) {
                    seen.add(w);
                    stack.push(w);
                }
        }
        out.push(comp.sort((a, b) => a - b));
    }
    return out;
}
/** Số sợi chỉ (đường đi rời cạnh) tối thiểu phủ hết cầu = Σ theo thành phần max(1, số đảo lẻ / 2) */
export function minTrails(g) {
    const deg = degrees(g);
    return components(g).reduce((s, c) => s + Math.max(1, c.filter((v) => deg[v] % 2).length / 2), 0);
}
const GEO = new Map();
export const SAMPLES = 16;
export function bridgeGeos(g) {
    const hit = GEO.get(g.id);
    if (hit)
        return hit;
    const out = g.bridges.map((b) => {
        const A = g.islands[b.a];
        const B = g.islands[b.b];
        const dx = B.x - A.x;
        const dz = B.z - A.z;
        const L = Math.hypot(dx, dz) || 1;
        const cx = (A.x + B.x) / 2 + (-dz / L) * b.bend * 2;
        const cz = (A.z + B.z) / 2 + (dx / L) * b.bend * 2;
        const pts = [];
        let len = 0;
        for (let i = 0; i <= SAMPLES; i++) {
            const t = i / SAMPLES;
            const u = 1 - t;
            const x = u * u * A.x + 2 * u * t * cx + t * t * B.x;
            const z = u * u * A.z + 2 * u * t * cz + t * t * B.z;
            if (i)
                len += Math.hypot(x - pts[pts.length - 2], z - pts[pts.length - 1]);
            pts.push(x, z);
        }
        // t0/t1: điểm mẫu đầu tiên ra khỏi đảo (nội suy tuyến tính trong đoạn)
        const exitT = (I, fromEnd) => {
            for (let k = 0; k < SAMPLES; k++) {
                const i0 = fromEnd ? SAMPLES - k : k;
                const i1 = fromEnd ? i0 - 1 : i0 + 1;
                const d0 = Math.hypot(pts[i0 * 2] - I.x, pts[i0 * 2 + 1] - I.z);
                const d1 = Math.hypot(pts[i1 * 2] - I.x, pts[i1 * 2 + 1] - I.z);
                if (d1 >= I.r) {
                    const f = d1 > d0 ? clamp((I.r - d0) / (d1 - d0), 0, 1) : 0;
                    return (i0 + (i1 - i0) * f) / SAMPLES;
                }
            }
            return fromEnd ? 0.6 : 0.4;
        };
        return { pts, t0: exitT(A, false), t1: exitT(B, true), len };
    });
    GEO.set(g.id, out);
    return out;
}
/** Độ cao mặt cầu tại tham số t (vòm sin, 0 ở hai mép đảo) */
export function deckY(geo, t) {
    const u = clamp((t - geo.t0) / Math.max(1e-3, geo.t1 - geo.t0), 0, 1);
    return ARCH * Math.sin(Math.PI * u);
}
/** Người / bạn đồng hành đang ở đâu (đảo, cầu, đài, trên không, rơi xuống sương) */
export function locate(g, x, y, z) {
    if (y > LOOK_Y - 1.5 && Math.hypot(x - g.look.x, z - g.look.z) < LOOK_R + 0.4)
        return { k: "look" };
    if (y > AIR)
        return { k: "air" };
    for (let i = 0; i < g.islands.length; i++) {
        const I = g.islands[i];
        if (Math.hypot(x - I.x, z - I.z) < I.r)
            return { k: "island", i };
    }
    const geos = bridgeGeos(g);
    for (let e = 0; e < geos.length; e++) {
        const r = polyDist(x, z, geos[e].pts);
        if (r.d < BRIDGE_HALF + 0.15)
            return { k: "bridge", e, t: r.t };
    }
    return { k: "fog" };
}
/** Mặt đất cao nhất dưới chân (y hiện tại để biết có đang ở trên đài không) */
export function kGround(g, x, z, y = 0) {
    if (y >= LOOK_Y - 1.6 && Math.hypot(x - g.look.x, z - g.look.z) < LOOK_R)
        return LOOK_Y;
    for (const I of g.islands)
        if (Math.hypot(x - I.x, z - I.z) < I.r)
            return 0;
    const geos = bridgeGeos(g);
    for (const geo of geos) {
        const r = polyDist(x, z, geo.pts);
        if (r.d < BRIDGE_HALF)
            return deckY(geo, r.t);
    }
    return FOG_Y;
}
/** Va chạm: ở tầm đảo thì không được bước ra sương, không bước lên cầu đã sáng; trên cao (đài, đang lượn) thì tự do */
export function kBlocked(g, lit, x, z, y) {
    if (y > AIR + 0.4)
        return Math.hypot(x - g.look.x, z - g.look.z) > 70;
    for (const I of g.islands)
        if (Math.hypot(x - I.x, z - I.z) < I.r - 0.15)
            return false;
    const geos = bridgeGeos(g);
    for (let e = 0; e < geos.length; e++) {
        const r = polyDist(x, z, geos[e].pts);
        if (r.d < BRIDGE_HALF - 0.1)
            return lit[e] >= 0;
    }
    return true;
}
const emptyTrail = () => ({ s: -1, a: -1, l: -1, o: -1, e: [] });
export function kInit(stage, n) {
    const g = graphFor(stage, n);
    return { g: g.id, lit: g.bridges.map(() => -1), tr: Array.from({ length: n }, emptyTrail), rew: 0 };
}
/**
 * Cập nhật một ghế từ vị trí mới (10 Hz). Trả về chỉ số cầu vừa sáng (−1 nếu không).
 * Đi qua cầu = hai lần đứng đảo liên tiếp khác nhau (l → i) và ở giữa đứng trên cầu nối hai đảo đó.
 */
export function kStep(st, seat, x, y, z) {
    const g = graphById(st.g);
    const t = st.tr[seat];
    if (!t)
        return -1;
    const loc = locate(g, x, y, z);
    if (loc.k === "bridge") {
        t.o = loc.e;
        return -1;
    }
    if (loc.k !== "island")
        return -1;
    const i = loc.i;
    let lit = -1;
    if (t.a < 0) {
        // lần đầu đặt chân xuống đảo = đầu sợi chỉ
        t.s = t.a = i;
    }
    else if (i !== t.l && t.l >= 0) {
        const b = t.o >= 0 ? g.bridges[t.o] : null;
        const crossed = !!b && ((b.a === t.l && b.b === i) || (b.b === t.l && b.a === i));
        if (crossed && t.l === t.a && st.lit[t.o] < 0) {
            st.lit[t.o] = seat;
            t.e.push(t.o);
            t.a = i;
            lit = t.o;
        }
        else if (!t.e.length) {
            // chưa đi cầu nào → đổi điểm đầu (vd. lượn sang đảo khác)
            t.s = t.a = i;
        }
    }
    else if (t.l < 0 && !t.e.length)
        t.s = t.a = i;
    t.l = i;
    t.o = -1;
    return lit;
}
/** Tua lại: cầu của ghế này tắt, sợi chỉ xoá (người chơi về Đài quan sát) */
export function kRewind(st, seat) {
    const t = st.tr[seat];
    if (!t)
        return;
    for (const e of t.e)
        if (st.lit[e] === seat)
            st.lit[e] = -1;
    st.tr[seat] = emptyTrail();
    st.rew++;
}
/** Thắt nút: đã có sợi chỉ, đứng đúng ở cuối sợi chỉ mà không còn cầu chưa đi nào chạm đảo này */
export function kStuck(st, seat) {
    const t = st.tr[seat];
    if (!t || t.a < 0 || !t.e.length || kClear(st))
        return false;
    const g = graphById(st.g);
    if (g.bridges.some((b, e) => st.lit[e] < 0 && (b.a === t.a || b.b === t.a)))
        return false;
    // hết cầu ở đây nhưng cả thành phần (thị trấn / thành phố) đã sáng hết = sợi chỉ HOÀN THÀNH, không phải nút thắt
    const comp = components(g).find((c) => c.includes(t.a)) ?? [];
    return g.bridges.some((b, e) => st.lit[e] < 0 && comp.includes(b.a));
}
export const kClear = (st) => st.lit.every((s) => s >= 0);
export const kProgress = (st) => st.lit.filter((s) => s >= 0).length / Math.max(1, st.lit.length);

// ─────────── lib/world/vault/balance.ts ───────────
/**
 * Hầm Bổ đề · Phòng II — Cân Archimedes (Noether). Logic thuần.
 *
 * Ý toán / lý: mô-men τ = m·d. Đòn cân thăng bằng khi Σ mᵢdᵢ = 0: vật nhẹ ở xa cân được vật nặng ở gần.
 * Mỗi người (và Tiếng Vọng) nặng 1; "cánh tay đòn" = số khắc gần nhất nơi mình đứng (−7…7, âm = bên trái).
 * Đòn nghiêng theo mô-men tổng: θ_cb = atan(Στ / K) (như cân thật có trọng tâm dưới trục), θ tiến dần tới θ_cb.
 * θ > 0: đầu PHẢI chúi xuống. Thăng bằng khi |Στ| < 0,5 (màn 2: < 1).
 *
 * Màn:
 *  S1 "Cân đá": Tảng Bổ đề cố định bên phải, M·D chọn sao cho CẦN ĐỦ N người: 7(N−1) < M·D ≤ 7N.
 *  S2 "Cùng sang bờ": đá trượt được trên ray (đứng cạnh đá bấm F để đẩy xa mình 1 khắc). Mọi người phải đứng ở đầu phải
 *     (khắc ≥ 5) trong khi đòn vẫn thăng bằng → phải đẩy đá sang trái đúng nhịp với đoàn người đi sang phải.
 *  S3 "Máy bắn đá": sân riêng phía sau đòn cân. Bập bênh 6 m dưới tháp gió: người BỔ NHÀO (rơi từ đỉnh cột gió) xuống đầu
 *     ngắn bắn người / Quả cân ở đầu dài lên. Va chạm KHÔNG đàn hồi quanh trục — bảo toàn mô-men động lượng (Noether):
 *       v₂ = m₁·v₁·d₁·d₂ / (m₁·d₁² + m₂·d₂²)     (mọi khối lượng = 1; m₁ = số người chạm trong cùng 250 ms)
 *     v₁ = √(2·40·h_rơi) (trọng lực bổ nhào 40; cú lao −26 lúc bắt đầu chỉ để "cảm giác", KHÔNG tính), bay cao h₂ = v₂² / (2·22).
 *     Chuông A (4,5 m) cần 1 người rơi (ổ giữa); chuông B (9 m) cần 2 người chạm CÙNG LÚC (đếm 3-2-1) + điểm tựa ở ổ XA
 *     (d₂/d₁ = √2). B bị niêm cho tới khi A đã kêu. Server quyết cú bắn; client người được bắn đặt motion.vy = v₂.
 */

export const BEAM = { half: 8, y: 2.2, w: 0.9 };
export const PLAT = { x0: 8.4, x1: 15, w: 3.2 };
export const K_TILT = 60;
export const MAX_TILT = 0.26;
export const SLIDE_FROM = (6 * Math.PI) / 180;
export const B_STAGES = 3;
export const CHASM_Y = -20;
/** ray của Tảng Bổ đề chạy dọc mép sau của đòn (người đi ngang qua đá được) */
export const STONE_Z = -1.55;
export function stoneFor(stage, n) {
    if (stage === 0)
        return n >= 4 ? { m: 5, x: 5 } : n === 3 ? { m: 3, x: 6 } : { m: 2, x: 6 };
    // màn 3: đá nằm giữa ray (đòn cân đứng yên làm cảnh nền)
    if (stage === 2)
        return { m: n, x: 0 };
    return { m: n, x: 3 };
}
export function bInit(stage, n) {
    const s = stoneFor(stage, n);
    return { sg: stage, th: 0, tau: 0, m: s.m, sx: s.x, mov: stage === 1, hold: 0, arms: Array.from({ length: n }, () => null), pushAt: 0, pushes: 0, cat: stage === 2 ? cInit(n) : null };
}
/** Mặt đòn tại x (θ > 0 → bên phải thấp) */
export function beamY(th, x) {
    return BEAM.y - x * Math.tan(th);
}
/** Đứng trên đòn? → cánh tay đòn (khắc gần nhất), không thì null */
export function armOf(th, x, y, z) {
    if (Math.abs(x) > BEAM.half + 0.1 || Math.abs(z) > BEAM.w + 0.15)
        return null;
    if (Math.abs(y - beamY(th, x)) > 1.2)
        return null;
    return clamp(Math.round(x), -7, 7);
}
export function torque(arms, m, sx) {
    let t = m * sx;
    for (const a of arms)
        if (a !== null)
            t += a;
    return t;
}
export function tiltTarget(tau) {
    return clamp(Math.atan(tau / K_TILT), -MAX_TILT, MAX_TILT);
}
/** Lò xo tắt dần tới θ đích (≈ 0,6 s tới gần đủ) */
export function tiltStep(th, target, dt) {
    return th + (target - th) * (1 - Math.exp(-dt / 0.22));
}
export const levelTol = (st) => (st.sg === 1 ? 1 : 0.5);
/** Mục tiêu màn đã đạt (chưa tính thời gian giữ) */
export function bGoal(st) {
    if (st.cat)
        return st.cat.sw[0] && st.cat.sw[1];
    if (Math.abs(st.tau) >= levelTol(st))
        return false;
    if (st.sg === 0)
        return true;
    return st.arms.every((a) => a !== null && a >= 5);
}
export function bTick(st, pos, dt) {
    st.arms = st.arms.map((_, i) => {
        const p = pos[i];
        return p ? armOf(st.th, p[0], p[1], p[2]) : null;
    });
    st.tau = torque(st.arms, st.m, st.sx);
    st.th = tiltStep(st.th, tiltTarget(st.tau), dt);
    if (Math.abs(st.th) < 1e-4)
        st.th = 0;
    st.hold = bGoal(st) ? st.hold + dt * 1000 : 0;
}
export const B_HOLD = 2000;
export const bClear = (st) => st.hold >= B_HOLD;
export function bProgress(st) {
    if (st.cat) {
        const c = st.cat;
        return Math.round(((c.sw[0] ? 0.4 : 0) + (c.sw[1] ? 0.4 : 0) + Math.min(1, c.best / SW_H[1]) * 0.2) * 20) / 20;
    }
    const lv = clamp(1 - Math.abs(st.tau) / (st.m * 7 + 7), 0, 1);
    if (st.sg === 0)
        return Math.round(lv * 20) / 20;
    const right = st.arms.filter((a) => a !== null && a >= 5).length / st.arms.length;
    return Math.round((lv * 0.4 + right * 0.6) * 20) / 20;
}
/** Đẩy đá (màn 2): phải đứng cạnh đá (≤ 1,7 m), đẩy XA mình 1 khắc; nghỉ 350 ms giữa hai lần */
export function bPush(st, px, pz, now) {
    if (!st.mov || now - st.pushAt < 350)
        return false;
    if (Math.hypot(px - st.sx, pz - STONE_Z) > 1.9)
        return false;
    const dir = px <= st.sx ? 1 : -1;
    const nx = clamp(st.sx + dir, -7, 7);
    if (nx === st.sx)
        return false;
    st.sx = nx;
    st.pushAt = now;
    st.pushes++;
    return true;
}
/** Mặt đất phòng Cân: bệ trái (xuất phát), đòn, bệ phải (lối ra); còn lại là vực. Màn 3 (sg = 2): sân máy bắn đá */
export function bGround(th, x, z, sg = 0) {
    if (sg === 2)
        return cGround(x, z);
    if (Math.abs(x) <= BEAM.half && Math.abs(z) <= BEAM.w)
        return beamY(th, x);
    if (Math.abs(x) >= PLAT.x0 && Math.abs(x) <= PLAT.x1 && Math.abs(z) <= PLAT.w)
        return BEAM.y;
    // khe giữa đầu đòn và bệ: lấy mặt gần nhất (không rơi qua khe)
    if (Math.abs(x) > BEAM.half && Math.abs(x) < PLAT.x0 && Math.abs(z) <= BEAM.w)
        return Math.max(BEAM.y, beamY(th, Math.sign(x) * BEAM.half));
    return CHASM_Y;
}
export function bBlocked(th, x, z, y, sg = 0) {
    // không bước ra vực (mép đòn, mép bệ); màn 3: thân tháp gió chắn
    if (sg === 2 && Math.hypot(x - TOWER.x, z - TOWER.z) < TOWER.r && y < CAT.top)
        return true;
    return bGround(th, x, z, sg) === CHASM_Y;
}
/** Hướng trượt trên đòn khi nghiêng quá 6° (−1 trái, 1 phải, 0 không trượt) */
export function slideDir(th) {
    return Math.abs(th) > SLIDE_FROM ? Math.sign(th) : 0;
}
export function slideSpeed(th) {
    return Math.abs(th) > SLIDE_FROM ? Math.min(3, ((Math.abs(th) - SLIDE_FROM) / (MAX_TILT - SLIDE_FROM)) * 3 + 0.6) : 0;
}
// ───────────── Màn 3: máy bắn đá (bập bênh dưới tháp gió) ─────────────
/** trọng lực thường (bay lên) và khi bổ nhào — đúng hằng số của Player (scene/Hub.tsx) */
export const G_UP = 22;
export const G_PLUNGE = 40;
/** sân máy bắn (mặt y = BEAM.y), phía sau đòn cân, cách vực */
export const COURT = { x0: -9, x1: 7, z0: -16, z1: -6 };
/**
 * Bập bênh dọc trục x tại z: bệ đáp (đầu ngắn) ở padX, ghế bắn (đầu dài) ở seatX; mặt trên y. Cột gió trên bệ đáp
 * cao `up` m (đỉnh = top), bán kính upR.
 */
export const CAT = { z: -11, padX: -2.5, seatX: 2.5, half: 3.1, w: 1.0, y: BEAM.y + 0.6, padR: 1.2, seatR: 1.1, up: 10, upR: 1.3, top: BEAM.y + 0.6 + 10 };
/** thân tháp gió (đứng cạnh đầu ngắn) */
export const TOWER = { x: -4.9, z: -11, r: 0.85 };
/** cần gạt dời điểm tựa (người vận hành đứng trong r) */
export const LEVER = { x: 0, z: -8.4, r: 2.0 };
/** ba ổ điểm tựa: tỉ số d₂/d₁ (ổ 0 gần ghế, ổ 1 giữa, ổ 2 XA ghế) */
export const SOCKETS = [Math.SQRT1_2, 1, Math.SQRT2];
/** chuông A / B: độ cao bay (m, tính từ mặt ghế) */
export const SW_H = [4.5, 9];
/** chạm chuông: vòng chuông dày + người có chiều cao → tính là tới khi bay ≥ SW_H − 0,2 m (độ rơi thật của người ≈ 9,7–10,8 m) */
export const SW_TOL = 0.2;
/** độ rơi tối đa được tính (đỉnh cột gió + chỗ vọt quá khi lượn) — kẹp, không thưởng thêm */
export const FALL_MAX = 10.8;
export const VY_MAX = Math.sqrt(2 * G_PLUNGE * FALL_MAX);
/** chạm cùng lúc = trong 250 ms; chạm trễ (≤ 700 ms sau cú bắn) bị phí; bổ nhào phải bắt đầu trong cột gió ≤ 3 s trước */
export const GROUP_MS = 250;
export const LATE_MS = 700;
export const UP_MS = 3000;
/** Tiếng Vọng bổ nhào lúc GO: chạm bệ sau 500 ms (≈ phản xạ + thời gian rơi của người thật) */
export const ECHO_PLUNGE_MS = 500;
export function cInit(n) {
    return { sock: 1, sw: [false, false], up: Array.from({ length: n }, () => -1e12), last: Array.from({ length: n }, () => -1e12), grp: null, ep: [], launch: null, best: 0, tries: 0 };
}
/** cánh tay đòn: d₁ (bệ đáp → điểm tựa), d₂ (điểm tựa → ghế); d₁ + d₂ = khoảng cách bệ – ghế; fx = x của điểm tựa */
export function catArms(sock) {
    const L = CAT.seatX - CAT.padX;
    const r = SOCKETS[clamp(Math.round(sock), 0, SOCKETS.length - 1)];
    const d1 = L / (1 + r);
    return { d1, d2: L - d1, fx: CAT.padX + d1 };
}
/** Va chạm không đàn hồi quanh trục: mô-men động lượng trước = sau → vận tốc ở ghế */
export function catapultV(m1, v1, d1, d2, m2) {
    const I = m1 * d1 * d1 + m2 * d2 * d2;
    return I > 0 ? (m1 * v1 * d1 * d2) / I : 0;
}
/** vận tốc chạm khi rơi h (trọng lực bổ nhào), độ cao bay lên với vận tốc v (trọng lực thường) */
export const fallV = (h) => Math.sqrt(2 * G_PLUNGE * clamp(h, 0, FALL_MAX));
export const launchH = (v) => (v * v) / (2 * G_UP);
/** Một cú bắn: n người cùng rơi h₁ ở ổ sock → độ cao bay (m) */
export function shotH(n, h1, sock) {
    const { d1, d2 } = catArms(sock);
    return launchH(catapultV(n, fallV(h1), d1, d2, 1));
}
export const onPad = (x, z) => Math.hypot(x - CAT.padX, z - CAT.z) <= CAT.padR;
export const onSeat = (x, y, z) => Math.hypot(x - CAT.seatX, z - CAT.z) <= CAT.seatR && Math.abs(y - CAT.y) < 1.2;
/** ở cao trong cột gió (đủ để tính là "bổ nhào từ tháp") */
export const inUpdraft = (x, y, z) => Math.hypot(x - CAT.padX, z - CAT.z) < CAT.upR + 0.4 && y > CAT.y + 2.5;
/** Mặt đất sân máy bắn: bập bênh (cố định khi đứng — chỉ nghiêng để nhìn lúc bắn), sân, còn lại vực */
export function cGround(x, z) {
    if (Math.abs(x) <= CAT.half && Math.abs(z - CAT.z) <= CAT.w)
        return CAT.y;
    if (x >= COURT.x0 && x <= COURT.x1 && z >= COURT.z0 && z <= COURT.z1)
        return BEAM.y;
    return CHASM_Y;
}
/** Ghi nhận ai đang ở cao trong cột gió (gọi mỗi nhịp với vị trí đã biết) */
export function cTrack(c, pos, now) {
    pos.forEach((p, i) => {
        if (p && i < c.up.length && inUpdraft(p[0], p[1], p[2]))
            c.up[i] = now;
    });
}
/**
 * Cú chạm bệ do client gửi (ghế seat, vy = √(2·40·độ rơi)) — hoặc của Tiếng Vọng (echo = true, bỏ kiểm vị trí).
 * Kiểm: đứng trên bệ đáp (≤ 1,2 m), đã ở cao trong cột gió ≤ 3 s trước, vy ≤ √(2·40·FALL_MAX) + 1, nghỉ 600 ms.
 * Trả về "ok" (vào nhóm), "late" (trễ — phí), "" (sai luật / rác).
 */
export function cClaim(c, seat, vy, pos, now, echo = false) {
    if (!Number.isInteger(seat) || seat < 0 || seat >= c.up.length)
        return "";
    if (typeof vy !== "number" || !Number.isFinite(vy))
        return "";
    const v = Math.abs(vy);
    if (v > VY_MAX + 1 || v < 1)
        return "";
    if (!echo) {
        if (!pos || !onPad(pos[0], pos[2]) || pos[1] < CAT.y - 0.4)
            return "";
        if (now - c.up[seat] > UP_MS)
            return "";
        if (now - c.last[seat] < 600)
            return "";
    }
    if (c.grp?.imp.some((m) => m.s === seat))
        return "";
    c.last[seat] = now;
    c.up[seat] = -1e12;
    if ((c.launch && now >= c.launch.at && now - c.launch.at < LATE_MS) || (c.grp && now - c.grp.t0 > GROUP_MS))
        return "late";
    if (!c.grp)
        c.grp = { t0: now, imp: [] };
    c.grp.imp.push({ s: seat, v: Math.min(v, VY_MAX), at: now });
    return "ok";
}
/** Đóng nhóm (≥ 250 ms sau cú chạm đầu) → tính cú bắn. pos = vị trí mọi ghế (tìm người đứng trên ghế bắn). */
export function cResolve(c, pos, now) {
    const g = c.grp;
    if (!g || now - g.t0 < GROUP_MS)
        return null;
    c.grp = null;
    const imp = g.imp.filter((m) => m.at - g.t0 <= GROUP_MS);
    if (!imp.length)
        return null;
    // người được bắn: đứng trên ghế (không phải người vừa rơi), gần tâm ghế nhất; không ai → Quả cân Bổ đề
    let by = -1;
    let bd = Infinity;
    pos.forEach((p, i) => {
        if (!p || imp.some((m) => m.s === i) || !onSeat(p[0], p[1], p[2]))
            return;
        const d = Math.hypot(p[0] - CAT.seatX, p[2] - CAT.z);
        if (d < bd) {
            bd = d;
            by = i;
        }
    });
    const n = imp.length;
    const v1 = imp.reduce((s, m) => s + m.v, 0) / n;
    const { d1, d2 } = catArms(c.sock);
    const v = catapultV(n, v1, d1, d2, 1);
    const h = launchH(v);
    const a = c.sw[0];
    if (h >= SW_H[0] - SW_TOL)
        c.sw[0] = true;
    // chuông B bị niêm cho tới khi A đã kêu (từ cú TRƯỚC)
    if (a && h >= SW_H[1] - SW_TOL)
        c.sw[1] = true;
    const L = { by, v: Math.round(v * 100) / 100, h: Math.round(h * 100) / 100, n, h1: Math.round(((v1 * v1) / (2 * G_PLUNGE)) * 100) / 100, sock: c.sock, at: now };
    c.launch = L;
    c.best = Math.max(c.best, L.h);
    c.tries++;
    return L;
}
/** Dời điểm tựa (đứng ở cần gạt; không đổi giữa lúc đang có nhóm chạm) */
export function cSocket(c, i, px, pz) {
    if (!Number.isInteger(i) || i < 0 || i >= SOCKETS.length || i === c.sock || c.grp)
        return false;
    if (Math.hypot(px - LEVER.x, pz - LEVER.z) > LEVER.r)
        return false;
    c.sock = i;
    return true;
}

// ─────────── lib/world/vault/fourier.ts ───────────
/**
 * Hầm Bổ đề · Phòng V — Dàn hợp xướng Fourier (Ada Lovelace). Logic thuần.
 *
 * Ý toán: mọi sóng tuần hoàn là tổng các sóng sin (Fourier). Sóng vuông chỉ có hoạ âm LẺ (1, 1/3, 1/5, …) và
 * các góc luôn vọt lố ~9 % (hiện tượng Gibbs). Sóng ↔ phổ là hai cách nhìn cùng một vật.
 *
 * Luật chơi: mỗi ống k có một bệ; ĐỨNG trên bệ thì ống mới cất tiếng và mới xoay được núm biên độ a_k ∈ [−1, 1].
 * Sai số tính trong không gian hệ số (chính xác vì các sin trực giao):
 *   err = √Σ(a_k − t_k)² / √Σ t_k²      (ống không ai đứng = câm = a_k tính 0)
 * Xong màn khi err ≤ 0,10 giữ 2 giây.
 *  S1 "Lên dây": ống 1…N, một hỗn hợp đơn giản.
 *  S2 "Những ống lẻ": ống 1, 3, 5, 7 — sóng vuông.
 *  S3 "Nhạc trưởng": sóng răng cưa (1, −½, ⅓): CHỈ đứng trên bục Nhạc trưởng mới thấy phổ (cột hệ số);
 *     người thổi ống chỉ thấy hình sóng → Nhạc trưởng chỉ huy bằng ping giá trị (+, −, 0, đảo dấu).
 */

export const F_STAGES = 3;
export const ERR_OK = 0.1;
export const F_HOLD = 2000;
/** bán kính vòng bệ ống, bục nhạc trưởng */
export const PIPE_R = 7.2;
export const PODIUM = { x: 0, z: 8.2, r: 1.2 };
export const PEDESTAL_R = 1.05;
const T1 = [1, 1 / 2, -1 / 3, 1 / 4];
export function stageDef(stage, n) {
    const N = clamp(n, 2, 4);
    if (stage === 0) {
        const ks = Array.from({ length: N }, (_, i) => i + 1);
        return { ks, tg: T1.slice(0, N), cond: false };
    }
    if (stage === 1) {
        const ks = [1, 3, 5, 7].slice(0, N);
        return { ks, tg: ks.map((k) => 1 / k), cond: false };
    }
    const ks = N >= 4 ? [1, 2, 3] : Array.from({ length: N }, (_, i) => i + 1);
    return { ks, tg: ks.map((k) => (k % 2 ? 1 : -1) / k), cond: true };
}
export function fInit(stage, n) {
    const d = stageDef(stage, n);
    return { sg: stage, ks: d.ks, tg: d.tg, amp: d.ks.map(() => 0), on: d.ks.map(() => false), cond: d.cond, err: 1, hold: 0, turns: 0 };
}
/** Nấc của núm: 0, ±1/k (k = 1…8) và ±m/12 */
export const DETENTS = (() => {
    const s = new Set([0]);
    for (let k = 1; k <= 8; k++)
        s.add(Math.round((1 / k) * 1e6) / 1e6);
    for (let m = 1; m <= 12; m++)
        s.add(Math.round((m / 12) * 1e6) / 1e6);
    const pos = [...s].sort((a, b) => a - b);
    return [...pos.filter((v) => v > 0).map((v) => -v).reverse(), ...pos];
})();
export function snap(v) {
    if (!Number.isFinite(v))
        return 0;
    const c = clamp(v, -1, 1);
    let best = 0;
    for (const d of DETENTS)
        if (Math.abs(d - c) < Math.abs(best - c))
            best = d;
    return best;
}
/** Bước sang nấc kế bên (dir = +1 / −1) */
export function nudge(v, dir) {
    const i = DETENTS.indexOf(snap(v));
    return DETENTS[clamp(i + (dir > 0 ? 1 : -1), 0, DETENTS.length - 1)];
}
export function errOf(amp, tg) {
    let num = 0;
    let den = 0;
    for (let i = 0; i < tg.length; i++) {
        num += (amp[i] - tg[i]) ** 2;
        den += tg[i] ** 2;
    }
    return Math.sqrt(num) / Math.sqrt(den || 1);
}
/** Biên độ thực đang kêu (ống không ai đứng = 0) */
export const sounding = (st) => st.amp.map((a, i) => (st.on[i] ? a : 0));
/** Giá trị sóng tại pha x ∈ [0, 2π): Σ a_k sin(k x) */
export function sample(amps, ks, x) {
    let s = 0;
    for (let i = 0; i < ks.length; i++)
        s += amps[i] * Math.sin(ks[i] * x);
    return s;
}
/** Bệ của ống i (vòng cung phía bắc giếng, nhìn về tâm) */
export function pedestal(st, i) {
    const m = st.ks.length;
    const span = Math.min(Math.PI * 0.9, (m - 1) * 0.55);
    const a = -Math.PI / 2 + (m > 1 ? -span / 2 + (span * i) / (m - 1) : 0);
    return { x: Math.cos(a) * PIPE_R, z: Math.sin(a) * PIPE_R };
}
export function pedestalAt(st, x, z) {
    for (let i = 0; i < st.ks.length; i++) {
        const p = pedestal(st, i);
        if (Math.hypot(x - p.x, z - p.z) < PEDESTAL_R)
            return i;
    }
    return -1;
}
export const onPodium = (x, z) => Math.hypot(x - PODIUM.x, z - PODIUM.z) < PODIUM.r;
export function fTick(st, pos, dt) {
    st.on = st.ks.map(() => false);
    for (const p of pos) {
        if (!p)
            continue;
        const i = pedestalAt(st, p[0], p[2]);
        if (i >= 0)
            st.on[i] = true;
    }
    st.err = Math.round(errOf(sounding(st), st.tg) * 1000) / 1000;
    st.hold = st.err <= ERR_OK ? st.hold + dt * 1000 : 0;
}
export const fClear = (st) => st.hold >= F_HOLD;
export const fProgress = (st) => Math.round(clamp(1 - st.err, 0, 1) * 20) / 20;
/** Xoay núm: chỉ khi đứng trên đúng bệ ống đó */
export function fDial(st, i, v, px, pz) {
    if (!Number.isInteger(i) || i < 0 || i >= st.ks.length)
        return false;
    if (pedestalAt(st, px, pz) !== i)
        return false;
    const nv = snap(v);
    if (nv === st.amp[i])
        return false;
    st.amp[i] = nv;
    st.turns++;
    return true;
}
/** Mặt đất phòng Hợp xướng: sàn tròn r 12, giếng giữa r 3 (lan can) */
export const CHOIR_R = 12;
export function fBlocked(x, z) {
    const r = Math.hypot(x, z);
    return r > CHOIR_R - 0.5 || r < 3.2;
}

// ─────────── lib/world/vault/threshold.ts ───────────
/**
 * Hầm Bổ đề — Sảnh Ngưỡng cửa (hướng dẫn, ~90 s) và Cỗ máy Định lý (màn kết rút gọn). Logic thuần.
 *
 * Ngưỡng cửa, 3 nhịp:
 *  0. Mọi người đứng lên một ấn ký (mỗi ấn ký một người) → "ai cũng quan trọng".
 *  1. Hai dây chuông cách nhau 14 m phải kéo trong vòng 0,5 s → học nút "Đếm 3-2-1".
 *  2. Phiến đá ẩn: CHỈ người cầm đèn (ghế ●) thấy → phải PING cho người khác tới đứng → học ping + thông tin bất đối xứng.
 * Cỗ máy Định lý (rút gọn): N phiến quanh khối hai mươi mặt vỡ; mọi phiến có người đứng 3 s liền → Định lý phục hồi.
 */

export const HALL_R = 9;
export const SIGIL_R = 3.4;
export const ROPES = [
    [-7, 0],
    [7, 0],
];
export const RING_WINDOW = 500;
export const T_BEATS = 3;
export function sigil(n, i) {
    const a = (i / n) * Math.PI * 2 + Math.PI / 2;
    return [Math.cos(a) * SIGIL_R, Math.sin(a) * SIGIL_R];
}
export function tInit(n, seed) {
    const r = rng(seed ^ 0x51a7e);
    // phiến ẩn: nửa phía bắc, xa ấn ký và dây chuông
    const a = -Math.PI / 2 + (r() - 0.5) * 1.6;
    const d = 5.2 + r() * 1.6;
    return { beat: 0, sig: Array.from({ length: n }, () => -1), ring: [0, 0], plate: [Math.cos(a) * d, Math.sin(a) * d], on: -1, hold: 0 };
}
export function tTick(st, pos, dt) {
    const n = st.sig.length;
    st.sig = st.sig.map(() => -1);
    st.on = -1;
    pos.forEach((p, seat) => {
        if (!p || p[1] > 1.5)
            return;
        for (let i = 0; i < n; i++) {
            const [x, z] = sigil(n, i);
            if (Math.hypot(p[0] - x, p[2] - z) < 0.95 && st.sig[i] < 0)
                st.sig[i] = seat;
        }
        if (seat !== 0 && Math.hypot(p[0] - st.plate[0], p[2] - st.plate[1]) < 1.0)
            st.on = seat;
    });
    if (st.beat === 0) {
        st.hold = st.sig.every((s) => s >= 0) ? st.hold + dt * 1000 : 0;
        if (st.hold >= 800) {
            st.beat = 1;
            st.hold = 0;
        }
    }
    else if (st.beat === 2) {
        st.hold = st.on > 0 ? st.hold + dt * 1000 : 0;
        if (st.hold >= 800) {
            st.beat = 3;
            st.hold = 0;
        }
    }
}
/** Kéo dây chuông i: phải đứng sát dây (≤ 1,6 m) */
export function tRing(st, i, px, pz, now) {
    if (st.beat !== 1 || (i !== 0 && i !== 1))
        return false;
    if (Math.hypot(px - ROPES[i][0], pz - ROPES[i][1]) > 1.6)
        return false;
    st.ring[i] = now;
    const other = st.ring[1 - i];
    if (other && Math.abs(now - other) <= RING_WINDOW)
        st.beat = 2;
    return true;
}
export const ropeAt = (x, z) => ROPES.findIndex(([rx, rz]) => Math.hypot(x - rx, z - rz) < 1.6);
export const tClear = (st) => st.beat >= 3;
export const tProgress = (st) => clamp(st.beat / 3, 0, 1);
export function tBlocked(x, z) {
    return Math.hypot(x, z) > HALL_R - 0.4;
}
// ───────────── Cỗ máy Định lý (màn kết rút gọn) ─────────────
export const ENGINE_R = 5.2;
export const FIN_HOLD = 3000;
export function plate(n, i) {
    const a = (i / n) * Math.PI * 2 + Math.PI / 2;
    return [Math.cos(a) * ENGINE_R, Math.sin(a) * ENGINE_R];
}
export function eInit(n) {
    return { occ: Array.from({ length: n }, () => -1), hold: 0 };
}
export function eTick(st, pos, dt) {
    const n = st.occ.length;
    st.occ = st.occ.map(() => -1);
    pos.forEach((p, seat) => {
        if (!p)
            return;
        for (let i = 0; i < n; i++) {
            const [x, z] = plate(n, i);
            if (Math.hypot(p[0] - x, p[2] - z) < 1.0 && st.occ[i] < 0)
                st.occ[i] = seat;
        }
    });
    st.hold = st.occ.every((s) => s >= 0) ? st.hold + dt * 1000 : 0;
}
export const eClear = (st) => st.hold >= FIN_HOLD;
export const eProgress = (st) => Math.round((st.occ.filter((s) => s >= 0).length / st.occ.length) * 20) / 20;
export const ENGINE_FLOOR_R = 11;

// ─────────── lib/world/vault/run.ts ───────────
/**
 * Hầm Bổ đề (The Lemma Vaults) — một lượt chơi: ghế, pha, khoá N, ping, nói nhanh, đếm ngược chung, gợi ý 3 bậc,
 * bạn đồng hành "Tiếng Vọng" (chỉ làm theo ping, KHÔNG biết lời giải). Logic thuần, tất định theo (now, vị trí):
 *  - chơi một mình: client chạy trực tiếp (components/world/vault/vaultClient.ts);
 *  - tổ đội: realtime/vault.mjs (sinh từ các file này bằng scripts/gen-realtime.mjs) là trọng tài.
 * Thiết kế: docs/ai-reviews/game-3d/COOP_PUZZLE.md (§4 giao tiếp, §5 tổ đội, §6 gợi ý, §8 các phòng, §10 mạng).
 */





export const PLAN = ["threshold", "konigsberg", "balance", "fourier", "finale"];
export const STAGES = { threshold: 1, konigsberg: K_STAGES, balance: B_STAGES, fourier: F_STAGES, finale: 1 };
export const MAX_SEATS = 4;
/** Ghế: ký hiệu + màu (luôn đi cặp, an toàn cho người mù màu) */
export const GLYPHS = ["●", "▲", "■", "◆"];
export const SEAT_COLORS = ["#ffc94a", "#ff6f9f", "#4fd6ff", "#9be36a"];
/** Tiếng Vọng của ghế i (khoá tên) */
export const ECHOES = ["euler", "noether", "turing", "ada"];
/** Mã tổ đội: 4 ký tự từ bảng chữ không gây nhầm (không O/0, I/1, S/5, B/8, Z/2) */
export const CODE_ABC = "ACDEFHJKMNPRTUVWXY3479";
export const SAY_IDS = ["ready", "on3", "wait", "mine", "yourturn", "undo", "other", "count", "moreless", "balanced", "nice", "thanks", "k.odd", "k.spent", "b.out", "b.in", "f.loud", "f.flip"];
export const PING_KINDS = ["here", "go", "use", "val", "look", "avoid"];
const ECHO_SPEED = 4.2;
const GLIDE_SPEED = 6.5;
const CLEAR_MS = 2800;
const HINT_WINDOW = 5000;
const STUCK_OFFER = 90000;
const GRACE_MS = 120000;
export const chamberOf = (r) => PLAN[clamp(r.ch, 0, PLAN.length - 1)];
export const isComp = (s) => s.uid === null || !s.conn;
function newSeat(uid, name, conn) {
    return { uid, name, conn, ready: false, p: [0, 0, 0], yaw: 0, path: [], task: "", leftAt: 0, sc: { br: 0, push: 0, dial: 0, ring: 0, ping: 0, hold: 0 }, lastPing: -1e12, lastSay: -1e12, lastAsk: -1e12 };
}
export function newRun(code, seed, now, solo = false) {
    return {
        code,
        seed: seed >>> 0,
        solo,
        phase: "lobby",
        at: now,
        ch: 0,
        sg: 0,
        n: 0,
        seats: [],
        st: null,
        hint: { lv: 0, ask: 0, by: -1, best: 0, since: now, offer: false },
        count: { at: 0, by: -1, go: false },
        pings: [],
        ev: [],
        nid: 1,
        reset: [],
        t0: 0,
        hints: 0,
    };
}
export function validCode(c) {
    return typeof c === "string" && c.length === 4 && [...c].every((ch) => CODE_ABC.includes(ch));
}
export function makeCode(rand) {
    let s = "";
    for (let i = 0; i < 4; i++)
        s += CODE_ABC[Math.floor(rand() * CODE_ABC.length) % CODE_ABC.length];
    return s;
}
function push(r, k, by, s, now) {
    r.ev.push({ id: r.nid++, k, by, s, at: now });
    if (r.ev.length > 16)
        r.ev.splice(0, r.ev.length - 16);
}
const humans = (r) => r.seats.filter((s) => s.uid !== null);
const online = (r) => r.seats.filter((s) => s.uid !== null && s.conn);
// ───────────── Ghế ─────────────
/** Vào ghế: ghế theo uid (kết nối lại giữ ghế cũ); trước khi bắt đầu thì thêm ghế / thay Tiếng Vọng; đã chơi thì chỉ thay Tiếng Vọng hoặc ghế bỏ đi quá 120 s. */
export function seatJoin(r, uid, name, now) {
    const old = r.seats.findIndex((s) => s.uid === uid);
    if (old >= 0) {
        const s = r.seats[old];
        s.conn = true;
        s.name = name || s.name;
        s.path = [];
        s.task = "";
        push(r, "join", old, undefined, now);
        return old;
    }
    let i = r.seats.findIndex((s) => s.uid === null);
    if (i < 0 && r.phase !== "lobby")
        i = r.seats.findIndex((s) => s.uid !== null && !s.conn && now - s.leftAt > GRACE_MS);
    if (i < 0 && r.phase === "lobby" && r.seats.length < MAX_SEATS) {
        r.seats.push(newSeat(uid, name, true));
        i = r.seats.length - 1;
    }
    else if (i >= 0) {
        const keep = r.seats[i];
        r.seats[i] = { ...newSeat(uid, name, true), p: keep.p, yaw: keep.yaw, sc: keep.sc };
    }
    if (i >= 0)
        push(r, "join", i, undefined, now);
    return i;
}
export function seatLeave(r, uid, now) {
    const i = r.seats.findIndex((s) => s.uid === uid);
    if (i < 0)
        return;
    const s = r.seats[i];
    if (r.phase === "lobby") {
        r.seats.splice(i, 1);
        return;
    }
    s.conn = false;
    s.leftAt = now;
    s.ready = false;
    push(r, "left", i, undefined, now);
}
// ───────────── Pha + màn ─────────────
function enterStage(r, now) {
    const c = chamberOf(r);
    r.st = c === "threshold" ? tInit(r.n, r.seed) : c === "konigsberg" ? kInit(r.sg, r.n) : c === "balance" ? bInit(r.sg, r.n) : c === "fourier" ? fInit(r.sg, r.n) : eInit(r.n);
    r.phase = "play";
    r.at = now;
    r.hint = { lv: 0, ask: 0, by: -1, best: 0, since: now, offer: false };
    r.count = { at: 0, by: -1, go: false };
    r.pings = [];
    r.reset = [];
    r.seats.forEach((s, i) => {
        s.p = spawnFor(r, i);
        s.path = [];
        s.task = "";
        s.ready = false;
    });
    push(r, "stage", -1, `${r.ch}.${r.sg}`, now);
}
/** Bắt đầu lượt (khoá N = người + Tiếng Vọng, tối thiểu 2) */
export function startRun(r, now) {
    if (r.phase !== "lobby")
        return false;
    while (r.seats.length < 2)
        r.seats.push(newSeat(null, "@" + ECHOES[r.seats.length], true));
    r.n = clamp(r.seats.length, 2, MAX_SEATS);
    r.ch = 0;
    r.sg = 0;
    r.t0 = now;
    enterStage(r, now);
    return true;
}
export function addEcho(r) {
    if (r.phase !== "lobby" || r.seats.length >= MAX_SEATS)
        return false;
    r.seats.push(newSeat(null, "@" + ECHOES[r.seats.length], true));
    return true;
}
export function removeEcho(r) {
    if (r.phase !== "lobby")
        return false;
    for (let i = r.seats.length - 1; i >= 0; i--)
        if (r.seats[i].uid === null) {
            r.seats.splice(i, 1);
            r.seats.forEach((s, j) => s.uid === null && (s.name = "@" + ECHOES[j]));
            return true;
        }
    return false;
}
/** Nhảy thẳng tới phòng / màn (công cụ thử khi phát triển; server KHÔNG gọi) */
export function jumpTo(r, ch, sg, now) {
    if (r.phase === "lobby")
        startRun(r, now);
    r.ch = clamp(ch, 0, PLAN.length - 1);
    r.sg = clamp(sg, 0, STAGES[PLAN[r.ch]] - 1);
    enterStage(r, now);
}
/** Điểm xuất hiện của ghế i ở màn hiện tại (client dịch chuyển tới đây khi đổi màn) */
export function spawnFor(r, i) {
    const c = chamberOf(r);
    const n = Math.max(2, r.n || r.seats.length);
    const a = (i / n) * Math.PI * 2;
    if (c === "konigsberg" && r.st) {
        const g = graphById(r.st.g);
        return [g.look.x + Math.cos(a) * 1.6, LOOK_Y, g.look.z + Math.sin(a) * 1.6];
    }
    if (c === "balance" && r.sg === 2)
        return [-4.2 + (i % 2) * 1.4, BEAM.y, -6.9 - Math.floor(i / 2) * 1.3];
    if (c === "balance")
        return [-11.5 + (i % 2) * 1.4, BEAM.y, -1 + Math.floor(i / 2) * 1.6];
    if (c === "fourier")
        return [(i - (n - 1) / 2) * 1.5, 0, 10.2];
    if (c === "finale")
        return [(i - (n - 1) / 2) * 1.5, 0, 9];
    return [(i - (n - 1) / 2) * 1.4, 0, 4.6];
}
// ───────────── Mặt đất / va chạm theo phòng (client: Player; server: Tiếng Vọng) ─────────────
export function groundFor(r, x, z, y = 0) {
    const c = chamberOf(r);
    if (!r.st)
        return 0;
    if (c === "konigsberg")
        return kGround(graphById(r.st.g), x, z, y);
    if (c === "balance")
        return bGround(r.st.th, x, z, r.st.sg);
    return 0;
}
export function blockedFor(r, x, z, y) {
    const c = chamberOf(r);
    if (!r.st || r.phase === "lobby")
        return tBlocked(x, z);
    if (c === "konigsberg") {
        const st = r.st;
        return kBlocked(graphById(st.g), st.lit, x, z, y);
    }
    if (c === "balance")
        return bBlocked(r.st.th, x, z, y, r.st.sg);
    if (c === "fourier")
        return fBlocked(x, z);
    if (c === "finale")
        return Math.hypot(x, z) > ENGINE_FLOOR_R - 0.4 || Math.hypot(x, z) < 2.2;
    return tBlocked(x, z);
}
function progressOf(r) {
    const c = chamberOf(r);
    if (!r.st)
        return 0;
    if (c === "threshold")
        return tProgress(r.st);
    if (c === "konigsberg")
        return kProgress(r.st);
    if (c === "balance")
        return bProgress(r.st);
    if (c === "fourier")
        return fProgress(r.st);
    return eProgress(r.st);
}
function clearOf(r) {
    const c = chamberOf(r);
    if (!r.st)
        return false;
    if (c === "threshold")
        return tClear(r.st);
    if (c === "konigsberg")
        return kClear(r.st);
    if (c === "balance")
        return bClear(r.st);
    if (c === "fourier")
        return fClear(r.st);
    return eClear(r.st);
}
// ───────────── Tiếng Vọng ─────────────
function moveEcho(r, s, dt) {
    let budget = dt;
    while (budget > 1e-4 && s.path.length) {
        const w = s.path[0];
        const dx = w[0] - s.p[0];
        const dz = w[2] - s.p[2];
        const fy = Number.isFinite(w[1]);
        // điểm có độ cao cho trước (lượn / hạ xuống): đo khoảng cách 3 chiều
        const d = fy ? Math.hypot(dx, dz, w[1] - s.p[1]) : Math.hypot(dx, dz);
        const glide = fy && Math.abs(w[1] - s.p[1]) > 1.5;
        const sp = glide ? GLIDE_SPEED : ECHO_SPEED;
        const step = sp * budget;
        if (Math.hypot(dx, dz) > 1e-3)
            s.yaw = Math.atan2(dx, dz);
        if (d <= step) {
            s.p = [w[0], Number.isFinite(w[1]) ? w[1] : groundFor(r, w[0], w[2], s.p[1] + 0.6), w[2]];
            s.path.shift();
            budget -= d / sp;
        }
        else {
            const f = step / d;
            const ny = Number.isFinite(w[1]) ? s.p[1] + (w[1] - s.p[1]) * f : groundFor(r, s.p[0] + dx * f, s.p[2] + dz * f, s.p[1] + 0.6);
            s.p = [s.p[0] + dx * f, ny, s.p[2] + dz * f];
            budget = 0;
        }
    }
    // (Tiếng Vọng đang lơ lửng trên đỉnh cột gió chờ GO thì không dính đất)
    if (!s.path.length && chamberOf(r) === "balance" && s.task !== "plunge")
        s.p[1] = groundFor(r, s.p[0], s.p[2], s.p[1] + 0.6);
    s.p = [Math.round(s.p[0] * 100) / 100, Math.round(s.p[1] * 100) / 100, Math.round(s.p[2] * 100) / 100];
}
/** Đường vòng qua giếng giữa (phòng Hợp xướng) / bệ trung tâm (Cỗ máy) */
function around(from, x, z, rMin) {
    const out = [];
    const ax = from[0];
    const az = from[2];
    const dx = x - ax;
    const dz = z - az;
    const l2 = dx * dx + dz * dz || 1;
    const t = clamp(-(ax * dx + az * dz) / l2, 0, 1);
    const cx = ax + dx * t;
    const cz = az + dz * t;
    if (Math.hypot(cx, cz) < rMin) {
        const a0 = Math.atan2(az, ax);
        const a1 = Math.atan2(z, x);
        let da = a1 - a0;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        const rr = rMin + 1.4;
        for (const f of [0.33, 0.66])
            out.push([Math.cos(a0 + da * f) * rr, NaN, Math.sin(a0 + da * f) * rr]);
    }
    out.push([x, NaN, z]);
    return out;
}
/** Tiếng Vọng làm theo ping. Trả về khoá câu thoại (để hiện bong bóng) */
function obey(r, i, pg, now) {
    const s = r.seats[i];
    const c = chamberOf(r);
    if (c === "konigsberg" && r.st) {
        const st = r.st;
        const g = graphById(st.g);
        const tr = st.tr[i];
        const here = locate(g, s.p[0], s.p[1], s.p[2]);
        const tgt = locate(g, pg.x, Math.min(pg.y, 0.5), pg.z);
        // trên đài: lượn xuống đảo được chỉ
        if (here.k === "look" || here.k === "air" || tr.a < 0) {
            if (tgt.k !== "island")
                return "e.island";
            const I = g.islands[tgt.i];
            const dx = I.x - g.look.x;
            const dz = I.z - g.look.z;
            const L = Math.hypot(dx, dz) || 1;
            // lượn CAO tới trên đảo rồi mới hạ xuống (không lướt thấp qua cầu khác → không tính nhầm là đã đi qua)
            const tx = I.x - (dx / L) * I.r * 0.4;
            const tz = I.z - (dz / L) * I.r * 0.4;
            s.path = [
                [g.look.x + (dx / L) * 3.4, s.p[1], g.look.z + (dz / L) * 3.4],
                [tx, 3.4, tz],
                [tx, 0, tz],
            ];
            return "e.glide";
        }
        const at = tr.a;
        let e = -1;
        if (tgt.k === "bridge")
            e = tgt.e;
        else if (tgt.k === "island" && tgt.i !== at)
            e = g.bridges.findIndex((b, k) => st.lit[k] < 0 && ((b.a === at && b.b === tgt.i) || (b.b === at && b.a === tgt.i)));
        else
            return "e.where";
        if (e < 0)
            return "e.nobridge";
        const b = g.bridges[e];
        if (b.a !== at && b.b !== at)
            return "e.notend";
        if (st.lit[e] >= 0)
            return "e.spent";
        const geo = bridgeGeos(g)[e];
        const fwd = b.a === at;
        const pts = [];
        const I = g.islands[at];
        pts.push([I.x + (geo.pts[fwd ? 2 : geo.pts.length - 4] - I.x) * 0.5, 0, I.z + (geo.pts[fwd ? 3 : geo.pts.length - 3] - I.z) * 0.5]);
        for (let k = 1; k < geo.pts.length / 2 - 1; k++) {
            const j = fwd ? k : geo.pts.length / 2 - 1 - k;
            const t = j / (geo.pts.length / 2 - 1);
            pts.push([geo.pts[j * 2], deckY(geo, t), geo.pts[j * 2 + 1]]);
        }
        const J = g.islands[fwd ? b.b : b.a];
        pts.push([J.x, 0, J.z]);
        s.path = pts;
        return "e.cross";
    }
    if (c === "balance" && r.st && r.st.cat)
        return obeyCat(r, i, pg);
    if (c === "balance" && r.st) {
        const st = r.st;
        if (st.mov && Math.hypot(pg.x - st.sx, pg.z - STONE_Z) < 1.6) {
            // đẩy đá: đứng bên phải đá rồi đẩy về trái một khắc mỗi lần được ping
            const want = [Math.min(BEAM.half - 0.3, st.sx + 0.9), NaN, -0.5];
            if (Math.hypot(s.p[0] - want[0], s.p[2] - want[2]) < 0.6) {
                if (bPush(st, s.p[0], s.p[2], now))
                    s.sc.push++;
                return "e.push";
            }
            s.path = [want];
            return "e.tostone";
        }
        const arm = armOf(0, pg.x, beamY(0, pg.x), pg.z);
        if (arm !== null) {
            s.path = [[arm, NaN, 0]];
            return "e.notch";
        }
        s.path = [[clamp(pg.x, -14, 14), NaN, clamp(pg.z, -2.5, 2.5)]];
        return "e.ok";
    }
    if (c === "fourier" && r.st) {
        const st = r.st;
        if (pg.kind === "val" && typeof pg.t === "number") {
            const p = pedestal(st, pg.t);
            if (pedestalAt(st, s.p[0], s.p[2]) !== pg.t) {
                s.path = around(s.p, p.x, p.z, 3.4);
                return "e.topipe";
            }
            const v = st.amp[pg.t];
            st.amp[pg.t] = pg.v === "+" ? nudge(v, 1) : pg.v === "-" ? nudge(v, -1) : pg.v === "0" ? 0 : -v;
            s.sc.dial++;
            return "e.turn";
        }
        const pi = pedestalAt(st, pg.x, pg.z);
        if (pi >= 0) {
            const p = pedestal(st, pi);
            s.path = around(s.p, p.x, p.z, 3.4);
            return "e.topipe";
        }
        if (Math.hypot(pg.x - PODIUM.x, pg.z - PODIUM.z) < 1.6) {
            s.path = around(s.p, PODIUM.x, PODIUM.z, 3.4);
            return "e.podium";
        }
        s.path = around(s.p, pg.x, pg.z, 3.4);
        return "e.ok";
    }
    if (c === "threshold" && r.st) {
        const ri = ropeAt(pg.x, pg.z);
        if (ri >= 0) {
            s.path = [[ROPES[ri][0] * 0.9, NaN, ROPES[ri][1] + 0.6]];
            s.task = "ring";
            return "e.rope";
        }
        s.task = "";
        s.path = [[clamp(pg.x, -HALL_R + 1, HALL_R - 1), NaN, clamp(pg.z, -HALL_R + 1, HALL_R - 1)]];
        return "e.ok";
    }
    s.path = around(s.p, pg.x, pg.z, 2.4);
    return "e.ok";
}
/** Máy bắn đá: ping cần gạt = dời điểm tựa; ping bệ đáp / tháp = lên đỉnh cột gió chờ GO; ping ghế = ngồi ghế bắn */
function obeyCat(r, i, pg) {
    const s = r.seats[i];
    const cat = r.st.cat;
    if (Math.hypot(pg.x - LEVER.x, pg.z - LEVER.z) < 1.6) {
        s.task = "";
        if (Math.hypot(s.p[0] - LEVER.x, s.p[2] - LEVER.z) < LEVER.r - 0.3 && cSocket(cat, (cat.sock + 1) % 3, s.p[0], s.p[2])) {
            s.sc.push++;
            return "e.socket";
        }
        s.path = [[LEVER.x, NaN, LEVER.z + 0.8]];
        return "e.tolever";
    }
    if (Math.hypot(pg.x - CAT.padX, pg.z - CAT.z) < 1.8 || Math.hypot(pg.x - (CAT.padX - 2.4), pg.z - CAT.z) < 1.4) {
        // hai Tiếng Vọng cùng chờ: đứng lệch nhau trên bệ
        const k = r.seats.filter((o, j) => j !== i && o.task === "plunge").length;
        const z = CAT.z + (k % 2 ? 0.45 : -0.45);
        s.task = "plunge";
        s.path = [
            [CAT.padX, NaN, z],
            [CAT.padX, CAT.top, z],
        ];
        return "e.tower";
    }
    s.task = "";
    if (Math.hypot(pg.x - CAT.seatX, pg.z - CAT.z) < 1.5) {
        s.path = [[CAT.seatX, NaN, CAT.z]];
        return "e.seat";
    }
    s.path = [[clamp(pg.x, COURT.x0 + 0.5, COURT.x1 - 0.5), NaN, clamp(pg.z, COURT.z0 + 0.5, COURT.z1 - 0.5)]];
    return "e.ok";
}
/** Đóng nhóm cú chạm nếu đủ 250 ms → cú bắn (sự kiện + Tiếng Vọng được bắn bay lên rồi rơi về ghế) */
function catFlush(r, cat, now) {
    const L = cResolve(cat, r.seats.map((s) => s.p), now);
    if (!L)
        return;
    push(r, "launch", L.by, `${L.v}|${L.h}|${L.n}`, now);
    const s = L.by >= 0 ? r.seats[L.by] : null;
    if (s && isComp(s)) {
        s.task = "";
        s.path = [
            [s.p[0], CAT.y + L.h, s.p[2]],
            [s.p[0], CAT.y, s.p[2]],
        ];
    }
}
/** Một cú chạm bệ (người: từ động từ "plunge"; Tiếng Vọng: lúc tới hẹn) */
function catImpact(r, cat, seat, vy, pos, now, echo) {
    const res = cClaim(cat, seat, vy, pos, now, echo);
    if (!res)
        return false;
    push(r, res === "late" ? "late" : "plunge", seat, String(Math.round(Math.abs(vy) * 10) / 10), now);
    return true;
}
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);
/** Thực hiện động từ của ghế `seat` (pos = vị trí server biết của người gửi). true = trạng thái đổi. */
export function actRun(r, seat, a, now, pos) {
    const s = r.seats[seat];
    if (!s || !a || typeof a.k !== "string")
        return false;
    const c = chamberOf(r);
    switch (a.k) {
        case "start":
            if (r.phase !== "lobby")
                return false;
            if (online(r).length <= 1 || online(r).every((h) => h.ready || h === s))
                return startRun(r, now);
            return false;
        case "ready":
            if (r.phase !== "lobby" && r.phase !== "reveal")
                return false;
            s.ready = a.on !== false;
            if (r.phase === "reveal" && online(r).every((h) => h.ready))
                nextChamber(r, now);
            else if (r.phase === "lobby" && online(r).length > 1 && online(r).every((h) => h.ready))
                startRun(r, now);
            return true;
        case "fill":
            return addEcho(r);
        case "unfill":
            return removeEcho(r);
        case "ping": {
            if (r.phase !== "play" && r.phase !== "lobby")
                return false;
            const kind = String(a.kind);
            const x = num(a.x);
            const y = num(a.y);
            const z = num(a.z);
            if (!PING_KINDS.includes(kind) || ![x, y, z].every(Number.isFinite))
                return false;
            if (now - s.lastPing < 500)
                return false;
            if (pos && Math.hypot(pos[0] - x, pos[2] - z) > 60)
                return false;
            const mine = r.pings.filter((p) => p.by === seat);
            if (mine.length >= 3)
                r.pings.splice(r.pings.indexOf(mine[0]), 1);
            const pg = { id: r.nid++, by: seat, kind, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, z: Math.round(z * 100) / 100, until: now + 4000 };
            if (typeof a.v === "string" && ["+", "-", "0", "f"].includes(a.v))
                pg.v = a.v;
            const t = num(a.t);
            if (Number.isInteger(t) && t >= 0 && t < 64)
                pg.t = t;
            r.pings.push(pg);
            s.lastPing = now;
            s.sc.ping++;
            // Tiếng Vọng: ghế được chọn (to) hoặc Tiếng Vọng gần điểm ping nhất
            if (r.phase === "play") {
                const to = num(a.to);
                let e = Number.isInteger(to) && r.seats[to] && isComp(r.seats[to]) ? to : -1;
                if (e < 0) {
                    let bd = Infinity;
                    r.seats.forEach((o, j) => {
                        if (j === seat || !isComp(o))
                            return;
                        const d = Math.hypot(o.p[0] - x, o.p[2] - z);
                        if (d < bd) {
                            bd = d;
                            e = j;
                        }
                    });
                }
                if (e >= 0)
                    push(r, "echo", e, obey(r, e, pg, now), now);
            }
            return true;
        }
        case "say": {
            const id = String(a.id);
            if (!SAY_IDS.includes(id) || now - s.lastSay < 1000)
                return false;
            s.lastSay = now;
            push(r, "say", seat, id, now);
            if (id === "on3")
                startCount(r, seat, now);
            return true;
        }
        case "count":
            return startCount(r, seat, now);
        case "hint": {
            if (r.phase !== "play" || r.hint.lv >= 3 || r.hint.ask || now - s.lastAsk < 2000)
                return false;
            s.lastAsk = now;
            if (online(r).length <= 1)
                bumpHint(r, seat, now);
            else {
                r.hint.ask = now;
                r.hint.by = seat;
            }
            return true;
        }
        case "notyet":
            if (!r.hint.ask)
                return false;
            r.hint.ask = 0;
            push(r, "notyet", seat, undefined, now);
            return true;
        case "reset": {
            if (r.phase !== "play")
                return false;
            r.reset[seat] = now;
            const votes = r.seats.filter((o, j) => o.uid !== null && o.conn && now - (r.reset[j] || 0) < 5000).length;
            if (votes * 2 > online(r).length || online(r).length <= 1) {
                enterStage(r, now);
                push(r, "reset", seat, undefined, now);
            }
            return true;
        }
    }
    // ── động từ của từng phòng ──
    if (r.phase !== "play" || !r.st || !pos)
        return false;
    if (c === "konigsberg" && a.k === "rewind") {
        kRewind(r.st, seat);
        push(r, "tp", seat, "look", now);
        return true;
    }
    if (c === "balance" && (a.k === "plunge" || a.k === "socket")) {
        const cat = r.st.cat;
        if (!cat)
            return false;
        if (a.k === "socket") {
            const i = num(a.i);
            const ok = cSocket(cat, Number.isInteger(i) ? i : (cat.sock + 1) % 3, pos[0], pos[2]);
            if (ok)
                s.sc.push++;
            return ok;
        }
        return catImpact(r, cat, seat, num(a.vy), pos, now, false);
    }
    if (c === "balance" && a.k === "push") {
        const ok = bPush(r.st, pos[0], pos[2], now);
        if (ok)
            s.sc.push++;
        return ok;
    }
    if (c === "fourier" && a.k === "dial") {
        const ok = fDial(r.st, num(a.i), num(a.v), pos[0], pos[2]);
        if (ok)
            s.sc.dial++;
        return ok;
    }
    if (c === "threshold" && a.k === "ring") {
        const i = ropeAt(pos[0], pos[2]);
        const ok = i >= 0 && tRing(r.st, i, pos[0], pos[2], now);
        if (ok) {
            s.sc.ring++;
            push(r, "ring", seat, String(i), now);
        }
        return ok;
    }
    return false;
}
function startCount(r, seat, now) {
    if (r.count.at && now < r.count.at + 1200)
        return false;
    r.count = { at: now + 3000, by: seat, go: false };
    push(r, "count", seat, undefined, now);
    return true;
}
function bumpHint(r, seat, now) {
    r.hint.lv = Math.min(3, r.hint.lv + 1);
    r.hint.ask = 0;
    r.hint.by = seat;
    r.hints++;
    push(r, "hint", seat, String(r.hint.lv), now);
}
function nextChamber(r, now) {
    r.ch++;
    r.sg = 0;
    if (r.ch >= PLAN.length) {
        r.phase = "done";
        r.at = now;
        return;
    }
    enterStage(r, now);
}
// ───────────── Nhịp 10 Hz ─────────────
/** ext[i] = vị trí do client của ghế i gửi (null nếu không có / mất kết nối) */
export function tickRun(r, ext, now, dt) {
    dt = clamp(dt, 0, 0.25);
    const pos = r.seats.map((s, i) => {
        if (!isComp(s)) {
            const p = ext[i];
            if (p)
                s.p = [p[0], p[1], p[2]];
            return p ?? null;
        }
        if (r.phase === "play")
            moveEcho(r, s, dt);
        return s.p;
    });
    r.pings = r.pings.filter((p) => p.until > now);
    // hết hạn chờ "Chưa cần" → gợi ý bậc kế
    if (r.hint.ask && now - r.hint.ask >= HINT_WINDOW)
        bumpHint(r, r.hint.by, now);
    if (r.phase === "lobby" || r.phase === "reveal" || r.phase === "done" || !r.st)
        return;
    if (r.phase === "clear") {
        if (now - r.at >= CLEAR_MS) {
            const c = chamberOf(r);
            if (r.sg + 1 < STAGES[c]) {
                r.sg++;
                enterStage(r, now);
            }
            else if (c === "threshold")
                nextChamber(r, now);
            else if (c === "finale") {
                r.phase = "done";
                r.at = now;
                push(r, "done", -1, undefined, now);
            }
            else {
                r.phase = "reveal";
                r.at = now;
                r.seats.forEach((s) => (s.ready = false));
                if (online(r).length === 0)
                    nextChamber(r, now);
            }
        }
        return;
    }
    const c = chamberOf(r);
    // đếm ngược tới GO: Tiếng Vọng đang được giao kéo dây thì kéo đúng lúc
    if (r.count.at && !r.count.go && now >= r.count.at) {
        r.count.go = true;
        r.seats.forEach((s, i) => {
            if (!isComp(s) || s.task !== "ring" || c !== "threshold")
                return;
            const ri = ropeAt(s.p[0], s.p[2]);
            if (ri >= 0 && tRing(r.st, ri, s.p[0], s.p[2], now)) {
                s.sc.ring++;
                push(r, "ring", i, String(ri), now);
            }
        });
        // máy bắn đá: Tiếng Vọng đang chờ trên đỉnh cột gió bổ nhào theo GO
        const cat = c === "balance" ? r.st.cat : null;
        if (cat)
            r.seats.forEach((s, i) => {
                if (isComp(s) && s.task === "plunge" && !s.path.length && onPad(s.p[0], s.p[2]) && s.p[1] > CAT.top - 1.5)
                    cat.ep.push({ s: i, at: r.count.at + ECHO_PLUNGE_MS });
            });
    }
    if (c === "threshold")
        tTick(r.st, pos, dt);
    else if (c === "konigsberg") {
        const st = r.st;
        pos.forEach((p, i) => {
            if (!p)
                return;
            const e = kStep(st, i, p[0], p[1], p[2]);
            if (e >= 0) {
                r.seats[i].sc.br++;
                push(r, "lit", i, String(e), now);
            }
        });
    }
    else if (c === "balance") {
        const st = r.st;
        bTick(st, pos, dt);
        const cat = st.cat;
        if (cat) {
            cTrack(cat, pos, now);
            // Tiếng Vọng tới hẹn: rơi xuống bệ (chạm lúc đã hẹn) rồi lại bay lên đỉnh chờ lượt sau
            for (const e of cat.ep.filter((q) => q.at <= now)) {
                const s = r.seats[e.s];
                if (!s || !isComp(s) || s.task !== "plunge")
                    continue;
                const fall = s.p[1] - CAT.y;
                s.p = [s.p[0], CAT.y, s.p[2]];
                catImpact(r, cat, e.s, fallV(fall), null, e.at, true);
                s.path = [[s.p[0], CAT.top, s.p[2]]];
            }
            cat.ep = cat.ep.filter((q) => q.at > now);
            catFlush(r, cat, now);
        }
    }
    else if (c === "fourier")
        fTick(r.st, pos, dt);
    else
        eTick(r.st, pos, dt);
    // gợi ý: theo dõi tiến độ để biết đội đang kẹt bao lâu
    const p = progressOf(r);
    if (p > r.hint.best + 1e-6) {
        r.hint.best = p;
        r.hint.since = now;
    }
    const attempts = c === "konigsberg" ? r.st.rew : 0;
    r.hint.offer = r.hint.lv === 0 && (now - r.hint.since > STUCK_OFFER || attempts >= 3);
    if (clearOf(r)) {
        r.phase = "clear";
        r.at = now;
        if (c === "balance" || c === "finale")
            pos.forEach((q, i) => q && r.seats[i].sc.hold++);
        push(r, "clear", -1, `${r.ch}.${r.sg}`, now);
    }
}
/** Ghế đang thắt nút (Königsberg) — để hiện nút thắt + gợi ý tua lại */
export function stuckSeats(r) {
    if (chamberOf(r) !== "konigsberg" || !r.st)
        return [];
    return r.seats.map((_, i) => i).filter((i) => kStuck(r.st, i));
}
/** Bản gửi qua mạng: bỏ uid (không lộ định danh), làm tròn số */
export function packRun(r) {
    return {
        ...r,
        // vị trí người đang kết nối đã có trong ảnh chụp p → bỏ ở đây (trạng thái không đổi mỗi khi ai đó bước đi)
        seats: r.seats.map((s) => ({ h: s.uid !== null, name: s.name, conn: s.conn, ready: s.ready, p: s.uid !== null && s.conn ? null : s.p, yaw: Math.round(s.yaw * 100) / 100, task: s.task, sc: s.sc, busy: s.path.length > 0 })),
        st: r.st && chamberOf(r) === "balance" ? { ...r.st, th: Math.round(r.st.th * 10000) / 10000, tau: Math.round(r.st.tau * 100) / 100 } : r.st,
    };
}
