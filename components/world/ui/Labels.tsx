"use client";
/**
 * World-space labels drawn in ONE DOM layer (instead of one React root per drei <Html>):
 * no React 19 "synchronously unmount a root" errors, and much cheaper per frame.
 * - <Label3D> (inside the Canvas) registers an anchor object + text.
 * - <LabelProjector/> (inside the Canvas) projects anchors to screen each frame.
 * - <LabelLayer/> (outside the Canvas) provides the DOM container.
 */
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { SCOPE, useScope } from "../scope";

type Variant = "default" | "small" | "warn" | "name" | "math";
interface Entry {
  obj: THREE.Object3D;
  el: HTMLDivElement;
  scale: number;
  /** quá khoảng này thì ẩn (mờ dần 6 m cuối) — tên NPC chỉ hiện khi đứng gần, đỡ rối và đỡ "nhìn xuyên tường" */
  maxDist: number;
}
const entries = new Set<Entry>();
let container: HTMLDivElement | null = null;
const pending: Entry[] = [];

const CLASS: Record<Variant, string> = {
  default: "rounded-full bg-white/85 px-3 py-1 text-sm font-black text-indigo-900 shadow-lg",
  small: "rounded-full bg-white/85 px-2.5 py-0.5 text-xs font-bold text-indigo-900 shadow",
  warn: "rounded-full bg-rose-500/85 px-2.5 py-0.5 text-xs font-black text-white shadow",
  name: "rounded-full bg-[#12162b]/75 px-2.5 py-0.5 text-[11px] font-black italic text-[#ecd7a9] ring-1 ring-[#ecd7a9]/50",
  math: "rounded-full px-3 py-1 text-sm font-black text-white shadow-lg",
};

export function LabelLayer() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    container = ref.current;
    for (const e of pending.splice(0)) container?.appendChild(e.el);
    return () => {
      container = null;
    };
  }, []);
  return <div ref={ref} className="pointer-events-none absolute inset-0 z-[15] overflow-hidden" />;
}

/** Nhãn gắn vào một điểm trong cảnh; onEl cho phép cập nhật chữ/màu mỗi khung hình (không re-render) */
export function Label3D({
  text,
  position = [0, 0, 0],
  variant = "default",
  scale = 1,
  maxDist,
  onEl,
}: {
  text?: string;
  position?: [number, number, number];
  variant?: Variant;
  scale?: number;
  maxDist?: number;
  onEl?: (el: HTMLDivElement) => void;
}) {
  const anchor = useRef<THREE.Group>(null);
  const entry = useRef<Entry | null>(null);
  useEffect(() => {
    if (!anchor.current) return;
    const el = document.createElement("div");
    el.className = `absolute left-0 top-0 whitespace-nowrap will-change-transform ${CLASS[variant]}`;
    el.style.opacity = "0";
    const e: Entry = { obj: anchor.current, el, scale, maxDist: maxDist ?? (variant === "name" ? 24 : 60) };
    entry.current = e;
    entries.add(e);
    if (container) container.appendChild(el);
    else pending.push(e);
    onEl?.(el);
    return () => {
      entries.delete(e);
      el.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant]);
  useEffect(() => {
    if (entry.current && text !== undefined) entry.current.el.textContent = text;
  }, [text]);
  return <group ref={anchor} position={position} />;
}

const P = new THREE.Vector3();
const C = new THREE.Vector3();

/** Số sát thương / chữ bay lên rồi mờ dần (pool DOM, không qua React) */
interface Floater {
  pos: THREE.Vector3;
  el: HTMLDivElement;
  born: number;
  dx: number;
}
const floaters: Floater[] = [];
const FLOAT_CLASS = {
  dmg: "w-float",
  crit: "w-float w-float--crit",
  hurt: "w-float w-float--hurt",
  info: "w-float w-float--info",
} as const;
export function floatText(pos: THREE.Vector3, text: string, kind: keyof typeof FLOAT_CLASS = "dmg") {
  if (!container) return;
  const el = document.createElement("div");
  el.className = `absolute left-0 top-0 ${FLOAT_CLASS[kind]}`;
  // phần tử con để "nảy" bằng CSS (transform của phần tử ngoài do JS đặt theo vị trí 3D)
  const inner = document.createElement("span");
  inner.textContent = text;
  el.appendChild(inner);
  container.appendChild(el);
  floaters.push({ pos: pos.clone(), el, born: performance.now(), dx: (Math.random() - 0.5) * 40 });
  if (floaters.length > 40) floaters.shift()?.el.remove();
}
const FLOAT_MS = 900;

/** Nhãn DOM không tự theo visible của cây cảnh → kiểm cả tổ tiên (vd. sân bị ẩn khi đang ở trong bốt) */
function worldVisible(o: THREE.Object3D | null) {
  for (let c = o; c; c = c.parent) if (!c.visible) return false;
  return true;
}

export function LabelProjector() {
  const { camera, size } = useThree();
  useFrame(() => {
    camera.getWorldPosition(C);
    // ống nhòm: khoảng cách hiệu dụng = d / zoom (nhãn xa hiện ra khi phóng); nhãn gần tâm ngắm nhất = mục tiêu
    const zoom = SCOPE.zoom;
    const scoping = useScope.getState().on;
    let best: string | null = null;
    let bestD = 0.14;
    for (const e of entries) {
      e.obj.getWorldPosition(P);
      const dist = P.distanceTo(C) / zoom;
      P.project(camera);
      if (scoping && P.z < 1 && worldVisible(e.obj)) {
        const dc = Math.hypot(P.x, P.y);
        if (dc < bestD) {
          bestD = dc;
          best = e.el.textContent;
        }
      }
      const visible = P.z < 1 && Math.abs(P.x) < 1.2 && Math.abs(P.y) < 1.2 && dist < e.maxDist && worldVisible(e.obj);
      if (!visible) {
        e.el.style.opacity = "0";
        continue;
      }
      const x = (P.x * 0.5 + 0.5) * size.width;
      const y = (-P.y * 0.5 + 0.5) * size.height;
      const s = Math.max(0.55, Math.min(1.15, (9 / Math.max(1, dist)) * e.scale + 0.35));
      const fade = Math.min(20, e.maxDist / 3);
      e.el.style.opacity = dist > e.maxDist - fade ? String(Math.max(0, (e.maxDist - dist) / fade)) : "1";
      e.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${s})`;
    }
    if (scoping && useScope.getState().target !== best) useScope.setState({ target: best });
    const now = performance.now();
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      const k = (now - f.born) / FLOAT_MS;
      if (k >= 1) {
        f.el.remove();
        floaters.splice(i, 1);
        continue;
      }
      P.copy(f.pos);
      P.y += k * 0.9;
      P.project(camera);
      if (P.z >= 1) {
        f.el.style.opacity = "0";
        continue;
      }
      const x = (P.x * 0.5 + 0.5) * size.width + f.dx * k;
      const y = (-P.y * 0.5 + 0.5) * size.height;
      // Bật to rồi thu lại (cảm giác "đập"), mờ ở 35% cuối
      const pop = k < 0.12 ? 0.6 + (k / 0.12) * 0.75 : 1.35 - Math.min(0.35, (k - 0.12) * 1.2);
      f.el.style.opacity = String(k > 0.65 ? (1 - k) / 0.35 : 1);
      f.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${pop})`;
    }
  });
  return null;
}
