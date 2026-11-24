"use client";

import { memo, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { mali, nunito } from "@/lib/fonts";
import "./ah/theme.css";
import { cancelRedemption, redeemReward, setGoalReward } from "@/actions/points";
import { buyItem, saveAvatar } from "@/actions/avatar";
import type { StudentPointsPageData } from "@/lib/points/queries";
import type { HomeTodoItem } from "@/lib/home/student-home";
import { LEVELS, getLevel } from "@/lib/points/levels";
import { rarityOf, type Rarity } from "@/lib/points/rarity";
import { ITEMS, ITEM_BY_ID, SLOTS, type Item } from "@/lib/game/items";
import type { Outcome } from "@/lib/game/gacha-shared";
import { buildNpcLines } from "@/lib/game/npc";
import { buzz, isSoundOn, onSoundChange, play, setSoundOn } from "@/lib/sound";
import { V2Art, V2_MASCOT, rewardArtV2, v2Index } from "@/components/studio/Sprite";
import { pauseOffscreen } from "@/lib/offscreen";
import { LevelUpDialog, useOnline, useTweenNumber } from "@/components/studio/effects";
import { PetSvg } from "@/components/avatar/PetSvg";
import { Confetti } from "@/components/points/Confetti";
import { CoinBurst } from "@/components/game/CoinBurst";
import { type RecentDone } from "./TasksModal";
import { type BoardData } from "./LeaderboardModal";
import { HistoryModal } from "./HistoryModal";
import { TitlesModal } from "./TitlesModal";
import { WeatherLayer } from "./Weather";
import { AvatarRing, CoinDot, GemDot, ItemArt, PlateBox, QUICK_EQUIP, RAR_LABEL, fmt, shortName } from "./ah/parts";
import { EarnSection } from "./ah/EarnSection";
import { CodeSection } from "./ah/CodeSection";
import { GachaSection } from "./ah/GachaSection";
import { GoldModal } from "./ah/GoldSection";
import { BagSection } from "./ah/BagSection";
import { CustomizeModal } from "./ah/CustomizeModal";

type Reward = StudentPointsPageData["rewards"][number];
type Sec = "shop" | "earn" | "code" | "gacha" | "gold" | "bag";
type Cat = "all" | "physical" | "voucher" | "frame" | "nameplate" | "pet" | "deco";
type RarFilter = "all" | Rarity;
type DecoSlot = "all" | Item["slot"];

const CATS: { key: Cat | "box"; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "physical", label: "Quà hiện vật" },
  { key: "voucher", label: "Thẻ đặc quyền" },
  { key: "frame", label: "Viền avatar" },
  { key: "nameplate", label: "Bảng tên" },
  { key: "pet", label: "Mèo cún" },
  { key: "deco", label: "Trang trí khác" },
  { key: "box", label: "Hộp bí ẩn (Gacha)" },
];
const CAT_TITLE: Record<Cat, string> = { all: "Tất cả sản phẩm", physical: "Quà hiện vật", voucher: "Thẻ đặc quyền", frame: "Viền avatar", nameplate: "Bảng tên", pet: "Mèo cún", deco: "Trang trí khác" };
const SEC_TITLE: Record<Exclude<Sec, "shop">, string> = { earn: "Nộp bài tập nhận xu", code: "Thẻ cào Điểm 10 & Code", gold: "Bảng Vàng server khối", gacha: "Hộp bí ẩn", bag: "Túi đồ của bé" };
/** Các ô "Trang trí khác": tóc, mắt, trang phục, phụ kiện, nền, hiệu ứng, danh hiệu (có món bán/rương) */
const DECO_SLOTS = SLOTS.filter((sl) => !["skin", "frame", "nameplate", "pet"].includes(sl.key) && ITEMS.some((i) => i.slot === sl.key && !i.free));
const HOW: Record<string, string> = {
  PHYSICAL: "Nhận tại lớp học offline. Thầy sẽ xác nhận khi trao quà cho bạn.",
  VIRTUAL: "Cất vào Túi đồ. Báo thầy khi bạn muốn dùng thẻ.",
  frame: "Tự động đeo lên hồ sơ và Bảng Vàng.",
  nameplate: "Tự động đổi bảng tên trên hồ sơ và Bảng Vàng.",
  pet: "Thú cưng đi cùng nhân vật của bạn.",
};

/** Một ô trong lưới: quà của thầy hoặc đồ trang trí/thú cưng */
type Entry =
  | { key: string; kind: "reward"; rarity: Rarity; name: string; r: Reward }
  | { key: string; kind: "item"; rarity: Rarity; name: string; it: Item };

export interface ShopPageProps {
  data: StudentPointsPageData;
  user: { id: string; name: string | null; className: string | null; grade: number | null };
  todo: HomeTodoItem[];
  todoTotal: number;
  recent?: RecentDone[];
  boards: BoardData[];
  /** Banner thử thách tuần ở Bảng Vàng (dữ liệu thật của ví) */
  event?: { title: string; text: string; badge: string } | null;
  /** null khi rương đang tắt (GACHA_ENABLED=off) */
  gacha?: { pullsToday: number } | null;
  /** Tài khoản thầy / admin xem tiệm: chỉ xem, các thao tác đổi / mở hộp / nhập mã do server từ chối */
  adminView?: boolean;
}

/** Tiệm quà — giao diện "Adorable Home" của canvas ShopV2 (thanh gỗ, khối hồ sơ, mèo linh vật, danh mục trái, thẻ theo độ hiếm); logic xu/ngọc/quà/đồ/rương giữ nguyên */
export function ShopPage({ data, user, todo, todoTotal, recent = [], boards, event = null, gacha = null, adminView = false }: ShopPageProps) {
  const router = useRouter();
  const online = useOnline();
  const [sec, setSec] = useState<Sec>("shop");
  const [cat, setCat] = useState<Cat>("all");
  const [rar, setRar] = useState<RarFilter>("all");
  const [decoSlot, setDecoSlot] = useState<DecoSlot>("all");
  const [affordOnly, setAffordOnly] = useState(false);
  const [selKey, setSelKey] = useState<string | null>(null);
  const [modal, setModal] = useState<null | "history" | "titles">(null);
  const [custom, setCustom] = useState(false);
  const [gold, setGold] = useState(false);
  const [lvUp, setLvUp] = useState<number | null>(null);
  const [soundOn, setSoundState] = useState(true);
  // Menu tiệm (chọn thời tiết) đã bỏ theo yêu cầu thầy 24/11 → luôn trời nắng
  const weather = "sun" as const;
  const [pending, start] = useTransition();
  const [celebrated, setCelebrated] = useState(0);
  const [burst, setBurst] = useState(0);
  const [fly, setFly] = useState<{ k: number; dx: number; dy: number; x: number; y: number } | null>(null);
  const [hearts, setHearts] = useState<number[]>([]);
  const [tipI, setTipI] = useState(0);
  const [avatar, setAvatar] = useState(data.avatar);
  const [owned, setOwned] = useState(() => new Set(data.ownedItems));
  const coinRef = useRef<HTMLSpanElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const firstSec = useRef(true);
  const { wallet, goal } = data;
  const level = getLevel(wallet.lifetimeEarned);
  // Ví hiển thị: cộng / trừ NGAY khi server báo thành công (nhập mã, đổi quà, mua đồ), khớp lại khi dữ liệu mới về —
  // trước 24/11 phải chờ cả trang tiệm dựng lại (rất lâu trên điện thoại) mới thấy xu đổi
  const [opt, setOpt] = useState<{ base: number; gemBase: number; xu: number; gem: number } | null>(null);
  const optLive = !!opt && opt.base === wallet.balance && opt.gemBase === wallet.gems;
  const balanceNow = optLive ? wallet.balance + opt.xu : wallet.balance;
  const gemsNow = optLive ? wallet.gems + opt.gem : wallet.gems;
  const adjust = (xu: number, gem = 0) =>
    setOpt((o) => {
      const keep = !!o && o.base === wallet.balance && o.gemBase === wallet.gems;
      return { base: wallet.balance, gemBase: wallet.gems, xu: (keep ? o.xu : 0) + xu, gem: (keep ? o.gem : 0) + gem };
    });
  const xuShown = useTweenNumber(balanceNow);
  const pet = avatar.pet ? ITEM_BY_ID[avatar.pet] : null;
  const bagCount = data.redemptions.filter((r) => r.status === "PENDING").length + owned.size;
  const plateDark = !!avatar.nameplate && ITEM_BY_ID[avatar.nameplate]?.v2 === "dark";

  const lines = useMemo(
    () =>
      buildNpcLines({
        name: user.name,
        canEarn: data.canEarn,
        todoCount: todoTotal,
        weekActivities: wallet.weekActivities,
        weekTarget: wallet.weekTarget,
        thisWeekCounted: wallet.thisWeekCounted,
        lifetimeEarned: wallet.lifetimeEarned,
        nextLevel: level.next ? { name: level.next.name, toNext: level.toNext } : null,
        balance: wallet.balance,
        gems: wallet.gems,
        goal: goal ? { title: goal.title, price: goal.price } : null,
      }).map((l) => l.replace(/Mình là Lucky Boy, bấm vào mình để nghe tiếp nhé 😉/, "Meo~ vuốt ve tớ đi, tớ kể tiếp cho nghe 🐾")),
    [user.name, data.canEarn, todoTotal, wallet, level, goal],
  );

  // Đi từ /leaderboard (hoặc link "#bang-vang") → mở sẵn hộp Bảng Vàng trong tiệm
  useEffect(() => {
    if (window.location.hash !== "#bang-vang") return;
    setGold(true);
    history.replaceState(null, "", window.location.pathname);
  }, []);

  // Âm thanh: đọc/ghi localStorage trong effect (HTML server/client khớp)
  useEffect(() => {
    setSoundState(isSoundOn());
    return onSoundChange(setSoundState);
  }, []);
  // Lên cấp: so với cấp đã thấy lần trước trong trình duyệt này
  useEffect(() => {
    try {
      const k = `last-level:${user.id}`;
      const prev = Number(localStorage.getItem(k) || 0);
      if (prev && level.level > prev) setLvUp(level.level);
      localStorage.setItem(k, String(level.level));
    } catch {
      /* bỏ qua */
    }
  }, [level.level, user.id]);
  // Đổi danh mục: nếu đầu lưới đã trôi lên khỏi màn hình thì cuộn lên. Các mục Nộp bài / Thẻ cào / Hộp bí ẩn / Túi đồ
  // mở bằng hộp nổi ngay tại chỗ (thầy 24/11: không nhảy xuống nội dung) nên không cần cuộn.
  useEffect(() => {
    if (firstSec.current) {
      firstSec.current = false;
      return;
    }
    const el = mainRef.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [cat]);
  // Đóng hộp chi tiết bằng phím Esc
  useEffect(() => {
    if (!selKey && !custom && !gold && sec === "shop") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setSelKey(null);
      setCustom(false);
      setGold(false);
      setSec("shop");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selKey, custom, gold, sec]);

  const goSec = (k: Sec) => {
    play("click");
    setSec(k);
    setSelKey(null);
  };
  const goCat = (k: Cat) => {
    play("click");
    setSec("shop");
    setCat(k);
    setSelKey(null);
  };
  /** Đồng xu bay từ giữa màn hình về ví (hoặc ngược lại) như canvas */
  const flyCoins = (dir: "in" | "out") => {
    const pill = coinRef.current?.getBoundingClientRect();
    if (!pill) return;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight * 0.55;
    const px = pill.left + 10;
    const py = pill.top + 10;
    setFly(dir === "in" ? { k: Date.now(), x: cx, y: cy, dx: px - cx, dy: py - cy } : { k: Date.now(), x: px, y: py, dx: cx - px, dy: cy - py });
    setTimeout(() => setFly(null), 1100);
  };

  const run = (fn: () => Promise<{ success: boolean; message?: string; error?: string }>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (res.success) {
        if (res.message) toast.success(res.message);
        after?.();
      } else {
        play("error");
        toast.error(res.error || "Có lỗi xảy ra");
      }
    });

  const equip = (item: Item) =>
    start(async () => {
      const next = { ...avatar, [item.slot]: item.id };
      const res = await saveAvatar(next);
      if (res.success) {
        play("click");
        setAvatar(res.config ?? next);
        setSelKey(null);
        toast.success(`Đã trang bị "${item.name}"`);
      } else {
        play("error");
        toast.error(res.error);
      }
    });

  const purchase = (item: Item) =>
    start(async () => {
      const res = await buyItem(item.id);
      if (res.success) {
        play("coin");
        buzz(25);
        setBurst((n) => n + 1);
        flyCoins("out");
        setOwned((o) => new Set([...o, item.id]));
        if (item.price) adjust("xu" in item.price ? -item.price.xu : 0, "gem" in item.price ? -item.price.gem : 0);
        setSelKey(null);
        toast.success(res.message);
        // Mua đồ mặc nhanh thì dùng luôn — phải LƯU lên server (buyItem chỉ thêm vào túi) (review Gemini GĐ6)
        if (QUICK_EQUIP.includes(item.slot) && item.slot !== "accessory") {
          const saved = await saveAvatar({ ...avatar, [item.slot]: item.id });
          if (saved.success && saved.config) setAvatar(saved.config);
        }
      } else {
        play("error");
        toast.error(res.error);
      }
    });

  const redeem = (r: Reward) =>
    run(
      () => redeemReward(r.id),
      () => {
        adjust(-r.price);
        setSelKey(null);
        setCelebrated((n) => n + 1);
        flyCoins("out");
        play("coin");
        buzz(20);
      },
    );

  const saveCustom = (next: { frame: string | null; nameplate: string | null }) =>
    start(async () => {
      const res = await saveAvatar({ ...avatar, ...next });
      if (res.success) {
        play("coin");
        setAvatar(res.config ?? { ...avatar, ...next });
        setCustom(false);
        toast.success("Đã lưu hồ sơ");
      } else {
        play("error");
        toast.error(res.error);
      }
    });

  const onGachaDone = ({ outcome }: { outcome: Outcome }) => {
    if (outcome.kind === "item" && !outcome.duplicate) setOwned((o) => new Set([...o, outcome.itemId]));
  };

  const petIt = () => {
    play("meow");
    buzz(15);
    const k = Date.now();
    setHearts([k, k + 1, k + 2]);
    setTimeout(() => setHearts((h) => h.filter((x) => x < k || x > k + 2)), 1300);
    setTipI((n) => n + 1);
  };

  // ---------- Danh sách theo danh mục
  const entriesFor = (c: Cat): Entry[] => {
    const rewards: Entry[] = data.rewards
      .filter((r) => (c === "all" ? true : c === "physical" ? r.kind === "PHYSICAL" : c === "voucher" ? r.kind === "VIRTUAL" : false))
      .map((r) => ({ key: `r:${r.id}`, kind: "reward", rarity: rarityOf(r.price).key, name: r.title, r }));
    const pick = (i: Item) => {
      if (c === "all") return !i.free && !!i.price && (i.slot === "frame" || i.slot === "nameplate" || i.slot === "pet");
      if (c === "frame" || c === "nameplate") return i.slot === c && (!!i.price || !!i.gachaOnly);
      if (c === "pet") return i.slot === "pet";
      if (c === "deco") return DECO_SLOTS.some((s) => s.key === i.slot) && !i.free && (!!i.price || !!i.gachaOnly) && (decoSlot === "all" || i.slot === decoSlot);
      return false;
    };
    const items: Entry[] = ITEMS.filter(pick).map((it) => ({ key: `i:${it.id}`, kind: "item", rarity: it.rarity, name: it.name, it }));
    return [...rewards, ...items];
  };

  const stateOf = (e: Entry) => {
    if (e.kind === "reward") {
      const r = e.r;
      const soldOut = r.stock !== null && r.stock <= 0;
      const limitHit = r.perStudentMonthlyLimit !== null && r.usedThisMonth >= r.perStudentMonthlyLimit;
      return { own: false, on: false, locked: false, gachaOnly: false, soldOut, limitHit, ok: balanceNow >= r.price, gem: false, need: r.price, have: balanceNow };
    }
    const it = e.it;
    const own = !!it.free || owned.has(it.id);
    const gem = !!it.price && "gem" in it.price;
    const need = !it.price ? 0 : "xu" in it.price ? it.price.xu : it.price.gem;
    const have = gem ? gemsNow : balanceNow;
    return { own, on: avatar[it.slot] === it.id, locked: !own && (it.minLevel ?? 0) > level.level, gachaOnly: !own && !it.price, soldOut: false, limitHit: false, ok: !!it.price && have >= need, gem, need, have };
  };

  const counts = Object.fromEntries((["all", "physical", "voucher", "frame", "nameplate", "pet", "deco"] as Cat[]).map((c) => [c, entriesFor(c).length])) as Record<Cat, number>;
  const list = entriesFor(cat).filter((e) => {
    if (rar !== "all" && e.rarity !== rar) return false;
    if (!affordOnly) return true;
    const s = stateOf(e);
    return s.ok && !s.own && !s.locked && !s.soldOut && !s.limitHit;
  });
  const sel = selKey ? entriesFor(cat).find((e) => e.key === selKey) ?? null : null;
  const open = (e: Entry) => {
    setSelKey(e.key);
  };

  const navBtn = "ah-btn h-12 px-5 text-base";

  return (
    <div className={cn("ah min-h-screen pb-12", mali.variable, nunito.variable)} data-testid="shop-frame" data-celebrated={celebrated} data-weather={weather}>
      <Confetti burst={celebrated} />
      <CoinBurst burst={burst} />
      <WeatherLayer weather={weather} />
      {adminView && (
        <div role="status" data-testid="admin-view" className="relative z-[5] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-[#2A1F5C] px-4 py-2 text-center text-xs font-bold text-[#FDE68A]">
          <span>Bạn đang xem Tiệm quà bằng tài khoản giáo viên — giao diện giống học sinh, chỉ xem (đổi quà, mở hộp, nhập mã dành cho học sinh).</span>
          <Link href="/teacher/rewards" className="underline decoration-dotted">Quản lý quà →</Link>
        </div>
      )}

      {/* ===== Thanh gỗ ===== */}
      <header className="ah-wood">
        <div className="relative mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-4 gap-y-3 px-6 py-2.5 max-sm:px-4">
          <Link href="/" aria-label="Về trang chủ" className="ah-btn ah-cream h-[46px] w-[46px] rounded-[14px] p-0">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#241e1a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" fill="#ea6a51" /></svg>
          </Link>
          <span className="relative inline-flex">
            <button type="button" data-testid="bag-open" onClick={() => goSec("bag")} aria-label={`Túi đồ (${bagCount} món)`} className="ah-btn ah-cream h-[46px] w-[46px] rounded-[14px] p-0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#241e1a" strokeWidth="2.2" strokeLinejoin="round" aria-hidden><path d="M3 8l9-4 9 4v9l-9 4-9-4z" fill="#e7d0a3" /><path d="M3 8l9 4 9-4M12 12v9" /></svg>
            </button>
            {bagCount > 0 && <Badge n={bagCount} />}
          </span>
          <div className="flex flex-col">
            <h1 className="ah-hand text-[22px] font-bold leading-tight" data-testid="shop-title">Tiệm Quà Học Đường</h1>
            <span className="text-xs font-extrabold text-[#6e4722]">Chăm làm bài · Đổi quà xinh</span>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2.5">
            <span className="ah-ink flex h-[42px] items-center gap-2 rounded-full bg-[#fffdf8] px-4 text-base font-black shadow-[0_3px_0_#241e1a]" data-testid="hud-balance" title="Xu tiêu được">
              <span ref={coinRef} className="flex"><CoinDot size={20} /></span>
              <span key={xuShown.bump} className={cn("tabular-nums", xuShown.bump > 0 && "v2-bump")}>{fmt(xuShown.shown)}</span>
            </span>
            <span className="ah-ink flex h-[42px] items-center gap-2 rounded-full bg-[#fffdf8] px-4 text-base font-black shadow-[0_3px_0_#241e1a]" data-testid="hud-gems" title="Kim cương">
              <GemDot size={15} />{gemsNow}
            </span>
            <button type="button" data-testid="history-open" onClick={() => { play("click"); setModal("history"); }} aria-label="Lịch sử xu" title="Lịch sử xu" className="ah-btn ah-cream h-11 w-11 p-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#241e1a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9" fill="#fef3c7" /><path d="M12 7v5l3 2" /></svg>
            </button>
            <button type="button" role="switch" aria-checked={soundOn} aria-label="Âm thanh hiệu ứng" title={soundOn ? "Âm thanh: Bật" : "Âm thanh: Tắt"} onClick={() => setSoundOn(!soundOn)} className="ah-btn ah-cream h-11 w-11 p-0">
              {soundOn ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#241e1a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M11 5L6 9H2v6h4l5 4z" fill="#7dd3fc" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" /></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#241e1a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M11 5L6 9H2v6h4l5 4z" fill="#e7d0a3" /><path d="M22 9l-6 6M16 9l6 6" /></svg>
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1240px] flex-col gap-[22px] p-6 max-sm:px-4">
        {!online && (
          <div role="alert" className="ah-panel flex flex-wrap items-center gap-3 bg-[#fde2dc] px-[18px] py-3.5" data-testid="offline">
            <b className="ah-hand text-base">Mất kết nối mạng.</b>
            <span className="flex-[1_1_240px]">Bạn vẫn xem được tiệm, nhưng chưa đổi quà hay mở hộp được.</span>
            <button type="button" onClick={() => router.refresh()} className="ah-btn ah-coral h-10 px-4">Thử lại</button>
          </div>
        )}
        {!data.canEarn && (
          <div className="ah-panel bg-[#fff1c9] px-[18px] py-3 font-bold text-[#6e4722]">Tài khoản cần được thầy duyệt để bắt đầu nhận xu và đổi quà.</div>
        )}

        {/* ===== Khối hồ sơ ===== */}
        <section className="ah-panel flex flex-wrap items-center gap-[18px] p-[18px]" data-testid="shop-hud">
          <PlateBox id={avatar.nameplate} className="min-w-0 flex-[999_1_560px]" testId="hud-nameplate">
            <div className="flex flex-wrap items-center gap-4 px-[18px] py-3.5">
              <Link href="/profile" title="Hồ sơ của bạn" className="shrink-0 rounded-full">
                <AvatarRing config={avatar} size={104} inset={22} title={user.name ?? undefined} />
              </Link>
              <div className={cn("flex min-w-0 flex-[1_1_300px] flex-col gap-2", plateDark ? "text-white" : "text-[#1E1B2E]")}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="ah-hand text-[22px] font-bold">{user.name || "Học sinh"}</span>
                  {user.grade && <span className="rounded-full border-2 border-[#241e1a] bg-[#fef3c7] px-2.5 py-0.5 text-xs font-black text-[#241e1a]">Khối {user.grade}</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" data-testid="titles-open" onClick={() => { play("click"); setModal("titles"); }} title="Xem hệ thống danh hiệu" className="ah-btn ah-gold h-[34px] px-3.5 text-sm">
                    <span>{level.name} (<b>Lv.{level.level}</b>)</span>
                  </button>
                  <button type="button" data-testid="customize-open" onClick={() => { play("click"); setCustom(true); }} className="ah-btn ah-cream h-[34px] px-3.5 text-[13px]">Đổi viền &amp; bảng tên</button>
                </div>
                <div className="flex justify-between gap-2 text-xs font-extrabold"><span>Cấp độ {level.level}</span><span>{fmt(wallet.lifetimeEarned)}{level.next ? ` / ${fmt(level.next.min)}` : ""} xu tích lũy</span></div>
                <div className="h-3.5 overflow-hidden rounded-full border-[2.5px] border-[#241e1a] bg-[#fffdf8]" role="progressbar" aria-label="Xu tích luỹ đến cấp sau" aria-valuenow={level.progress} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full bg-gradient-to-r from-[#fbd048] to-[#ea6a51]" style={{ width: `${Math.max(2, level.progress)}%` }} />
                </div>
                <div className="text-xs font-bold opacity-90">{level.next ? `Còn ${fmt(level.toNext)} xu tích lũy để lên Lv.${level.level + 1} · ${level.next.name}` : "Bạn đã đạt cấp cao nhất"}</div>
              </div>
            </div>
          </PlateBox>
          <nav aria-label="Menu tiệm quà" className="flex flex-[1_1_360px] flex-wrap justify-end gap-3">
            <span className="relative inline-flex">
              <button type="button" data-testid="tasks-open" onClick={() => goSec("earn")} className={cn(navBtn, "ah-gold")}>Nộp bài +</button>
              {todoTotal > 0 && <Badge n={todoTotal} />}
            </span>
            <button type="button" data-testid="code-open" onClick={() => goSec("code")} className={cn(navBtn, "ah-coral")}>Thẻ cào &amp; Code</button>
            <button type="button" data-testid="board-open" onClick={() => { play("click"); setGold(true); }} className={cn(navBtn, "ah-sky")}>Bảng Vàng</button>
            <button type="button" data-testid="sec-gacha" onClick={() => goSec("gacha")} className={cn(navBtn, "ah-mint")}>Hộp bí ẩn</button>
            <Link href="/profile" className={cn(navBtn, "ah-cream")}>Hồ sơ</Link>
          </nav>
        </section>

        {/* ===== Mèo linh vật ===== */}
        <section className="ah-panel flex items-center gap-4 px-[18px] py-3.5" data-testid="mascot">
          <div className="relative shrink-0">
            <button type="button" onClick={petIt} aria-label={`Vuốt ve ${pet?.name ?? "mèo Snow"}`} data-testid="pet-card" className="v2-float relative flex h-[78px] w-[78px] cursor-pointer items-center justify-center overflow-hidden rounded-[18px] border-[2.5px] border-[#241e1a] bg-[#fef3c7] p-0 shadow-[0_4px_0_#241e1a]">
              <PetArt pet={pet} />
            </button>
            {hearts.map((k, n) => (
              <span key={k} className="v2-heart" style={{ left: 14 + n * 18, top: -6, animationDelay: `${n * 0.12}s` }} aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#f472b6" stroke="#241e1a" strokeWidth="1.5"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z" /></svg>
              </span>
            ))}
          </div>
          <div role="status" className="flex min-w-0 flex-1 flex-col gap-1 rounded-[18px] border-[2.5px] border-[#241e1a] bg-[#fffdf8] px-4 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <b className="ah-hand text-sm text-[#9e6b3f]">{pet ? pet.name : "Mèo Hoàng Thượng Snow"}</b>
              <button type="button" onClick={petIt} className="h-7 shrink-0 cursor-pointer rounded-full border-2 border-[#ea6a51] bg-[#fff5f2] px-3 text-xs font-extrabold text-[#b83d27]">Vuốt ve</button>
            </div>
            <div className="text-[15px] font-extrabold leading-normal" data-testid="pet-line">{lines[tipI % Math.max(1, lines.length)]}</div>
          </div>
        </section>

        {/* ===== Thân trang ===== */}
        <div className="flex flex-wrap items-start gap-[22px]">
          <aside className="ah-panel flex min-w-0 max-w-[290px] flex-[1_1_250px] flex-col gap-2.5 p-4 max-md:max-w-none" aria-label="Danh mục tiệm quà">
            <div className="ah-hand px-1 pb-1 pt-0.5 font-bold text-[#6e4722]">Danh mục tiệm quà</div>
            <div role="tablist" aria-label="Danh mục quà" aria-orientation="vertical" className="flex min-w-0 flex-col gap-2.5 max-md:-mx-1 max-md:flex-row max-md:overflow-x-auto max-md:px-1 max-md:pb-2 max-md:pt-0.5 max-md:[scrollbar-width:none]">
              {CATS.filter((c) => c.key !== "box" || gacha).map((c) => {
                const on = c.key === "box" ? sec === "gacha" : sec === "shop" && cat === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    data-testid={`cat-${c.key}`}
                    onClick={() => (c.key === "box" ? goSec("gacha") : goCat(c.key))}
                    className={cn("ah-btn ah-catbtn shrink-0 max-md:w-auto", on ? "ah-coral" : "ah-cream")}
                  >
                    {c.label}
                    <span className="ml-auto pl-2 font-[family-name:var(--font-nunito)] text-xs font-black opacity-80">{c.key === "box" ? 2 : counts[c.key]}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <main ref={mainRef} className="flex min-w-0 flex-[999_1_600px] scroll-mt-4 flex-col gap-[18px]">
              <div className="flex flex-col gap-[18px]">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="ah-hand text-[26px] font-bold">
                    {CAT_TITLE[cat]} <span className="font-[family-name:var(--font-nunito)] text-sm font-extrabold text-[#9e6b3f]">({list.length} món)</span>
                  </h2>
                  <div className="ml-auto flex flex-wrap gap-1.5">
                    {(["all", "common", "rare", "epic", "legendary"] as RarFilter[]).map((k) => (
                      <button
                        key={k}
                        type="button"
                        aria-pressed={rar === k}
                        data-testid={`rar-${k}`}
                        onClick={() => { play("click"); setRar(k); }}
                        className={cn("h-[30px] cursor-pointer rounded-full border-2 border-[#241e1a] px-3 text-xs font-black", k !== "all" && `r-${k}`, rar === k ? "-translate-y-px shadow-[0_3px_0_#241e1a]" : "opacity-[0.72]")}
                        style={{ background: k === "all" ? "#fffdf8" : "var(--pl)", color: k === "all" ? "#241e1a" : "var(--pt)" }}
                      >
                        {k === "all" ? "Mọi độ hiếm" : RAR_LABEL[k]}
                      </button>
                    ))}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={affordOnly}
                      data-testid="afford-only"
                      onClick={() => { play("click"); setAffordOnly((v) => !v); }}
                      className={cn("h-[30px] cursor-pointer rounded-full border-2 border-[#241e1a] px-3 text-xs font-black", affordOnly ? "bg-[#8cd184] shadow-[0_3px_0_#241e1a]" : "bg-[#fffdf8] opacity-80")}
                    >
                      Chỉ món mua được
                    </button>
                  </div>
                </div>
                {cat === "deco" && (
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Lọc theo ô trang trí" data-testid="deco-slots">
                    {([{ key: "all", label: "Tất cả" }, ...DECO_SLOTS] as { key: DecoSlot; label: string }[]).map((sl) => (
                      <button key={sl.key} type="button" aria-pressed={decoSlot === sl.key} data-testid={`deco-${sl.key}`} onClick={() => { play("click"); setDecoSlot(sl.key); }} className={cn("ah-btn h-9 px-3.5 text-[13px]", decoSlot === sl.key ? "ah-woodbtn" : "ah-cream")}>
                        {sl.label}
                      </button>
                    ))}
                  </div>
                )}
                {!data.isOffline && (cat === "all" || cat === "physical") && !data.rewards.some((r) => r.kind === "PHYSICAL") && (
                  <p className="text-xs font-bold text-[#6e4722]">Quà hiện vật được trao tại lớp học offline, vì vậy bạn chỉ thấy các quà dành cho mọi học sinh.</p>
                )}
                <div className="grid grid-cols-[repeat(auto-fill,minmax(min(240px,100%),1fr))] gap-x-[22px] gap-y-[26px] pt-1.5 max-sm:grid-cols-2 max-sm:gap-x-3 max-sm:gap-y-5" data-testid="shop-grid">
                  {list.map((e) => (
                    <Card key={e.key} e={e} st={stateOf(e)} avatar={avatar} name={user.name} onOpen={() => open(e)} />
                  ))}
                  {list.length === 0 && (
                    <div className="ah-panel ah-hand col-span-full p-10 text-center text-base">
                      {affordOnly
                        ? "Chưa có món nào vừa túi tiền. Nộp thêm bài để kiếm xu nhé."
                        : (cat === "physical" || cat === "voucher") && counts[cat] === 0
                          ? "Thầy đang chuẩn bị quà cho mục này, quay lại sau nhé! Trong lúc chờ, cứ nộp bài để dành xu."
                          : "Không có món nào phù hợp bộ lọc."}
                    </div>
                  )}
                </div>
              </div>
          </main>
        </div>
      </div>

      {/* ===== Các mục Nộp bài / Thẻ cào / Hộp bí ẩn / Túi đồ: hộp nổi ngay tại chỗ (như mẫu Gemini), không nhảy trang ===== */}
      {sec !== "shop" && (
        <div className="fixed inset-0 z-[58] flex items-end justify-center overscroll-contain bg-[rgba(36,30,26,0.55)] sm:items-center sm:p-4" onClick={(e) => e.target === e.currentTarget && goSec("shop")}>
          <div role="dialog" aria-modal="true" aria-labelledby="sec-title" data-testid="sec-modal" className={cn("ah-dialog ah-panel v2-pop relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-b-none sm:max-h-[88vh] sm:rounded-b-[26px]", sec === "code" ? "sm:max-w-[560px]" : "sm:max-w-[860px]")}>
            <div className="flex shrink-0 items-center gap-3 border-b-2 border-[#efe3cc] px-4 py-3 sm:px-5">
              <h2 id="sec-title" className="ah-hand min-w-0 flex-1 truncate text-[22px] font-bold" data-testid="sec-title">{SEC_TITLE[sec]}</h2>
              <button type="button" aria-label="Đóng" data-testid="shop-modal-close" onClick={() => goSec("shop")} className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-[2.5px] border-[#241e1a] bg-[#ef5b4c] text-lg font-black leading-none text-white shadow-[0_3px_0_#241e1a]">×</button>
            </div>
            <div className="flex min-h-0 flex-col gap-[18px] overflow-y-auto p-4 sm:p-5">
                {sec === "earn" && <EarnSection todo={todo} todoTotal={todoTotal} recent={recent} lifetimeEarned={wallet.lifetimeEarned} level={level.level} />}
                {sec === "code" && <CodeSection canEarn={data.canEarn} onWon={(w) => { flyCoins("in"); adjust(w.currency === "GEM" ? 0 : w.amount, w.currency === "GEM" ? w.amount : 0); }} />}
                {sec === "gacha" &&
                  (gacha ? (
                    <GachaSection wallet={{ balance: balanceNow, gems: gemsNow }} pity={wallet.gachaPity} pullsToday={gacha.pullsToday} owned={[...owned]} avatar={avatar} canEarn={data.canEarn} onDone={onGachaDone} />
                  ) : (
                    <div className="ah-panel ah-hand p-10 text-center text-base">Hộp bí ẩn đang tạm đóng. Quay lại sau nhé!</div>
                  ))}
                {sec === "bag" && <BagSection redemptions={data.redemptions} owned={[...owned]} avatar={avatar} pending={pending} name={user.name} onEquip={equip} onCancel={(id) => run(() => cancelRedemption(id))} />}
            </div>
          </div>
        </div>
      )}

      {/* ===== Hộp chi tiết món (canvas: thẻ theo độ hiếm) ===== */}
      {sel && renderModal(sel)}

      {gold && <GoldModal boards={boards} myGrade={user.grade} me={{ id: user.id, avatar, name: user.name }} event={event} onClose={() => setGold(false)} />}
      {custom && (
        <CustomizeModal avatar={avatar} owned={owned} level={level.level} name={user.name} grade={user.grade} pending={pending} onCancel={() => setCustom(false)} onSave={saveCustom} />
      )}

      {lvUp && (
        <LevelUpDialog
          level={lvUp}
          title={level.name}
          note={level.next ? `Còn ${fmt(level.toNext)} xu nữa để lên ${level.next.name}. Viền avatar và bảng tên mới đang chờ bạn ở Cửa hàng!` : "Bạn đã đạt cấp cao nhất 👑"}
          onClose={() => setLvUp(null)}
          onSee={() => { setLvUp(null); goCat("frame"); }}
        />
      )}

      {fly &&
        Array.from({ length: 7 }, (_, i) => (
          <span
            key={`${fly.k}-${i}`}
            aria-hidden
            className="ah-fly h-6 w-6 rounded-full border-[3px] border-[#241e1a] bg-[#fbd048]"
            style={{ left: fly.x + i * 14 - 42, top: fly.y, animationDelay: `${i * 0.05}s`, ["--dx" as string]: `${fly.dx - (i * 14 - 42)}px`, ["--dy" as string]: `${fly.dy}px` }}
          />
        ))}

      <TitlesModal open={modal === "titles"} onOpenChange={(o) => setModal(o ? "titles" : null)} lifetimeEarned={wallet.lifetimeEarned} />
      <HistoryModal open={modal === "history"} onOpenChange={(o) => setModal(o ? "history" : null)} ledger={data.ledger} levelIndex={level.level - 1} />
    </div>
  );

  /** Hộp chi tiết một món: tiêu đề theo độ hiếm, ảnh xem trước, cách nhận, ghi chú số dư, Đóng / hành động */
  function renderModal(e: Entry) {
    const s = stateOf(e);
    const priceText = s.gem ? `${s.need} KC` : `${fmt(s.need)} xu`;
    let how: string;
    let meta: string;
    let note = "";
    let action: React.ReactNode;
    const btn = "ah-btn h-12 flex-[2] text-base";
    if (e.kind === "reward") {
      const r = e.r;
      how = HOW[r.kind];
      meta = [r.kind === "PHYSICAL" ? "Quà hiện vật" : "Thẻ đặc quyền", r.stock !== null ? `Còn ${r.stock}` : "", r.perStudentMonthlyLimit !== null ? `Đã đổi ${r.usedThisMonth}/${r.perStudentMonthlyLimit} tháng này` : ""].filter(Boolean).join(" · ");
      const can = s.ok && !s.soldOut && !s.limitHit && data.canEarn && online;
      if (s.soldOut) note = "";
      else if (s.limitHit) note = "Bạn đã đổi đủ lượt của tháng này.";
      else if (!data.canEarn) note = "Tài khoản cần được thầy duyệt để đổi quà.";
      else if (!online) note = "Kết nối lại để đổi quà.";
      else if (!s.ok) note = `Bạn có ${fmt(s.have)} xu, còn thiếu ${fmt(s.need - s.have)} xu. Nộp bài để kiếm thêm.`;
      else note = `Số dư sau khi đổi: ${fmt(balanceNow - r.price)} xu`;
      const label = s.soldOut ? "Hết hàng" : s.limitHit ? "Hết lượt tháng này" : !data.canEarn ? "Chờ thầy duyệt" : !online ? "Đang mất mạng" : s.ok ? `Đổi · ${priceText}` : "Chưa đủ xu";
      action = (
        <button type="button" data-testid="redeem" disabled={!can || pending} onClick={() => redeem(r)} className={cn(btn, can ? "ah-gold" : "ah-cream")}>
          {pending && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
          {label}
        </button>
      );
    } else {
      const it = e.it;
      const quick = QUICK_EQUIP.includes(it.slot);
      how = HOW[it.slot] ?? (quick ? "Dùng ngay trên hồ sơ của bạn." : "Mặc lên nhân vật ở trang Hồ sơ.");
      meta = [SLOTS.find((x) => x.key === it.slot)?.label ?? "Trang trí", it.minLevel ? `Từ Lv.${it.minLevel}` : "", it.gachaOnly ? "Chỉ từ Hộp bí ẩn" : ""].filter(Boolean).join(" · ");
      if (s.own) {
        action = s.on ? (
          <button type="button" disabled className={cn(btn, "ah-mint")}>Đang dùng</button>
        ) : quick ? (
          <button type="button" data-testid={`equip-${it.id}`} disabled={pending} onClick={() => equip(it)} className={cn(btn, "ah-mint")}>Trang bị</button>
        ) : (
          <Link href={`/profile?try=${it.id}`} data-testid={`try-${it.id}`} className={cn(btn, "ah-woodbtn")}>Mặc trên hồ sơ</Link>
        );
      } else if (s.gachaOnly) {
        note = "Món này chỉ có trong Hộp bí ẩn.";
        action = <button type="button" disabled={!gacha} onClick={() => { setSelKey(null); goSec("gacha"); }} className={cn(btn, "ah-grape")}>Mở Hộp bí ẩn</button>;
      } else if (s.locked) {
        const min = LEVELS[(it.minLevel ?? 1) - 1]?.min ?? 0;
        note = `Còn ${fmt(Math.max(0, min - wallet.lifetimeEarned))} xu tích lũy để mở khóa.`;
        action = <button type="button" disabled data-testid={`shop-buy-${it.id}`} className={cn(btn, "ah-cream")}>Cần Lv.{it.minLevel}</button>;
      } else {
        const can = s.ok && data.canEarn && online;
        if (!data.canEarn) note = "Tài khoản cần được thầy duyệt để đổi quà.";
        else if (!online) note = "Kết nối lại để đổi quà.";
        else if (!s.ok) note = s.gem ? `Bạn có ${s.have} KC, còn thiếu ${s.need - s.have} KC. Cào thẻ hoặc nhập mã thầy phát để nhận thêm.` : `Bạn có ${fmt(s.have)} xu, còn thiếu ${fmt(s.need - s.have)} xu. Nộp bài để kiếm thêm.`;
        else note = `Số dư sau khi đổi: ${s.gem ? `${gemsNow - s.need} KC` : `${fmt(balanceNow - s.need)} xu`}`;
        action = (
          <button type="button" data-testid={`shop-buy-${it.id}`} disabled={!can || pending} onClick={() => purchase(it)} className={cn(btn, !can ? "ah-cream" : s.gem ? "ah-sky" : "ah-gold")}>
            {!data.canEarn ? "Chờ thầy duyệt" : !online ? "Đang mất mạng" : s.ok ? `Đổi · ${priceText}` : `Chưa đủ ${s.gem ? "kim cương" : "xu"}`}
          </button>
        );
      }
    }
    const isGoal = e.kind === "reward" && goal?.id === e.r.id;
    const frame = e.kind === "item" && e.it.slot === "frame";
    const plate = e.kind === "item" && e.it.slot === "nameplate";
    const plateIsDark = plate && e.kind === "item" && e.it.v2 === "dark";
    return (
      <div className="fixed inset-0 z-[55] flex items-center justify-center bg-[rgba(36,30,26,0.55)] p-4" onClick={(ev) => ev.target === ev.currentTarget && setSelKey(null)}>
        <div role="dialog" aria-modal="true" aria-label={e.name} data-testid="shop-detail" className={cn("ah-dialog ah-pcard v2-pop w-full max-w-[460px] cursor-default gap-3.5 p-[18px] hover:transform-none", `r-${e.rarity}`)}>
          <div className="ah-phead ah-hand text-lg" data-testid="detail-name">{e.name}</div>
          <div className="ah-part aspect-video" data-testid="detail-art">
            {e.rarity === "legendary" && <span className="ah-sun" aria-hidden />}
            {e.kind === "reward" ? (
              <V2Art index={rewardArtV2(e.r.title, e.r.kind)} className="relative h-[88%]" />
            ) : plate ? (
              <PlateBox id={e.it.id} className="w-[92%] rounded-[14px] border-[2.5px] shadow-none">
                <div className={cn("flex min-h-[72px] items-center gap-3 px-3.5 py-2", plateIsDark ? "text-white" : "text-[#1E1B2E]")}>
                  <AvatarRing config={{ ...avatar, nameplate: e.it.id }} size={52} inset={10} />
                  <div><div className="ah-hand text-base font-bold">{shortName(user.name)}</div><div className="text-xs font-extrabold">Xem trước trên Bảng Vàng</div></div>
                </div>
              </PlateBox>
            ) : (
              <span className="relative flex h-full w-full items-center justify-center"><ItemArt it={e.it} avatar={avatar} name={user.name} withFace={frame} /></span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2"><span className="ah-ppill">{RAR_LABEL[e.rarity]}</span><span className="text-xs font-extrabold">{meta}</span></div>
          <div className="text-[13px] font-bold">{how}</div>
          {note && <div className="rounded-[14px] border-2 border-dashed border-[#241e1a] bg-[#fffdf8] px-3 py-2.5 text-[13px] font-extrabold" data-testid="detail-note">{note}</div>}
          <div className="flex gap-2.5">
            <button type="button" onClick={() => { play("click"); setSelKey(null); }} className="ah-btn ah-cream h-12 flex-1">Đóng</button>
            {action}
          </div>
          {e.kind === "reward" && (
            <button type="button" data-testid="pin" disabled={pending} aria-pressed={isGoal} onClick={() => run(() => setGoalReward(isGoal ? null : e.r.id))} className="self-center text-[13px] font-extrabold text-[#9e6b3f] underline decoration-dotted underline-offset-4">
              {isGoal ? "♥ Đã là quà mong muốn (bỏ ghim)" : "♡ Ghim làm quà mong muốn"}
            </button>
          )}
          {e.kind === "item" && !s.own && e.it.slot !== "nameplate" && (
            <Link href={`/profile?try=${e.it.id}`} data-testid={`try-${e.it.id}`} className="self-center text-[13px] font-extrabold text-[#9e6b3f] underline decoration-dotted underline-offset-4">Thử trên hồ sơ trước khi đổi</Link>
          )}
        </div>
      </div>
    );
  }
}

/* ============================== Thẻ trong lưới ============================== */

type St = { own: boolean; on: boolean; locked: boolean; gachaOnly: boolean; soldOut: boolean; limitHit: boolean; ok: boolean; gem: boolean; need: number; have: number };

type CardProps = { e: Entry; st: St; avatar: StudentPointsPageData["avatar"]; name: string | null; onOpen: () => void };
const sameSt = (a: St, b: St) => (Object.keys(a) as (keyof St)[]).every((k) => a[k] === b[k]);
const entrySig = (e: Entry) => (e.kind === "reward" ? `${e.key}|${e.r.title}|${e.r.price}|${e.r.stock}|${e.r.kind}` : `${e.key}|${e.it.id}`);
/** Thẻ chỉ vẽ lại khi chính nó đổi (sau mỗi lần làm mới dữ liệu, lưới 30+ thẻ có nhân vật không phải vẽ lại hết — nặng trên điện thoại).
 *  onOpen không so: nó chỉ mở hộp chi tiết theo khoá của thẻ. */
const Card = memo(CardView, (a: CardProps, b: CardProps) => entrySig(a.e) === entrySig(b.e) && sameSt(a.st, b.st) && a.avatar === b.avatar && a.name === b.name);

function CardView({ e, st, avatar, name, onOpen }: CardProps) {
  // Tia nắng xoay (huyền thoại), hiệu ứng bảng tên… của thẻ ngoài màn hình thì dừng — trước đây chạy hết cả lưới
  const cardRef = useRef<HTMLButtonElement>(null);
  useEffect(() => pauseOffscreen(cardRef.current), []);
  const leg = e.rarity === "legendary";
  const quick = e.kind === "item" && QUICK_EQUIP.includes(e.it.slot);
  const minLevel = e.kind === "item" ? e.it.minLevel : undefined;
  const [cls, text, icon]: [string, string, "coin" | "gem" | null] = st.on
    ? ["ah-mint", "Đang đeo", null]
    : st.own
      ? ["ah-woodbtn", quick ? "Đã có · Trang bị" : "Đã có", null]
      : st.locked
        ? ["ah-cream", `Cần Lv.${minLevel}`, null]
        : st.gachaOnly
          ? ["ah-grape", "Chỉ từ Hộp bí ẩn", null]
          : st.soldOut
            ? ["ah-cream", "Hết hàng", null]
            : st.gem
              ? ["ah-sky", `${st.need} Kim Cương`, "gem"]
              : ["ah-gold", `${fmt(st.need)} Xu`, "coin"];
  const stock =
    e.kind === "reward"
      ? e.r.stock !== null ? `Còn ${e.r.stock}` : "Không giới hạn"
      : minLevel ? `Lv.${minLevel}+` : e.it.gachaOnly ? "Hộp bí ẩn" : "Vĩnh viễn";
  const extra: Record<string, string> = e.kind === "reward" ? { "data-title": e.r.title, "data-rarity": e.rarity } : { "data-item": e.it.id };
  const priceAria = st.own ? (st.on ? "Đang dùng" : "Đã có") : st.gachaOnly ? "Chỉ từ Hộp bí ẩn" : st.gem ? `${st.need} kim cương` : `${fmt(st.need)} xu`;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${e.name}, ${RAR_LABEL[e.rarity]}, ${priceAria}`}
      title={!st.own && !st.gachaOnly && !st.ok ? `Còn thiếu ${st.gem ? st.need - st.have : fmt(st.need - st.have)} ${st.gem ? "kim cương" : "xu"}` : undefined}
      data-testid={e.kind === "reward" ? "reward-card" : "item-card"}
      {...extra}
      ref={cardRef}
      className={cn("ah-pcard", `r-${e.rarity}`)}
    >
      {leg && <span className="ah-tabtop">CỰC PHẨM HUYỀN THOẠI</span>}
      <span className="ah-phead ah-hand">{e.name}</span>
      <span className="flex flex-wrap items-center justify-between gap-1">
        <span className="ah-ppill">{RAR_LABEL[e.rarity]}</span>
        <span className="ah-pstock">{stock}</span>
      </span>
      <span className="ah-part">
        {leg && <span className="ah-sun" aria-hidden />}
        {e.kind === "reward" ? <V2Art index={rewardArtV2(e.r.title, e.r.kind)} className="relative h-[82%]" /> : <ItemArt it={e.it} avatar={avatar} name={name} />}
      </span>
      <span className={cn("ah-btn h-[46px] gap-2 px-4 text-base max-sm:h-[38px] max-sm:gap-1.5 max-sm:px-2 max-sm:text-[13px]", cls)}>
        {icon === "coin" && <CoinDot size={19} className="border-2" />}
        {icon === "gem" && <GemDot size={13} className="mx-[3px] border-2" />}
        {text}
      </span>
    </button>
  );
}

/** Số đỏ góc nút (túi đồ, bài cần nộp) — đặt ngoài nút để ánh quét của nút không tràn ra */
function Badge({ n }: { n: number }) {
  return <span className="pointer-events-none absolute -right-2 -top-2 z-[1] flex h-[22px] min-w-[22px] items-center justify-center rounded-full border-2 border-[#241e1a] bg-[#ea6a51] px-1 text-[11px] font-black text-[#fffdf8]">{n}</span>;
}

/** Ảnh thú cưng ở dải mèo linh vật: tranh v2 nếu có, mặc định mèo Snow của canvas */
function PetArt({ pet }: { pet: Item | null }) {
  const i = v2Index(pet?.id);
  if (i !== undefined) return <V2Art index={i} className="absolute inset-1" />;
  if (!pet) return <V2Art index={V2_MASCOT} className="absolute inset-1" />;
  return <PetSvg itemId={pet.id} size={70} className="h-[70px] w-[70px]" />;
}
