import type { ReactNode } from "react";
import { ITEM_BY_ID } from "@/lib/game/items";
import { FACES, PRESETS, faceIndexOf, paintedLook } from "@/lib/game/presets";
import { BODIES, BODY_H, HEAD_ANCHOR } from "@/lib/game/painted-data";

const CHAR_STRIP = "/studio/characters.webp";
// Mặt nạ tóc / tròng mắt của tranh + mặt vẽ tay đã căn theo mắt SVG (scripts/studio/gen-face-assets.py)
const CHAR_HAIR = "/studio/char-hair.webp";
const CHAR_EYES = "/studio/char-eyes.webp";
// Đầu rời (cắt ở cằm) + thân theo trang phục → thay đồ vẫn giữ đầu của nhân vật
const CHAR_HEADS = "/studio/char-heads.webp";
const CHAR_BODIES = "/studio/char-bodies.webp";
const FACE_STRIP = "/studio/faces.webp";
const FACE_EYES = "/studio/faces-eyes.webp";
const FACE_W = 204;
const FACE_H = 138;
import type { AvatarConfig } from "@/lib/game/avatar";
import { cn } from "@/lib/utils";

/**
 * Nhân vật anime chibi — SVG thuần theo cấu hình (không ảnh ngoài, không ngẫu nhiên → HTML server/client khớp).
 * Tỉ lệ chibi: đầu to (~60% chiều cao), mắt to có mống mắt chuyển màu + 2 đốm sáng, tóc mái nhọn + tóc mai + vệt sáng,
 * nét viền hoạt hình. Thứ tự vẽ: nền → khung → hào quang → đồ sau lưng → tóc sau → chân → thân/áo → tay → cổ → đầu
 * → mặt → tóc trước → phụ kiện.
 */
export function Chibi({ config, size = 120, className, title, painted = true }: { config: AvatarConfig; size?: number; className?: string; title?: string; painted?: boolean }) {
  const get = (slot: keyof AvatarConfig) => (config[slot] ? ITEM_BY_ID[config[slot] as string] : undefined);
  // Dáng (tóc, áo, phụ kiện) trùng một "Mẫu nhân vật" của canvas → vẽ bằng tranh của design, màu tóc/mắt khác thì tô lại trên tranh
  const look = painted ? paintedLook(config) : null;
  // Tự chỉnh khác mẫu → thân SVG + khuôn mặt vẽ tay của mẫu (màu da theo mặt đó cho liền)
  const faceIdx = painted && !look ? faceIndexOf(config) : -1;
  const faceOf = faceIdx >= 0 ? FACES[faceIdx] : null;
  const skin = faceOf?.skin ?? get("skin")?.v ?? "#fde7d2";
  const hair = get("hair")?.v ?? "short";
  const hairRaw = get("hairColor")?.v ?? "#1f2937";
  const eye = get("eyes")?.v ?? "#4b2e1e";
  const outfit = get("outfit");
  const outfitId = outfit?.id ?? "outfit-tee";
  const shirt = outfit?.v ?? "#60a5fa";
  const accent = outfit?.v2 ?? "#1e3a8a";
  const accRaw = get("accessory")?.v;
  const acc = faceOf?.id === "preset-scholar" && accRaw === "glasses" ? undefined : accRaw; // mặt Học giả đã có kính
  const fx = get("effect")?.v;
  const frame = get("frame")?.v;
  const bg = get("background");
  const uid = `c${Math.abs(hashStr(JSON.stringify(config)))}`; // id gradient riêng khi nhiều nhân vật trên một trang

  const rainbow = hairRaw.startsWith("url(");
  const H = rainbow ? `url(#${uid}-hairRainbow)` : hairRaw;
  const hairLine = rainbow ? "#4c2a6e" : shade(hairRaw, -0.5);
  const hairShine = rainbow ? "#ffffff" : shade(hairRaw, 0.5);
  const skinShade = shade(skin, -0.12);
  const skinLine = shade(skin, -0.4);
  const shirtLine = shade(shirt, -0.45);
  const hp = { fill: H, stroke: hairLine, strokeWidth: 1.4, strokeLinejoin: "round" as const };
  const hairStyle = HAIR[hair] ?? HAIR.short;

  return (
    <svg viewBox="0 0 120 140" width={size} height={size * (140 / 120)} className={cn("select-none", className)} role="img" aria-label={title ?? "Nhân vật"}>
      <defs>
        <linearGradient id={`${uid}-hairRainbow`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f43f5e" />
          <stop offset="35%" stopColor="#f59e0b" />
          <stop offset="65%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={bg?.v ?? "#eff6ff"} />
          <stop offset="100%" stopColor={bg?.v2 ?? "#dbeafe"} />
        </linearGradient>
        <linearGradient id={`${uid}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#fde68a" />
        </linearGradient>
        <linearGradient id={`${uid}-rainbowFrame`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f472b6" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#60a5fa" />
        </linearGradient>
        <linearGradient id={`${uid}-iris`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={shade(eye, -0.45)} />
          <stop offset="55%" stopColor={eye} />
          <stop offset="100%" stopColor={shade(eye, 0.55)} />
        </linearGradient>
      </defs>

      {/* Nền */}
      {bg && <rect x="4" y="4" width="112" height="132" rx="26" fill={`url(#${uid}-bg)`} />}
      {bg?.id === "bg-galaxy" && (
        <g fill="#fff" opacity="0.85">
          <circle cx="24" cy="22" r="1.5" /><circle cx="92" cy="30" r="1.2" /><circle cx="100" cy="100" r="1.6" /><circle cx="18" cy="110" r="1.1" /><circle cx="60" cy="12" r="1" />
          <path d="M104 64l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1z" /><path d="M16 74l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
        </g>
      )}
      {bg?.id === "bg-gold" && (
        <g fill="#fff" opacity="0.7">
          <path d="M20 24l1.2 3 3 1.2-3 1.2-1.2 3-1.2-3-3-1.2 3-1.2z" /><path d="M100 110l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1z" />
        </g>
      )}

      {/* Khung */}
      {frame && (
        <rect
          x="4" y="4" width="112" height="132" rx="26" fill="none" strokeWidth="5"
          stroke={frame === "gold" ? `url(#${uid}-gold)` : frame === "rainbow" ? `url(#${uid}-rainbowFrame)` : frame}
        />
      )}
      {frame === "gold" && (
        <g fill="#fbbf24">
          <path d="M60 2l2.5 5 5 .7-3.7 3.5.9 5.2L60 14l-4.7 2.4.9-5.2L52.5 7.7l5-.7z" />
          <circle cx="12" cy="128" r="2.2" /><circle cx="108" cy="128" r="2.2" />
        </g>
      )}
      {frame === "rainbow" && (
        <g fill="#fff" opacity="0.9">
          <ellipse cx="22" cy="16" rx="9" ry="4.5" /><ellipse cx="98" cy="124" rx="9" ry="4.5" />
        </g>
      )}

      {/* Hào quang (sau đầu) */}
      {acc === "halo" && (
        <g fill="none">
          <ellipse cx="60" cy="8" rx="21" ry="4.8" stroke="#fde68a" strokeWidth="7" opacity="0.45" />
          <ellipse cx="60" cy="8" rx="21" ry="4.8" stroke="#f59e0b" strokeWidth="3" />
          <ellipse cx="60" cy="7.4" rx="19" ry="3.6" stroke="#fff7d1" strokeWidth="1" />
        </g>
      )}

      {look ? (
        // Tranh nhân vật của design: ô 332×272 trong dải 8 ô, canh đáy khung
        <svg
          x="-12" y="10" width="144" height="128" viewBox={`${look.index * 332} 0 332 272`} preserveAspectRatio="xMidYMax meet"
          data-painted={PRESETS[look.index].id} data-hair={look.hairColor ?? undefined} data-eyes={look.eyes ?? undefined}
        >
          {look.body === null ? (
            <image href={CHAR_STRIP} width="2656" height="272" />
          ) : (
            <>
              {/* thân dịch cho cổ khớp đường cằm của đầu; ô thân cao hơn để chân không hở đáy */}
              <svg
                x={look.index * 332 + HEAD_ANCHOR[look.index][0] - BODIES[look.body].anchor[0]}
                y={HEAD_ANCHOR[look.index][1] - BODIES[look.body].anchor[1]}
                width="332" height={BODY_H} viewBox={`${look.body * 332} 0 332 ${BODY_H}`}
                data-body={BODIES[look.body].outfit}
              >
                <image href={CHAR_BODIES} width={BODIES.length * 332} height={BODY_H} />
              </svg>
              <image href={CHAR_HEADS} width="2656" height="272" />
            </>
          )}
          {look.hairColor && <Tint id={`${uid}-th`} href={CHAR_HAIR} x={look.index * 332} w={332} h={272} total={2656} fill={tintOf(look.hairColor, uid)} />}
          {look.eyes && <Tint id={`${uid}-te`} href={CHAR_EYES} x={look.index * 332} w={332} h={272} total={2656} fill={tintOf(look.eyes, uid)} />}
        </svg>
      ) : (
      <>
      {/* Đồ sau lưng */}
      <OutfitBack id={outfitId} shirt={shirt} accent={accent} line={shirtLine} />

      {/* Tóc sau */}
      <g {...hp}>{hairStyle.back}</g>

      {/* Chân + giày */}
      <Legs id={outfitId} skin={skin} skinLine={skinLine} shirt={shirt} accent={accent} />

      {/* Thân + áo */}
      <Outfit id={outfitId} shirt={shirt} accent={accent} line={shirtLine} uid={uid} />

      {/* Tay áo + bàn tay */}
      <g fill={outfitId === "outfit-scientist" ? "#f8fafc" : outfitId === "outfit-astro" ? "#f1f5f9" : shirt} stroke={shirtLine} strokeWidth="1.2" strokeLinejoin="round">
        <path d="M43 96c-6 3-10 10-10.5 17 2 1.8 4.6 2 6.6.9.3-5.6 2.4-10.4 6.4-13.9z" />
        <path d="M77 96c6 3 10 10 10.5 17-2 1.8-4.6 2-6.6.9-.3-5.6-2.4-10.4-6.4-13.9z" />
      </g>
      <g fill={skin} stroke={skinLine} strokeWidth="1">
        <circle cx="35.6" cy="116" r="4.2" /><circle cx="84.4" cy="116" r="4.2" />
      </g>

      {/* Cổ */}
      <path d="M55 82h10v11H55z" fill={skinShade} />

      {/* Tai + đầu */}
      <g fill={skin} stroke={skinLine} strokeWidth="1.2">
        <ellipse cx="27" cy="60" rx="4.5" ry="6" /><ellipse cx="93" cy="60" rx="4.5" ry="6" />
        <path d="M26 52C26 31 41 19 60 19s34 12 34 33c0 14-6 24-16 30-7 4-12 6-18 6s-11-2-18-6C32 76 26 66 26 52z" />
      </g>

      {/* Mặt: vẽ tay theo mẫu (khuôn mặt đã chọn); painted=false → mặt SVG cũ */}
      {faceOf ? (
        <svg x="26" y="44" width="68" height="46" viewBox={`${faceIdx * FACE_W} 0 ${FACE_W} ${FACE_H}`} data-face={faceOf.id}>
          <image href={FACE_STRIP} width={FACE_W * FACES.length} height={FACE_H} />
          {config.eyes && config.eyes !== PRESETS.find((p) => p.id === faceOf.id)?.items.eyes && (
            <Tint id={`${uid}-tf`} href={FACE_EYES} x={faceIdx * FACE_W} w={FACE_W} h={FACE_H} total={FACE_W * FACES.length} fill={tintOf(config.eyes, uid)} />
          )}
        </svg>
      ) : (
        <Face eye={eye} uid={uid} skinLine={skinLine} />
      )}
      {/* bóng mái tóc trên trán (vẽ sau mặt để che mép trên của mặt vẽ tay) */}
      <path d="M29 47q31-10 62 0v7q-31-9-62 0z" fill={skinShade} opacity="0.7" />

      {/* Tóc trước */}
      <g {...hp}>{hairStyle.front}</g>
      {hairStyle.shine !== false && (
        <path d={hairStyle.shine ?? "M33 30q27-14 54 0"} fill="none" stroke={hairShine} strokeWidth="2.6" strokeLinecap="round" strokeDasharray="8 3.5" opacity={rainbow ? 0.55 : 0.75} />
      )}
      {hairStyle.extra?.(hairLine)}

      {/* Phụ kiện */}
      <Accessory acc={acc} uid={uid} hair={H} hairLine={hairLine} />
      </>
      )}

      {/* Hiệu ứng (bản tĩnh; banner hồ sơ có bản động) */}
      {fx && <FxStatic kind={fx} />}
    </svg>
  );
}

/* ============================== Tô màu trên tranh ============================== */

/** Màu tô của món tóc/mắt (cầu vồng → gradient của nhân vật này) */
function tintOf(itemId: string, uid: string) {
  const v = ITEM_BY_ID[itemId]?.v ?? "#000";
  return v.startsWith("url(") ? `url(#${uid}-hairRainbow)` : v;
}

/**
 * Tô lại một vùng của tranh: ảnh `href` có A = mặt nạ vùng, RGB = độ sáng đã chuẩn hoá.
 * Phủ màu đặc theo mặt nạ rồi nhân với độ sáng → giữ nét vẽ, bóng đổ, viền đen của tranh.
 */
function Tint({ id, href, x, w, h, total, fill }: { id: string; href: string; x: number; w: number; h: number; total: number; fill: string }) {
  return (
    <g style={{ isolation: "isolate" }}>
      <mask id={id} maskUnits="userSpaceOnUse" x={x} y="0" width={w} height={h} style={{ maskType: "alpha" }}>
        <image href={href} width={total} height={h} />
      </mask>
      <rect x={x} y="0" width={w} height={h} fill={fill} mask={`url(#${id})`} />
      <image href={href} width={total} height={h} style={{ mixBlendMode: "multiply" }} />
    </g>
  );
}

/* ============================== Mặt ============================== */

function Face({ eye, uid, skinLine }: { eye: string; uid: string; skinLine: string }) {
  const lash = "#2b1a12";
  const eyeAt = (cx: number, flip: boolean) => {
    const s = flip ? -1 : 1; // mắt phải lật ngang
    return (
      <g>
        <ellipse cx={cx} cy="61" rx="7.2" ry="9.2" fill="#fff" />
        <ellipse cx={cx + 0.4 * s} cy="62" rx="6.1" ry="8.1" fill={`url(#${uid}-iris)`} />
        <ellipse cx={cx + 0.4 * s} cy="63" rx="2.6" ry="3.8" fill={shade(eye, -0.6)} opacity="0.85" />
        <path d={`M${cx - 4 * s} 66.5q${4 * s} 3 ${8 * s} 0`} fill="none" stroke={shade(eye, 0.7)} strokeWidth="1.3" strokeLinecap="round" opacity="0.8" />
        <ellipse cx={cx + 2.6 * s} cy="57.6" rx="2.5" ry="3.1" fill="#fff" />
        <circle cx={cx - 2.4 * s} cy="65.4" r="1.25" fill="#fff" />
        {/* hàng mi trên + đuôi mi */}
        <path d={`M${cx - 8.4 * s} 56.2Q${cx} 48 ${cx + 8.6 * s} 54.4`} fill="none" stroke={lash} strokeWidth="2.7" strokeLinecap="round" />
        <path d={`M${cx - 8 * s} 56l${-2.4 * s} -2.4`} stroke={lash} strokeWidth="1.8" strokeLinecap="round" />
        <path d={`M${cx - 4 * s} 70.4h${7 * s}`} stroke={lash} strokeWidth="0.9" strokeLinecap="round" opacity="0.5" />
        {/* lông mày */}
        <path d={`M${cx - 5 * s} 45.6q${5 * s} -2.6 ${10 * s} 0`} fill="none" stroke={lash} strokeWidth="1.3" strokeLinecap="round" opacity="0.75" />
      </g>
    );
  };
  return (
    <g>
      {eyeAt(45.5, false)}
      {eyeAt(74.5, true)}
      {/* má hồng + vạch chéo */}
      <ellipse cx="39" cy="72" rx="6.2" ry="3.2" fill="#ff8fa3" opacity="0.55" />
      <ellipse cx="81" cy="72" rx="6.2" ry="3.2" fill="#ff8fa3" opacity="0.55" />
      <g stroke="#f0607a" strokeWidth="0.9" strokeLinecap="round" opacity="0.7">
        <path d="M36 73.4l1.6-2.6M39 73.4l1.6-2.6M42 73.4l1.6-2.6M78 73.4l1.6-2.6M81 73.4l1.6-2.6M84 73.4l1.6-2.6" />
      </g>
      {/* mũi + miệng */}
      <path d="M59.4 70.6l1.2 1.2" stroke={skinLine} strokeWidth="1.1" strokeLinecap="round" />
      <path d="M55.8 76.4Q60 81.6 64.2 76.4Q60 78 55.8 76.4z" fill="#c2334d" stroke="#8f1d35" strokeWidth="0.8" strokeLinejoin="round" />
      <ellipse cx="60" cy="79" rx="2" ry="1" fill="#ff9fb2" />
    </g>
  );
}

/* ============================== Tóc ============================== */

type HairDef = { back?: ReactNode; front: ReactNode; shine?: string | false; extra?: (line: string) => ReactNode };

// Mái nhọn chung (đỉnh đầu → mái 4 lọn nhọn, ngọn ở y≈47–50 để không che mắt)
const FRINGE =
  "M23 58C21 30 38 13 60 13s39 17 37 45q-3-12-11-18q-2 8-5 8q-2-7-8-10q-2 9-6 12q-3-9-9-12q-3 10-7 12q-2-7-9-12q-1 7-6 9q-3-5-8-7q-2 9-6 17z";
const LOCK_MED = (
  <>
    <path d="M23 49c-2 15 0 27 6 37 1.4-10 2.2-22 4.2-34z" />
    <path d="M97 49c2 15 0 27-6 37-1.4-10-2.2-22-4.2-34z" />
  </>
);
const STRANDS = (line: string) => (
  <path d="M60 15q-4 14-8 32M46 18q-5 13-9 27M74 18q5 13 7 27" fill="none" stroke={line} strokeWidth="0.9" opacity="0.4" strokeLinecap="round" />
);
const BACK_CAP = <path d="M21 58C19 29 37 12 60 12s41 17 39 46c0 8-2 15-5 20H26c-3-5-5-12-5-20z" />;

const HAIR: Record<string, HairDef> = {
  short: {
    back: <path d="M22 58C20 29 37 12 60 12s40 17 38 46c0 4-1 8-3 11H25c-2-3-3-7-3-11z" />,
    front: (
      <>
        <path d="M58 14c-3-7 2-12 9-10-4 2-6 5-5.6 10z" />
        <path d={FRINGE} />
        <path d="M23 49c-1.6 9 0 17 4.4 23 1-7 1.6-14 3.6-21z" />
        <path d="M97 49c1.6 9 0 17-4.4 23-1-7-1.6-14-3.6-21z" />
      </>
    ),
    extra: STRANDS,
  },
  bob: {
    back: <path d="M21 56C19 28 37 12 60 12s41 16 39 44c1 14 0 25-6 32-5 2-9 0-11-2H38c-2 2-6 4-11 2-6-7-7-18-6-32z" />,
    front: (
      <>
        <path d="M22 58C20 30 38 13 60 13s40 17 38 45l-6-8-3-4q-9 4-15 0-7 4-14 1-7 3-14-1-6 4-15 0l-3 4z" />
        <path d="M22 50c-2 16 0 28 8 38 3.6-1 5.6-4 4.4-8-2-9-2.4-19-1.4-29z" />
        <path d="M98 50c2 16 0 28-8 38-3.6-1-5.6-4-4.4-8 2-9 2.4-19 1.4-29z" />
      </>
    ),
    shine: "M32 31q28-15 56 0",
    extra: (line) => <path d="M44 20q-4 12-6 26M76 20q4 12 6 26" fill="none" stroke={line} strokeWidth="0.9" opacity="0.4" />,
  },
  ponytail: {
    back: (
      <>
        {BACK_CAP}
        <path d="M84 22c17-3 26 13 23 33-2 16 5 27-2 41-6-9-12-18-12-32 0-12 0-24-9-30z" />
      </>
    ),
    front: (
      <>
        <path d={FRINGE} />
        {LOCK_MED}
      </>
    ),
    extra: (line) => (
      <>
        {STRANDS(line)}
        <path d="M84 21.5c2.6-2.8 6.6-2.4 8.2.6-2.2 2.6-5.8 3-8.2-.6z" fill="#ef5a3c" stroke="#9f2a16" strokeWidth="1" />
      </>
    ),
  },
  spiky: {
    back: <path d="M18 66l-6-14 8-4-6-17h12l-2-16 14 4 6-14 12 8 10-10 8 10 14-6 4 14 12-2-4 16 10 6-8 10 6 14z" />,
    front: <path d="M22 60l-2-20 8 4-2-18 10 6 2-18 10 10 8-16 6 14 10-12 4 16 12-10v16l10-4-4 16 6 4-4 12q-4-12-10-18l-4 8-8-10-6 10-8-11-8 11-6-10-8 8-4-6q-6 6-10 18z" />,
    shine: "M36 30q24-12 48 0",
  },
  twin: {
    back: (
      <>
        {BACK_CAP}
        <path d="M28 36c-15 6-19 28-15 48 2 12-2 20-6 26 12-2 18-12 18-24 2-14 4-28 10-40z" />
        <path d="M92 36c15 6 19 28 15 48-2 12 2 20 6 26-12-2-18-12-18-24-2-14-4-28-10-40z" />
      </>
    ),
    front: (
      <>
        <path d={FRINGE} />
        {LOCK_MED}
      </>
    ),
    extra: (line) => (
      <>
        {STRANDS(line)}
        <g fill="#ef5a3c" stroke="#9f2a16" strokeWidth="1">
          <circle cx="27" cy="38" r="3.6" /><circle cx="93" cy="38" r="3.6" />
        </g>
      </>
    ),
  },
  long: {
    back: <path d="M21 56C19 28 37 12 60 12s41 16 39 44c2 24 4 44-2 62-6-4-10 2-16-2H39c-6 4-10-2-16 2-6-18-4-38-2-62z" />,
    front: (
      <>
        <path d={FRINGE} />
        <path d="M23 49c-3 20-1 40 7 56 1-16 1-36 3.2-53z" />
        <path d="M97 49c3 20 1 40-7 56-1-16-1-36-3.2-53z" />
      </>
    ),
    extra: STRANDS,
  },
  bun: {
    back: (
      <>
        {BACK_CAP}
        <circle cx="60" cy="11" r="10" />
      </>
    ),
    front: (
      <>
        <path d={FRINGE} />
        {LOCK_MED}
      </>
    ),
    extra: (line) => (
      <>
        {STRANDS(line)}
        <path d="M54 8q6-5 12 0M55 13q5 3 10 0" fill="none" stroke={line} strokeWidth="0.9" opacity="0.5" />
        <path d="M52.5 12.4q7.5 3 15 0l-.8 2.8q-6.7 2.4-13.4 0z" fill="#ef5a3c" stroke="#9f2a16" strokeWidth="0.9" />
      </>
    ),
  },
  mohawk: {
    front: (
      <>
        <path d="M28 42C30 26 43 17 60 17s30 9 32 25q-32-8-64 0z" opacity="0.2" stroke="none" />
        <path d="M49 42l-5-18 8 4-3-18 9 8 2-17 6 16 7-9-1 18 7-4-6 20q-12-5-24 0z" />
      </>
    ),
    shine: "M55 14q5-2 8 4",
  },
};

/* ============================== Trang phục ============================== */

const TORSO = "M40 100c0-6 8-9 20-9s20 3 20 9l2 20c0 3-2 4-5 4H43c-3 0-5-1-5-4z";

function OutfitBack({ id, shirt, accent, line }: { id: string; shirt: string; accent: string; line: string }) {
  if (id === "outfit-royal")
    return <path d="M39 95q-6 16-10 33h62q-4-17-10-33z" fill={shade(shirt, -0.25)} stroke={line} strokeWidth="1.2" strokeLinejoin="round" />;
  if (id === "outfit-wizard")
    return <path d="M39 95q-6 16-10 33h62q-4-17-10-33z" fill={shade(shirt, -0.3)} stroke={line} strokeWidth="1.2" strokeLinejoin="round" />;
  if (id === "outfit-knight") return <path d="M41 95q-4 15-7 31h52q-3-16-7-31z" fill={accent} stroke={shade(accent, -0.4)} strokeWidth="1.2" strokeLinejoin="round" />;
  if (id === "outfit-hoodie" || id === "outfit-cathoodie" || id === "outfit-gamer") return <path d="M41 97q2-14 19-14t19 14z" fill={shade(shirt, -0.15)} stroke={line} strokeWidth="1.2" />;
  if (id === "outfit-astro") return <rect x="39" y="93" width="42" height="28" rx="7" fill="#cbd5e1" stroke="#64748b" strokeWidth="1.2" />;
  if (id === "outfit-ninja") return <path d="M70 92q16-2 24 9-9-2-22-4z" fill={accent} stroke={shade(accent, -0.4)} strokeWidth="1" />;
  void accent;
  return null;
}

function Legs({ id, skin, skinLine, shirt, accent }: { id: string; skin: string; skinLine: string; shirt: string; accent: string }) {
  const pants =
    id === "outfit-dress" ? skin
    : id === "outfit-tee" ? "#3b5b8f"
    : id === "outfit-hoodie" ? "#374151"
    : id === "outfit-ninja" ? shade(shirt, 0.1)
    : id === "outfit-royal" ? "#f5f3ff"
    : id === "outfit-astro" ? "#f1f5f9"
    : id === "outfit-kimono" ? shade(shirt, -0.08)
    : id === "outfit-wizard" ? "#312e81"
    : id === "outfit-knight" ? "#94a3b8"
    : id === "outfit-gamer" ? "#374151"
    : id === "outfit-cathoodie" ? "#3b5b8f"
    : accent;
  const shoe =
    id === "outfit-dress" ? "#be185d"
    : id === "outfit-sport" ? "#ffffff"
    : id === "outfit-astro" ? "#e2e8f0"
    : id === "outfit-royal" || id === "outfit-kimono" ? "#7c2d12"
    : id === "outfit-knight" ? "#64748b"
    : "#3b2a1e";
  const line = id === "outfit-dress" ? skinLine : shade(pants, -0.45);
  return (
    <g strokeWidth="1.1" strokeLinejoin="round">
      <rect x="49" y="119" width="9" height="12" rx="3" fill={pants} stroke={line} />
      <rect x="62" y="119" width="9" height="12" rx="3" fill={pants} stroke={line} />
      <g fill={shoe} stroke={shade(shoe === "#ffffff" ? "#cbd5e1" : shoe, -0.35)}>
        <path d="M47 131.5c0-2.4 2.4-3.4 6-3.4s6 1 6 3.4v.6H47z" />
        <path d="M61 131.5c0-2.4 2.4-3.4 6-3.4s6 1 6 3.4v.6H61z" />
      </g>
      {id === "outfit-sport" && <path d="M48.5 130h9.5M62.5 130h9.5" stroke={accent} strokeWidth="1.2" />}
    </g>
  );
}

function Outfit({ id, shirt, accent, line, uid }: { id: string; shirt: string; accent: string; line: string; uid: string }) {
  const base = { stroke: line, strokeWidth: 1.2, strokeLinejoin: "round" as const };
  switch (id) {
    case "outfit-uniform": // đồng phục cổ thuỷ thủ + nơ đỏ
      return (
        <g>
          <path d={TORSO} fill="#ffffff" stroke="#94a3b8" strokeWidth="1.2" />
          <path d="M39.2 112h41.6l1.2 8c0 3-2 4-5 4H43c-3 0-5-1-5-4z" fill={accent} stroke={shade(accent, -0.4)} strokeWidth="1.1" />
          <path d="M51 114v9M60 114v9M69 114v9" stroke={shade(accent, 0.3)} strokeWidth="0.8" />
          <path d="M43 93q17 4 34 0l4 7-21 13-21-13z" fill={accent} stroke={shade(accent, -0.4)} strokeWidth="1.1" />
          <path d="M50 93l10 13 10-13z" fill="#ffffff" />
          <path d="M42 99.6l18 11.2 18-11.2" fill="none" stroke="#fff" strokeWidth="1" />
          <g fill="#ef4444" stroke="#991b1b" strokeWidth="0.9">
            <path d="M60 106l-7-4v8zM60 106l7-4v8z" /><path d="M58.6 107l-2 7 3.4-2.4 3.4 2.4-2-7z" /><circle cx="60" cy="106" r="2" />
          </g>
        </g>
      );
    case "outfit-hoodie":
      return (
        <g>
          <path d={TORSO} fill={shirt} {...base} />
          <path d="M56 94l-1 10M64 94l1 10" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="55" cy="104.6" r="1.1" fill="#fff" /><circle cx="65" cy="104.6" r="1.1" fill="#fff" />
          <path d="M48 111h24l-3 8H51z" fill={shade(shirt, -0.12)} {...base} />
          <path d="M40 121h40" stroke={accent} strokeWidth="2.4" />
        </g>
      );
    case "outfit-dress": // váy hoa xoè, cổ sen, nơ eo
      return (
        <g>
          <path d="M42 100c0-6 7-9 18-9s18 3 18 9l8 23c0 3-2 4-4 4H38c-2 0-4-1-4-4z" fill={shirt} {...base} />
          <path d="M50 92q4 8 10 3 6 5 10-3z" fill="#fff" stroke={shade(shirt, -0.3)} strokeWidth="0.9" />
          <path d="M43 106h34v3H43z" fill={accent} />
          <path d="M60 107.5l-5-3v6zM60 107.5l5-3v6z" fill={accent} stroke={shade(accent, -0.3)} strokeWidth="0.7" />
          <g fill="#fff">
            {[[46, 116], [60, 120], [74, 115], [53, 101], [68, 100]].map(([x, y]) => (
              <g key={`${x}-${y}`}>
                <circle cx={x - 1.6} cy={y} r="1.3" /><circle cx={x + 1.6} cy={y} r="1.3" /><circle cx={x} cy={y - 1.6} r="1.3" /><circle cx={x} cy={y + 1.6} r="1.3" />
                <circle cx={x} cy={y} r="1" fill={accent} />
              </g>
            ))}
          </g>
          <path d="M36 123q24 4 48 0" fill="none" stroke="#fff" strokeWidth="1.4" strokeDasharray="2 2" opacity="0.9" />
        </g>
      );
    case "outfit-sport":
      return (
        <g>
          <path d={TORSO} fill={shirt} {...base} />
          <path d="M42 98l-2 22M78 98l2 22" stroke="#fff" strokeWidth="2.2" />
          <path d="M52 92q8 6 16 0" fill="none" stroke={accent} strokeWidth="2" />
          <circle cx="60" cy="108" r="6" fill="#fff" stroke={accent} strokeWidth="1.2" />
          <text x="60" y="111" textAnchor="middle" fontSize="8.5" fontWeight="900" fill={accent} fontFamily="Arial, sans-serif">7</text>
        </g>
      );
    case "outfit-scientist": // áo blouse nhà toán học
      return (
        <g>
          <path d={TORSO} fill="#f8fafc" stroke="#94a3b8" strokeWidth="1.2" />
          <path d="M51 92l9 16 9-16z" fill="#bfdbfe" />
          <path d="M60 95l-2 4 2 10 2-10z" fill={accent} />
          <path d="M51 92l6 14M69 92l-6 14M60 108v16" fill="none" stroke="#94a3b8" strokeWidth="1.1" />
          <rect x="66" y="110" width="9" height="7" rx="1.5" fill="none" stroke="#94a3b8" strokeWidth="1" />
          <path d="M70 106v6" stroke="#2563eb" strokeWidth="1.6" strokeLinecap="round" />
          <text x="49.5" y="117" textAnchor="middle" fontSize="7" fontWeight="900" fill={accent} fontFamily="Georgia, serif">π</text>
        </g>
      );
    case "outfit-ninja":
      return (
        <g>
          <path d={TORSO} fill={shirt} stroke="#000" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M51 92l15 20M69 92l-8 10" stroke={shade(shirt, 0.35)} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M40 112h40v4H40z" fill={accent} />
          <path d="M47 90q13 7 26 0v5q-13 7-26 0z" fill={accent} stroke={shade(accent, -0.4)} strokeWidth="1" />
        </g>
      );
    case "outfit-royal": // hoàng bào + cổ lông + viền vàng
      return (
        <g>
          <path d={TORSO} fill={shirt} {...base} />
          <path d="M58 96h4v28h-4zM38.6 120.5h42.8" stroke={`url(#${uid}-gold)`} strokeWidth="2.2" fill={`url(#${uid}-gold)`} />
          <g fill={accent}><circle cx="60" cy="104" r="1.4" /><circle cx="60" cy="111" r="1.4" /></g>
          <path d="M43 93q17 9 34 0 1 6-3 8-14 5-28 0-4-2-3-8z" fill="#fff" stroke="#cbd5e1" strokeWidth="1" />
          <g fill="#111827"><circle cx="49" cy="98" r="0.9" /><circle cx="56" cy="100.4" r="0.9" /><circle cx="64" cy="100.4" r="0.9" /><circle cx="71" cy="98" r="0.9" /></g>
        </g>
      );
    case "outfit-astro": // bộ phi hành gia
      return (
        <g>
          <path d={TORSO} fill="#f8fafc" stroke="#64748b" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M41 99l6 2v19h-7zM79 99l-6 2v19h7z" fill={accent} opacity="0.85" />
          <rect x="53" y="101" width="14" height="10" rx="2" fill="#334155" />
          <circle cx="56.6" cy="106" r="1.5" fill="#ef4444" /><circle cx="60" cy="106" r="1.5" fill="#22c55e" /><circle cx="63.4" cy="106" r="1.5" fill="#facc15" />
          <ellipse cx="60" cy="92.6" rx="11" ry="3.6" fill="#94a3b8" stroke="#64748b" strokeWidth="1" />
        </g>
      );
    case "outfit-cathoodie": // hoodie tai mèo: dấu chân mèo + túi
      return (
        <g>
          <path d={TORSO} fill={shirt} {...base} />
          <path d="M56 94l-1 9M64 94l1 9" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
          <g fill={accent}>
            <ellipse cx="60" cy="109" rx="3.6" ry="3" /><circle cx="55.6" cy="104.6" r="1.4" /><circle cx="58.6" cy="103.2" r="1.4" /><circle cx="61.4" cy="103.2" r="1.4" /><circle cx="64.4" cy="104.6" r="1.4" />
          </g>
          <path d="M48 114h24l-2.4 7H50.4z" fill={shade(shirt, -0.1)} {...base} />
        </g>
      );
    case "outfit-gamer": // áo game thủ: viền neon + tay cầm
      return (
        <g>
          <path d={TORSO} fill={shirt} stroke="#000" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M42 99l-2 21M78 99l2 21" stroke={accent} strokeWidth="1.6" />
          <path d="M52 92q8 6 16 0" fill="none" stroke={accent} strokeWidth="1.8" />
          <rect x="51" y="104" width="18" height="9" rx="4.5" fill="#111827" stroke={accent} strokeWidth="1.2" />
          <path d="M55 108.5h4M57 106.5v4" stroke={accent} strokeWidth="1.1" strokeLinecap="round" />
          <circle cx="64" cy="107.4" r="1" fill="#f472b6" /><circle cx="66" cy="109.4" r="1" fill="#facc15" />
        </g>
      );
    case "outfit-kimono": // kimono: cổ chéo + đai obi + hoa
      return (
        <g>
          <path d="M40 100c0-6 8-9 20-9s20 3 20 9l3 24c0 2-2 3-4 3H41c-2 0-4-1-4-3z" fill={shirt} {...base} />
          <path d="M50 92l12 16M70 92l-12 12" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          <path d="M50 92l12 16M70 92l-12 12" stroke={accent} strokeWidth="1" strokeLinecap="round" opacity="0.6" />
          <path d="M39.6 108h40.8v6H39.6z" fill={accent} stroke={shade(accent, -0.4)} strokeWidth="1" />
          <path d="M60 111l-5-3v6zM60 111l5-3v6z" fill={shade(accent, 0.3)} />
          <g fill={accent} opacity="0.8">
            {[[46, 120], [72, 118], [66, 124]].map(([x, y]) => (
              <g key={`${x}-${y}`}><circle cx={x - 1.4} cy={y} r="1.2" /><circle cx={x + 1.4} cy={y} r="1.2" /><circle cx={x} cy={y - 1.4} r="1.2" /><circle cx={x} cy={y + 1.4} r="1.2" /></g>
            ))}
          </g>
        </g>
      );
    case "outfit-wizard": // áo choàng phù thuỷ: viền vàng, sao trăng
      return (
        <g>
          <path d="M41 100c0-6 7-9 19-9s19 3 19 9l5 24c0 2-2 3-4 3H40c-2 0-4-1-4-3z" fill={shirt} {...base} />
          <path d="M60 92v35" stroke={accent} strokeWidth="2.4" />
          <path d="M37 125q23 3 46 0" fill="none" stroke={accent} strokeWidth="2" />
          <path d="M49 103l1 2.2 2.4.4-1.7 1.7.4 2.4-2.1-1.1-2.1 1.1.4-2.4-1.7-1.7 2.4-.4z" fill={accent} />
          <path d="M71 112a4 4 0 1 1-3.4-5.6 3 3 0 0 0 3.4 5.6z" fill={accent} />
          <path d="M51 92q9 7 18 0" fill="none" stroke={accent} strokeWidth="2" />
        </g>
      );
    case "outfit-knight": // giáp hiệp sĩ: giáp ngực bạc, áo khoác xanh có huy hiệu
      return (
        <g>
          <path d={TORSO} fill={shirt} stroke="#64748b" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M50 94h20v26H50z" fill={accent} stroke={shade(accent, -0.4)} strokeWidth="1" />
          <path d="M60 99l5 2v5c0 4-2.4 6-5 7-2.6-1-5-3-5-7v-5z" fill="#fbbf24" stroke="#b45309" strokeWidth="0.9" />
          <path d="M40 114h40v3.4H40z" fill="#78350f" />
          <circle cx="42" cy="98" r="5" fill="#e2e8f0" stroke="#64748b" strokeWidth="1.1" /><circle cx="78" cy="98" r="5" fill="#e2e8f0" stroke="#64748b" strokeWidth="1.1" />
        </g>
      );
    default: // áo phông
      return (
        <g>
          <path d={TORSO} fill={shirt} {...base} />
          <path d="M52 92q8 6 16 0" fill="none" stroke={accent} strokeWidth="2" />
          <path d="M60 101.5l1.9 3.9 4.3.6-3.1 3 .7 4.3-3.8-2-3.8 2 .7-4.3-3.1-3 4.3-.6z" fill="#fff" stroke={accent} strokeWidth="0.9" strokeLinejoin="round" />
        </g>
      );
  }
}

/* ============================== Phụ kiện ============================== */

function Accessory({ acc, uid, hair, hairLine }: { acc?: string; uid: string; hair: string; hairLine: string }) {
  switch (acc) {
    case "scarf": // khăn quàng sọc đỏ trắng
      return (
        <g stroke="#991b1b" strokeWidth="1.1" strokeLinejoin="round">
          <path d="M66 94l3 17 6-1.4-2.6-16z" fill="#ef4444" />
          <path d="M44 87q16 9 32 0l1.4 6q-17 10-34.8 0z" fill="#ef4444" />
          <path d="M50 90.6l-1 5M57 92.6l-.4 5M64 92.4l.4 5M70.6 90.2l1 5M67.6 99l6-1.2M68.6 104l5.6-1.2" stroke="#fff" strokeWidth="1.6" />
        </g>
      );
    case "sakura": // kẹp hoa anh đào bên trái
      return (
        <g>
          {[[33, 33, 1], [41, 27, 0.8]].map(([x, y, k]) => (
            <g key={x} transform={`translate(${x} ${y}) scale(${k})`} stroke="#be185d" strokeWidth="0.8">
              {[0, 72, 144, 216, 288].map((r) => <ellipse key={r} cx="0" cy="-4.2" rx="2.8" ry="4" fill="#fbcfe8" transform={`rotate(${r})`} />)}
              <circle r="1.8" fill="#facc15" stroke="#ca8a04" />
            </g>
          ))}
        </g>
      );
    case "catears": // bờm tai mèo cùng màu tóc
      return (
        <g strokeLinejoin="round">
          <path d="M30 30l-3-20 18 9z" fill={hair} stroke={hairLine} strokeWidth="1.4" />
          <path d="M90 30l3-20-18 9z" fill={hair} stroke={hairLine} strokeWidth="1.4" />
          <path d="M31.6 26l-1.6-11 9.6 5z" fill="#f9a8d4" /><path d="M88.4 26l1.6-11-9.6 5z" fill="#f9a8d4" />
        </g>
      );
    case "wizardhat": // mũ phù thuỷ chóp cong
      return (
        <g strokeLinejoin="round" stroke="#2e1065" strokeWidth="1.3">
          <path d="M38 32C46 24 54 12 66 4c4 3 9 3 13 1-6 4-8 10-6 16 2 5 5 8 9 11z" fill="#5b21b6" />
          <path d="M40 30q20-6 40 0l-1 4q-19-5-38 0z" fill="#fbbf24" stroke="#b45309" />
          <ellipse cx="60" cy="34" rx="40" ry="7" fill="#4c1d95" />
          <path d="M62 16l1.4 3 3.2.4-2.3 2.2.6 3.2-2.9-1.5-2.9 1.5.6-3.2-2.3-2.2 3.2-.4z" fill="#fde047" stroke="#ca8a04" strokeWidth="0.7" />
        </g>
      );
    case "glasses":
      return (
        <g>
          <g fill="#fff" fillOpacity="0.14" stroke="#3b4a6b" strokeWidth="1.9">
            <circle cx="45.5" cy="61" r="9.6" /><circle cx="74.5" cy="61" r="9.6" />
          </g>
          <path d="M55.1 59.6q4.9-2.4 9.8 0M35.9 58.4L27 55.6M84.1 58.4l8.9-2.8" fill="none" stroke="#3b4a6b" strokeWidth="1.9" strokeLinecap="round" />
          <path d="M40 55.4l3-2.6M69 55.4l3-2.6" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
        </g>
      );
    case "cap":
      return (
        <g strokeLinejoin="round">
          <path d="M25 42C25 22 41 10 60 10s35 12 35 32c-11-6-23-8-35-8s-24 2-35 8z" fill="#ef4444" stroke="#991b1b" strokeWidth="1.3" />
          <path d="M60 10v24M44 14q-6 10-6 22M76 14q6 10 6 22" fill="none" stroke="#b91c1c" strokeWidth="0.9" />
          <circle cx="60" cy="10.5" r="2.4" fill="#b91c1c" />
          <path d="M24 42c14-9 58-9 72 0 0 4-4 5-8 4-16-6-40-6-56 0-4 1-8 0-8-4z" fill="#dc2626" stroke="#991b1b" strokeWidth="1.3" />
          <path d="M60 18.5l1.8 3.6 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4-2.9-2.8 4-.6z" fill="#fff" />
        </g>
      );
    case "bow":
      return (
        <g stroke="#be185d" strokeWidth="1.2" strokeLinejoin="round">
          <path d="M84 27l-4 12 4-3 3 4z" fill="#ec4899" />
          <path d="M84 26c-6-10-16-8-14 0-2 8 8 10 14 0z" fill="#f472b6" />
          <path d="M84 26c6-10 16-8 14 0 2 8-8 10-14 0z" fill="#f472b6" />
          <circle cx="84" cy="26" r="3.6" fill="#ec4899" />
          <path d="M74 22.6q2-2 4-1M90 21.6q2-1 4 1" fill="none" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
        </g>
      );
    case "headphones": // tai nghe tai mèo
      return (
        <g strokeLinejoin="round">
          <path d="M37 22l1-12 9 7zM83 22l-1-12-9 7z" fill="#374151" stroke="#111827" strokeWidth="1.1" />
          <path d="M39 19l.6-6 4.6 3.6zM81 19l-.6-6-4.6 3.6z" fill="#f9a8d4" />
          <path d="M24 54C22 26 40 11 60 11s38 15 36 43" fill="none" stroke="#374151" strokeWidth="4.2" strokeLinecap="round" />
          <g fill="#374151" stroke="#111827" strokeWidth="1.1">
            <rect x="17.5" y="48" width="12" height="19" rx="5.5" /><rect x="90.5" y="48" width="12" height="19" rx="5.5" />
          </g>
          <rect x="20.5" y="52" width="3" height="11" rx="1.5" fill="#22d3ee" /><rect x="96.5" y="52" width="3" height="11" rx="1.5" fill="#22d3ee" />
        </g>
      );
    case "crown":
      return (
        <g transform="rotate(-8 60 14)">
          <path d="M44 23l2-15 7 7 7-11 7 11 7-7 2 15z" fill={`url(#${uid}-gold)`} stroke="#b45309" strokeWidth="1.3" strokeLinejoin="round" />
          <path d="M44 23h32" stroke="#b45309" strokeWidth="1.3" />
          <circle cx="60" cy="17.6" r="2.1" fill="#ef4444" /><circle cx="51" cy="19" r="1.5" fill="#3b82f6" /><circle cx="69" cy="19" r="1.5" fill="#22c55e" />
          <circle cx="46" cy="8" r="1.4" fill="#fde68a" /><circle cx="60" cy="4" r="1.4" fill="#fde68a" /><circle cx="74" cy="8" r="1.4" fill="#fde68a" />
        </g>
      );
    default:
      return null;
  }
}

/* ============================== Hiệu ứng tĩnh ============================== */

/** Bản tĩnh của hiệu ứng trong khung nhân vật (thẻ tiệm, túi đồ, ô chọn); vị trí cố định → server/client khớp */
function FxStatic({ kind }: { kind: string }) {
  const at: [number, number, number][] = [[14, 26, 1], [104, 20, 0.8], [100, 74, 1.1], [16, 84, 0.9], [26, 118, 0.7], [96, 120, 0.8], [58, 6, 0.6]];
  if (kind === "thunder")
    return (
      <g fill="none" stroke="#22d3ee" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="60" cy="74" rx="52" ry="62" strokeWidth="1.6" strokeDasharray="10 6" opacity="0.7" />
        <path d="M12 52l6 4-4 4 6 4M106 84l-6 4 4 4-6 4M98 24l-4 6h5l-4 6" strokeWidth="2" />
      </g>
    );
  if (kind === "flame")
    return (
      <g stroke="#c2410c" strokeWidth="0.8">
        {[[14, 128, 1], [26, 132, 0.7], [106, 128, 1], [94, 132, 0.7]].map(([x, y, k]) => (
          <g key={x} transform={`translate(${x} ${y}) scale(${k})`}>
            <path d="M0 0c-7 0-9-7-5-12 1 3 3 4 4 3-1-5 2-10 6-12-1 5 4 8 4 14 0 4-3 7-9 7z" fill="#fb923c" />
            <path d="M0-2c-3 0-4-3-2-6 1 2 3 2 3 0 2 2 3 4 3 5 0 1-2 1-4 1z" fill="#fde047" stroke="none" />
          </g>
        ))}
      </g>
    );
  if (kind === "meteor")
    return (
      <g strokeLinecap="round">
        {[[20, 14], [84, 8], [100, 46]].map(([x, y]) => (
          <g key={x}>
            <path d={`M${x} ${y}l-14 10`} stroke="#c7d2fe" strokeWidth="2" opacity="0.8" />
            <circle cx={x} cy={y} r="2" fill="#fff" stroke="#818cf8" strokeWidth="0.8" />
          </g>
        ))}
      </g>
    );
  return (
    <g>
      {at.map(([x, y, k], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${k})`}>
          <FxShape kind={kind} i={i} />
        </g>
      ))}
    </g>
  );
}

/** Một hạt hiệu ứng vẽ quanh gốc (0,0), cỡ ~10 — dùng chung cho bản tĩnh và lớp động trên banner */
export function FxShape({ kind, i = 0 }: { kind: string; i?: number }) {
  switch (kind) {
    case "sparkle":
      return <path d="M0-6l1.6 4.4L6 0 1.6 1.6 0 6-1.6 1.6-6 0l4.4-1.6z" fill={i % 2 ? "#fff" : "#fde047"} stroke="#f59e0b" strokeWidth="0.6" />;
    case "sakura":
      return <path d="M0-4c3-3 6 0 4 3L0 4-4 1c-2-3 1-6 4-3z" fill="#f9a8d4" stroke="#db2777" strokeWidth="0.6" transform={`rotate(${i * 47})`} />;
    case "snow":
      return (
        <g stroke="#bae6fd" strokeWidth="1.2" strokeLinecap="round">
          <path d="M0-5v10M-4.3-2.5l8.6 5M-4.3 2.5l8.6-5" /><circle r="1.2" fill="#fff" />
        </g>
      );
    case "butterfly":
      return (
        <g transform={`rotate(${(i % 3) * 20 - 20})`} stroke="#6d28d9" strokeWidth="0.6">
          <path d="M0 0c-3-5-8-5-7-1 0 3 4 3 7 1zM0 0c3-5 8-5 7-1 0 3-4 3-7 1z" fill={i % 2 ? "#c4b5fd" : "#67e8f9"} />
          <path d="M0 0c-2 2-6 4-5 6 2 1 4-2 5-6zM0 0c2 2 6 4 5 6-2 1-4-2-5-6z" fill={i % 2 ? "#a78bfa" : "#22d3ee"} />
        </g>
      );
    case "bubble":
      return (
        <g>
          <circle r="5" fill={["#bfdbfe", "#fbcfe8", "#bbf7d0", "#fde68a"][i % 4]} fillOpacity="0.45" stroke="#60a5fa" strokeWidth="0.7" />
          <path d="M-2.4-2.4a3 3 0 0 1 2-1.4" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" fill="none" />
        </g>
      );
    case "flame":
      return <path d="M0 5c-4 0-5-4-3-7 0 2 2 2 2 1-1-3 1-6 4-7-1 3 3 5 3 8 0 3-2 5-6 5z" fill={i % 2 ? "#fb923c" : "#f472b6"} />;
    case "meteor":
      return (
        <g strokeLinecap="round">
          <path d="M0 0l-16 10" stroke="#c7d2fe" strokeWidth="2" opacity="0.8" /><circle r="2" fill="#fff" />
        </g>
      );
    case "thunder":
      return <path d="M2-7l-6 8h4l-2 6 6-8H0z" fill="#67e8f9" stroke="#0891b2" strokeWidth="0.6" strokeLinejoin="round" />;
    default:
      return null;
  }
}

/* ============================== Tiện ích ============================== */

/** Pha màu hex: amt < 0 tối đi, amt > 0 sáng lên (giá trị không phải hex → trả nguyên) */
function shade(hex: string, amt: number) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt));
  return `#${ch.map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, "0")).join("")}`;
}

function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
