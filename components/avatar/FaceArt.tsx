import type { ReactNode } from "react";
import { ITEM_BY_ID } from "@/lib/game/items";
import { FACES, PRESETS, hasFaceParts, type LookConfig } from "@/lib/game/presets";
import { skinToneOf } from "@/lib/game/face-parts";

export const FACE_STRIP = "/studio/faces.webp";
const FACE_EYES = "/studio/faces-eyes.webp";
const FACE_BLANK = "/studio/faces-blank.webp"; // mặt đã xoá mắt + miệng → phối bộ phận
const FACE_SKIN = "/studio/faces-skin.webp"; // vùng da + độ sáng → tô màu da riêng
const FACE_BLANK_SKIN = "/studio/faces-blank-skin.webp";
export const FACE_W = 204;
export const FACE_H = 138;
const TOTAL = FACE_W * FACES.length;
const LASH = "#2b1a12";
const MOUTH_IN = "#7a1f2b";
const TONGUE = "#f47a8f";

export function tintOf(itemId: string, uid: string) {
  const v = ITEM_BY_ID[itemId]?.v ?? "#000";
  return v.startsWith("url(") ? `url(#${uid}-hairRainbow)` : v;
}

/**
 * Tô lại một vùng của tranh: ảnh `href` có A = mặt nạ vùng, RGB = độ sáng đã chuẩn hoá.
 * Phủ màu đặc theo mặt nạ rồi nhân với độ sáng → giữ nét vẽ, bóng đổ, viền đen của tranh.
 */
export function Tint({ id, href, x, y = 0, w, h, total, fill }: { id: string; href: string; x: number; y?: number; w: number; h: number; total: number; fill: string }) {
  return (
    <g style={{ isolation: "isolate" }}>
      <mask id={id} maskUnits="userSpaceOnUse" x={x} y={y} width={w} height={h} style={{ maskType: "alpha" }}>
        <image href={href} y={y} width={total} height={h} />
      </mask>
      <rect x={x} y={y} width={w} height={h} fill={fill} mask={`url(#${id})`} />
      <image href={href} y={y} width={total} height={h} style={{ mixBlendMode: "multiply" }} />
    </g>
  );
}

const presetEyes = (face: number) => PRESETS.find((p) => p.id === FACES[face].id)?.items.eyes;
const mirror = (n: ReactNode) => <g transform="matrix(-1 0 0 1 120 0)">{n}</g>;
const both = (n: ReactNode) => (
  <>
    {n}
    {mirror(n)}
  </>
);

function heart(cx: number, cy: number, r: number) {
  return `M${cx} ${cy + r * 0.75}C${cx - r * 1.15} ${cy - r * 0.1} ${cx - r * 0.65} ${cy - r * 1.15} ${cx} ${cy - r * 0.45}C${cx + r * 0.65} ${cy - r * 1.15} ${cx + r * 1.15} ${cy - r * 0.1} ${cx} ${cy + r * 0.75}Z`;
}
function star(cx: number, cy: number, r: number, n = 5, inner = 0.45) {
  const pts = Array.from({ length: n * 2 }, (_, i) => {
    const a = (Math.PI * i) / n - Math.PI / 2;
    const rr = i % 2 ? r * inner : r;
    return `${(cx + rr * Math.cos(a)).toFixed(2)} ${(cy + rr * Math.sin(a)).toFixed(2)}`;
  });
  return `M${pts.join("L")}Z`;
}
function spiral(cx: number, cy: number) {
  const pts = Array.from({ length: 48 }, (_, i) => {
    const t = (i / 47) * Math.PI * 5;
    const r = 0.5 + (t / (Math.PI * 5)) * 7.6;
    return `${(cx + r * Math.cos(t)).toFixed(2)} ${(cy + r * Math.sin(t) * 1.08).toFixed(2)}`;
  });
  return `M${pts.join("L")}`;
}

/** Pha màu hex: t < 0 → tối dần về đen, t > 0 → sáng dần về trắng */
function mix(hex: string, t: number) {
  const n = parseInt(hex.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(t < 0 ? v * (1 + t) : v + (255 - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

// ---- Mắt riêng của nhân vật tự chỉnh (vẽ mắt trái quanh C,Y rồi lật sang phải; đơn vị mặt)
const C = 45.5;
const Y = 61;
const ell = (cx: number, cy: number, rx: number, ry: number) => `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;
interface EyeGeo {
  sclera: string;
  lash: string;
  /** mống mắt: bán kính x, y và độ lệch xuống */
  iris: [number, number, number];
  pupil: "round" | "slit" | "star";
  /** vùng được thấy (mi trên sụp: lờ đờ, quyết tâm) */
  cut?: string;
  sparkle?: boolean;
  flick?: boolean;
}
const OWN_EYES: Record<string, EyeGeo> = {
  round: { sclera: ell(C, Y + 0.4, 7.6, 8.6), lash: `M${C - 8.8} ${Y - 2.6}Q${C - 1} ${Y - 12.6} ${C + 8.6} ${Y - 4.6}`, iris: [6.4, 7.8, 1], pupil: "round", flick: true },
  big: { sclera: ell(C, Y, 8.3, 9.7), lash: `M${C - 9.4} ${Y - 3}Q${C - 1} ${Y - 14.2} ${C + 9.2} ${Y - 5.2}`, iris: [7.3, 8.9, 0.8], pupil: "round", sparkle: true, flick: true },
  sharp: {
    sclera: `M${C - 9} ${Y - 1.4}Q${C - 2} ${Y - 8.6} ${C + 8.4} ${Y - 5.6}Q${C + 7.6} ${Y + 5.6} ${C} ${Y + 6}Q${C - 7} ${Y + 5.4} ${C - 9} ${Y - 1.4}Z`,
    lash: `M${C - 9.8} ${Y - 0.8}Q${C - 2} ${Y - 9.6} ${C + 8.9} ${Y - 6}`,
    iris: [5.4, 6.8, 0.8],
    pupil: "round",
  },
  gentle: {
    sclera: `M${C - 8.6} ${Y + 0.6}Q${C - 2} ${Y - 10} ${C + 8.2} ${Y - 5.2}Q${C + 8} ${Y + 6.4} ${C} ${Y + 7.4}Q${C - 7.6} ${Y + 6.6} ${C - 8.6} ${Y + 0.6}Z`,
    lash: `M${C - 9.4} ${Y + 1.4}Q${C - 2} ${Y - 10.8} ${C + 8.6} ${Y - 5.6}`,
    iris: [6.2, 7.4, 1.6],
    pupil: "round",
  },
  cat: {
    sclera: `M${C - 9.4} ${Y - 5.8}Q${C - 1} ${Y - 9.4} ${C + 8} ${Y - 3.6}Q${C + 7} ${Y + 6.4} ${C - 0.6} ${Y + 6.6}Q${C - 7.4} ${Y + 5.6} ${C - 9.4} ${Y - 5.8}Z`,
    lash: `M${C - 11.6} ${Y - 8.4}L${C - 9.4} ${Y - 5.8}Q${C - 1} ${Y - 9.8} ${C + 8.4} ${Y - 3.8}`,
    iris: [5.8, 7.2, 0.8],
    pupil: "slit",
  },
  sleepy: {
    sclera: ell(C, Y + 1, 7.6, 8),
    cut: `M${C - 12} ${Y - 1.4}Q${C} ${Y - 5} ${C + 12} ${Y - 1.8}V${Y + 14}H${C - 12}Z`,
    lash: `M${C - 8.8} ${Y - 0.4}Q${C} ${Y - 4.6} ${C + 8.8} ${Y - 1}`,
    iris: [6.2, 7.4, 1.8],
    pupil: "round",
  },
  starry: { sclera: ell(C, Y + 0.4, 7.8, 8.9), lash: `M${C - 9} ${Y - 2.8}Q${C - 1} ${Y - 13} ${C + 8.8} ${Y - 4.8}`, iris: [6.6, 8, 1], pupil: "star", flick: true },
  fierce: {
    sclera: ell(C, Y + 0.6, 7.6, 8.4),
    cut: `M${C - 12} ${Y - 8.6}L${C + 12} ${Y - 2.4}V${Y + 14}H${C - 12}Z`,
    lash: `M${C - 9.6} ${Y - 7.6}L${C + 9.6} ${Y - 2.6}`,
    iris: [6.2, 7.6, 1.4],
    pupil: "round",
  },
};

function OwnEye({ g, uid, k, defs = true }: { g: EyeGeo; uid: string; k: string; defs?: boolean }) {
  const [irx, iry, dy] = g.iris;
  const ic = C + 0.3;
  const iy = Y + dy;
  const inner = (
    <>
      <path d={g.sclera} fill="#fff" />
      <g clipPath={`url(#${uid}-cs${k})`}>
        <ellipse cx={ic} cy={iy} rx={irx} ry={iry} fill={`url(#${uid}-iris)`} />
        <path d={`M${ic - irx * 0.62} ${iy + iry * 0.62}Q${ic} ${iy + iry * 1.02} ${ic + irx * 0.62} ${iy + iry * 0.62}`} fill="none" stroke={`url(#${uid}-irisL)`} strokeWidth="1.2" opacity="0.9" />
        {g.pupil === "round" && <ellipse cx={ic} cy={iy + 0.8} rx={irx * 0.42} ry={iry * 0.46} fill={`url(#${uid}-pupil)`} />}
        {g.pupil === "slit" && <ellipse cx={ic} cy={iy + 0.4} rx="1.1" ry={iry * 0.78} fill={`url(#${uid}-pupil)`} />}
        {g.pupil === "star" && <path d={star(ic, iy + 1, irx * 0.58)} fill={`url(#${uid}-pupil)`} />}
        <path d={`M${C - 9} ${Y - 9}Q${C} ${Y - 2.6} ${C + 9} ${Y - 8}V${Y - 12}H${C - 9}Z`} fill="#6b4b5a" opacity="0.28" />
        <ellipse cx={ic + irx * 0.4} cy={iy - iry * 0.42} rx={irx * 0.36} ry={iry * 0.36} fill="#fff" />
        <circle cx={ic - irx * 0.38} cy={iy + iry * 0.56} r={irx * 0.18} fill="#fff" />
        {g.pupil === "star" && <path d={star(ic - irx * 0.35, iy - iry * 0.2, 1.6, 4, 0.35)} fill="#fff" />}
        {g.sparkle && (
          <>
            <path d={star(ic + irx * 0.55, iy - iry * 0.5, 2.6, 4, 0.3)} fill="#fff" />
            <circle cx={ic - irx * 0.5} cy={iy - iry * 0.15} r="0.8" fill="#fff" opacity="0.9" />
          </>
        )}
      </g>
    </>
  );
  return (
    <g>
      {defs && (
        // mắt phải (bản lật) dùng chung clipPath: toạ độ tính theo hệ của phần tử dùng nó
        <defs>
          <clipPath id={`${uid}-cs${k}`}>
            <path d={g.sclera} />
          </clipPath>
          {g.cut && (
            <clipPath id={`${uid}-cc${k}`}>
              <path d={g.cut} />
            </clipPath>
          )}
        </defs>
      )}
      {g.cut ? <g clipPath={`url(#${uid}-cc${k})`}>{inner}</g> : inner}
      <g fill="none" stroke={LASH} strokeLinecap="round" strokeLinejoin="round">
        <path d={g.lash} strokeWidth="2.7" />
        {g.flick && <path d={`M${C - 8.6} ${Y - 2.8}l-2.8 -2.2`} strokeWidth="1.8" />}
        <path d={`M${C - 3.4} ${Y + 8.9}q3.4 1 6.8 0`} strokeWidth="0.7" opacity="0.28" />
      </g>
    </g>
  );
}

const happyEye = <path d="M37.5 63.5Q45.5 53 53.5 63.5" fill="none" stroke={LASH} strokeWidth="2.6" strokeLinecap="round" />;
/** Mắt của nhân vật tự chỉnh: kiểu mắt riêng (tô theo màu mắt) hoặc biểu cảm */
function eyeArt(id: string, uid: string): ReactNode {
  const g = OWN_EYES[id];
  if (g)
    return (
      <>
        <OwnEye g={g} uid={uid} k={id} />
        {mirror(<OwnEye g={g} uid={uid} k={id} defs={false} />)}
      </>
    );
  switch (id) {
    case "happy":
      return both(happyEye);
    case "closed":
      return both(
        <g fill="none" stroke={LASH} strokeLinecap="round">
          <path d="M37.5 60Q45.5 67 53.5 60" strokeWidth="2.4" />
          <path d="M39.6 62.8l-2 2.2M45.5 64.6v2.6M51.4 62.8l2 2.2" strokeWidth="1.2" />
        </g>,
      );
    case "wink":
      return (
        <>
          <OwnEye g={OWN_EYES.round} uid={uid} k="w" />
          <path d="M82 56.5L68.5 61.5L82 65.5" fill="none" stroke={LASH} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case "heart":
      return both(
        <g>
          <path d={heart(45.5, 61.5, 8)} fill="#ff4f7b" stroke="#8a1c3a" strokeWidth="1.1" strokeLinejoin="round" />
          <ellipse cx="42.4" cy="58.2" rx="2" ry="1.3" fill="#fff" opacity="0.85" transform="rotate(-30 42.4 58.2)" />
        </g>,
      );
    case "dizzy":
      return both(<path d={spiral(45.5, 61)} fill="none" stroke={LASH} strokeWidth="1.6" strokeLinecap="round" />);
    default:
      return null;
  }
}

const MOUTH_DRAW: Record<string, ReactNode> = {
  grin: (
    <g strokeLinejoin="round">
      <path d="M53.6 69.8Q60 71.2 66.4 69.8Q65.6 77.8 60 77.8Q54.4 77.8 53.6 69.8Z" fill={MOUTH_IN} stroke={LASH} strokeWidth="1" />
      <path d="M56.6 76Q60 73.4 63.4 76Q62 77.4 60 77.4Q58 77.4 56.6 76Z" fill={TONGUE} />
      <path d="M54.6 70.2Q60 71.4 65.4 70.2L65 71.6Q60 72.7 55 71.6Z" fill="#fff" />
    </g>
  ),
  o: <ellipse cx="60" cy="72.6" rx="2.5" ry="3.1" fill={MOUTH_IN} stroke={LASH} strokeWidth="1" />,
  tongue: (
    <g strokeLinecap="round" strokeLinejoin="round">
      <path d="M58.6 72.4Q58.6 77.2 61 76.9Q63.6 76.5 62.6 72.2" fill={TONGUE} stroke="#b84a5c" strokeWidth="0.8" />
      <path d="M54.5 70.4Q60 74.8 65.5 70.4" fill="none" stroke={LASH} strokeWidth="1.4" />
    </g>
  ),
  cat: <path d="M54 70.6Q56.8 74.6 60 71.2Q63.2 74.6 66 70.6" fill="none" stroke={LASH} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />,
  fang: (
    <g strokeLinejoin="round">
      <path d="M57.3 72.3l1.2 2.6l1.1-2.3Z" fill="#fff" stroke={LASH} strokeWidth="0.6" />
      <path d="M54.5 70.4Q60 74.8 65.5 70.4" fill="none" stroke={LASH} strokeWidth="1.4" strokeLinecap="round" />
    </g>
  ),
  pout: <path d="M56.2 73.2Q58 71.2 60 72.8Q62 71.2 63.8 73.2" fill="none" stroke={LASH} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />,
  smirk: <path d="M55 72.6Q60.5 74 65.8 69.8" fill="none" stroke={LASH} strokeWidth="1.4" strokeLinecap="round" />,
};

function decoArt(id: string, uid: string): ReactNode {
  switch (id) {
    case "blush":
      return both(<ellipse cx="38.6" cy="71.4" rx="7" ry="3.8" fill={`url(#${uid}-blush)`} />);
    case "shy":
      return both(
        <g>
          <ellipse cx="38.6" cy="71.4" rx="6.4" ry="3.4" fill={`url(#${uid}-blush)`} opacity="0.8" />
          <path d="M35 73.4l1.7-2.8M38.2 73.4l1.7-2.8M41.4 73.4l1.7-2.8" stroke="#e8506d" strokeWidth="0.9" strokeLinecap="round" />
        </g>,
      );
    case "freckles":
      return both(
        <g fill="#b0674a" opacity="0.75">
          {[[34.6, 69], [37.4, 67.8], [36.4, 71.4], [39.6, 70.2], [41.8, 68.6], [38.6, 72.8]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="0.6" />)}
        </g>,
      );
    case "star":
      return <path d={star(81.5, 71, 4.4)} fill="#fcd34d" stroke="#c2740a" strokeWidth="0.9" strokeLinejoin="round" />;
    case "heart":
      return (
        <g>
          <path d={heart(81.5, 71.4, 4.2)} fill="#fb7185" stroke="#be123c" strokeWidth="0.8" strokeLinejoin="round" />
          <ellipse cx="79.8" cy="69.6" rx="1" ry="0.7" fill="#fff" opacity="0.8" />
        </g>
      );
    case "bandaid":
      return (
        <g transform="rotate(-24 38.5 70.6)">
          <rect x="32.3" y="68.4" width="12.4" height="4.6" rx="2.3" fill="#f6d3ae" stroke="#b98557" strokeWidth="0.7" />
          <rect x="36.6" y="68.8" width="3.8" height="3.8" rx="0.8" fill="#e8b688" />
          <g fill="#c49064">
            <circle cx="34.2" cy="70" r="0.35" />
            <circle cx="34.2" cy="71.5" r="0.35" />
            <circle cx="42.8" cy="70" r="0.35" />
            <circle cx="42.8" cy="71.5" r="0.35" />
          </g>
        </g>
      );
    case "whiskers":
      return both(<path d="M31 67.6l7.6 1.6M30.6 71.4h7.8M31.2 75l7.4-1.6" stroke={LASH} strokeWidth="0.9" strokeLinecap="round" opacity="0.8" />);
    case "sweat":
      return (
        <g>
          <path d="M85.2 50.6Q89 56.4 85.2 58.6Q81.4 56.4 85.2 50.6Z" fill="#cdeeff" stroke="#3b82f6" strokeWidth="0.8" strokeLinejoin="round" />
          <ellipse cx="84.3" cy="56" rx="0.8" ry="1.2" fill="#fff" />
        </g>
      );
    default:
      return null;
  }
}

const BROW_ART: Record<string, ReactNode> = {
  thin: <path d="M38.2 48.4Q45 45 52.4 47" fill="none" strokeWidth="1.2" />,
  thick: <path d="M37.6 49Q44.6 43.2 53 45.8L52.6 47.6Q45 46.2 38.2 50.2Z" strokeWidth="0.5" />,
  arched: <path d="M38 49.6Q43.6 43 52.6 46.6" fill="none" strokeWidth="1.7" />,
  straight: <path d="M38 48Q45 47 52.6 47.4" fill="none" strokeWidth="2" />,
  angry: <path d="M38.4 45.2Q45.6 46.2 53 49.8" fill="none" strokeWidth="2.2" />,
  worried: <path d="M38.4 49.2Q46 49 52.6 45" fill="none" strokeWidth="1.8" />,
  dot: <ellipse cx="48" cy="47.2" rx="2.6" ry="1.6" strokeWidth="0.4" />,
};

/** Lông mày (đơn vị mặt; vẽ nổi trên tóc mái), màu theo màu tóc */
export function Brows({ id, hairColor, transform }: { id: string; hairColor?: string | null; transform?: string }) {
  const art = BROW_ART[id];
  if (!art) return null;
  const v = (hairColor && ITEM_BY_ID[hairColor]?.v) || "#4b2e1e";
  const c = v.startsWith("#") ? mix(v, -0.45) : "#3b2418";
  return (
    <g transform={transform} fill={c} stroke={c} strokeLinecap="round" strokeLinejoin="round" opacity="0.92" data-brows={id}>
      {art}
      <g transform="matrix(-1 0 0 1 120 0)">{art}</g>
    </g>
  );
}

/**
 * Khuôn mặt vẽ tay (ô `face` của faces.webp, căn theo mắt) đặt vào khung x/y/width/height.
 * Có phối bộ phận (eyeShape / mouth / faceDeco) → mặt trơn + mắt riêng (nét vẽ, tô theo màu mắt) hoặc mắt vẽ tay của mặt nền
 * + miệng + trang điểm; không phối → nguyên mặt. Mắt vẽ tay tô lại khi màu mắt khác màu gốc của mặt.
 */
export function FaceArt({ uid, face, config, x, y, width, height }: { uid: string; face: number; config: LookConfig; x: number; y: number; width: number; height: number }) {
  const ox = face * FACE_W;
  const tintFor = (src: number) => (config.eyes && config.eyes !== presetEyes(src) ? config.eyes : null);
  const tone = skinToneOf(config.skinTone);
  const skinT = (k: string, href: string) => tone && <Tint id={`${uid}-ts${k}`} href={href} x={ox} w={FACE_W} h={FACE_H} total={TOTAL} fill={tone} />;
  const attrs = { x, y, width, height, viewBox: `${ox} 0 ${FACE_W} ${FACE_H}`, "data-face": FACES[face].id };
  if (!hasFaceParts(config)) {
    const t = tintFor(face);
    return (
      <svg {...attrs}>
        <image href={FACE_STRIP} width={TOTAL} height={FACE_H} />
        {skinT("0", FACE_SKIN)}
        {t && <Tint id={`${uid}-tf`} href={FACE_EYES} x={ox} w={FACE_W} h={FACE_H} total={TOTAL} fill={tintOf(t, uid)} />}
      </svg>
    );
  }
  const shape = config.eyeShape ?? null;
  const drawn = shape ? eyeArt(shape, uid) : null; // null → giữ mắt vẽ tay của mặt nền
  const glasses = FACES[face].id === "preset-scholar";
  const [rx, ry] = glasses ? [14, 13] : [11, 12];
  const eyeColor = (config.eyes && ITEM_BY_ID[config.eyes]?.v) || "#8a5a3c";
  const unit = `translate(${ox - 78} -132) scale(3)`; // đơn vị mặt (x 26..94, y 44..90) → px của ô mặt
  const t = tintFor(face);
  const mouth = config.mouth ? MOUTH_DRAW[config.mouth] : null;
  return (
    <svg {...attrs} data-eyeshape={shape ?? undefined} data-mouth={config.mouth ?? undefined} data-deco={config.faceDeco ?? undefined}>
      <defs>
        <radialGradient id={`${uid}-soft`}>
          <stop offset="0.72" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-blush`}>
          <stop offset="0" stopColor="#ff6f8e" stopOpacity="0.75" />
          <stop offset="1" stopColor="#ff8fa3" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-iris`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mix(eyeColor, -0.62)} />
          <stop offset="0.5" stopColor={eyeColor} />
          <stop offset="1" stopColor={mix(eyeColor, 0.42)} />
        </linearGradient>
        <linearGradient id={`${uid}-irisL`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={mix(eyeColor, 0.6)} stopOpacity="0" />
          <stop offset="0.5" stopColor={mix(eyeColor, 0.6)} />
          <stop offset="1" stopColor={mix(eyeColor, 0.6)} stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${uid}-pupil`}>
          <stop offset="0" stopColor={mix(eyeColor, -0.85)} />
          <stop offset="1" stopColor={mix(eyeColor, -0.7)} />
        </radialGradient>
        <mask id={`${uid}-em`} maskUnits="userSpaceOnUse" x={ox} y="0" width={FACE_W} height={FACE_H}>
          <g transform={unit} fill={`url(#${uid}-soft)`}>
            <ellipse cx="45.5" cy="61" rx={rx} ry={ry} />
            <ellipse cx="74.5" cy="61" rx={rx} ry={ry} />
            {glasses && <rect x="52" y="54" width="16" height="10" />}
          </g>
        </mask>
        <mask id={`${uid}-mm`} maskUnits="userSpaceOnUse" x={ox} y="0" width={FACE_W} height={FACE_H}>
          <ellipse cx="60" cy="72" rx="9" ry="5.5" fill={`url(#${uid}-soft)`} transform={unit} />
        </mask>
      </defs>
      <image href={FACE_BLANK} width={TOTAL} height={FACE_H} />
      {skinT("b", FACE_BLANK_SKIN)}
      {!drawn && (
        <g mask={`url(#${uid}-em)`}>
          <image href={FACE_STRIP} width={TOTAL} height={FACE_H} />
          {skinT("e", FACE_SKIN)}
          {t && <Tint id={`${uid}-tf`} href={FACE_EYES} x={ox} w={FACE_W} h={FACE_H} total={TOTAL} fill={tintOf(t, uid)} />}
        </g>
      )}
      {!mouth && (
        <g mask={`url(#${uid}-mm)`}>
          <image href={FACE_STRIP} width={TOTAL} height={FACE_H} />
          {skinT("m", FACE_SKIN)}
        </g>
      )}
      <g transform={unit}>
        {drawn}
        {mouth}
        {config.faceDeco && decoArt(config.faceDeco, uid)}
      </g>
    </svg>
  );
}
