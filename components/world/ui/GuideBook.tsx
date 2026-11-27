"use client";
/**
 * Sổ tay Sảnh Bất Khả — sách hướng dẫn có minh hoạ: mỗi chương một ý tưởng (toán, vật lý, triết học, khoa học viễn tưởng),
 * giải thích bằng lời dễ hiểu + câu hỏi "Thử nghĩ" + nơi trải nghiệm trong game. Chương Monty Hall có trò chơi tương tác và
 * mô phỏng 1 000 ván để thấy xác suất 2/3 hiện ra từ dữ liệu.
 */
import { useState } from "react";
import { motion } from "motion/react";
import { X, ChevronLeft, ChevronRight, MapPin, Lightbulb } from "lucide-react";
import { useWorld } from "../store";
import { worldAsset } from "@/lib/world/avatars";
import { sfx } from "@/lib/world/sfx";
import "./babel.css";

type L = { en: string; vi: string };
type Chapter = { id: string; img?: string; svg?: "penrose"; title: L; tag: L; body: L; think: L[]; where?: L };

const CH: Chapter[] = [
  {
    id: "booth",
    img: "guide/booth.webp",
    title: { en: "Bigger on the inside", vi: "Lớn hơn bên trong" },
    tag: { en: "Geometry · dimensions", vi: "Hình học · chiều không gian" },
    body: {
      en: "A cube's shadow on a wall is a flat square — one dimension is lost. A 4-D hypercube (tesseract) casts a 3-D 'shadow': a cube inside a cube, joined at the corners. If space had a fourth direction, a room could be folded so that its inside reaches far beyond its outside walls — like a 3-D box drawn on paper hides a whole volume inside a flat sheet.",
      vi: "Bóng của khối lập phương trên tường là một hình vuông phẳng — mất đi một chiều. Siêu khối 4 chiều (tesseract) đổ một 'bóng' 3 chiều: một hình lập phương nằm trong hình lập phương, nối nhau ở các đỉnh. Nếu không gian có thêm hướng thứ tư, một căn phòng có thể được gấp lại để bên trong của nó trải rộng hơn hẳn các bức tường bên ngoài — giống như hình hộp vẽ trên giấy giấu cả một khối trong một tờ phẳng.",
    },
    think: [
      { en: "A 2-D creature sees a sphere pass through its plane. What does it see, and in what order?", vi: "Một sinh vật 2 chiều thấy một quả cầu đi xuyên qua mặt phẳng của nó. Nó thấy gì, theo thứ tự nào?" },
      { en: "A cube has 8 corners and 12 edges. Count them for the tesseract on the Hypercore (16 and 32) — can you find the pattern?", vi: "Hình lập phương có 8 đỉnh, 12 cạnh. Đếm thử với siêu khối trên Hypercore (16 và 32) — bạn tìm ra quy luật không?" },
    ],
    where: { en: "The Tesseract Booth (step through its door)", vi: "Bốt Siêu khối (bước qua cửa)" },
  },
  {
    id: "penrose",
    svg: "penrose",
    title: { en: "The impossible triangle", vi: "Tam giác không thể" },
    tag: { en: "Projection · perception", vi: "Phép chiếu · tri giác" },
    body: {
      en: "Three bars, three right angles, one closed loop — impossible, since a triangle's angles add up to 180°. The sculpture in the court is three straight bars that do not touch: from exactly one viewpoint the end of the last bar hides behind the first. A picture is a projection, and many different 3-D objects can project to the same 2-D image.",
      vi: "Ba thanh, ba góc vuông, khép thành một vòng — không thể, vì tổng ba góc tam giác là 180°. Bức tượng ngoài sân là ba thanh thẳng KHÔNG chạm nhau: chỉ từ đúng một điểm nhìn, đầu thanh cuối nấp sau thanh đầu. Bức tranh là một phép chiếu, và nhiều vật 3 chiều khác nhau có thể cho cùng một hình 2 chiều.",
    },
    think: [{ en: "How many photos from different angles do you need to be sure of an object's real 3-D shape?", vi: "Cần bao nhiêu bức ảnh chụp từ các góc khác nhau để chắc chắn hình dạng 3 chiều thật của một vật?" }],
    where: { en: "The court, south-west corner — find the glowing ring and look back", vi: "Góc tây nam sân — tìm vòng sáng dưới chân rồi nhìn lại" },
  },
  {
    id: "hilbert",
    img: "guide/hilbert.webp",
    title: { en: "Hilbert's Grand Hotel", vi: "Khách sạn Hilbert" },
    tag: { en: "Infinity · counting", vi: "Vô hạn · phép đếm" },
    body: {
      en: "A hotel with infinitely many rooms is full — yet it can always take more guests: shift everyone from room n to n+1, or to 2n. Two sets are 'the same size' if you can pair them one-to-one; the natural numbers, the even numbers and the fractions all pair up. Cantor showed the real numbers cannot be listed this way: some infinities are bigger than others.",
      vi: "Một khách sạn vô hạn phòng đã kín chỗ — vẫn luôn nhận thêm khách: dời mọi người từ phòng n sang n+1, hoặc sang 2n. Hai tập hợp 'bằng nhau' nếu ghép được từng cặp một-một; số tự nhiên, số chẵn và phân số đều ghép được với nhau. Cantor chứng minh số thực không thể liệt kê như vậy: có những vô hạn lớn hơn những vô hạn khác.",
    },
    think: [
      { en: "Are there more natural numbers than even numbers? Explain with a pairing.", vi: "Số tự nhiên có nhiều hơn số chẵn không? Giải thích bằng cách ghép cặp." },
      { en: "Why does 'n → 2ⁿ, bus k seat s → pₖˢ' never put two people in one room?", vi: "Vì sao 'n → 2ⁿ, xe k ghế s → pₖˢ' không bao giờ xếp hai người vào một phòng?" },
    ],
    where: { en: "The endless corridor — ask Vô Cực at the desk", vi: "Hành lang không bao giờ hết — hỏi lễ tân Vô Cực" },
  },
  {
    id: "babel",
    img: "art/keyart_babel.webp",
    title: { en: "The Library of Babel", vi: "Thư viện Babel" },
    tag: { en: "Combinatorics · information", vi: "Tổ hợp · thông tin" },
    body: {
      en: "Every book of 410 pages written with 25 symbols, each exactly once: 25^1 312 000 books. Every truth and every lie is in there — which makes the whole library useless. Information is not having everything; it is choosing one thing out of many. A bijection turns 'searching' into 'computing': each page has exactly one address.",
      vi: "Mọi cuốn sách 410 trang viết bằng 25 ký hiệu, mỗi cuốn đúng một lần: 25^1 312 000 cuốn. Mọi sự thật và mọi lời dối đều có trong đó — vì thế cả thư viện trở nên vô dụng. Thông tin không phải là có tất cả; mà là chọn ra một điều giữa vô số điều. Một song ánh biến việc 'tìm' thành việc 'tính': mỗi trang có đúng một địa chỉ.",
    },
    think: [{ en: "How many different pages of just 3 letters can be written with 25 symbols?", vi: "Với 25 ký hiệu, viết được bao nhiêu trang khác nhau chỉ dài 3 ký tự?" }],
    where: { en: "Inside the Booth: the west corridor, through the amber gate", vi: "Trong Bốt: hành lang phía tây, qua cổng hổ phách" },
  },
  {
    id: "cave",
    img: "guide/cave.webp",
    title: { en: "Plato's Cave", vi: "Hang của Platon" },
    tag: { en: "Philosophy · projection", vi: "Triết học · phép chiếu" },
    body: {
      en: "Prisoners chained since birth see only shadows on a cave wall and believe the shadows are the world. One is freed, turns to the fire, walks into the sun — and is dazzled by a reality richer than any shadow. Physics often works the same way: we measure projections (a shadow, a spectrum, a track in a detector) and reconstruct the higher-dimensional thing that cast them.",
      vi: "Những tù nhân bị xích từ lúc sinh ra chỉ thấy bóng trên vách hang và tin bóng là thế giới. Một người được giải thoát, quay lại nhìn ngọn lửa, bước ra ánh mặt trời — và choáng ngợp trước một thực tại phong phú hơn mọi cái bóng. Vật lý thường làm y như vậy: ta đo các hình chiếu (cái bóng, quang phổ, vết hạt trong máy dò) rồi dựng lại vật thể nhiều chiều hơn đã tạo ra chúng.",
    },
    where: { en: "The court, north-east corner — talk to the Echo of the Cave and sit with the prisoners", vi: "Góc đông bắc sân — nói chuyện với Hồi âm của Hang rồi ngồi cùng các tù nhân" },
    think: [{ en: "The tesseract's shadow is a cube. What would a 3-D being need to 'step out' and see the whole thing?", vi: "Bóng của siêu khối là một khối lập phương. Một sinh vật 3 chiều cần gì để 'bước ra ngoài' mà thấy trọn vẹn nó?" }],
  },
  {
    id: "monty",
    img: "guide/monty.png",
    title: { en: "Three doors (Monty Hall)", vi: "Ba cánh cửa (Monty Hall)" },
    tag: { en: "Probability · a famous paradox", vi: "Xác suất · một nghịch lý nổi tiếng" },
    body: {
      en: "A prize hides behind one of three doors. You pick one; the host, who KNOWS where the prize is, opens another door showing a goat, and offers a switch. Most people think it's 50–50. It isn't: switching wins 2/3 of the time, because your first pick is right only 1/3 of the time — and the host's choice is not random. Play it, then let the simulator run 1 000 games.",
      vi: "Phần thưởng nằm sau một trong ba cánh cửa. Bạn chọn một cửa; người dẫn chương trình — người BIẾT phần thưởng ở đâu — mở một cửa khác có con dê, rồi mời bạn đổi. Hầu hết mọi người nghĩ cơ hội là 50–50. Không phải: đổi cửa thắng 2/3 số lần, vì lần chọn đầu chỉ đúng 1/3 — và người dẫn không mở cửa ngẫu nhiên. Chơi thử, rồi để máy mô phỏng 1 000 ván.",
    },
    where: { en: "The Three Doors stage, south-east of the court — play with the MC, Lumi (try the 100-door mode)", vi: "Sân khấu Ba Cánh Cửa ở đông nam sân — chơi cùng MC Lumi (thử cả chế độ 100 cửa)" },
    think: [{ en: "Imagine 100 doors: you pick one, the host opens 98 goats. Still want to stay?", vi: "Tưởng tượng 100 cánh cửa: bạn chọn 1, người dẫn mở 98 cửa có dê. Bạn vẫn muốn giữ nguyên chứ?" }],
  },
  {
    id: "theseus",
    img: "guide/theseus.webp",
    title: { en: "The Ship of Theseus", vi: "Con tàu của Theseus" },
    tag: { en: "Philosophy · identity", vi: "Triết học · bản sắc" },
    body: {
      en: "Replace a ship's planks one by one until none of the original wood is left. Is it the same ship? Now build a second ship from all the old planks — which one is the 'real' Theseus' ship? Your body replaces most of its atoms over the years; a song is the same song in any recording. Identity may live in the PATTERN, not the material.",
      vi: "Thay từng tấm ván của con tàu cho đến khi không còn mẩu gỗ cũ nào. Nó có còn là con tàu ấy? Giờ đóng con tàu thứ hai từ toàn bộ ván cũ — chiếc nào mới là tàu 'thật' của Theseus? Cơ thể bạn thay phần lớn nguyên tử qua nhiều năm; một bài hát vẫn là bài hát đó trong mọi bản thu. Có lẽ bản sắc nằm ở KHUÔN MẪU, không ở vật liệu.",
    },
    where: { en: "The twin dry docks north of the Booth — help Moc replace the planks", vi: "Hai ụ khô phía bắc Bốt — phụ Mộc thay ván tàu" },
    think: [{ en: "If you copy a file, is the copy 'the same file'? What about a teleporter that copies you?", vi: "Nếu sao chép một tệp, bản sao có phải 'cùng một tệp'? Còn một máy dịch chuyển sao chép chính bạn thì sao?" }],
  },
  {
    id: "room",
    img: "guide/room.webp",
    title: { en: "The Chinese Room", vi: "Căn phòng Trung Hoa" },
    tag: { en: "Computer science · mind", vi: "Khoa học máy tính · tâm trí" },
    body: {
      en: "A person who knows no Chinese sits in a room with a huge rulebook: symbols come in through a slot, they look up the rules and pass the right symbols out. Outside, it looks like the room understands Chinese. John Searle (1980) asked: does following rules — which is all a computer does — ever add up to understanding? Turing had proposed judging only by behaviour. Who is right is still argued about.",
      vi: "Một người không biết tiếng Trung ngồi trong phòng với cuốn sách quy tắc khổng lồ: ký hiệu đi vào qua khe, người ấy tra quy tắc rồi đưa ra đúng ký hiệu cần trả lời. Bên ngoài, căn phòng trông như hiểu tiếng Trung. John Searle (1980) hỏi: làm theo quy tắc — đúng việc máy tính làm — có bao giờ trở thành sự hiểu? Turing thì đề xuất chỉ xét hành vi. Ai đúng, đến nay vẫn còn tranh luận.",
    },
    where: { en: "The closed room on the west side of the court — talk to Lan, then take the seat inside", vi: "Căn phòng kín ở mé tây sân — nói chuyện với Lan rồi vào ngồi bàn quy tắc" },
    think: [{ en: "Does a calculator understand addition? Does a chess engine 'want' to win?", vi: "Máy tính bỏ túi có hiểu phép cộng không? Máy chơi cờ có 'muốn' thắng không?" }],
  },
  {
    id: "maxwell",
    img: "guide/maxwell.webp",
    title: { en: "Maxwell's Demon", vi: "Con quỷ của Maxwell" },
    tag: { en: "Physics · entropy · information", vi: "Vật lý · entropy · thông tin" },
    body: {
      en: "A tiny demon guards a trapdoor between two boxes of gas, letting fast molecules go right and slow ones left. One side heats up, the other cools — free energy, breaking the second law of thermodynamics? The catch (Szilárd, Landauer, Bennett): to sort, the demon must measure and remember, and erasing that memory costs at least kT·ln 2 of energy per bit. Information is physical.",
      vi: "Một con quỷ tí hon canh cửa sập giữa hai hộp khí, cho phân tử nhanh sang phải, chậm sang trái. Một bên nóng lên, bên kia lạnh đi — năng lượng miễn phí, phá vỡ định luật II nhiệt động lực học? Mấu chốt (Szilárd, Landauer, Bennett): để phân loại, con quỷ phải đo và ghi nhớ, và xoá trí nhớ đó tốn ít nhất kT·ln 2 năng lượng cho mỗi bit. Thông tin là một thứ vật lý.",
    },
    where: { en: "The brass laboratory, south-west of the court — talk to the Demon and try his job", vi: "Phòng thí nghiệm đồng ở tây nam sân — nói chuyện với Quỷ rồi thử làm việc của nó" },
    think: [{ en: "Why does your computer get warm when it deletes data?", vi: "Vì sao máy tính nóng lên khi xoá dữ liệu?" }],
  },
];

function PenroseSvg() {
  return (
    <svg viewBox="-60 -56 120 104" className="w-guide__svg" aria-hidden>
      <defs>
        <linearGradient id="pa" x1="0" x2="1"><stop offset="0" stopColor="#f2e6ff" /><stop offset="1" stopColor="#c9b8f5" /></linearGradient>
      </defs>
      <polygon points="0,-50 50,36.6 36,44.7 0,-18 -22,20 -36,20" fill="url(#pa)" stroke="#2b2350" strokeWidth="1.6" />
      <polygon points="50,36.6 -50,36.6 -43,24.5 22,24.5 0,-18 14,-26" fill="#9d8be0" stroke="#2b2350" strokeWidth="1.6" />
      <polygon points="-50,36.6 0,-50 14,-26 -22,36.6 -36,36.6 -43,24.5" fill="#4b3f8f" stroke="#2b2350" strokeWidth="1.6" />
    </svg>
  );
}

/** Ngẫu nhiên (chỉ gọi trong trình xử lý sự kiện) */
const randInt = (n: number) => Math.floor(Math.random() * n);

function MontyHall({ lang }: { lang: "vi" | "en" }) {
  const [prize, setPrize] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [opened, setOpened] = useState<number | null>(null);
  const [final, setFinal] = useState<number | null>(null);
  const [stats, setStats] = useState({ stayW: 0, stayN: 0, swW: 0, swN: 0 });
  const [sim, setSim] = useState<{ stay: number; sw: number } | null>(null);
  const reset = () => {
    setPick(null);
    setOpened(null);
    setFinal(null);
  };
  const choose = (d: number) => {
    if (pick === null) {
      // phần thưởng được giấu ngẫu nhiên lúc bạn chọn (tương đương giấu từ trước — bạn không biết nó ở đâu)
      const pz = randInt(3);
      setPrize(pz);
      setPick(d);
      const goats = [0, 1, 2].filter((x) => x !== d && x !== pz);
      setOpened(goats[randInt(goats.length)]);
      sfx.click();
    } else if (final === null && d !== opened) {
      setFinal(d);
      const switched = d !== pick;
      const win = d === prize;
      setStats((s) => (switched ? { ...s, swN: s.swN + 1, swW: s.swW + (win ? 1 : 0) } : { ...s, stayN: s.stayN + 1, stayW: s.stayW + (win ? 1 : 0) }));
      if (win) sfx.chime(3);
      else sfx.miss();
    }
  };
  const simulate = () => {
    let stay = 0;
    let sw = 0;
    for (let i = 0; i < 1000; i++) {
      const pz = randInt(3);
      const pk = Math.floor(Math.random() * 3);
      if (pk === pz) stay++;
      else sw++;
    }
    setSim({ stay, sw });
  };
  const t = (vi: string, en: string) => (lang === "vi" ? vi : en);
  return (
    <div className="w-monty">
      <div className="w-monty__doors">
        {[0, 1, 2].map((d) => {
          const open = d === opened || final !== null;
          const content = d === prize ? "🏆" : "🐐";
          return (
            <button key={d} type="button" className={`w-monty__door${pick === d ? " is-pick" : ""}${final === d ? " is-final" : ""}${open ? " is-open" : ""}`} onClick={() => choose(d)} disabled={final !== null || d === opened}>
              <span className="w-monty__in">{open ? content : d + 1}</span>
            </button>
          );
        })}
      </div>
      <p className="w-monty__msg">
        {pick === null
          ? t("Chọn một cánh cửa.", "Pick a door.")
          : final === null
            ? t(`Người dẫn mở cửa ${opened! + 1}: một con dê. Giữ cửa ${pick + 1} hay đổi?`, `The host opens door ${opened! + 1}: a goat. Stay with ${pick + 1} or switch?`)
            : final === prize
              ? t("Thắng! ", "You win! ")
              : t("Tiếc quá — là con dê. ", "A goat, sorry. ")}
        {final !== null && (
          <button type="button" className="w-babel__btn" onClick={reset}>
            {t("Chơi lại", "Play again")}
          </button>
        )}
      </p>
      <div className="w-monty__stats">
        <span>
          {t("Giữ nguyên", "Stayed")}: <b>{stats.stayW}</b>/{stats.stayN}
        </span>
        <span>
          {t("Đổi cửa", "Switched")}: <b>{stats.swW}</b>/{stats.swN}
        </span>
        <button type="button" className="w-babel__btn w-babel__btn--gold" onClick={simulate}>
          {t("Mô phỏng 1 000 ván", "Simulate 1 000 games")}
        </button>
      </div>
      {sim && (
        <div className="w-monty__bars">
          <div>
            <span>{t("Giữ", "Stay")}</span>
            <i style={{ width: `${sim.stay / 10}%` }} />
            <b>{(sim.stay / 10).toFixed(1)}%</b>
          </div>
          <div>
            <span>{t("Đổi", "Switch")}</span>
            <i className="is-sw" style={{ width: `${sim.sw / 10}%` }} />
            <b>{(sim.sw / 10).toFixed(1)}%</b>
          </div>
        </div>
      )}
    </div>
  );
}

export function GuideBook({ onClose }: { onClose: () => void }) {
  const lang = useWorld((s) => (s.lang === "vi" ? "vi" : "en"));
  const [i, setI] = useState(0);
  const c = CH[i];
  const go = (d: number) => {
    setI((x) => (x + d + CH.length) % CH.length);
    sfx.click();
  };
  return (
    <motion.div className="w-modal w-babel-modal pointer-events-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="w-babel w-guide" initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onClick={(e) => e.stopPropagation()}>
        <header className="w-babel__head">
          <div className="w-babel__ht">
            <span className="w-babel__kicker">
              {lang === "vi" ? "SỔ TAY SẢNH BẤT KHẢ" : "GUIDEBOOK OF THE IMPOSSIBLE HALLS"} · {i + 1}/{CH.length}
            </span>
            <h2 className="w-babel__title">{c.title[lang]}</h2>
          </div>
          <nav className="w-guide__toc">
            {CH.map((x, k) => (
              <button key={x.id} type="button" className={`w-guide__dot${k === i ? " is-on" : ""}`} onClick={() => setI(k)} title={x.title[lang]} />
            ))}
          </nav>
          <button type="button" className="w-babel__btn w-babel__btn--icon" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </header>
        <div className="w-guide__spread">
          <button type="button" className="w-babel__turn" onClick={() => go(-1)} aria-label="Previous">
            <ChevronLeft />
          </button>
          <motion.figure key={c.id} className="w-guide__fig" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- ảnh tĩnh của trò chơi, phục vụ từ /world */}
            {c.svg === "penrose" ? <PenroseSvg /> : <img src={worldAsset(c.img!.replace(".png", ".webp"))} alt="" />}
          </motion.figure>
          <motion.article key={c.id + "t"} className="w-guide__text" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
            <span className="w-guide__tag">{c.tag[lang]}</span>
            <p>{c.body[lang]}</p>
            <h4>
              <Lightbulb /> {lang === "vi" ? "Thử nghĩ" : "Think about it"}
            </h4>
            <ul>
              {c.think.map((q, k) => (
                <li key={k}>{q[lang]}</li>
              ))}
            </ul>
            {c.id === "monty" && <MontyHall lang={lang} />}
            {c.where && (
              <p className="w-guide__where">
                <MapPin /> {c.where[lang]}
              </p>
            )}
          </motion.article>
          <button type="button" className="w-babel__turn" onClick={() => go(1)} aria-label="Next">
            <ChevronRight />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
