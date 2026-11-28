"use client";
/**
 * HUD của phù thuỷ hoạ âm (Gối Xếp Im): tên + mode, thanh "mũi ghim còn lại", dòng hướng dẫn đòn, sơ đồ sóng dừng nhỏ
 * (bao |sin(nπx/L)|, nút trong = chấm — đã may thì đặc), lượt dự đoán: chỉ hiện n cũ → n mới + công thức, KHÔNG vẽ nút mới.
 * Gắn bằng createRoot vào .w-root (GoiXepIm.tsx) → nằm ngoài Canvas, đọc store thưa; dùng lại kiểu .w-boss của Siren,
 * đặt ngay dưới thanh máu Nàng Tiên Cá. Chữ song ngữ: GXI_TEXT (kiểu L của lib/world/i18n.ts).
 */
import { useWorld } from "../../../store";
import { fmtNum } from "@/lib/world/i18n";
import { GXI, gxiText, type GxiTextKey } from "@/lib/world/witchGoiXepIm";
import { useWitchUi } from "./witchUi";
import "./witch.css";

const W = 240;
const H = 52;

/** đường bao sóng dừng n bụng: hai nhánh ±|sin| (path SVG) */
function envPath(n: number): string {
  let top = "";
  let bot = "";
  for (let i = 0; i <= 96; i++) {
    const x = (i / 96) * W;
    const a = Math.abs(Math.sin((Math.PI * n * i) / 96)) * (H / 2 - 6);
    top += `${i ? "L" : "M"}${x.toFixed(1)} ${(H / 2 - a).toFixed(1)}`;
    bot += `${i ? "L" : "M"}${x.toFixed(1)} ${(H / 2 + a).toFixed(1)}`;
  }
  return `${top} ${bot}`;
}

export function WitchHud() {
  const lang = useWorld((s) => (s.lang === "vi" ? "vi" : "en"));
  const u = useWitchUi();
  if (!u.on) return null;
  const t = (k: GxiTextKey, p?: Record<string, string | number>) => gxiText(lang, k, p);
  const predict = u.stage === "predict";
  let tag: { text: string; warn: boolean } | null = null;
  if (u.stage === "dormant") tag = { text: t("dormant"), warn: false };
  else if (u.stage === "reveal") tag = { text: t("reveal"), warn: true };
  else if (u.stage === "demo") tag = { text: t("demo"), warn: false };
  else if (predict) tag = { text: t("predict", { n: u.n }), warn: true };
  else if (u.stage === "fight" && u.atk) tag = { text: t(u.atk === "whip" ? "whip" : "slam"), warn: true };
  else if (u.stage === "hush" || u.stage === "done") tag = { text: t(u.stage === "done" ? "win" : "hush"), warn: false };
  const inner = u.n - 1;
  const sewn = u.pins.slice(0, inner).filter((p) => p >= 1).length;
  const hz = GXI.HZ * u.n;
  const showN = predict ? u.prevN : u.n;
  return (
    <div className="w-witch">
      <div className="w-boss__name">
        <span>{t("name")}</span>
        <i>{predict ? t("modeNext", { a: u.prevN, b: u.n }) : u.stage === "dormant" ? "" : t("mode", { n: u.n })}</i>
      </div>
      <div className="w-boss__hp">
        <div style={{ width: `${(u.hp / Math.max(1, u.maxHp)) * 100}%` }} className="w-witch__hp" />
      </div>
      {tag && <div className={`w-boss__tag ${tag.warn ? "w-boss__tag--warn" : ""}`}>{tag.text}{u.count > 0 ? ` · ${u.count}` : ""}</div>}
      {u.stage !== "dormant" && u.stage !== "done" && (
        <div className="w-witch__card">
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
            <line x1={0} y1={H / 2} x2={W} y2={H / 2} className="w-witch__axis" />
            {!predict && <path d={envPath(showN)} className="w-witch__env" />}
            {predict && <path d={envPath(u.prevN)} className="w-witch__env w-witch__env--old" />}
            {/* hai đầu kẹp cố định */}
            <rect x={0} y={4} width={4} height={H - 8} className="w-witch__clamp" />
            <rect x={W - 4} y={4} width={4} height={H - 8} className="w-witch__clamp" />
            {!predict &&
              Array.from({ length: inner }, (_, i) => {
                const x = ((i + 1) / u.n) * W;
                const p = u.pins[i] ?? 0;
                return <circle key={i} cx={x} cy={H / 2} r={5} className={p >= 1 ? "w-witch__node is-sewn" : p > 0 ? "w-witch__node is-half" : "w-witch__node"} />;
              })}
            {predict && (
              <text x={W / 2} y={H / 2 + 6} textAnchor="middle" className="w-witch__q">
                ? ? ?
              </text>
            )}
          </svg>
          <div className="w-witch__row">
            {predict ? (
              <span>
                {t("predictFormula")} · L = {fmtNum(u.L, lang, 1)} m
              </span>
            ) : (
              <span>
                {t("loops", { n: u.n, hz })} · {t("node")} {sewn}/{inner}
              </span>
            )}
          </div>
          {u.stage === "fight" && <div className="w-witch__row w-witch__row--dim">{t("pinHint", { k: sewn, m: inner })}</div>}
        </div>
      )}
    </div>
  );
}
