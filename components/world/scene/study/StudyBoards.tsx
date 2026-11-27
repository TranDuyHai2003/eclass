"use client";
/**
 * Chữ trên tường (CanvasTexture — vẽ lại CHỈ khi nội dung đổi):
 *  - tường bắc: tấm "Lời thề" lớn (nền gỗ sẫm, chữ vàng kem, viền hoa văn) + bảng đồng hồ chung phía trên;
 *  - tường nam: năm tấm "Ta sẽ vì chân lý mà đấu tranh!" quanh cửa;
 *  - tường đông / tây: bảng danh ngôn đổi theo giờ thực (mọi người cùng thấy một câu).
 * Chữ tự co cỡ cho vừa khung (tìm nhị phân), xuống dòng theo từ, giữ nguyên các dòng ngắt của bản gốc.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useWorld } from "../../store";
import { CREED, OATH, QUOTES, quoteIndex } from "@/lib/world/studyQuotes";
import { DOOR, FIREPLACE, OATH_PANEL, SR } from "@/lib/world/studyRoom";
import { fmtClock, roomPhase, soloView } from "@/lib/world/studyTimer";
import { presence, useStudy } from "./studyState";

const SERIF = "'Noto Serif', 'Times New Roman', Georgia, serif";
/** Họ phông Be Vietnam Pro do next/font sinh (tên băm) — đọc từ biến CSS trên gốc game */
function sansFamily(): string {
  if (typeof document === "undefined") return "sans-serif";
  const el = document.querySelector(".w-root") ?? document.body;
  const v = getComputedStyle(el).getPropertyValue("--font-bvp").trim();
  return v ? `${v}, sans-serif` : "'Be Vietnam Pro', sans-serif";
}

interface Run {
  text: string;
  /** hệ số cỡ chữ so với thân */
  scale?: number;
  color?: string;
  font?: "serif" | "sans";
  weight?: number;
  italic?: boolean;
  /** khoảng cách thêm sau dòng (theo cỡ thân) */
  gap?: number;
  align?: "center" | "left";
  /** bắt buộc nằm trên một dòng (tiêu đề) — co chữ thay vì xuống dòng */
  oneLine?: boolean;
}

/** Bẻ dòng theo từ cho vừa bề rộng */
function wrap(g: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  if (!text) return [""];
  const words = text.split(" ");
  const out: string[] = [];
  let line = "";
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (g.measureText(t).width <= maxW || !line) line = t;
    else {
      out.push(line);
      line = w;
    }
  }
  if (line) out.push(line);
  return out;
}

function fontOf(r: Run, size: number, sans: string) {
  return `${r.italic ? "italic " : ""}${r.weight ?? 500} ${Math.round(size * (r.scale ?? 1))}px ${r.font === "sans" ? sans : SERIF}`;
}

/** Bố cục: trả về chiều cao cần cho cỡ thân `size` */
function layout(g: CanvasRenderingContext2D, runs: Run[], size: number, w: number, sans: string) {
  const lines: { text: string; run: Run; y: number; size: number }[] = [];
  let y = 0;
  for (const r of runs) {
    const s = size * (r.scale ?? 1);
    g.font = fontOf(r, size, sans);
    if (!r.text) {
      y += s * 0.7;
      continue;
    }
    const ls = wrap(g, r.text, w);
    if (r.oneLine && ls.length > 1) return { lines, h: Infinity };
    for (const l of ls) {
      lines.push({ text: l, run: r, y: y + s, size: s });
      y += s * 1.32;
    }
    y += size * (r.gap ?? 0);
  }
  return { lines, h: y };
}

/** Vẽ khối chữ tự co cỡ vừa hộp (x, y, w, h), căn giữa theo chiều dọc */
function drawRuns(g: CanvasRenderingContext2D, runs: Run[], x: number, y: number, w: number, h: number, maxSize: number) {
  const sans = sansFamily();
  let lo = 8;
  let hi = maxSize;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    if (layout(g, runs, mid, w, sans).h <= h) lo = mid;
    else hi = mid;
  }
  const L = layout(g, runs, lo, w, sans);
  const top = y + (h - L.h) / 2;
  g.textBaseline = "alphabetic";
  for (const l of L.lines) {
    g.font = fontOf(l.run, lo, sans);
    g.fillStyle = l.run.color ?? "#f3e6c8";
    const al = l.run.align ?? "center";
    g.textAlign = al;
    g.fillText(l.text, al === "center" ? x + w / 2 : x, top + l.y);
  }
}

/** Khung bảng: nền gỗ sẫm có vân mờ, viền vàng đôi, hoa văn góc */
function drawFrame(g: CanvasRenderingContext2D, W: number, H: number, bg = "#1f2a27", accent = "#d9b46a") {
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, bg);
  gr.addColorStop(1, shade(bg, -0.25));
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  // vân mờ
  g.globalAlpha = 0.06;
  g.strokeStyle = "#ffffff";
  for (let i = 0; i < 40; i++) {
    g.beginPath();
    const yy = (i / 40) * H + Math.sin(i * 7.3) * 6;
    g.moveTo(0, yy);
    g.bezierCurveTo(W * 0.3, yy + 8, W * 0.7, yy - 8, W, yy);
    g.stroke();
  }
  g.globalAlpha = 1;
  const m = Math.round(Math.min(W, H) * 0.035);
  g.strokeStyle = accent;
  g.lineWidth = Math.max(2, m * 0.22);
  g.strokeRect(m, m, W - m * 2, H - m * 2);
  g.lineWidth = Math.max(1, m * 0.08);
  g.strokeRect(m * 1.5, m * 1.5, W - m * 3, H - m * 3);
  // hoa văn góc (hình thoi + vòng)
  g.fillStyle = accent;
  for (const [cx, cy] of [
    [m * 1.5, m * 1.5],
    [W - m * 1.5, m * 1.5],
    [m * 1.5, H - m * 1.5],
    [W - m * 1.5, H - m * 1.5],
  ]) {
    g.beginPath();
    g.moveTo(cx, cy - m * 0.8);
    g.lineTo(cx + m * 0.8, cy);
    g.lineTo(cx, cy + m * 0.8);
    g.lineTo(cx - m * 0.8, cy);
    g.closePath();
    g.fill();
  }
  return m;
}
function shade(hex: string, k: number) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(1 + k);
  return `#${c.getHexString()}`;
}
/** vạch trang trí giữa tiêu đề và thân */
function rule(g: CanvasRenderingContext2D, cx: number, y: number, w: number, color: string) {
  g.strokeStyle = color;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(cx - w / 2, y);
  g.lineTo(cx - 14, y);
  g.moveTo(cx + 14, y);
  g.lineTo(cx + w / 2, y);
  g.stroke();
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(cx, y - 7);
  g.lineTo(cx + 7, y);
  g.lineTo(cx, y + 7);
  g.lineTo(cx - 7, y);
  g.fill();
}

// ───────────── Tấm bảng chung ─────────────

function useCanvasTex(w: number, h: number) {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return { c, g: c.getContext("2d")!, tex };
  }, [w, h]);
}

/** Đợi phông thật nạp xong rồi vẽ lại (canvas không tự vẽ lại khi phông về) */
function useFontsReady(draw: () => void, key: unknown) {
  const ref = useRef(draw);
  useEffect(() => {
    ref.current = draw;
  });
  useEffect(() => {
    ref.current();
    let alive = true;
    const fam = sansFamily().split(",")[0];
    Promise.all([document.fonts?.load(`700 40px ${fam}`, "Ta nguyện ữ"), document.fonts?.load(`500 40px ${SERIF}`, "Ta nguyện ữ")])
      .catch(() => {})
      .then(() => document.fonts?.ready)
      .then(() => alive && ref.current());
    return () => {
      alive = false;
    };
    // vẽ lại khi tấm canvas được tạo lại (vd. nạp nóng khi phát triển)
  }, [key]);
}

function Board({ tex, w, h, position, rotY = 0, frame = true, emissive = 0.55 }: { tex: THREE.Texture; w: number; h: number; position: [number, number, number]; rotY?: number; frame?: boolean; emissive?: number }) {
  // chữ tự sáng nhẹ (đọc được trong phòng tối) nhưng vẫn nhận ánh đèn
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: new THREE.Color(1, 1, 1), emissiveIntensity: emissive, roughness: 0.85 }), [tex, emissive]);
  const frameMat = useMemo(() => new THREE.MeshToonMaterial({ color: "#3a2416" }), []);
  useEffect(
    () => () => {
      mat.dispose();
      frameMat.dispose();
    },
    [mat, frameMat],
  );
  return (
    <group position={position} rotation-y={rotY}>
      {frame && (
        <mesh position={[0, 0, -0.035]} material={frameMat}>
          <boxGeometry args={[w + 0.16, h + 0.16, 0.06]} />
        </mesh>
      )}
      <mesh material={mat}>
        <planeGeometry args={[w, h]} />
      </mesh>
    </group>
  );
}

// ───────────── Lời thề (tường chính) ─────────────

function OathBoard() {
  const w = OATH_PANEL.hw * 2;
  const h = OATH_PANEL.y1 - OATH_PANEL.y0;
  const PX = 1600;
  const { c, g, tex } = useCanvasTex(PX, Math.round((PX * h) / w));
  useFontsReady(() => {
    const m = drawFrame(g, c.width, c.height, "#22201c", "#e0bd72");
    const [title, ...rest] = OATH;
    const runs: Run[] = [
      { text: title, scale: 1.45, weight: 800, font: "sans", color: "#f4cf7a", gap: 0.5, oneLine: true },
      ...rest.map((t) => ({ text: t, color: "#f3e6c8", weight: 500 }) as Run),
    ];
    const pad = m * 3.2;
    drawRuns(g, runs, pad, pad, c.width - pad * 2, c.height - pad * 2, 60);
    tex.needsUpdate = true;
  }, tex);
  useEffect(() => () => tex.dispose(), [tex]);
  return <Board tex={tex} w={w} h={h} position={[OATH_PANEL.x, (OATH_PANEL.y0 + OATH_PANEL.y1) / 2, -SR.D + 0.08]} emissive={0.7} />;
}

// ───────────── Năm tấm "Ta sẽ vì chân lý mà đấu tranh!" (tường nam) ─────────────

const CREED_SLOTS: { x: number; y: number; w: number; h: number }[] = [
  // nhìn từ trong phòng ra cửa (hướng nam) thì +x ở bên TRÁI → đọc: tiêu đề, cột trái trên→dưới, cột phải trên→dưới
  { x: 0, y: 3.35, w: 4, h: 0.75 },
  { x: 3.85, y: 3.4, w: 3, h: 1.45 },
  { x: 3.85, y: 1.75, w: 3, h: 1.35 },
  { x: -3.85, y: 3.4, w: 3, h: 1.45 },
  { x: -3.85, y: 1.75, w: 3, h: 1.35 },
];
function CreedBoard({ i }: { i: number }) {
  const s = CREED_SLOTS[i];
  const PX = i === 0 ? 1400 : 1024;
  const { c, g, tex } = useCanvasTex(PX, Math.round((PX * s.h) / s.w));
  useFontsReady(() => {
    const m = drawFrame(g, c.width, c.height, "#2c1d1a", "#c9a25a");
    const pad = m * 2.6;
    const runs: Run[] = i === 0 ? [{ text: CREED[0], weight: 800, font: "sans", color: "#f4cf7a", oneLine: true }] : [{ text: CREED[i], color: "#f1e3c6", weight: 500 }];
    drawRuns(g, runs, pad, pad, c.width - pad * 2, c.height - pad * 2, i === 0 ? 90 : 56);
    tex.needsUpdate = true;
  }, tex);
  useEffect(() => () => tex.dispose(), [tex]);
  // mặt bảng quay về bắc (vào trong phòng)
  return <Board tex={tex} w={s.w} h={s.h} position={[s.x, s.y, SR.D - 0.08]} rotY={Math.PI} />;
}

// ───────────── Bảng danh ngôn đổi theo giờ ─────────────

const QUOTE_SLOTS: { pos: [number, number, number]; rotY: number }[] = [
  { pos: [SR.W - 0.06, 3.45, -4.1], rotY: -Math.PI / 2 },
  { pos: [SR.W - 0.06, 3.45, -0.7], rotY: -Math.PI / 2 },
  { pos: [SR.W - 0.06, 3.45, 2.7], rotY: -Math.PI / 2 },
  { pos: [-SR.W + 0.06, 3.45, -4.1], rotY: Math.PI / 2 },
  // trên ống khói lò sưởi (mặt trước ống khói ở x = −W + 0,8·sâu)
  { pos: [-SR.W + FIREPLACE.depth * 0.8 + 0.04, 2.75, FIREPLACE.z], rotY: Math.PI / 2 },
  { pos: [-SR.W + 0.06, 3.45, 2.85], rotY: Math.PI / 2 },
];
const QW = 2.5;
const QH = 1.5;

function QuoteBoard({ i }: { i: number }) {
  const slot = QUOTE_SLOTS[i];
  const small = i === 4;
  const w = small ? 1.4 : QW;
  const h = small ? 1.05 : QH;
  const { c, g, tex } = useCanvasTex(1024, Math.round((1024 * h) / w));
  const shown = useRef(-1);
  const lang = useWorld((s) => s.lang);
  const draw = (qi: number) => {
    const q = QUOTES[qi];
    const m = drawFrame(g, c.width, c.height, "#1d2733", "#c9a25a");
    const pad = m * 2.8;
    const vi = lang === "vi";
    const runs: Run[] = [
      { text: `“${vi ? q.vi : q.en}”`, color: "#f6ead0", weight: 500, gap: 0.35 },
      { text: `“${vi ? q.en : q.vi}”`, scale: 0.62, italic: true, color: "#b9c3c9", gap: 0.45 },
      { text: `— ${q.who[vi ? "vi" : "en"]}`, scale: 0.8, weight: 700, font: "sans", color: "#e9ad62" },
      { text: q.src, scale: 0.5, color: "#8d97a0", font: "sans", weight: 500 },
    ];
    drawRuns(g, runs, pad, pad, c.width - pad * 2, c.height - pad * 2, 64);
    rule(g, c.width / 2, pad * 0.75, c.width * 0.3, "#c9a25a");
    tex.needsUpdate = true;
  };
  const drawRef = useRef(draw);
  useEffect(() => {
    drawRef.current = draw;
  });
  useFontsReady(() => {
    shown.current = quoteIndex(i, QUOTE_SLOTS.length, Date.now());
    drawRef.current(shown.current);
  }, tex);
  useEffect(() => {
    if (shown.current >= 0) drawRef.current(shown.current);
  }, [lang]);
  useEffect(() => {
    const id = window.setInterval(() => {
      // chế độ tập trung: giữ nguyên câu (không có gì đổi ở rìa tầm nhìn)
      if (useStudy.getState().focus) return;
      const qi = quoteIndex(i, QUOTE_SLOTS.length, Date.now());
      if (qi !== shown.current) {
        shown.current = qi;
        drawRef.current(qi);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [i]);
  useEffect(() => () => tex.dispose(), [tex]);
  return <Board tex={tex} w={w} h={h} position={slot.pos} rotY={slot.rotY} />;
}

// ───────────── Bảng đồng hồ chung (trên tấm Lời thề) ─────────────

function ClockBoard() {
  const w = 2.9;
  const h = 0.62;
  const { c, g, tex } = useCanvasTex(1024, Math.round((1024 * h) / w));
  const last = useRef("");
  const lang = useWorld((s) => s.lang);
  const draw = () => {
    const st = useStudy.getState();
    const now = Date.now();
    const v = st.mode === "solo" ? soloView(st.solo, now) : roomPhase(now);
    const { studying } = presence();
    const vi = lang === "vi";
    const label = v.phase === "focus" ? (vi ? "ĐANG TẬP TRUNG" : "FOCUS") : vi ? "GIẢI LAO" : "BREAK";
    const who = st.mode === "solo" ? (vi ? "đồng hồ riêng" : "your timer") : vi ? "nhịp chung của phòng" : "room rhythm";
    const key = `${label}|${fmtClock(v.remain)}|${studying}|${who}`;
    if (key === last.current) return;
    last.current = key;
    const H = c.height;
    g.fillStyle = "#15120f";
    g.fillRect(0, 0, c.width, H);
    g.strokeStyle = "#c9a25a";
    g.lineWidth = 4;
    g.strokeRect(6, 6, c.width - 12, H - 12);
    const focus = v.phase === "focus";
    // thanh tiến độ pha
    const k = 1 - v.remain / Math.max(1, v.dur);
    g.fillStyle = focus ? "rgba(233,173,98,.25)" : "rgba(131,145,125,.3)";
    g.fillRect(14, H - 26, (c.width - 28) * k, 12);
    const sans = sansFamily();
    g.textBaseline = "middle";
    g.textAlign = "left";
    g.fillStyle = focus ? "#f4cf7a" : "#a8c3a0";
    g.font = `800 40px ${sans}`;
    g.fillText(label, 36, H * 0.38);
    g.font = `500 26px ${sans}`;
    g.fillStyle = "#cdbfa3";
    g.fillText(`${who} · ${vi ? `${studying} người đang học` : `${studying} studying`}`, 36, H * 0.7);
    g.textAlign = "right";
    g.font = `700 96px ${sans}`;
    g.fillStyle = "#f6ead0";
    g.fillText(fmtClock(v.remain), c.width - 36, H * 0.5);
    tex.needsUpdate = true;
  };
  const drawRef = useRef(draw);
  useEffect(() => {
    drawRef.current = draw;
  });
  useFontsReady(() => {
    last.current = "";
    drawRef.current();
  }, tex);
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.25) return;
    acc.current = 0;
    drawRef.current();
  });
  useEffect(() => {
    last.current = "";
  }, [lang, tex]);
  useEffect(() => () => tex.dispose(), [tex]);
  return <Board tex={tex} w={w} h={h} position={[0, OATH_PANEL.y1 + 0.5, -SR.D + 0.08]} emissive={0.9} />;
}

/** Biển nhỏ trên cửa ra */
function ExitSign() {
  const { g, tex } = useCanvasTex(512, 128);
  const lang = useWorld((s) => s.lang);
  const draw = () => {
    g.fillStyle = "#1a2a22";
    g.fillRect(0, 0, 512, 128);
    g.fillStyle = "#a8d8b0";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `800 52px ${sansFamily()}`;
    g.fillText(useWorld.getState().lang === "vi" ? "← Quảng trường" : "← Plaza", 256, 66);
    tex.needsUpdate = true;
  };
  const drawRef = useRef(draw);
  useEffect(() => {
    drawRef.current = draw;
  });
  useFontsReady(() => drawRef.current(), tex);
  useEffect(() => drawRef.current(), [lang]);
  useEffect(() => () => tex.dispose(), [tex]);
  return <Board tex={tex} w={0.9} h={0.225} position={[0, 2.6, DOOR.z - 0.1]} rotY={Math.PI} emissive={1} frame={false} />;
}

export function StudyBoards() {
  return (
    <group>
      <OathBoard />
      <ClockBoard />
      {CREED.map((_, i) => (
        <CreedBoard key={i} i={i} />
      ))}
      {QUOTE_SLOTS.map((_, i) => (
        <QuoteBoard key={i} i={i} />
      ))}
      <ExitSign />
    </group>
  );
}
