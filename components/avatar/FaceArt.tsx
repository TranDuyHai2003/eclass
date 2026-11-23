import type { ReactNode } from "react";
import { ITEM_BY_ID } from "@/lib/game/items";
import { FACES, PRESETS, hasFaceParts, type LookConfig } from "@/lib/game/presets";

export const FACE_STRIP = "/studio/faces.webp";
const FACE_EYES = "/studio/faces-eyes.webp";
const FACE_BLANK = "/studio/faces-blank.webp"; // mặt đã xoá mắt + miệng → phối bộ phận
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

/** Nét vẽ thêm trên mắt (toạ độ đơn vị mặt: mắt trái 45.5,61 · mắt phải 74.5,61) */
const happyEye = <path d="M37.5 63.5Q45.5 53 53.5 63.5" fill="none" stroke={LASH} strokeWidth="2.6" strokeLinecap="round" />;
const EYE_DRAW: Record<string, { paint: "both" | "left" | "none"; draw?: ReactNode }> = {
  happy: { paint: "none", draw: both(happyEye) },
  closed: {
    paint: "none",
    draw: both(
      <g fill="none" stroke={LASH} strokeLinecap="round">
        <path d="M37.5 60Q45.5 67 53.5 60" strokeWidth="2.4" />
        <path d="M39.6 62.8l-2 2.2M45.5 64.6v2.6M51.4 62.8l2 2.2" strokeWidth="1.2" />
      </g>,
    ),
  },
  wink: {
    paint: "left",
    draw: (
      <g fill="none" stroke={LASH} strokeLinecap="round" strokeLinejoin="round">
        <path d="M82 56.5L68.5 61.5L82 65.5" strokeWidth="2.5" />
      </g>
    ),
  },
  sparkle: {
    paint: "both",
    draw: both(
      <g fill="#fff" stroke="#fff6c8" strokeWidth="0.4">
        <path d={star(48.8, 57.4, 3.4, 4, 0.32)} />
        <path d={star(42.6, 65, 1.7, 4, 0.34)} />
      </g>,
    ),
  },
  fierce: {
    paint: "both",
    draw: both(<path d="M35.8 52.6L54.5 56.8" fill="none" stroke={LASH} strokeWidth="2.8" strokeLinecap="round" />),
  },
  heart: {
    paint: "none",
    draw: both(
      <g>
        <path d={heart(45.5, 61.5, 8)} fill="#ff4f7b" stroke="#8a1c3a" strokeWidth="1.1" strokeLinejoin="round" />
        <ellipse cx="42.4" cy="58.2" rx="2" ry="1.3" fill="#fff" opacity="0.85" transform="rotate(-30 42.4 58.2)" />
      </g>,
    ),
  },
  dizzy: { paint: "none", draw: both(<path d={spiral(45.5, 61)} fill="none" stroke={LASH} strokeWidth="1.6" strokeLinecap="round" />) },
};

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

/**
 * Khuôn mặt vẽ tay (ô `face` của faces.webp, căn theo mắt) đặt vào khung x/y/width/height.
 * Có phối bộ phận (eyeShape / mouth / faceDeco) → mặt trơn + mắt (mắt vẽ tay của mặt nguồn qua mặt nạ elip mờ, hoặc nét vẽ)
 * + miệng + trang điểm; không phối → nguyên mặt. Màu mắt tô lại khi khác màu mắt gốc của mặt nguồn.
 */
export function FaceArt({ uid, face, config, x, y, width, height }: { uid: string; face: number; config: LookConfig; x: number; y: number; width: number; height: number }) {
  const ox = face * FACE_W;
  const tintFor = (src: number) => (config.eyes && config.eyes !== presetEyes(src) ? config.eyes : null);
  const attrs = { x, y, width, height, viewBox: `${ox} 0 ${FACE_W} ${FACE_H}`, "data-face": FACES[face].id };
  if (!hasFaceParts(config)) {
    const t = tintFor(face);
    return (
      <svg {...attrs}>
        <image href={FACE_STRIP} width={TOTAL} height={FACE_H} />
        {t && <Tint id={`${uid}-tf`} href={FACE_EYES} x={ox} w={FACE_W} h={FACE_H} total={TOTAL} fill={tintOf(t, uid)} />}
      </svg>
    );
  }
  const shape = config.eyeShape ?? null;
  const srcIdx = shape ? FACES.findIndex((f) => f.id === shape) : -1;
  const drawn = shape && srcIdx < 0 ? EYE_DRAW[shape] : undefined;
  const src = srcIdx >= 0 ? srcIdx : face;
  const paint = drawn ? drawn.paint : "both";
  const glasses = FACES[src].id === "preset-scholar";
  const [rx, ry] = glasses ? [14, 13] : [11, 12];
  const unit = `translate(${ox - 78} -132) scale(3)`; // đơn vị mặt (x 26..94, y 44..90) → px của ô mặt
  const t = tintFor(src);
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
        <mask id={`${uid}-em`} maskUnits="userSpaceOnUse" x={ox} y="0" width={FACE_W} height={FACE_H}>
          <g transform={unit} fill={`url(#${uid}-soft)`}>
            {paint !== "none" && <ellipse cx="45.5" cy="61" rx={rx} ry={ry} />}
            {paint === "both" && <ellipse cx="74.5" cy="61" rx={rx} ry={ry} />}
            {glasses && paint === "both" && <rect x="52" y="54" width="16" height="10" />}
          </g>
        </mask>
        <mask id={`${uid}-mm`} maskUnits="userSpaceOnUse" x={ox} y="0" width={FACE_W} height={FACE_H}>
          <ellipse cx="60" cy="72" rx="9" ry="5.5" fill={`url(#${uid}-soft)`} transform={unit} />
        </mask>
      </defs>
      <image href={FACE_BLANK} width={TOTAL} height={FACE_H} />
      {paint !== "none" && (
        <g mask={`url(#${uid}-em)`}>
          <g transform={`translate(${(face - src) * FACE_W} 0)`}>
            <image href={FACE_STRIP} width={TOTAL} height={FACE_H} />
            {t && <Tint id={`${uid}-tf`} href={FACE_EYES} x={src * FACE_W} w={FACE_W} h={FACE_H} total={TOTAL} fill={tintOf(t, uid)} />}
          </g>
        </g>
      )}
      {!mouth && <image href={FACE_STRIP} width={TOTAL} height={FACE_H} mask={`url(#${uid}-mm)`} />}
      <g transform={unit}>
        {drawn?.draw}
        {mouth}
        {config.faceDeco && decoArt(config.faceDeco, uid)}
      </g>
    </svg>
  );
}
