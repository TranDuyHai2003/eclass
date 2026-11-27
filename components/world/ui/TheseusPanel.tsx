"use client";
/** Con tàu của Theseus: thay ván → câu hỏi "từ tấm thứ mấy thì không còn là tàu cũ?" → hai con tàu → bỏ phiếu → các học thuyết */
import { useEffect } from "react";
import { motion } from "motion/react";
import { X, Hammer, FastForward, RotateCcw } from "lucide-react";
import { useWorld } from "../store";
import { VIEW, replaceMany, replaceNext, resetShip, useTheseus, type Vote } from "../scene/TheseusDocks";
import { unlockNote } from "../story/quest";
import { N_PLANKS, THEORIES, originalShare, verdict, type Theory, type Verdict } from "@/lib/world/theseus";
import { sfx } from "@/lib/world/sfx";
import "./theseus.css";

type T = (vi: string, en: string) => string;

export function TheseusPanel({ onClose }: { onClose: () => void }) {
  const lang = useWorld((s) => (s.lang === "vi" ? "vi" : "en"));
  const t: T = (vi, en) => (lang === "vi" ? vi : en);
  const { k, vote, limit } = useTheseus();
  useEffect(() => {
    // đứng phía nam hai ụ, nhìn ngang mạn cả hai con tàu (máy quay sau lưng, hướng −z)
    useWorld.getState().player.set(VIEW.x, 0, VIEW.z);
    useWorld.setState({ playerYaw: Math.PI, camYaw: 0, camPitch: 0.42, camDist: 7.5 });
    return () => useWorld.setState({ camDist: 3.2, camPitch: 0.16 });
  }, []);
  useEffect(() => {
    if (vote) unlockNote("theseus");
  }, [vote]);
  const share = originalShare(k);
  const complete = k >= N_PLANKS;
  const askLimit = k >= N_PLANKS / 2 && limit === null;
  return (
    <motion.div className="w-ship pointer-events-auto" initial={{ x: "-50%", y: 30, opacity: 0 }} animate={{ x: "-50%", y: 0, opacity: 1 }} exit={{ x: "-50%", y: 30, opacity: 0 }}>
      <header className="w-ship__head">
        <span className="w-ship__kicker">{t("CON TÀU CỦA THESEUS · PLUTARCH, ~75 SCN", "THE SHIP OF THESEUS · PLUTARCH, ~75 AD")}</span>
        <button type="button" className="w-ship__btn w-ship__btn--icon" onClick={onClose} aria-label="Close">
          <X />
        </button>
      </header>
      <div className="w-ship__gauges">
        <Gauge label={t("Tàu A · ván gốc", "Ship A · original planks")} v={N_PLANKS - k} tone="a" />
        <Gauge label={t("Tàu B · ván cũ đã ráp", "Ship B · old planks reassembled")} v={k} tone="b" />
      </div>
      {!complete && !askLimit && (
        <>
          <p>
            {k === 0
              ? t("Người Athens giữ con tàu của Theseus làm kỷ vật. Ván mục thì thay ván mới. Còn những tấm ván cũ… Mộc đem sang ụ bên cạnh.", "The Athenians kept Theseus's ship as a memorial. When a plank rotted they replaced it. And the old planks… Moc carries them to the next dock.")
              : t(`Đã thay ${k}/${N_PLANKS} tấm — tàu A còn ${Math.round(share * 100)}% gỗ gốc. Nó vẫn là tàu của Theseus chứ?`, `${k}/${N_PLANKS} planks replaced — ship A is ${Math.round(share * 100)}% original wood. Is it still Theseus's ship?`)}
          </p>
          <div className="w-ship__row">
            <button type="button" className="w-ship__btn w-ship__btn--gold" onClick={replaceNext}>
              <Hammer />
              {t("Thay 1 tấm ván", "Replace 1 plank")}
            </button>
            <button type="button" className="w-ship__btn" onClick={() => replaceMany(Math.min(6, N_PLANKS - k))}>
              <FastForward />
              {t("Thay 6 tấm", "Replace 6")}
            </button>
          </div>
        </>
      )}
      {askLimit && (
        <>
          <p>{t("Một nửa con tàu đã là gỗ mới. Theo bạn, từ tấm thứ mấy thì tàu A KHÔNG còn là tàu của Theseus?", "Half the ship is new wood now. In your view, from which plank on is ship A NO LONGER Theseus's ship?")}</p>
          <div className="w-ship__row">
            {[1, 6, 12, 13, 24].map((n) => (
              <button key={n} type="button" className="w-ship__btn" onClick={() => (useTheseus.setState({ limit: n }), sfx.click())}>
                {t(`Tấm thứ ${n}`, `Plank ${n}`)}
              </button>
            ))}
            <button type="button" className="w-ship__btn w-ship__btn--gold" onClick={() => (useTheseus.setState({ limit: 0 }), sfx.click())}>
              {t("Không bao giờ — vẫn là nó", "Never — it's still the ship")}
            </button>
          </div>
        </>
      )}
      {limit !== null && !complete && (
        <p className="w-ship__hint">
          {limit === 0
            ? t("Bạn chọn tính liên tục: hình dạng và lịch sử không đứt thì con tàu vẫn là nó. Nhớ câu này — lát nữa sẽ có con tàu thứ hai…", "You chose continuity: if shape and history never break, the ship stays itself. Remember that — a second ship is coming…")
            : t(`Bạn đặt ranh giới ở tấm ${limit}. Nhưng tấm ${limit} có gì đặc biệt hơn tấm ${Math.max(1, limit - 1)}? Đây là nghịch lý "đống cát" (sorites): một thay đổi nhỏ không bao giờ đủ để đổi danh tính, vậy mà rất nhiều thay đổi nhỏ thì đủ.`, `You drew the line at plank ${limit}. But what makes plank ${limit} special compared to plank ${Math.max(1, limit - 1)}? This is the sorites ("heap") paradox: one small change never changes identity, yet many small changes do.`)}
        </p>
      )}
      {limit !== null && !complete && (
        <div className="w-ship__row">
          <button type="button" className="w-ship__btn w-ship__btn--gold" onClick={() => replaceMany(N_PLANKS - k)}>
            <FastForward />
            {t("Thay nốt toàn bộ", "Replace all the rest")}
          </button>
        </div>
      )}
      {complete && !vote && (
        <>
          <p>{t("Tàu A: 100% gỗ mới, vẫn neo ở ụ cũ, vẫn mang tên. Tàu B: ráp đúng từ 24 tấm ván gốc theo đúng vị trí cũ. Đâu mới là Tàu của Theseus?", "Ship A: 100% new wood, same dock, same name. Ship B: rebuilt from the 24 original planks in their original places. Which one is the Ship of Theseus?")}</p>
          <div className="w-ship__row">
            {(
              [
                ["a", t("Tàu A", "Ship A")],
                ["b", t("Tàu B", "Ship B")],
                ["both", t("Cả hai", "Both")],
                ["neither", t("Không chiếc nào", "Neither")],
              ] as [Vote, string][]
            ).map(([v, label]) => (
              <button key={v} type="button" className="w-ship__btn w-ship__btn--gold" onClick={() => (useTheseus.setState({ vote: v }), sfx.chime(1))}>
                {label}
              </button>
            ))}
          </div>
        </>
      )}
      {complete && vote && <Theories t={t} vote={vote} />}
      {complete && (
        <div className="w-ship__row">
          <button type="button" className="w-ship__btn" onClick={resetShip}>
            <RotateCcw />
            {t("Đóng lại từ đầu", "Start over")}
          </button>
        </div>
      )}
    </motion.div>
  );
}

function Gauge({ label, v, tone }: { label: string; v: number; tone: "a" | "b" }) {
  return (
    <div className={`w-ship__gauge is-${tone}`}>
      <span>{label}</span>
      <div className="w-ship__planks">
        {Array.from({ length: N_PLANKS }, (_, i) => (
          <i key={i} className={i < v ? "is-on" : ""} />
        ))}
      </div>
      <b>
        {v}/{N_PLANKS}
      </b>
    </div>
  );
}

const NAMES: Record<Theory, [string, string, string, string]> = {
  continuity: ["Liên tục", "Continuity", "Hình dạng và lịch sử không đứt quãng ⇒ đó vẫn là nó.", "Unbroken shape and history ⇒ it's still the same thing."],
  matter: ["Vật chất", "Matter", "Là nó nếu làm từ chính vật chất ấy.", "It's the same if it's made of the same stuff."],
  function: ["Chức năng & tên gọi", "Function & name", "Cái đang chạy, đang mang tên, đang được dùng.", "Whatever sails, bears the name and is used."],
  fourd: ["Bốn chiều", "Four-dimensional", "Vật là 'con sâu thời gian'; A và B chung một quá khứ rồi tách đôi.", "Objects are 'time-worms'; A and B share one past, then split."],
  nihil: ["Hư vô", "Nihilism", "'Cùng một con tàu' chỉ là cách gọi; sự thật là ván nào ở đâu.", "'Same ship' is just a label; the facts are which plank is where."],
};
function cell(v: Verdict, t: T) {
  return v === "yes" ? t("✔ là", "✔ yes") : v === "no" ? t("✘ không", "✘ no") : v === "both" ? t("◐ một phần", "◐ partly") : t("∅ câu hỏi rỗng", "∅ empty question");
}

function Theories({ t, vote }: { t: T; vote: Vote }) {
  const match = (th: Theory) => {
    const r = verdict(th, N_PLANKS);
    if (vote === "a") return r.a === "yes" && r.b === "no";
    if (vote === "b") return r.b === "yes" && r.a === "no";
    if (vote === "both") return r.a === "both";
    return r.a === "empty";
  };
  return (
    <div className="w-ship__theories">
      <table>
        <thead>
          <tr>
            <th>{t("Học thuyết", "Theory")}</th>
            <th>{t("Tàu A", "Ship A")}</th>
            <th>{t("Tàu B", "Ship B")}</th>
          </tr>
        </thead>
        <tbody>
          {THEORIES.map((th) => {
            const r = verdict(th, N_PLANKS);
            const n = NAMES[th];
            return (
              <tr key={th} className={match(th) ? "is-you" : ""}>
                <td>
                  <b>{t(n[0], n[1])}</b>
                  {match(th) && <em className="w-ship__you">{t("← lựa chọn của bạn", "← your pick")}</em>}
                  <small>{t(n[2], n[3])}</small>
                </td>
                <td>{cell(r.a, t)}</td>
                <td>{cell(r.b, t)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p>
        {t(
          "Không có đáp án được chứng minh — mỗi học thuyết là một cách ĐỊNH NGHĨA \"cùng một\". Và câu hỏi rất thật: tế bào hồng cầu của bạn thay mới sau khoảng 120 ngày; một ban nhạc thay hết thành viên; một kho mã mà mọi dòng đã được viết lại; dòng sông Heraclitus không ai tắm hai lần. Bạn có còn là bạn của năm ngoái?",
          "No answer can be proven — each theory is a way of DEFINING \"the same\". And the question is real: your red blood cells are replaced about every 120 days; a band can replace every member; a codebase can have every line rewritten; no one steps in Heraclitus's river twice. Are you the same you as last year?",
        )}
      </p>
    </div>
  );
}
