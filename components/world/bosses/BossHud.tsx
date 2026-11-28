"use client";
/**
 * HUD boss / sự kiện của Vùng Kỳ quan: thanh máu + pha (dùng lại kiểu .w-boss của Siren), thẻ toán (Khiên Đối xứng / Sổ),
 * dải sự kiện Đêm Đèn lồng, dòng thông báo. Đọc các store cập nhật thưa (≤ 8 lần/s) — không re-render mỗi khung.
 */
import { useEffect, useState } from "react";
import { useWorld } from "../store";
import { fmtNum, t as tt, type Lang } from "@/lib/world/i18n";
import { LANE_NAMES, laneProb } from "@/lib/world/rainLedger";
import { lcmPeriods } from "@/lib/world/lanternNight";
import { useBossToast, useBossUi, useEventUi } from "./bossStore";
import "../ui/story.css";
import "./bossHud.css";

const num = (n: number) => (n < 0 ? `−${-n}` : `${n}`);
const LANE_HEX = ["#ff8c8c", "#ffd16b", "#8deb9e", "#8cb8ff"];

export function ExpanseBossHud() {
  const lang = useWorld((s) => (s.lang === "vi" ? "vi" : "en")) as Lang;
  const b = useBossUi();
  const ev = useEventUi();
  return (
    <div className="bx-wrap">
      {b.on && <BossBar lang={lang} />}
      {!b.on && ev.on && <EventBanner lang={lang} />}
      <Toast />
    </div>
  );
}

function BossBar({ lang }: { lang: Lang }) {
  const b = useBossUi();
  const t = (k: string, p?: Record<string, string | number>) => tt(lang, k, p);
  const shielded = b.mode === "seal" || (b.id === "ledger" && b.mode !== "exposed");
  let tag: { text: string; warn: boolean } | null = null;
  if (b.mode === "intro") tag = { text: t(b.id === "surveyor" ? "bxIntro" : "bxShake"), warn: false };
  else if (b.mode === "stun") tag = { text: t("bxStun"), warn: false };
  else if (b.mode === "lowered") tag = { text: t("bxLowered"), warn: false };
  else if (b.mode === "exposed") tag = { text: t("bxExposed"), warn: false };
  else if (b.mode === "spill") tag = { text: t("bxSpill"), warn: true };
  else if (b.id === "surveyor" && b.atk) tag = { text: t(`bxAtk_${b.atk}`), warn: true };
  else if (b.id === "ledger" && b.atk === "shake") tag = { text: t("bxShake"), warn: true };
  else if (b.id === "surveyor" && b.mode === "fight") tag = { text: t("bxArmored"), warn: false };
  else if (b.id === "ledger" && b.mode === "fight") tag = { text: t("bxSealed"), warn: false };
  return (
    <div className="w-boss">
      <div className="w-boss__name">
        <span>{t(b.id === "surveyor" ? "bxSurveyor" : "bxLedger")}</span>
        <i>{t("bxPhase", { n: b.phase })}</i>
      </div>
      <div className="w-boss__hp">
        <div style={{ width: `${(b.hp / b.maxHp) * 100}%` }} className={shielded ? "is-shield" : ""} />
      </div>
      {b.id === "ledger" && b.ledger && (
        <div className="bx-pts" title={t("bxLedgerPts")}>
          <div style={{ width: `${Math.min(1, b.ledger.points / b.ledger.need) * 100}%` }} />
        </div>
      )}
      {tag && <div className={`w-boss__tag ${tag.warn ? "w-boss__tag--warn" : ""}`}>{tag.text}</div>}
      {b.id === "surveyor" && b.seal && <SealCard lang={lang} />}
      {b.id === "ledger" && b.ledger && <LedgerCard lang={lang} />}
    </div>
  );
}

function SealCard({ lang }: { lang: Lang }) {
  const b = useBossUi();
  const s = b.seal!;
  const t = (k: string, p?: Record<string, string | number>) => tt(lang, k, p);
  return (
    <div className="bx-card">
      <div>
        <b>{t("bxSeal")}</b>
      </div>
      <div className="bx-row bx-math">
        <span className="bx-chip bx-chip--gold">ℓ: {s.line}</span>
        {s.stakes.map((k) => (
          <span key={k.name} className={`bx-chip ${k.pinned ? "bx-chip--ok" : ""}`}>
            {k.name}({num(k.u)}; {num(k.v)}){k.pinned ? " ✓" : ""}
          </span>
        ))}
        <span className="bx-chip">{t("bxYou", { u: num(b.pu), v: num(b.pv) })}</span>
        <span className="bx-chip">{s.left}s</span>
      </div>
      <div className="bx-hint bx-hint--long">{t(s.ghost ? "bxSealGhost" : "bxSealNoGhost")}</div>
      {s.tries > 0 && <div className="bx-math">{t("bxSealRule", { rule: s.rule })}</div>}
      {s.wrong && <div className="bx-warn">{t("bxSealWrong")}</div>}
    </div>
  );
}

function LedgerCard({ lang }: { lang: Lang }) {
  const b = useBossUi();
  const L = b.ledger!;
  const t = (k: string, p?: Record<string, string | number>) => tt(lang, k, p);
  const tot = L.w.reduce((a, x) => a + x, 0);
  const anyPay = L.pay.some((v) => v !== 1);
  return (
    <div className="bx-card">
      <div className="bx-row bx-math">
        {L.w.map((w, i) => (
          <span key={i} className={`bx-chip ${L.bet === i ? "bx-chip--bet" : ""}`} style={{ color: LANE_HEX[i] }}>
            {LANE_NAMES[i]}: p = {w}/{tot} ≈ {fmtNum(laneProb(L.w, i), lang)}
            {anyPay ? ` · v = ${L.pay[i]}` : ""}
          </span>
        ))}
        <span className="bx-chip bx-chip--gold">
          {t("bxLedgerPts")} {fmtNum(L.points, lang, 1)}/{L.need}
        </span>
      </div>
      <div className="bx-hint bx-hint--long">{t(L.k === 2 ? "bxLedgerP2" : "bxLedgerHow")}</div>
      <div className="bx-hint bx-math bx-hint--long">
        {t("bxDrawn")}: {L.counts.map((c, i) => `${LANE_NAMES[i]} ${c}`).join(" · ")} ({t("bxExpected")} {L.expect.map((e) => fmtNum(e, lang, 1)).join(" · ")})
      </div>
      {L.last && <div className="bx-math">{L.last}</div>}
    </div>
  );
}

function EventBanner({ lang }: { lang: Lang }) {
  const e = useEventUi();
  const t = (k: string, p?: Record<string, string | number>) => tt(lang, k, p);
  return (
    <div className="bx-card">
      <div>
        <b>{t("evLantern")}</b> · {e.state === "intro" ? t("evIntro") : t("evWave", { w: e.wave, n: e.waves, left: e.left })}
      </div>
      {e.state === "wave" && (
        <div className="bx-hint bx-math">
          {e.periods.length > 1 ? t("evSync", { a: e.periods[0], b: e.periods[1], l: lcmPeriods(e.periods), s: fmtNum(e.sync, lang, 1) }) : `T = ${fmtNum(e.periods[0] ?? 0, lang, 1)} s · ${t("evHint")}`}
        </div>
      )}
    </div>
  );
}

function Toast() {
  const toast = useBossToast();
  // ẩn sau 4 s: ghi nhớ mốc "at" đã hết hạn (đặt trong hẹn giờ, không đọc đồng hồ khi render)
  const [expired, setExpired] = useState(0);
  useEffect(() => {
    if (!toast.at) return;
    const id = setTimeout(() => setExpired(toast.at), 4000);
    return () => clearTimeout(id);
  }, [toast.at]);
  if (!toast.text || expired === toast.at) return null;
  return <div className={`bx-toast bx-toast--${toast.kind}`}>{toast.text}</div>;
}
