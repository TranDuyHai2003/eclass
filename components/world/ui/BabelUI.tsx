"use client";
/**
 * Thư viện Babel — giao diện: giá sách (5 kệ × 32 gáy), trang sách (40 × 80 ký tự, 410 trang), Mục lục (tra cứu câu →
 * địa chỉ duy nhất), bàn đọc của Thủ thư (vài văn bản công cộng từ "bên ngoài" — và địa chỉ của chúng trong Thư viện),
 * và cầu thang xoắn (lên / xuống). Chất liệu giấy da – gỗ – nhũ vàng, không phải trang web.
 */
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { X, ChevronLeft, ChevronRight, Search, BookOpen, ArrowUp, ArrowDown, Home } from "lucide-react";
import { useWorld } from "../store";
import { ALPHABET, BOOK_DIGITS, PAGES, hexName, lines, normalize, pageAt, search, spineTitle, type Address } from "@/lib/world/babel";
import { ENTRY_HEX, jumpToHex, openBabelUi, useBabel } from "../scene/babelState";
import { unlockNote } from "../story/quest";
import { sfx } from "@/lib/world/sfx";
import "./babel.css";

type L = { en: string; vi: string };
/** Văn bản thuộc phạm vi công cộng (tác giả mất đã lâu) — "sách từ bên ngoài" trên bàn của Thủ thư */
const DESK_TEXTS: { id: string; title: L; by: L; text: string }[] = [
  {
    id: "kieu",
    title: { en: "The Tale of Kiều (opening)", vi: "Truyện Kiều (mở đầu)" },
    by: { en: "Nguyễn Du, early 19th century", vi: "Nguyễn Du, đầu thế kỷ XIX" },
    text: "Trăm năm trong cõi người ta,\nChữ tài chữ mệnh khéo là ghét nhau.\nTrải qua một cuộc bể dâu,\nNhững điều trông thấy mà đau đớn lòng.\nLạ gì bỉ sắc tư phong,\nTrời xanh quen thói má hồng đánh ghen.",
  },
  {
    id: "lvt",
    title: { en: "Lục Vân Tiên (opening)", vi: "Lục Vân Tiên (mở đầu)" },
    by: { en: "Nguyễn Đình Chiểu, 19th century", vi: "Nguyễn Đình Chiểu, thế kỷ XIX" },
    text: "Trước đèn xem chuyện Tây Minh,\nGẫm cười hai chữ nhân tình éo le.\nHỡi ai lẳng lặng mà nghe,\nDữ răn việc trước, lành dè thân sau.",
  },
  {
    id: "euclid",
    title: { en: "Euclid's Elements, Book I — Definitions", vi: "Cơ sở của Euclid, Quyển I — Định nghĩa" },
    by: { en: "Euclid, c. 300 BC (tr. T. L. Heath, 1908)", vi: "Euclid, khoảng 300 TCN (bản dịch T. L. Heath, 1908)" },
    text: "A point is that which has no part. A line is breadthless length. The extremities of a line are points. A straight line is a line which lies evenly with the points on itself. A surface is that which has length and breadth only.",
  },
  {
    id: "flatland",
    title: { en: "Flatland (opening)", vi: "Flatland — Xứ Phẳng (mở đầu)" },
    by: { en: "Edwin A. Abbott, 1884", vi: "Edwin A. Abbott, 1884" },
    text: "I call our world Flatland, not because we call it so, but to make its nature clearer to you, my happy readers, who are privileged to live in Space.",
  },
];

const close = () => openBabelUi(null);
const t = (lang: "vi" | "en", vi: string, en: string) => (lang === "vi" ? vi : en);

export function BabelUI() {
  const ui = useBabel((s) => s.ui);
  const lang = useWorld((s) => (s.lang === "vi" ? "vi" : "en"));
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT")) {
        if (e.key === "Escape") el.blur();
        return;
      }
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  if (!ui) return null;
  return (
    <motion.div className="w-modal w-babel-modal pointer-events-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
      <motion.div className="w-babel" initial={{ y: 18, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ duration: 0.28, ease: [0.2, 0.9, 0.3, 1] }} onClick={(e) => e.stopPropagation()}>
        {ui.mode === "shelf" && <Shelf wall={ui.wall} lang={lang} />}
        {ui.mode === "reader" && <Reader addr={ui.addr} hl={ui.hl} lang={lang} />}
        {ui.mode === "search" && <Catalogue lang={lang} initial={ui.text} />}
        {ui.mode === "desk" && <Desk lang={lang} />}
        {ui.mode === "stair" && <Stair lang={lang} />}
      </motion.div>
    </motion.div>
  );
}

function Head({ kicker, title, lang, children }: { kicker: string; title: string; lang: "vi" | "en"; children?: React.ReactNode }) {
  return (
    <header className="w-babel__head">
      <div className="w-babel__ht">
        <span className="w-babel__kicker">{kicker}</span>
        <h2 className="w-babel__title">{title}</h2>
      </div>
      {children}
      <button type="button" className="w-babel__btn w-babel__btn--icon" onClick={() => openBabelUi({ mode: "search" })} title={t(lang, "Mục lục", "Catalogue")}>
        <Search />
      </button>
      <button type="button" className="w-babel__btn w-babel__btn--icon" onClick={close} aria-label="Close">
        <X />
      </button>
    </header>
  );
}

function HexTag({ hex, lang }: { hex: bigint; lang: "vi" | "en" }) {
  const n = hexName(hex);
  return (
    <span className="w-babel__hex" title={t(lang, `Tên phòng có ${n.digits} chữ số (cơ số 36)`, `The room's name has ${n.digits} digits (base 36)`)}>
      {t(lang, "Phòng", "Hexagon")} <b>{n.short}</b> <small>({n.digits.toLocaleString(lang === "vi" ? "vi-VN" : "en-US")} {t(lang, "chữ số", "digits")})</small>
    </span>
  );
}

function Shelf({ wall, lang }: { wall: number; lang: "vi" | "en" }) {
  const hex = useBabel((s) => s.hex);
  const spines = useMemo(
    () =>
      Array.from({ length: 5 }, (_, shelf) =>
        Array.from({ length: 32 }, (_, vol) => {
          const title = spineTitle({ hex, wall, shelf, vol });
          let h = 0;
          for (const ch of `${hex.toString(36).slice(-10)}:${wall}:${shelf}:${vol}`) h = (Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0);
          return { title, hue: h % 10, tall: 78 + (h % 22) };
        }),
      ),
    [hex, wall],
  );
  return (
    <>
      <Head kicker={t(lang, `TƯỜNG ${wall + 1} / 4 · 5 KỆ × 32 CUỐN`, `WALL ${wall + 1} / 4 · 5 SHELVES × 32 BOOKS`)} title={t(lang, "Giá sách", "The shelves")} lang={lang}>
        <HexTag hex={hex} lang={lang} />
      </Head>
      <div className="w-babel__shelves">
        {spines.map((row, shelf) => (
          <div key={shelf} className="w-babel__row">
            {row.map((b, vol) => (
              <button
                key={vol}
                type="button"
                className={`w-babel__spine w-babel__spine--c${b.hue}`}
                style={{ height: `${b.tall}%` }}
                title={`${t(lang, "Kệ", "Shelf")} ${shelf + 1} · ${t(lang, "cuốn", "vol.")} ${vol + 1} — “${b.title}”`}
                onClick={() => {
                  sfx.click();
                  openBabelUi({ mode: "reader", addr: { hex, wall, shelf, vol, page: 0 } });
                }}
              >
                <i>{b.title}</i>
              </button>
            ))}
            <span className="w-babel__plank" />
          </div>
        ))}
      </div>
      <p className="w-babel__foot">{t(lang, "Nhan đề trên gáy không nói gì về nội dung. Rút một cuốn ra mà đọc.", "Spine titles say nothing about the contents. Pull one out and read.")}</p>
    </>
  );
}

function Reader({ addr, hl, lang }: { addr: Address; hl?: { at: number; len: number }; lang: "vi" | "en" }) {
  const [page, setPage] = useState(addr.page);
  const [jump, setJump] = useState("");
  const a = useMemo(() => ({ ...addr, page }), [addr, page]);
  const text = useMemo(() => pageAt(a), [a]);
  const rows = lines(text);
  const go = (p: number) => {
    setPage(Math.max(0, Math.min(PAGES - 1, p)));
    sfx.click();
  };
  const showHl = hl && page === addr.page;
  return (
    <>
      <Head
        kicker={t(lang, `KỆ ${a.shelf + 1} · CUỐN ${a.vol + 1} · TƯỜNG ${a.wall + 1}`, `SHELF ${a.shelf + 1} · VOLUME ${a.vol + 1} · WALL ${a.wall + 1}`)}
        title={`“${spineTitle(a)}”`}
        lang={lang}
      >
        <HexTag hex={a.hex} lang={lang} />
      </Head>
      <div className="w-babel__book">
        <button type="button" className="w-babel__turn" onClick={() => go(page - 1)} disabled={page === 0} aria-label="Previous page">
          <ChevronLeft />
        </button>
        <div className="w-babel__page" aria-label={`page ${page + 1}`}>
          {rows.map((r, i) => {
            if (!showHl) return <div key={i}>{r}</div>;
            const s = i * 80;
            const e = s + 80;
            const h0 = Math.max(hl.at, s);
            const h1 = Math.min(hl.at + hl.len, e);
            if (h1 <= h0) return <div key={i}>{r}</div>;
            return (
              <div key={i}>
                {r.slice(0, h0 - s)}
                <mark>{r.slice(h0 - s, h1 - s)}</mark>
                {r.slice(h1 - s)}
              </div>
            );
          })}
          <span className="w-babel__pno">— {page + 1} —</span>
        </div>
        <button type="button" className="w-babel__turn" onClick={() => go(page + 1)} disabled={page === PAGES - 1} aria-label="Next page">
          <ChevronRight />
        </button>
      </div>
      <footer className="w-babel__bar">
        <span>
          {t(lang, "Trang", "Page")} <b>{page + 1}</b> / {PAGES}
        </span>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const n = parseInt(jump, 10);
            if (n >= 1 && n <= PAGES) go(n - 1);
          }}
        >
          <input className="w-babel__input w-babel__input--num" inputMode="numeric" value={jump} onChange={(e) => setJump(e.target.value.replace(/\D/g, ""))} placeholder="1–410" />
        </form>
        <button type="button" className="w-babel__btn" onClick={() => go(Math.floor(Math.random() * PAGES))}>
          {t(lang, "Trang ngẫu nhiên", "Random page")}
        </button>
        <button type="button" className="w-babel__btn" onClick={() => openBabelUi({ mode: "shelf", wall: a.wall })}>
          <BookOpen /> {t(lang, "Trả lên kệ", "Back to shelf")}
        </button>
        {a.hex !== ENTRY_HEX && (
          <button
            type="button"
            className="w-babel__btn"
            onClick={() => {
              jumpToHex(ENTRY_HEX);
              close();
            }}
          >
            <Home /> {t(lang, "Về phòng của Tịnh", "Back to Tịnh's room")}
          </button>
        )}
      </footer>
    </>
  );
}

function Catalogue({ lang, initial }: { lang: "vi" | "en"; initial?: string }) {
  const [text, setText] = useState(initial ?? "");
  const [mode, setMode] = useState<"random" | "blank">("random");
  const [variant, setVariant] = useState(0);
  const norm = normalize(text);
  const res = useMemo(() => (norm.length ? search(norm, mode, variant) : null), [norm, mode, variant]);
  return (
    <>
      <Head kicker={t(lang, "MỤC LỤC · SONG ÁNH", "CATALOGUE · A BIJECTION")} title={t(lang, "Câu của bạn nằm ở đâu?", "Where does your sentence live?")} lang={lang} />
      <div className="w-babel__cat">
        <label className="w-babel__label" htmlFor="babel-q">
          {t(lang, "Gõ bất kỳ câu nào (tiếng Việt có dấu cũng được — Thư viện chỉ có 25 ký hiệu nên dấu sẽ bị bỏ):", "Type any sentence (only 25 symbols exist here, so accents and other characters are dropped):")}
        </label>
        <textarea id="babel-q" className="w-babel__input w-babel__textarea" value={text} maxLength={3200} onChange={(e) => setText(e.target.value)} placeholder={t(lang, "vd. toán học là ngôn ngữ của vũ trụ", "e.g. mathematics is the language of the universe")} />
        <div className="w-babel__norm">
          <span>{t(lang, "Viết bằng 25 ký hiệu:", "In the 25 symbols:")}</span> <code>{norm || "—"}</code>
        </div>
        <div className="w-babel__seg" role="group">
          <button type="button" className={`w-babel__btn${mode === "random" ? " is-on" : ""}`} onClick={() => setMode("random")}>
            {t(lang, "Giữa chữ ngẫu nhiên", "Among random letters")}
          </button>
          <button type="button" className={`w-babel__btn${mode === "blank" ? " is-on" : ""}`} onClick={() => setMode("blank")}>
            {t(lang, "Đầu trang, còn lại trắng", "Alone on a blank page")}
          </button>
          <button type="button" className="w-babel__btn" onClick={() => setVariant((v) => v + 1)} disabled={!res}>
            {t(lang, "Một trang khác cũng chứa nó", "Another page that has it")}
          </button>
        </div>
        {res && (
          <div className="w-babel__result">
            <HexTag hex={res.addr.hex} lang={lang} />
            <span>
              {t(lang, "Tường", "Wall")} <b>{res.addr.wall + 1}</b> · {t(lang, "kệ", "shelf")} <b>{res.addr.shelf + 1}</b> · {t(lang, "cuốn", "volume")} <b>{res.addr.vol + 1}</b> · {t(lang, "trang", "page")} <b>{res.addr.page + 1}</b>
            </span>
            <button
              type="button"
              className="w-babel__btn w-babel__btn--gold"
              onClick={() => {
                jumpToHex(res.addr.hex);
                unlockNote("babel");
                sfx.chime(3);
                openBabelUi({ mode: "reader", addr: res.addr, hl: { at: res.at, len: res.text.length } });
              }}
            >
              <BookOpen /> {t(lang, "Đi tới và mở trang", "Go there and open it")}
            </button>
          </div>
        )}
        <p className="w-babel__math">
          {t(
            lang,
            `Địa chỉ = (trang × K + C) mod 25^3200 — một song ánh: mỗi trang có đúng một chỗ, nên không cần dò, chỉ cần tính. Cả Thư viện có 25^1 312 000 cuốn — một số có ${(BOOK_DIGITS + 1).toLocaleString("vi-VN")} chữ số. Bảng chữ: “${ALPHABET}”.`,
            `Address = (page × K + C) mod 25^3200 — a bijection: every page has exactly one place, so you don't search, you compute. The Library holds 25^1 312 000 books — a number with ${(BOOK_DIGITS + 1).toLocaleString("en-US")} digits. Alphabet: “${ALPHABET}”.`,
          )}
        </p>
      </div>
    </>
  );
}

function Desk({ lang }: { lang: "vi" | "en" }) {
  return (
    <>
      <Head kicker={t(lang, "BÀN ĐỌC CỦA THỦ THƯ TỊNH", "TỊNH'S READING DESK")} title={t(lang, "Sách từ bên ngoài", "Books from outside")} lang={lang} />
      <div className="w-babel__desk">
        {DESK_TEXTS.map((d) => (
          <article key={d.id} className="w-babel__card">
            <h3>{d.title[lang]}</h3>
            <small>{d.by[lang]}</small>
            <pre>{d.text}</pre>
            <button
              type="button"
              className="w-babel__btn w-babel__btn--gold"
              onClick={() => {
                const r = search(d.text, "blank");
                jumpToHex(r.addr.hex);
                unlockNote("babel");
                sfx.chime(4);
                openBabelUi({ mode: "reader", addr: r.addr, hl: { at: r.at, len: r.text.length } });
              }}
            >
              <Search /> {t(lang, "Tìm trang này trong Thư viện", "Find this page in the Library")}
            </button>
          </article>
        ))}
      </div>
      <footer className="w-babel__bar">
        <span>{t(lang, "Văn bản phạm vi công cộng. Mọi trang của chúng — đã bỏ dấu — vốn đã nằm trên các kệ này.", "Public-domain texts. Every page of them — accents stripped — was already on these shelves.")}</span>
        <button
          type="button"
          className="w-babel__btn"
          onClick={() => {
            close();
            useWorld.setState({ nearby: { kind: "portal", id: "impossible", label: "" } });
            window.dispatchEvent(new CustomEvent("world:portal", { detail: "impossible" }));
          }}
        >
          <Home /> {t(lang, "Rời Thư viện (về Bốt Siêu khối)", "Leave the Library (back to the Booth)")}
        </button>
      </footer>
    </>
  );
}

function Stair({ lang }: { lang: "vi" | "en" }) {
  const start = (dir: 1 | -1) => {
    close();
    sfx.circle();
    useBabel.setState({ climb: { dir, t0: performance.now() } });
  };
  return (
    <>
      <Head kicker={t(lang, "CẦU THANG XOẮN", "SPIRAL STAIR")} title={t(lang, "Đi đâu?", "Which way?")} lang={lang} />
      <div className="w-babel__stair">
        <button type="button" className="w-babel__big" onClick={() => start(1)}>
          <ArrowUp /> {t(lang, "Lên một tầng", "Up one floor")}
        </button>
        <button type="button" className="w-babel__big" onClick={() => start(-1)}>
          <ArrowDown /> {t(lang, "Xuống một tầng", "Down one floor")}
        </button>
      </div>
      <p className="w-babel__foot">{t(lang, "Cầu thang chìm xuống vực sâu và vươn lên những khoảng cách xa xăm — chưa ai đi tới cùng.", "The stair sinks into the abyss and climbs to remote distances — no one has reached either end.")}</p>
    </>
  );
}
