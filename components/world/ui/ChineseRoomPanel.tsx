"use client";
/** Căn phòng Trung Hoa: bạn ngồi trong phòng, tra sách quy tắc theo HÌNH DẠNG ký tự, chép câu trả lời — rồi mới biết mình vừa "nói" gì */
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { X, Delete, Send, RotateCcw } from "lucide-react";
import { useWorld } from "../store";
import { SEAT, startRoom, submitAnswer, useCRoom } from "../scene/ChineseRoom";
import { unlockNote } from "../story/quest";
import { ROUNDS, RULEBOOK, glyphs, trayFor } from "@/lib/world/chineseRoom";
import { sfx } from "@/lib/world/sfx";
import "./croom.css";

type T = (vi: string, en: string) => string;

export function ChineseRoomPanel({ onClose }: { onClose: () => void }) {
  const lang = useWorld((s) => (s.lang === "vi" ? "vi" : "en"));
  const t: T = (vi, en) => (lang === "vi" ? vi : en);
  const { round, written, phase, wrong } = useCRoom();
  useEffect(() => {
    // ngồi vào bàn quy tắc, nhìn về bức tường có hai khe
    useWorld.getState().player.set(SEAT.x, 0.18, SEAT.z);
    useWorld.setState({ playerYaw: Math.PI / 2, camYaw: -Math.PI / 2, camPitch: 0.32, camDist: 2.3 });
    if (useCRoom.getState().phase === "idle") startRoom();
    return () => useWorld.setState({ camDist: 3.2, camPitch: 0.16 });
  }, []);
  useEffect(() => {
    if (phase === "done") unlockNote("chineseroom");
  }, [phase]);
  return (
    <motion.div className="w-cr pointer-events-auto" initial={{ x: "-50%", y: 30, opacity: 0 }} animate={{ x: "-50%", y: 0, opacity: 1 }} exit={{ x: "-50%", y: 30, opacity: 0 }}>
      <header className="w-cr__head">
        <span className="w-cr__kicker">{t("CĂN PHÒNG TRUNG HOA · JOHN SEARLE, 1980", "THE CHINESE ROOM · JOHN SEARLE, 1980")}</span>
        <button type="button" className="w-cr__btn w-cr__btn--icon" onClick={onClose} aria-label="Close">
          <X />
        </button>
      </header>
      {phase !== "done" ? <Work key={round} t={t} round={round} written={written} phase={phase} wrong={wrong} /> : <Reveal t={t} />}
    </motion.div>
  );
}

function Work({ t, round, written, phase, wrong }: { t: T; round: number; written: string[]; phase: string; wrong: number }) {
  const r = ROUNDS[round];
  const tray = trayFor(round);
  // số lần đã dùng mỗi ô (ô trong khay dùng được đúng một lần)
  const [used, setUsed] = useState<number[]>([]);
  const put = (i: number) => {
    if (phase !== "writing" || used.includes(i)) return;
    setUsed([...used, i]);
    useCRoom.setState({ written: [...written, tray[i]] });
    sfx.click();
  };
  const back = () => {
    if (!written.length) return;
    setUsed(used.slice(0, -1));
    useCRoom.setState({ written: written.slice(0, -1) });
  };
  const clear = () => {
    setUsed([]);
    useCRoom.setState({ written: [] });
  };
  return (
    <div className="w-cr__work">
      <div className="w-cr__desk">
        <p className="w-cr__lead">
          {phase === "incoming"
            ? t("Một mẩu giấy trượt qua khe 入…", "A slip of paper slides through the 入 slot…")
            : phase === "outgoing"
              ? t("Bạn đẩy câu trả lời ra khe 出. Bên ngoài, Lan đọc và mỉm cười: 「哇，你的中文真好！」", "You push the answer out of the 出 slot. Outside, Lan reads it and smiles: 「哇，你的中文真好！」")
              : t(`Mẩu giấy ${round + 1}/${ROUNDS.length}. Bạn không đọc được chữ nào. Hãy tìm trong sách quy tắc dòng có HÌNH DẠNG giống hệt, rồi chép phần "viết ra".`, `Slip ${round + 1}/${ROUNDS.length}. You can't read a single character. Find the rule whose SHAPES match exactly, then copy its "write" part.`)}
        </p>
        <div className="w-cr__slip" aria-label="input">
          {glyphs(r.see).map((g, i) => (
            <span key={i}>{g}</span>
          ))}
        </div>
        <div key={wrong} className={`w-cr__answer${wrong ? " is-shake" : ""}`}>
          {written.length ? written.map((g, i) => <span key={i}>{g}</span>) : <em>{t("câu trả lời của bạn…", "your answer…")}</em>}
        </div>
        <div className="w-cr__tray">
          {tray.map((g, i) => (
            <button key={i} type="button" className="w-cr__tile" disabled={used.includes(i) || phase !== "writing"} onClick={() => put(i)}>
              {g}
            </button>
          ))}
        </div>
        <div className="w-cr__row">
          <button type="button" className="w-cr__btn" onClick={back} disabled={!written.length}>
            <Delete />
            {t("Xoá 1", "Undo")}
          </button>
          <button type="button" className="w-cr__btn" onClick={clear} disabled={!written.length}>
            {t("Xoá hết", "Clear")}
          </button>
          <button type="button" className="w-cr__btn w-cr__btn--red" onClick={submitAnswer} disabled={phase !== "writing" || !written.length}>
            <Send />
            {t("Đẩy ra khe 出", "Push through 出")}
          </button>
        </div>
        {wrong > 0 && phase === "writing" && <p className="w-cr__hint">{t("Chưa khớp với quy tắc. So từng nét — thứ tự cũng phải đúng, kể cả dấu câu.", "That doesn't match the rule. Compare stroke by stroke — order matters, punctuation too.")}</p>}
      </div>
      <div className="w-cr__book">
        <div className="w-cr__bookhead">{t("SÁCH QUY TẮC — nếu thấy… thì viết…", "RULE BOOK — if you see… then write…")}</div>
        {RULEBOOK.map((rule) => (
          <div key={rule.id} className="w-cr__rule">
            <span className="w-cr__see">{rule.see}</span>
            <span className="w-cr__arrow">⟶</span>
            <span className="w-cr__write">{rule.write}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Reveal({ t }: { t: T }) {
  const lang = useWorld((s) => (s.lang === "vi" ? "vi" : "en"));
  return (
    <div className="w-cr__reveal">
      <p>
        <b>{t("Bây giờ mới xem bạn vừa nói gì:", "Now, here's what you just said:")}</b>
      </p>
      <table>
        <tbody>
          {ROUNDS.map((r) => (
            <tr key={r.id}>
              <td>
                <span className="w-cr__zh">{r.see}</span>
                <small>{r.q[lang]}</small>
              </td>
              <td>
                <span className="w-cr__zh">{r.write}</span>
                <small>{r.a[lang]}</small>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        {t(
          "Bạn vừa khẳng định \"tôi nói tiếng Trung trôi chảy\" và \"tất nhiên tôi hiểu\" — mà không hiểu một chữ nào. Lan bên ngoài thì tin chắc trong phòng có người thạo tiếng Trung. Searle hỏi: một máy tính chạy chương trình cũng chỉ làm đúng việc bạn vừa làm — xử lý ký hiệu theo quy tắc (cú pháp). Vậy nó có HIỂU (ngữ nghĩa) không?",
          "You just claimed \"I speak Chinese fluently\" and \"of course I understand\" — without understanding a single character. Lan, outside, is sure someone fluent is in here. Searle asks: a computer running a program does exactly what you just did — manipulate symbols by rules (syntax). Does it UNDERSTAND (semantics)?",
        )}
      </p>
      <div className="w-cr__replies">
        <div>
          <b>{t("Phản biện \"hệ thống\"", "The Systems reply")}</b>
          <span>{t("Bạn không hiểu, nhưng CẢ căn phòng — bạn + sách + giấy — thì hiểu. Searle: vậy hãy học thuộc cả cuốn sách; bạn là cả hệ thống, mà vẫn không hiểu.", "You don't understand, but the WHOLE room — you + book + paper — does. Searle: then memorise the book; now you are the whole system, and still don't understand.")}</span>
        </div>
        <div>
          <b>{t("Phản biện \"robot\"", "The Robot reply")}</b>
          <span>{t("Gắn căn phòng vào một robot có mắt, tay, đi lại trong thế giới: ký hiệu được nối với sự vật thật. Liệu khi đó nghĩa có xuất hiện?", "Put the room inside a robot with eyes and hands that moves in the world: symbols get tied to real things. Would meaning appear then?")}</span>
        </div>
        <div>
          <b>{t("Phản biện \"mô phỏng não\"", "The Brain-simulator reply")}</b>
          <span>{t("Nếu quy tắc mô phỏng đúng từng nơ-ron của một người nói tiếng Trung thì sao? Searle: mô phỏng cơn bão không làm ai ướt.", "What if the rules simulate every neuron of a Chinese speaker? Searle: a simulated storm gets no one wet.")}</span>
        </div>
        <div>
          <b>{t("Còn AI ngày nay?", "And today's AI?")}</b>
          <span>
            {t(
              "Các mô hình ngôn ngữ lớn học quy tắc từ hàng tỉ câu thay vì một cuốn sách viết tay. Có người cho rằng như thế vẫn chỉ là cú pháp; có người cho rằng \"hiểu\" chính là năng lực dùng ký hiệu đủ tốt, và não người cũng là một cỗ máy. Câu hỏi vẫn còn mở — và giờ nó không còn là tưởng tượng.",
              "Large language models learn their rules from billions of sentences instead of a hand-written book. Some say that is still only syntax; others say \"understanding\" just is the ability to use symbols well enough, and that brains are machines too. The question is still open — and it is no longer imaginary.",
            )}
          </span>
        </div>
      </div>
      <p className="w-cr__think">
        {t("Thử nghĩ: làm sao bạn biết bạn cùng lớp thật sự hiểu, chứ không chỉ trả lời đúng? Phép thử Turing (1950) chỉ nhìn hành vi bên ngoài — như Lan.", "Think: how do you know a classmate truly understands, rather than just answering correctly? The Turing test (1950) only looks at outside behaviour — like Lan does.")}
      </p>
      <button type="button" className="w-cr__btn" onClick={startRoom}>
        <RotateCcw />
        {t("Làm lại từ đầu", "Start again")}
      </button>
    </div>
  );
}
