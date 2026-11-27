"use client";
/**
 * Màn chờ khi tải / dựng thế giới hoặc nhân vật — thay cho màn hình trống:
 *  • một đồ chơi toán – vật lý CHẠM VÀO ĐƯỢC (canvas 2D, cộng sáng): vẽ bằng vòng tròn Fourier, con lắc kép hỗn loạn,
 *    bảng Galton → đường chuông, kim Buffon ước lượng π, xoắn Ulam số nguyên tố, harmonograph (con lắc vẽ hình);
 *  • thẻ "Bạn có biết?" đổi mỗi 7 giây; thanh tiến độ ghi rõ đang tải gì (mô hình 3D / nhân vật / hoạ tiết…).
 * Chỉ "lên dây" khi vừa vào game, đổi thế giới hoặc đổi nhân vật — tải lặt vặt giữa trận (người chơi khác vào) không bật màn chờ.
 * Hiện khi việc tải kéo dài > 0,3 s; đã hiện thì ở lại tối thiểu 1,6 s rồi mờ dần.
 */
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useProgress } from "@react-three/drei";
import { CURVES, FACTS, buffonHit, buffonPi, dft, epicycleAt, galtonBin, pendStep, sampleCurve, sieve, ulam, type CurveId, type Epicycle, type Pend } from "@/lib/world/loadToys";
import { useWorld } from "../store";
import { TITLES } from "./AreaTitle";

type L = { vi: string; en: string };
interface Toy {
  title: L;
  desc: L;
  hint: L;
  step(g: CanvasRenderingContext2D, W: number, H: number, dt: number): void;
  tap(x: number, y: number, W: number, H: number): void;
  /** số liệu sống hiện dưới tên (vd. ước lượng π) */
  stat?(): string;
}
const rnd = Math.random;
const fade = (g: CanvasRenderingContext2D, W: number, H: number, a: number) => {
  g.globalCompositeOperation = "source-over";
  g.fillStyle = `rgba(8,6,22,${a})`;
  g.fillRect(0, 0, W, H);
};

function fourierToy(): Toy {
  let ci = 0;
  let E: Epicycle[] = [];
  let t = 0;
  let path: [number, number][] = [];
  const load = (id: CurveId) => {
    E = dft(sampleCurve(id, 160)).slice(0, 60);
    t = 0;
    path = [];
  };
  load(CURVES[0]);
  return {
    title: { vi: "Vẽ bằng vòng tròn quay", en: "Drawing with spinning circles" },
    desc: { vi: "Mọi nét vẽ khép kín = tổng các vòng tròn quay đều (chuỗi Fourier). Đây là 60 vòng, vòng to quay chậm, vòng nhỏ quay nhanh.", en: "Any closed drawing = a sum of steadily spinning circles (a Fourier series). Here are 60: big ones turn slowly, small ones fast." },
    hint: { vi: "Chạm để đổi hình", en: "Tap for another shape" },
    step(g, W, H, dt) {
      fade(g, W, H, 1);
      const S = Math.min(W, H) * 0.36;
      const cx = W / 2;
      const cy = H / 2;
      t = (t + dt * 0.11) % 1;
      let x = 0;
      let y = 0;
      g.lineWidth = 1;
      for (const e of E) {
        const r = e.amp * S;
        const a = 2 * Math.PI * e.freq * t + e.phase;
        g.strokeStyle = "rgba(160,190,255,0.22)";
        g.beginPath();
        g.arc(cx + x, cy - y, r, 0, Math.PI * 2);
        g.stroke();
        const nx = x + r * Math.cos(a);
        const ny = y + r * Math.sin(a);
        g.strokeStyle = "rgba(255,230,170,0.55)";
        g.beginPath();
        g.moveTo(cx + x, cy - y);
        g.lineTo(cx + nx, cy - ny);
        g.stroke();
        x = nx;
        y = ny;
      }
      path.push([x, y]);
      if (path.length > 400) path.shift();
      g.globalCompositeOperation = "lighter";
      g.strokeStyle = "#ffd27a";
      g.lineWidth = 2.5;
      g.shadowColor = "#ffb347";
      g.shadowBlur = 14;
      g.beginPath();
      path.forEach(([px, py], i) => (i ? g.lineTo(cx + px, cy - py) : g.moveTo(cx + px, cy - py)));
      g.stroke();
      g.shadowBlur = 0;
      const [hx, hy] = epicycleAt(E, t);
      g.fillStyle = "#fff";
      g.beginPath();
      g.arc(cx + hx * S, cy - hy * S, 3, 0, Math.PI * 2);
      g.fill();
    },
    tap() {
      ci = (ci + 1) % CURVES.length;
      load(CURVES[ci]);
    },
  };
}

function pendulumToy(): Toy {
  const COL = ["#ffd27a", "#8dffd2", "#ff8fd0"];
  let P: Pend[] = [];
  let trails: [number, number][][] = [];
  const reset = (a: number, b: number) => {
    P = COL.map((_, i) => [a + i * 1e-4, b, 0, 0] as Pend);
    trails = COL.map(() => []);
  };
  reset(2.4, 2.9);
  return {
    title: { vi: "Con lắc kép — hỗn loạn", en: "Double pendulum — chaos" },
    desc: { vi: "Ba con lắc thả lệch nhau chỉ 0,0001 rad. Vài giây đầu chúng như một — rồi mỗi con một ngả. Định luật Newton hoàn toàn xác định, nhưng không đoán trước được.", en: "Three pendulums released only 0.0001 rad apart. For a few seconds they move as one — then each goes its own way. Newton's laws are fully deterministic, yet unpredictable." },
    hint: { vi: "Chạm để thả lại từ góc khác", en: "Tap to release from another angle" },
    step(g, W, H, dt) {
      fade(g, W, H, 0.22);
      const cx = W / 2;
      const cy = H * 0.42;
      const Lp = Math.min(W, H) * 0.2;
      g.globalCompositeOperation = "lighter";
      P.forEach((s, i) => {
        for (let k = 0; k < 8; k++) pendStep(s, Math.min(dt, 0.04) / 8);
        const x1 = cx + Lp * Math.sin(s[0]);
        const y1 = cy + Lp * Math.cos(s[0]);
        const x2 = x1 + Lp * Math.sin(s[1]);
        const y2 = y1 + Lp * Math.cos(s[1]);
        trails[i].push([x2, y2]);
        if (trails[i].length > 260) trails[i].shift();
        g.strokeStyle = COL[i];
        g.globalAlpha = 0.5;
        g.lineWidth = 1.6;
        g.beginPath();
        trails[i].forEach(([x, y], j) => (j ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.stroke();
        g.globalAlpha = 0.9;
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(x1, y1);
        g.lineTo(x2, y2);
        g.stroke();
        g.fillStyle = COL[i];
        g.shadowColor = COL[i];
        g.shadowBlur = 12;
        g.beginPath();
        g.arc(x2, y2, 5, 0, Math.PI * 2);
        g.fill();
        g.shadowBlur = 0;
      });
      g.globalAlpha = 1;
    },
    tap(x, y, W, H) {
      reset(((x / W) * 2 - 1) * 3, ((y / H) * 2 - 1) * 3 + 0.5);
    },
  };
}

function galtonToy(): Toy {
  const ROWS = 12;
  const bins = new Array(ROWS + 1).fill(0);
  type Ball = { k: number; row: number; f: number; x: number; right: number; bin: number };
  const balls: Ball[] = [];
  let spawn = 0;
  let total = 0;
  const add = () => {
    const bin = galtonBin(rnd, ROWS);
    balls.push({ k: 0, row: 0, f: 0, x: 0, right: 0, bin });
  };
  return {
    title: { vi: "Bảng Galton — đường chuông từ ngẫu nhiên", en: "Galton board — a bell curve from chance" },
    desc: { vi: "Mỗi viên bi qua 12 hàng đinh, mỗi lần nảy trái hay phải 50 : 50. Từng viên không đoán được — nhưng cả ngàn viên luôn xếp thành đường chuông (định lý giới hạn trung tâm).", en: "Each ball passes 12 rows of pegs, bouncing left or right 50 : 50. No single ball is predictable — but thousands always pile into a bell curve (central limit theorem)." },
    hint: { vi: "Chạm để thả thêm 60 viên", en: "Tap to drop 60 more" },
    stat: () => `${total}`,
    step(g, W, H, dt) {
      fade(g, W, H, 1);
      spawn += dt * 22;
      while (spawn > 1) {
        spawn--;
        add();
      }
      const top = H * 0.1;
      const rowH = (H * 0.5) / ROWS;
      const gap = Math.min(W * 0.06, rowH * 1.1);
      const cx = W / 2;
      g.fillStyle = "rgba(190,170,255,0.55)";
      for (let r = 0; r < ROWS; r++)
        for (let i = 0; i <= r; i++) {
          g.beginPath();
          g.arc(cx + (i - r / 2) * gap, top + r * rowH + rowH, 2.2, 0, Math.PI * 2);
          g.fill();
        }
      const base = top + ROWS * rowH + rowH * 1.5;
      const maxB = Math.max(8, ...bins);
      // cột + đường chuông lý thuyết
      for (let i = 0; i <= ROWS; i++) {
        const h = (bins[i] / maxB) * (H - base - 12);
        g.fillStyle = "rgba(127,227,255,0.55)";
        g.fillRect(cx + (i - ROWS / 2) * gap - gap * 0.4, H - 8 - h, gap * 0.8, h);
      }
      if (total > 30) {
        const sd = Math.sqrt(ROWS / 4);
        const peak = total / (sd * Math.sqrt(2 * Math.PI));
        g.strokeStyle = "#ffd27a";
        g.lineWidth = 2;
        g.beginPath();
        for (let u = 0; u <= 120; u++) {
          const k = (u / 120) * ROWS;
          const v = (total / (sd * Math.sqrt(2 * Math.PI))) * Math.exp(-((k - ROWS / 2) ** 2) / (2 * sd * sd));
          const xx = cx + (k - ROWS / 2) * gap;
          const yy = H - 8 - (v / Math.max(maxB, peak)) * (H - base - 12) * (maxB >= peak ? 1 : maxB / peak);
          if (u) g.lineTo(xx, yy);
          else g.moveTo(xx, yy);
        }
        g.stroke();
      }
      g.globalCompositeOperation = "lighter";
      for (let i = balls.length - 1; i >= 0; i--) {
        const b = balls[i];
        b.f += dt * 7;
        while (b.f >= 1 && b.row < ROWS) {
          b.f -= 1;
          // đi đúng đường dẫn tới ô đã bốc thăm (rẽ phải đúng b.bin lần trong 12 hàng)
          const need = b.bin - b.right;
          const left = ROWS - b.row;
          if (rnd() < need / left) b.right++;
          b.row++;
        }
        const x = cx + (b.right - b.row / 2) * gap;
        const y = top + (b.row + Math.min(1, b.f)) * rowH;
        g.fillStyle = "#ffd27a";
        g.beginPath();
        g.arc(x, y, 3, 0, Math.PI * 2);
        g.fill();
        if (b.row >= ROWS) {
          bins[b.bin]++;
          total++;
          balls.splice(i, 1);
        }
      }
    },
    tap() {
      for (let i = 0; i < 60; i++) add();
    },
  };
}

function buffonToy(): Toy {
  type N = { x: number; y: number; a: number; hit: boolean; age: number };
  const needles: N[] = [];
  let drops = 0;
  let hits = 0;
  let pending = 0;
  return {
    title: { vi: "Kim Buffon — đo π bằng cách thả kim", en: "Buffon's needle — measuring π by dropping needles" },
    desc: { vi: "Thả kim dài bằng khoảng cách hai vạch. Xác suất kim cắt vạch là 2/π — nên đếm kim là tính được π, chẳng cần vòng tròn nào!", en: "Drop needles as long as the gap between lines. The chance a needle crosses a line is 2/π — so counting needles computes π, no circle needed!" },
    hint: { vi: "Chạm để thả thêm 300 kim", en: "Tap to drop 300 more" },
    stat: () => (hits ? `π ≈ ${buffonPi(drops, hits).toFixed(4)}  (${drops})` : ""),
    step(g, W, H, dt) {
      fade(g, W, H, 1);
      const D = Math.min(W, H) / 7;
      g.strokeStyle = "rgba(190,170,255,0.35)";
      g.lineWidth = 1;
      for (let y = D / 2; y < H; y += D) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(W, y);
        g.stroke();
      }
      pending += dt * 18;
      while (pending > 1) {
        pending--;
        // tự thả theo luật (vị trí / góc đều) — đếm bằng đúng hàm của phần toán
        const hit = buffonHit(rnd);
        drops++;
        if (hit) hits++;
        const a = rnd() * Math.PI;
        const x = rnd() * W;
        // đặt kim cho khớp kết quả: tâm cách vạch gần nhất y0 sao cho có / không cắt
        const half = (D / 2) * Math.abs(Math.sin(a));
        const line = D / 2 + Math.floor(rnd() * 7) * D;
        const off = hit ? rnd() * half : half + rnd() * (D / 2 - half);
        needles.push({ x, y: line + (rnd() < 0.5 ? off : -off), a, hit, age: 0 });
        if (needles.length > 420) needles.shift();
      }
      g.globalCompositeOperation = "lighter";
      for (const n of needles) {
        n.age += dt;
        const L = D / 2;
        g.strokeStyle = n.hit ? "rgba(255,210,122,0.85)" : "rgba(127,227,255,0.45)";
        g.lineWidth = n.hit ? 1.8 : 1.2;
        g.beginPath();
        g.moveTo(n.x - Math.cos(n.a) * L, n.y - Math.sin(n.a) * L);
        g.lineTo(n.x + Math.cos(n.a) * L, n.y + Math.sin(n.a) * L);
        g.stroke();
      }
    },
    tap() {
      pending += 300;
    },
  };
}

function ulamToy(): Toy {
  const N = 40000;
  const P = sieve(N);
  let shown = 1;
  let zoom = 1;
  return {
    title: { vi: "Xoắn Ulam — số nguyên tố có \"đường\" bí ẩn", en: "Ulam spiral — primes form mysterious lines" },
    desc: { vi: "Viết 1, 2, 3, … xoắn ốc ra ngoài, tô sáng số nguyên tố. Hiện ra các đường chéo dày đặc — đến nay vẫn chưa ai chứng minh được vì sao.", en: "Write 1, 2, 3, … spiralling outward and light up the primes. Dense diagonal lines appear — nobody has fully proved why." },
    hint: { vi: "Chạm để thu nhỏ / phóng to", en: "Tap to zoom out / in" },
    stat: () => `${Math.floor(shown)}`,
    step(g, W, H, dt) {
      fade(g, W, H, 1);
      shown = Math.min(N, shown + dt * (400 + shown * 0.6));
      const cell = (Math.min(W, H) / Math.sqrt(Math.max(1, shown))) * 0.98 * zoom;
      const cx = W / 2;
      const cy = H / 2;
      g.globalCompositeOperation = "lighter";
      const sz = Math.max(1.2, cell * 0.8);
      for (let k = 2; k <= shown; k++) {
        if (!P[k]) continue;
        const [x, y] = ulam(k);
        const px = cx + x * cell;
        const py = cy - y * cell;
        if (px < -2 || py < -2 || px > W + 2 || py > H + 2) continue;
        const u = k / shown;
        g.fillStyle = u > 0.97 ? "#ffffff" : `hsl(${45 - u * 25}, 100%, ${60 + (1 - u) * 15}%)`;
        g.fillRect(px - sz / 2, py - sz / 2, sz, sz);
      }
    },
    tap() {
      zoom = zoom === 1 ? 2.6 : 1;
    },
  };
}

function harmonoToy(): Toy {
  let f = [2.01, 3, 3, 2];
  let p = [0, 1.2, 0.4, 0];
  let t = 0;
  const pts: [number, number][] = [];
  const reset = () => {
    const pairs = [
      [2, 3],
      [3, 4],
      [1, 3],
      [3, 5],
      [2, 5],
    ];
    const [a, b] = pairs[Math.floor(rnd() * pairs.length)];
    f = [a + (rnd() - 0.5) * 0.02, b, b + (rnd() - 0.5) * 0.02, a];
    p = [rnd() * 6, rnd() * 6, rnd() * 6, rnd() * 6];
    t = 0;
    pts.length = 0;
  };
  return {
    title: { vi: "Harmonograph — con lắc tự vẽ tranh", en: "Harmonograph — pendulums that draw" },
    desc: { vi: "Hai con lắc dao động theo hai phương, tần số theo tỉ lệ đơn giản (2 : 3, 3 : 4…), tắt dần vì ma sát. Hình hoa văn chính là đồ thị của phương trình dao động.", en: "Two pendulums swing along two axes at simple frequency ratios (2 : 3, 3 : 4…), slowly damped by friction. The pattern is literally the graph of their equations of motion." },
    hint: { vi: "Chạm để đổi tỉ lệ tần số", en: "Tap for another frequency ratio" },
    step(g, W, H, dt) {
      fade(g, W, H, 1);
      const S = Math.min(W, H) * 0.2;
      for (let k = 0; k < 14; k++) {
        t += dt * 1.1;
        const d = Math.exp(-0.012 * t);
        pts.push([S * d * (Math.sin(f[0] * t + p[0]) + Math.sin(f[1] * t + p[1])), S * d * (Math.sin(f[2] * t + p[2]) + Math.sin(f[3] * t + p[3]))]);
      }
      if (pts.length > 4000) pts.splice(0, pts.length - 4000);
      if (t > 260) reset();
      g.globalCompositeOperation = "lighter";
      g.lineWidth = 1;
      const n = pts.length;
      for (let i = 1; i < n; i++) {
        const u = i / n;
        g.strokeStyle = `hsla(${280 - u * 120}, 90%, ${55 + u * 15}%, ${0.15 + u * 0.55})`;
        g.beginPath();
        g.moveTo(W / 2 + pts[i - 1][0], H / 2 + pts[i - 1][1]);
        g.lineTo(W / 2 + pts[i][0], H / 2 + pts[i][1]);
        g.stroke();
      }
    },
    tap: reset,
  };
}

const TOYS = [fourierToy, pendulumToy, galtonToy, buffonToy, ulamToy, harmonoToy];
const TOY_KEY = "world.loadToy";
function nextToy(): number {
  let i = 0;
  try {
    i = (Number(sessionStorage.getItem(TOY_KEY)) + 1) % TOYS.length || 0;
    sessionStorage.setItem(TOY_KEY, String(i));
  } catch {
    i = Math.floor(rnd() * TOYS.length);
  }
  return i;
}

function ToyCanvas({ toy }: { toy: Toy }) {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = cv.current;
    const g = c?.getContext("2d");
    if (!c || !g) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const fit = () => {
      c.width = Math.round(c.clientWidth * dpr);
      c.height = Math.round(c.clientHeight * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    window.addEventListener("resize", fit);
    let last = performance.now();
    let raf = 0;
    const loop = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      toy.step(g, c.clientWidth, c.clientHeight, dt);
      g.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", fit);
    };
  }, [toy]);
  return (
    <canvas
      ref={cv}
      className="w-load__toy"
      onPointerDown={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        toy.tap(e.clientX - r.left, e.clientY - r.top, r.width, r.height);
      }}
    />
  );
}

/** Số liệu sống của đồ chơi (cập nhật 4 lần / giây) */
function ToyStat({ toy }: { toy: Toy }) {
  const [v, setV] = useState("");
  useEffect(() => {
    const id = window.setInterval(() => setV(toy.stat?.() ?? ""), 250);
    return () => window.clearInterval(id);
  }, [toy]);
  return v ? <span className="w-load__stat">{v}</span> : null;
}

function kindOf(item: string, vi: boolean) {
  const s = item.toLowerCase();
  if (s.endsWith(".vrm")) return vi ? "nhân vật" : "characters";
  if (/anim|ual/.test(s)) return vi ? "chuyển động" : "motion";
  if (/\.(glb|gltf)/.test(s)) return vi ? "mô hình 3D" : "3D models";
  if (/\.(webp|png|jpe?g|ktx2|hdr)/.test(s)) return vi ? "hoạ tiết" : "textures";
  return vi ? "dữ liệu" : "data";
}

/** armKey đổi (vào game / đổi thế giới / đổi nhân vật) → canh việc tải tiếp theo */
export function LoadingScreen({ armKey, scene }: { armKey: string; scene: string }) {
  const { active, item, loaded, total } = useProgress();
  const vi = useWorld((s) => s.lang === "vi");
  const [show, setShow] = useState(false);
  const st = useRef({ armedAt: 0, shownAt: 0, idleAt: 0 });
  const [toy, setToy] = useState<Toy | null>(null);
  const [fact, setFact] = useState(0);
  const [pct, setPct] = useState(0);
  // lên dây khi armKey đổi
  useEffect(() => {
    st.current.armedAt = performance.now();
  }, [armKey]);
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = performance.now();
      const s = st.current;
      if (!show) {
        if (!s.armedAt) return;
        if (active && now - s.armedAt > 300) {
          s.shownAt = now;
          s.idleAt = 0;
          setToy(TOYS[nextToy()]());
          setFact(Math.floor(Math.random() * FACTS.length));
          setPct(0);
          setShow(true);
        } else if (!active && now - s.armedAt > 1500) s.armedAt = 0; // đã có sẵn trong bộ nhớ đệm → không cần màn chờ
        return;
      }
      // tiến độ không tụt lùi khi có thêm tệp mới vào hàng đợi
      setPct((v) => Math.max(v, Math.round(useProgress.getState().progress)));
      if (active) s.idleAt = 0;
      else if (!s.idleAt) s.idleAt = now;
      if (!active && s.idleAt && now - s.idleAt > 600 && now - s.shownAt > 1600) {
        setShow(false);
        s.armedAt = 0;
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [show, active]);
  useEffect(() => {
    if (!show) return;
    const id = window.setInterval(() => setFact((f) => (f + 1) % FACTS.length), 7000);
    return () => window.clearInterval(id);
  }, [show]);
  return (
    <AnimatePresence>
      {show && toy && (
        <motion.div className="w-load" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.5 } }}>
          <div className="w-load__stars" />
          <header className="w-load__head">
            <small>{vi ? "Đang mở" : "Opening"}</small>
            <b>{TITLES[scene]?.name[vi ? "vi" : "en"] ?? "Math World"}</b>
          </header>
          <div className="w-load__stage">
            <ToyCanvas toy={toy} />
            <div className="w-load__cap">
              <h3>
                {toy.title[vi ? "vi" : "en"]}
                {toy.stat && <ToyStat toy={toy} />}
              </h3>
              <p>{toy.desc[vi ? "vi" : "en"]}</p>
              <em>{toy.hint[vi ? "vi" : "en"]}</em>
            </div>
          </div>
          <AnimatePresence mode="wait">
            <motion.p key={fact} className="w-load__fact" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <span>{vi ? "Bạn có biết?" : "Did you know?"}</span> {FACTS[fact][vi ? "vi" : "en"]}
            </motion.p>
          </AnimatePresence>
          <footer className="w-load__bar">
            <i style={{ width: `${pct}%` }} />
            <span>
              {vi ? "Đang tải" : "Loading"} {item ? kindOf(item, vi) : ""} · {loaded}/{total} · {pct}%
            </span>
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
