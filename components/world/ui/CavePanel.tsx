"use client";
/** Hang Platon — trải nghiệm "tù nhân": ngồi nhìn vách, đoán vật từ bóng, quay đầu nhìn vật thật, bóng của khối 4D */
import { useEffect } from "react";
import { motion } from "motion/react";
import { X } from "lucide-react";
import { useWorld } from "../store";
import { BENCH, useCave, type CaveStep } from "../scene/PlatoCave";
import { unlockNote } from "../story/quest";
import { sfx } from "@/lib/world/sfx";
import { CAM } from "../combat/combat";
import "./babel.css";

type L = { en: string; vi: string };
const Q1: { id: string; t: L; ok?: boolean }[] = [
  { id: "disc", t: { en: "A flat disc", vi: "Một cái đĩa phẳng" } },
  { id: "ball", t: { en: "A ball", vi: "Một quả cầu" } },
  { id: "cyl", t: { en: "A cylinder seen end-on", vi: "Một hình trụ nhìn dọc trục" } },
  { id: "unk", t: { en: "Can't know from the shadow alone", vi: "Chỉ nhìn bóng thì không thể biết chắc" }, ok: true },
];
const Q2: { id: string; t: L; ok?: boolean }[] = [
  { id: "2", t: { en: "2 dimensions", vi: "2 chiều" } },
  { id: "3", t: { en: "3 dimensions — it's a cube in a cube", vi: "3 chiều — một khối lập phương trong khối lập phương" } },
  { id: "4", t: { en: "4 dimensions — a tesseract", vi: "4 chiều — một siêu khối" }, ok: true },
];

function setCam(step: CaveStep) {
  const s = useWorld.getState();
  // Góc nhìn thứ nhất của tù nhân: ẩn nhân vật, máy quay ở ngay mắt
  CAM.hideSelf = step === "sit" || step === "q1" || step === "q2" || step === "turn";
  // góc nhìn rộng hơn để thấy trọn bóng trên vách
  CAM.fovKick = CAM.hideSelf ? 24 : 0;
  if (step === "sit" || step === "q1" || step === "q2") {
    s.player.set(BENCH.x, 0, BENCH.z);
    useWorld.setState({ playerYaw: Math.PI, camYaw: 0, camPitch: -0.12, camDist: 0.12 });
  } else if (step === "turn") {
    useWorld.setState({ camYaw: Math.PI, camPitch: 0.02, camDist: 0.12 });
  } else useWorld.setState({ camDist: 3.2, camPitch: 0.16 });
}
function go(step: CaveStep, answer: string | null = null) {
  useCave.setState({ step, answer });
  setCam(step);
  sfx.click();
}

export function CavePanel({ onClose }: { onClose: () => void }) {
  const lang = useWorld((s) => (s.lang === "vi" ? "vi" : "en"));
  const { step, answer } = useCave();
  useEffect(() => {
    const st = useCave.getState().step;
    if (st === "off") go("sit");
    else setCam(st); // mở lại giữa chừng: áp lại góc nhìn của bước hiện tại
    return () => {
      CAM.hideSelf = false;
      CAM.fovKick = 0;
    };
  }, []);
  const close = () => {
    go("off");
    onClose();
  };
  const t = (vi: string, en: string) => (lang === "vi" ? vi : en);
  const choice = (list: typeof Q1, next: CaveStep) => (
    <div className="w-cave__choices">
      {list.map((c) => (
        <button
          key={c.id}
          type="button"
          className={`w-babel__btn${answer === c.id ? (c.ok ? " is-on" : " is-wrong") : ""}`}
          onClick={() => {
            useCave.setState({ answer: c.id });
            if (c.ok) sfx.chime(3);
            else sfx.miss();
          }}
        >
          {c.t[lang]}
        </button>
      ))}
      {answer && list.find((c) => c.id === answer)?.ok && (
        <button type="button" className="w-babel__btn w-babel__btn--gold" onClick={() => go(next)}>
          {next === "turn" ? t("Quay đầu lại nhìn", "Turn around") : t("Bước ra ánh sáng", "Walk out into the light")}
        </button>
      )}
    </div>
  );
  return (
    <motion.div className="w-cave pointer-events-auto" initial={{ x: "-50%", y: 30, opacity: 0 }} animate={{ x: "-50%", y: 0, opacity: 1 }} exit={{ x: "-50%", y: 30, opacity: 0 }}>
      <header className="w-cave__head">
        <span className="w-babel__kicker">{t("HANG CỦA PLATON", "PLATO'S CAVE")}</span>
        <button type="button" className="w-babel__btn w-babel__btn--icon" onClick={close} aria-label="Close">
          <X />
        </button>
      </header>
      {(step === "sit" || step === "q1") && (
        <>
          <p>{t("Bạn bị xích, chỉ nhìn được vách đá. Một cái bóng tròn hiện lên. Đó là bóng của vật gì?", "You are chained and can only see the wall. A round shadow appears. What casts it?")}</p>
          {choice(Q1, "turn")}
          {answer && !Q1.find((c) => c.id === answer)?.ok && <p className="w-cave__hint">{t("Đĩa, cầu, trụ, nón… đều có thể đổ bóng tròn. Cái bóng đã đánh mất một chiều.", "A disc, a ball, a cylinder, a cone… all can cast a round shadow. The shadow has lost a dimension.")}</p>}
        </>
      )}
      {step === "turn" && (
        <>
          <p>{t("Bạn quay đầu: đó là một hình trụ. Khi nó xoay ngang, bóng trên vách biến thành hình chữ nhật — cùng một vật, hai cái bóng khác hẳn nhau.", "You turn: it's a cylinder. As it turns sideways its shadow becomes a rectangle — one object, two very different shadows.")}</p>
          <button type="button" className="w-babel__btn w-babel__btn--gold" onClick={() => go("q2")}>
            {t("Nhìn lại vách — một cái bóng lạ hơn", "Look at the wall again — a stranger shadow")}
          </button>
        </>
      )}
      {step === "q2" && (
        <>
          <p>{t("Cái bóng này như hình lập phương lồng trong hình lập phương, các góc nối nhau, và nó cứ 'lộn trong ra ngoài'. Vật thật có mấy chiều?", "This shadow looks like a cube inside a cube, corners joined, and it keeps turning inside-out. How many dimensions does the real object have?")}</p>
          {choice(Q2, "done")}
          {answer && !Q2.find((c) => c.id === answer)?.ok && <p className="w-cave__hint">{t("Một khối lập phương xoay không bao giờ 'lộn trong ra ngoài'. Chỉ vật có thêm một chiều mới làm được.", "A rotating cube never turns inside-out. Only something with an extra dimension can.")}</p>}
        </>
      )}
      {step === "done" && (
        <>
          <p>
            {t(
              "Đó là bóng 2 chiều của bóng 3 chiều của một siêu khối 4 chiều. Như tù nhân của Platon, ta chỉ thấy hình chiếu — vật lý đo những cái bóng (quang phổ, vết hạt, ảnh) rồi dựng lại thực tại đã tạo ra chúng.",
              "That was the 2-D shadow of the 3-D shadow of a 4-D tesseract. Like Plato's prisoners we only see projections — physics measures shadows (spectra, particle tracks, images) and reconstructs the reality that cast them.",
            )}
          </p>
          <button
            type="button"
            className="w-babel__btn w-babel__btn--gold"
            onClick={() => {
              unlockNote("plato");
              close();
            }}
          >
            {t("Rời hang", "Leave the cave")}
          </button>
        </>
      )}
    </motion.div>
  );
}
