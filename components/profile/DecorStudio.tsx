"use client";

import { useId, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Coin, IconAlert, IconCheck, IconHelp, IconLock, IconLogout, IconSave, IconUndo } from "@/components/studio/icons";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { buyBundle, saveAvatar } from "@/actions/avatar";
import { ITEM_BY_ID, itemsOfSlot, type Item, type Slot } from "@/lib/game/items";
import { FACES, FACE_IDS, PRESETS, currentFaceId, faceIndexOf, genderOf, paintedLook, presetIndexOf, type Gender, type Preset } from "@/lib/game/presets";
import { FACE_PART_KEYS, FACE_PART_OPTIONS, LOOK_EXTRA_KEYS, skinToneOf, type FacePartKey, type LookExtraKey } from "@/lib/game/face-parts";
import { Brows, FaceArt } from "@/components/avatar/FaceArt";
import type { AvatarConfig } from "@/lib/game/avatar";
import { play } from "@/lib/sound";
import { Chibi, FxShape } from "@/components/avatar/Chibi";
import { PetSvg } from "@/components/avatar/PetSvg";
import { CoinBurst } from "@/components/game/CoinBurst";
import { Confetti } from "@/components/points/Confetti";
import { ShopArt, Sprite, faceStyle, frameSpriteStyle, hasSprite, shopItemIndex } from "@/components/studio/Sprite";
import { Nameplate } from "@/components/studio/Nameplate";
import { AvatarFace } from "@/components/studio/AvatarFace";
import { ProfileBanner } from "./ProfileBanner";
import { ProfileScene } from "./ProfileScene";
import { FrameRing } from "./FrameRing";

export interface DecorStudioProps {
  user: { id: string; name: string | null; email: string | null; image: string | null };
  config: AvatarConfig;
  owned: string[];
  wallet: { balance: number; gems: number };
  canEarn: boolean;
  isDemo: boolean;
  completedLessons: number;
  level: { icon: string; level: number; name: string } | null;
  /** Kiểu tóc nhiều bạn dùng nhất (nhãn "Hot" trên thẻ kiểu tóc) */
  hotHair?: string[];
  /** `/profile?try=<itemId>` (nút "Thử trên hồ sơ" ở tiệm): mặc thử sẵn món này */
  initialTry?: string | null;
}

type Tab = "char" | "pet" | "frame" | "background" | "effect" | "nameplate" | "title";
type Filter = "all" | "owned" | "shop";
const TABS: { key: Tab; label: string; slots: Slot[] }[] = [
  { key: "char", label: "Nhân vật", slots: ["hair", "hairColor", "eyes", "outfit", "accessory", "skin"] },
  { key: "pet", label: "Thú cưng", slots: ["pet"] },
  { key: "frame", label: "Khung viền", slots: ["frame"] },
  { key: "background", label: "Hình nền", slots: ["background"] },
  { key: "effect", label: "Hiệu ứng", slots: ["effect"] },
  { key: "nameplate", label: "Bảng tên", slots: ["nameplate"] },
  { key: "title", label: "Danh hiệu", slots: ["title"] },
];
const TAB_OF: Partial<Record<Slot, Tab>> = Object.fromEntries(TABS.flatMap((t) => t.slots.map((s) => [s, t.key])));
const SLOT_KEYS: Slot[] = ["skin", "hair", "hairColor", "eyes", "outfit", "accessory", "frame", "background", "effect", "nameplate", "title", "pet"];
const LOOK_KEYS = ["face", "gender", ...FACE_PART_KEYS, ...LOOK_EXTRA_KEYS] as const; // khuôn mặt + bộ phận mặt + màu da, lông mày (miễn phí, không phải món)
type PartKey = FacePartKey | LookExtraKey;
const PART_ROWS: PartKey[] = ["skinTone", "eyeShape", "brows", "mouth", "faceDeco"];
const sameLook = (a: AvatarConfig, b: AvatarConfig) => LOOK_KEYS.every((k) => (a[k] ?? null) === (b[k] ?? null));
const same = (a: AvatarConfig, b: AvatarConfig) => sameLook(a, b) && SLOT_KEYS.every((k) => (a[k] ?? null) === (b[k] ?? null));
const PART_LABEL: Record<PartKey, { title: string; none: string }> = {
  skinTone: { title: "Màu da", none: "Giữ màu da đang có" },
  brows: { title: "Lông mày", none: "Không vẽ thêm lông mày" },
  eyeShape: { title: "Mắt", none: "Giữ mắt đang có" },
  mouth: { title: "Miệng", none: "Giữ miệng đang có" },
  faceDeco: { title: "Trang điểm & sticker", none: "Không trang điểm" },
};
const fmt = (n: number) => n.toLocaleString("vi-VN");
const priceText = (xu: number, gem: number) => [xu ? `${fmt(xu)} xu` : "", gem ? `${gem} ngọc` : ""].filter(Boolean).join(" + ") || "0 xu";
const noFx = { background: null, frame: null, effect: null } as const;
const ACCENT = "#5B2BD6";
const KEEP_FACE: Slot[] = ["hair", "outfit", "accessory"];

/** Màu ruy băng danh hiệu theo canvas (nền, chữ); món khác lấy theo độ hiếm */
const TITLE_COLORS: Record<string, [string, string]> = {
  "title-hunter10": ["#7C3AED", "#FFFFFF"],
  "title-mathking": ["#C2410C", "#FFFFFF"],
  "title-owl": ["#1E2A5A", "#FFFFFF"],
  "title-warrior": ["#B91C1C", "#FFFFFF"],
  "title-nerd": ["#15803D", "#FFFFFF"],
  "title-speed": ["#0E7490", "#FFFFFF"],
  "title-legend": ["#2A1F5C", "#FDE68A"],
  "title-boss": ["#7F1D1D", "#FDE68A"],
  "title-pi": ["#1D4ED8", "#FFFFFF"],
};
const LEVEL_PILL: [string, string] = ["#F3E3C3", "#6B4512"];
const pill = (c: [string, string]) => ({ background: c[0], color: c[1] });
const titlePill = (id: string) => pill(TITLE_COLORS[id] ?? LEVEL_PILL);

/** Hồ sơ & Trang trí — dựng theo artboard "Hồ sơ & Trang trí – Desktop" của canvas thiết kế (GĐ9) */
export default function DecorStudio({ user, config: initial, owned: ownedInit, wallet, canEarn, isDemo, completedLessons, level, initialTry, hotHair = [] }: DecorStudioProps) {
  const router = useRouter();
  const tryItem = initialTry ? ITEM_BY_ID[initialTry] : undefined;
  const [config, setConfig] = useState<AvatarConfig>(() => (tryItem ? { ...initial, [tryItem.slot]: tryItem.id } : initial));
  const [saved, setSaved] = useState<AvatarConfig>(initial);
  const [justSaved, setJustSaved] = useState(false);
  const [owned, setOwned] = useState<Set<string>>(() => new Set(ownedInit));
  const [balance, setBalance] = useState(wallet.balance);
  const [gems, setGems] = useState(wallet.gems);
  const [tab, setTab] = useState<Tab>(() => (tryItem ? TAB_OF[tryItem.slot] ?? "char" : "char"));
  const [charMode, setCharMode] = useState<"preset" | "custom">(() => (tryItem && TAB_OF[tryItem.slot] === "char" ? "custom" : "preset"));
  const [filter, setFilter] = useState<Filter>("all");
  const [pending, start] = useTransition();
  const [burst, setBurst] = useState(0);
  const [confetti, setConfetti] = useState(0);

  const has = (it: Item) => !!it.free || owned.has(it.id);
  const trying = useMemo(
    () => SLOT_KEYS.map((k) => (config[k] ? ITEM_BY_ID[config[k] as string] : undefined)).filter((it): it is Item => !!it && !it.free && !owned.has(it.id)),
    [config, owned],
  );
  const lvl = level?.level ?? 1;
  const lvLocked = (it: Item) => (it.minLevel ?? 0) > lvl;
  const buyable = trying.filter((it) => it.price && !lvLocked(it));
  const locked = trying.filter((it) => !it.price || lvLocked(it));
  const cost = buyable.reduce((s, it) => ({ xu: s.xu + (it.price && "xu" in it.price ? it.price.xu : 0), gem: s.gem + (it.price && "gem" in it.price ? it.price.gem : 0) }), { xu: 0, gem: 0 });
  const lackXu = Math.max(0, cost.xu - balance);
  const lackGem = Math.max(0, cost.gem - gems);
  const enough = lackXu === 0 && lackGem === 0;
  const dirty = !same(config, saved);
  const changedTabs = TABS.filter((t) => (t.key === "char" && !sameLook(config, saved)) || t.slots.some((k) => (config[k] ?? null) !== (saved[k] ?? null)));
  const matchPreset = (c: AvatarConfig, p: Preset) => presetIndexOf(c) === PRESETS.indexOf(p);
  const currentPreset = PRESETS.find((p) => matchPreset(config, p));

  const put = (slot: Slot, id: string | null) => {
    play("click");
    setJustSaved(false);
    // Đổi tóc / áo / phụ kiện mà chưa chọn mặt riêng → giữ mặt đang hiện (không bị đổi sang mặt của tranh khác)
    setConfig((c) => {
      const g = slot === "hair" && id ? ITEM_BY_ID[id]?.gender : undefined;
      if (g && g !== genderOf(c)) return { ...c, gender: g, face: null, [slot]: id }; // kiểu tóc của giới kia (vd thử từ tiệm) → đổi giới
      return { ...c, ...(!c.face && KEEP_FACE.includes(slot) ? { face: currentFaceId(c) } : {}), [slot]: id };
    });
  };
  const gender = genderOf(config);
  // Đổi giới: kiểu tóc không thuộc giới mới → kiểu mặc định của giới (miễn phí); mặt nền theo đầu của kiểu tóc
  const putGender = (g: Gender) => {
    play("click");
    setJustSaved(false);
    setConfig((c) => {
      const hairOk = c.hair && (ITEM_BY_ID[c.hair]?.gender ?? "male") === g;
      return { ...c, gender: g, ...(hairOk ? {} : { hair: g === "female" ? "hair-bob" : "hair-short", face: null }) };
    });
  };
  const putPart = (key: PartKey, id: string | null) => {
    play("click");
    setJustSaved(false);
    setConfig((c) => ({ ...c, [key]: id }));
  };
  // Mặt đang hiện: theo tranh mẫu (khi dáng trùng mẫu) hoặc mặt đã chọn / mặc định theo kiểu tóc
  const faceNow = currentFaceId(config);
  // Mặt nền để xem trước bộ phận; mũ kín (hiệp sĩ, nhà du hành) không phối được mặt
  const partBase = faceNow ? FACE_IDS.indexOf(faceNow) : faceIndexOf(config);
  const partsHidden = !faceNow && !!paintedLook(config);
  const applyPreset = (p: Preset) => {
    play("click");
    setJustSaved(false);
    setConfig((c) => ({ ...c, ...p.items, face: null, gender: null, eyeShape: null, mouth: null, faceDeco: null, skinTone: null, brows: null }));
  };
  const goTab = (t: Tab) => {
    play("tick");
    setTab(t);
    setFilter("all");
  };

  const persist = async (cfg: AvatarConfig) => {
    const res = await saveAvatar(cfg);
    if (!res.success) {
      play("error");
      toast.error(res.error);
      return;
    }
    play("levelup");
    setConfetti((n) => n + 1);
    const next = res.config ?? cfg;
    setSaved(next);
    setConfig(next);
    setJustSaved(true);
    toast.success("Đã lưu trang trí ✨");
    router.refresh();
  };

  /** "Mua & lưu": mua mọi món đang thử trong một giao dịch rồi lưu luôn */
  const buyAndSave = () =>
    start(async () => {
      const res = await buyBundle(buyable.map((it) => it.id));
      if (!res.success) {
        play("error");
        toast.error(res.error);
        return;
      }
      const bought = res.bought ?? [];
      play("coin");
      setBurst((n) => n + 1);
      setOwned((o) => new Set([...o, ...buyable.map((b) => b.id)]));
      setBalance((b) => b - bought.reduce((s, it) => s + (it.price && "xu" in it.price ? it.price.xu : 0), 0));
      setGems((g) => g - bought.reduce((s, it) => s + (it.price && "gem" in it.price ? it.price.gem : 0), 0));
      toast.success(res.message);
      await persist(config);
    });
  const save = () => start(() => persist(config));

  const titleItem = config.title ? ITEM_BY_ID[config.title] : null;
  const medals = [
    { label: "Chăm học", hint: "Học xong 10 bài", ok: completedLessons >= 10, fill: "#A78BFA", stroke: "#6D28D9", ribbon: "#F472B6" },
    { label: "Học bá", hint: "Học xong 50 bài", ok: completedLessons >= 50, fill: "#34D399", stroke: "#047857", ribbon: "#FBBF24" },
    { label: "Thăng cấp", hint: "Đạt cấp 3", ok: (level?.level ?? 1) >= 3, fill: "#60A5FA", stroke: "#1D4ED8", ribbon: "#F87171" },
    { label: "Nhà sưu tầm", hint: "Sở hữu 10 món", ok: owned.size >= 10, fill: "#FBBF24", stroke: "#B45309", ribbon: "#EF4444" },
  ];

  // Thanh hành động — câu chữ theo canvas
  const bar = !dirty
    ? { kind: "ok" as const, title: justSaved ? "Đã lưu trang trí" : "Không có thay đổi", sub: justSaved ? "Hồ sơ của bạn đã được cập nhật." : "Chọn vật phẩm để xem thử trên hồ sơ.", icon: "bg-[#E8F6EE] text-[#17703F]" }
    : locked.length
      ? { kind: "warn" as const, title: `Chưa mở khóa “${locked[0].name}”`, sub: lvLocked(locked[0]) ? `Đạt Lv.${locked[0].minLevel} (xu tích luỹ) để mở khoá món này.` : "Mở Hộp bí ẩn ở Tiệm quà để nhận món này.", icon: "bg-[#FDECE4] text-[#8A3B12]" }
      : buyable.length
        ? {
            kind: "warn" as const,
            title: `${buyable.length} vật phẩm chưa sở hữu · ${priceText(cost.xu, cost.gem)}`,
            sub: enough ? `Số dư sau khi mua: ${fmt(balance - cost.xu)} xu` : `Bạn còn thiếu ${priceText(lackXu, lackGem)}. Hoàn thành bài học để kiếm thêm.`,
            icon: "bg-[#FFF6DB] text-[#7A4E00]",
          }
        : { kind: "ok" as const, title: `${changedTabs.length} thay đổi chưa lưu`, sub: changedTabs.map((t) => t.label).join(", "), icon: "bg-[#F3F0FF] text-[#5B2BD6]" };

  const tabMeta = TABS.map((t) => {
    const total = t.key === "char" ? PRESETS.length : itemsOfSlot(t.slots[0]).length;
    const ownedN = t.key === "char" ? PRESETS.filter((p) => Object.values(p.items).every((id) => !id || has(ITEM_BY_ID[id]))).length : itemsOfSlot(t.slots[0]).filter(has).length;
    return { ...t, count: `${ownedN}/${total}` };
  });

  /** Ảnh của một món trong lưới / ô "Đang trang bị" (ưu tiên ảnh canvas, không có thì SVG) */
  const artOf = (it: Item, small = false) => {
    if (hasSprite(it.id)) return <Sprite id={it.id} className={cn("w-full", small && "h-full")} />;
    const shopIdx = shopItemIndex(it.id);
    if (shopIdx !== undefined) return <ShopArt index={shopIdx} className={small ? "h-[52px] w-[52px]" : "h-full"} />;
    if (it.slot === "pet") return <PetSvg itemId={it.id} size={small ? 44 : 72} />;
    if (it.slot === "frame")
      return (
        <span className={cn("relative block", small ? "h-11 w-11" : "h-[72px] w-[72px]")}>
          <span className="absolute inset-[15%] rounded-full bg-[#DDD6FE]" />
          <FrameRing frameId={it.id} className="absolute inset-0 h-full w-full" />
        </span>
      );
    if (it.slot === "background") return <ProfileScene bgId={it.id} className="h-full w-full" />;
    if (it.slot === "effect") return <EffectThumb kind={it.v ?? ""} />;
    return <Chibi config={{ ...config, ...noFx, [it.slot]: it.id }} size={small ? 40 : 66} />;
  };
  const bgArt = (id?: string | null) =>
    id && hasSprite(id) ? <Sprite id={id} className="w-16" /> : <span className="block h-9 w-16 overflow-hidden rounded"><ProfileScene bgId={id} /></span>;

  const equipped: { tab: Tab; label: string; art: React.ReactNode; aria: string }[] = [
    { tab: "char", label: "Nhân vật", aria: currentPreset?.name ?? "Tuỳ chỉnh", art: currentPreset ? <Sprite id={currentPreset.id} className="w-16" /> : <Chibi config={{ ...config, ...noFx }} size={40} /> },
    { tab: "pet", label: "Thú cưng", aria: config.pet ? ITEM_BY_ID[config.pet]?.name ?? "" : "Không dùng", art: config.pet ? artOf(ITEM_BY_ID[config.pet], true) : <Empty /> },
    { tab: "frame", label: "Khung viền", aria: config.frame ? ITEM_BY_ID[config.frame]?.name ?? "" : "Không dùng", art: config.frame ? artOf(ITEM_BY_ID[config.frame], true) : <Empty /> },
    { tab: "background", label: "Hình nền", aria: config.background ? ITEM_BY_ID[config.background]?.name ?? "" : "Mặc định", art: bgArt(config.background) },
    { tab: "effect", label: "Hiệu ứng", aria: config.effect ? ITEM_BY_ID[config.effect]?.name ?? "" : "Không dùng", art: config.effect ? artOf(ITEM_BY_ID[config.effect], true) : <Empty /> },
    {
      tab: "title",
      label: "Danh hiệu",
      aria: titleItem?.name ?? level?.name ?? "",
      art: <span className="max-w-full truncate whitespace-nowrap rounded-full px-1.5 py-[3px] text-[9px] font-extrabold" style={titleItem ? titlePill(titleItem.id) : pill(LEVEL_PILL)}>{titleItem?.name ?? level?.name ?? "—"}</span>,
    },
  ];

  const frameStyle = config.frame ? frameSpriteStyle(config.frame, 112) : undefined;

  return (
    <div className="flex flex-wrap items-start gap-6" data-testid="decor-studio">
      <CoinBurst burst={burst} />
      <Confetti burst={confetti} />

      {/* ===== LEFT: thẻ xem trước ===== */}
      <section aria-label="Xem trước hồ sơ" className="studio-card min-w-0 flex-[1_1_320px] overflow-hidden lg:sticky lg:top-24 lg:max-w-[380px]" data-testid="profile-card">
        <ProfileBanner config={config} name={user.name} showAvatar={false} previewing={dirty} />
        <div className="flex flex-col gap-[18px] px-6 pb-6">
          <div className="-mt-[52px] flex items-end gap-3.5">
            <div className="relative h-28 w-28 shrink-0 rounded-full bg-[#EEF0FB] shadow-[0_0_0_4px_#fff]" style={frameStyle} data-testid="profile-avatar-ring" data-frame={config.frame ?? ""}>
              <AvatarFace config={config} bg="#EDE7FD" title={user.name ?? undefined} className="absolute inset-6" />
              {config.frame && !frameStyle && <FrameRing frameId={config.frame} className="absolute inset-0 h-full w-full" />}
            </div>
            {config.nameplate ? (
              <Nameplate id={config.nameplate} className="mb-1 min-w-0 flex-1 px-3 py-2" testId="profile-nameplate">
                <p className="truncate text-[18px] font-extrabold leading-[1.1]">{user.name || "Học sinh"}</p>
                <p className="truncate text-xs opacity-80">{user.email || "Chưa có email"}</p>
              </Nameplate>
            ) : (
              <div className="flex min-w-0 flex-col gap-1.5 pb-1.5">
                <p className="truncate text-[22px] font-extrabold leading-[1.1]">{user.name || "Học sinh"}</p>
                <p className="truncate text-[13px] text-[#6B6680]">{user.email || "Chưa có email"}</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold" style={titleItem ? titlePill(titleItem.id) : pill(LEVEL_PILL)} data-testid="profile-title">
              {titleItem?.name ?? level?.name ?? "Học sinh"}
            </span>
            <span className="text-xs text-[#6B6680]">Danh hiệu đang dùng</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-0.5 rounded-[14px] bg-[#F3F0FF] px-4 py-3.5">
              <span className="text-2xl font-extrabold text-[#4319A8] tabular-nums">{completedLessons}</span>
              <span className="text-[13px] text-[#4B4566]">bài đã học</span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-[14px] bg-[#FFF6DB] px-4 py-3.5">
              <span className="text-2xl font-extrabold text-[#7A4E00] tabular-nums" data-testid="decor-xu">{fmt(balance)}</span>
              <span className="text-[13px] text-[#6B4E12]">xu hiện có{gems ? ` · ${gems} ngọc` : ""}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] font-bold text-[#3B3650]">Đang trang bị</span>
              <span className="text-xs text-[#6B6680]">Bấm để đổi</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {equipped.map((sl) => (
                <button
                  key={sl.tab}
                  type="button"
                  onClick={() => goTab(sl.tab)}
                  aria-label={`${sl.label}: ${sl.aria}`}
                  data-testid={`equipped-${sl.tab}`}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl px-1.5 py-2",
                    tab === sl.tab ? "border-2 border-[#5B2BD6] bg-[#F5F1FF]" : changedTabs.some((t) => t.key === sl.tab) ? "border-2 border-dashed border-[#A78BFA] bg-white" : "border-2 border-[#ECE9F5] bg-white",
                  )}
                >
                  <span className="flex h-[52px] w-16 items-center justify-center overflow-hidden rounded-lg bg-[#F3F1FA]">{sl.art}</span>
                  <span className="text-[11px] font-semibold text-[#4B4566]">{sl.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] font-bold text-[#3B3650]">Huy hiệu</span>
              <Link href={`/profile/${user.id}`} className="text-xs font-semibold text-[#5B2BD6] hover:text-[#4319A8]">Xem tất cả</Link>
            </div>
            <div className="flex gap-2.5">
              {medals.map((m) => (
                <div key={m.label} role="img" aria-label={`Huy hiệu ${m.label}: ${m.hint}${m.ok ? ", đã đạt" : ", chưa đạt"}`} title={`${m.label}: ${m.hint}`} data-testid="medal" data-ok={m.ok ? "1" : "0"} className={cn("flex h-12 w-12 items-center justify-center rounded-[14px] border border-[#ECE9F5] bg-[#F6F5FB]", !m.ok && "opacity-35 grayscale")}>
                  <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden>
                    <path d="M7 2h4l1 5-3 1zM17 2h-4l-1 5 3 1z" fill={m.ribbon} />
                    <circle cx="12" cy="14" r="7" fill={m.fill} stroke={m.stroke} strokeWidth="1.5" />
                    <path d="M12 10.2l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z" fill="#FFFFFF" />
                  </svg>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              await signOut({ redirect: false });
              window.location.href = "/login";
            }}
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#F1C9D3] bg-white font-bold text-[#B4233F] hover:bg-[#FFF5F7]"
          >
            <IconLogout /> Đăng xuất
          </button>
        </div>
      </section>

      {/* ===== RIGHT: Tủ đồ & Cửa hàng ===== */}
      <section aria-label="Tủ đồ và cửa hàng" className="studio-card flex min-w-0 flex-[999_1_520px] flex-col" data-testid="decor-panel">
        {/* Điện thoại: thẻ xem trước ở đầu trang, cuộn xuống tủ đồ là khuất → nhân vật dính trên đầu khung để thấy ngay khi chọn */}
        <div className="sticky top-[60px] z-20 px-3 pt-3 lg:hidden" data-testid="decor-mini-preview">
          <div className="flex items-center gap-3 rounded-2xl border border-[#E4E0F0] bg-gradient-to-b from-[#EAF0FF] to-[#F8F6FF] p-2 pr-3 shadow-[0_6px_18px_rgba(42,31,92,0.14)]">
            <div className="h-[100px] w-[86px] shrink-0">
              <Chibi config={{ ...config, background: null, frame: null, effect: null }} size={86} className="h-full w-full" title="Xem trước nhân vật" />
            </div>
            <div className="flex min-w-0 flex-col gap-0.5" aria-live="polite">
              <span className="text-xs font-bold text-[#5B2BD6]">{dirty ? "Đang xem trước" : "Nhân vật của bạn"}</span>
              <span className="truncate text-sm font-bold text-[#2A1F5C]">{bar.title}</span>
              <span className="line-clamp-2 text-xs text-[#5F5B73]">{bar.sub}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-4 px-4 pt-[22px] sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-xl font-extrabold">Tủ đồ &amp; Cửa hàng</h2>
              <p className="text-[13px] text-[#5F5B73]">Chọn để xem thử trên hồ sơ trước khi lưu hoặc mua.</p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/courses" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#5B2BD6] hover:text-[#4319A8]">
                <IconHelp /> Cách kiếm thêm xu
              </Link>
            </div>
          </div>

          <div role="tablist" aria-label="Loại vật phẩm" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:px-0">
            {tabMeta.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                data-testid={`decor-tab-${t.key}`}
                onClick={() => goTab(t.key)}
                className={cn("flex h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-bold", tab === t.key ? "border-[#5B2BD6] bg-[#5B2BD6] text-white" : "border-[#E4E0F0] bg-white text-[#3B3650]")}
              >
                {t.label}
                <span className={cn("rounded-full px-[7px] py-0.5 text-[11px] font-bold", tab === t.key ? "bg-white/20 text-white" : "bg-[#F3F1FA] text-[#4B4566]")}>{t.count}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {tab === "char" && (
              <div className="flex gap-1 rounded-xl bg-[#F3F1FA] p-1" role="radiogroup" aria-label="Kiểu chỉnh nhân vật">
                {([["preset", "Mẫu có sẵn"], ["custom", "Tùy chỉnh mặt, tóc & mắt"]] as const).map(([k, label]) => (
                  <button key={k} type="button" role="radio" aria-checked={charMode === k} data-testid={`char-${k}`} onClick={() => { play("tick"); setCharMode(k); }} className={cn("h-9 rounded-[9px] px-3.5 text-[13px] font-bold", charMode === k ? "bg-white text-[#2A1F5C] shadow-[0_1px_3px_rgba(30,27,46,0.12)]" : "text-[#5F5B73]")}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            {!(tab === "char" && charMode === "custom") && (
              <div className="ml-auto flex gap-1.5">
                {([["all", "Tất cả"], ["owned", "Đã sở hữu"], ["shop", "Cửa hàng"]] as const).map(([k, label]) => (
                  <button key={k} type="button" aria-pressed={filter === k} data-testid={`filter-${k}`} onClick={() => { play("tick"); setFilter(k); }} className={cn("h-[34px] rounded-full border px-3 text-[13px] font-semibold", filter === k ? "border-[#2A1F5C] bg-[#2A1F5C] text-white" : "border-[#E4E0F0] bg-white text-[#3B3650]")}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Lưới */}
        {!(tab === "char" && charMode === "custom") ? (
          <div className="grid min-h-[420px] grid-cols-2 content-start gap-3.5 px-4 pb-6 pt-4 sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] sm:px-6" role="tabpanel">
            {tab === "char"
              ? PRESETS.map((p) => {
                  const items = Object.values(p.items).filter((x): x is string => !!x).map((id) => ITEM_BY_ID[id]);
                  const missing = items.filter((it) => !has(it));
                  if (filter === "owned" && missing.length) return null;
                  if (filter === "shop" && !missing.length) return null;
                  const xu = missing.reduce((s, it) => s + (it.price && "xu" in it.price ? it.price.xu : 0), 0);
                  const gem = missing.reduce((s, it) => s + (it.price && "gem" in it.price ? it.price.gem : 0), 0);
                  const sel = matchPreset(config, p);
                  const lockedP = missing.some((it) => !it.price);
                  return (
                    <Card
                      key={p.id}
                      testId={`preset-${p.id}`}
                      name={p.name}
                      selected={sel}
                      trying={sel && missing.length > 0}
                      locked={lockedP && !sel}
                      onClick={() => applyPreset(p)}
                      art={<Sprite id={p.id} className="w-full" />}
                      status={matchPreset(saved, p) ? <Using /> : missing.length === 0 ? <Owned /> : lockedP ? <LockNote text="Hộp bí ẩn" /> : <Price text={priceText(xu, gem)} />}
                      aria={`${p.name}${missing.length === 0 ? ", đã sở hữu" : lockedP ? ", khóa" : `, giá ${priceText(xu, gem)}`}`}
                    />
                  );
                })
              : renderSlot(TABS.find((t) => t.key === tab)!.slots[0])}
          </div>
        ) : (
          <div className="flex min-h-[420px] flex-col gap-[22px] px-4 pb-6 pt-4 sm:px-6" role="tabpanel">
            <Section title="Giới tính">
              <div className="flex gap-2.5" role="radiogroup" aria-label="Giới tính">
                {(["male", "female"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    role="radio"
                    aria-checked={gender === g}
                    data-testid={`gender-${g}`}
                    onClick={() => putGender(g)}
                    className={cn("flex h-11 min-w-[96px] items-center justify-center gap-1.5 rounded-xl border-2 px-4 text-sm font-bold", gender === g ? "border-[#5B2BD6] bg-[#F5F1FF] text-[#2A1F5C]" : "border-[#ECE9F5] bg-white text-[#3B3650]")}
                  >
                    <span aria-hidden>{g === "male" ? "👦" : "👧"}</span>
                    {g === "male" ? "Nam" : "Nữ"}
                  </button>
                ))}
              </div>
              <p className="text-xs text-[#6B6680]">Mỗi giới có 10 kiểu tóc riêng · đổi giới thì kiểu tóc và khuôn mặt chuyển theo.</p>
            </Section>
            {PART_ROWS.map((key) => (
              <Section key={key} title={PART_LABEL[key].title}>
                <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label={PART_LABEL[key].title}>
                  {[{ id: null, name: PART_LABEL[key].none }, ...FACE_PART_OPTIONS[key]].map((o) => (
                    <FacePartButton key={o.id ?? "none"} testId={`${key}-${o.id ?? "none"}`} name={o.name} on={(config[key] ?? null) === o.id} face={partBase} config={{ ...config, [key]: o.id }} onClick={() => putPart(key, o.id)} />
                  ))}
                </div>
              </Section>
            ))}
            <p className="-mt-3 text-xs text-[#6B6680]">Khuôn mặt riêng của nhân vật tự chỉnh · miễn phí. Muốn đúng mặt của mẫu thì chọn ở “Mẫu có sẵn”.</p>
            {partsHidden && <p className="-mt-3 text-xs text-[#B4540A]">Trang phục đang che kín mặt (mũ giáp / mũ phi hành gia) nên chưa thấy mắt, miệng đã phối.</p>}
            <Section title="Màu tóc">
              <Swatches slot="hairColor" config={config} has={has} put={put} color={(it) => (it.v?.startsWith("url(") ? "conic-gradient(#F87171,#FBBF24,#34D399,#60A5FA,#A78BFA,#F87171)" : it.v ?? "#000")} />
            </Section>
            <Section title={`Kiểu tóc ${gender === "female" ? "nữ" : "nam"}`}>
              <HairCards gender={gender} config={config} has={has} put={put} hot={hotHair} saved={saved.hair ?? null} />
            </Section>
            <Section title="Màu mắt">
              <Swatches slot="eyes" config={config} has={has} put={put} color={(it) => it.v ?? "#000"} />
            </Section>
            <Section title="Trang phục"><Chips slot="outfit" config={config} has={has} put={put} /></Section>
            <Section title="Phụ kiện"><Chips slot="accessory" optional config={config} has={has} put={put} /></Section>
          </div>
        )}

        {/* Thanh hành động */}
        <div className="sticky bottom-0 z-10 mt-auto flex flex-wrap items-center gap-3 rounded-b-[20px] border-t border-[#ECE9F5] bg-[#FBFAFE] px-4 py-3.5 sm:px-6">
          <div className="flex min-w-0 flex-[1_1_260px] items-center gap-2.5">
            <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]", bar.icon)} aria-hidden>
              {bar.kind === "warn" ? <IconAlert /> : <IconCheck />}
            </span>
            <div className="flex min-w-0 flex-col" aria-live="polite" data-testid="decor-status">
              <span className="text-sm font-bold">{bar.title}</span>
              <span className="text-xs text-[#5F5B73]">{bar.sub}</span>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap gap-2.5">
            {dirty && (
              <button type="button" data-testid="decor-reset" disabled={pending} onClick={() => { play("tick"); setConfig(saved); }} className="flex h-11 items-center gap-2 rounded-xl border border-[#E4E0F0] bg-white px-4 font-bold text-[#3B3650]">
                <IconUndo /> Hoàn tác
              </button>
            )}
            {dirty && !locked.length && buyable.length > 0 && !enough && (
              <Link href="/courses" className="flex h-11 items-center rounded-xl border border-[#F3DC8E] bg-[#FFF6DB] px-4 font-bold text-[#7A4E00]">Kiếm xu</Link>
            )}
            {dirty && !locked.length && buyable.length > 0 ? (
              <button
                type="button"
                data-testid="decor-buy"
                disabled={pending || !canEarn || isDemo || !enough}
                onClick={buyAndSave}
                title={isDemo ? "Tài khoản demo chỉ xem" : !canEarn ? "Tài khoản cần được thầy duyệt" : undefined}
                className="flex h-11 items-center gap-2 rounded-xl bg-[#5B2BD6] px-5 font-bold text-white disabled:cursor-not-allowed disabled:bg-[#E4E0F0] disabled:text-[#6B6680]"
              >
                {pending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden /> : <IconSave />} Mua &amp; lưu · {priceText(cost.xu, cost.gem)}
              </button>
            ) : (
              <button
                type="button"
                data-testid="decor-save"
                disabled={pending || !dirty || locked.length > 0 || isDemo}
                onClick={save}
                title={isDemo ? "Tài khoản demo chỉ xem" : undefined}
                className="flex h-11 items-center gap-2 rounded-xl bg-[#5B2BD6] px-5 font-bold text-white disabled:cursor-not-allowed disabled:bg-[#E4E0F0] disabled:text-[#6B6680]"
              >
                {pending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden /> : <IconSave />} Lưu trang trí
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );

  function renderSlot(slot: Slot) {
    const items = itemsOfSlot(slot).filter((it) => (filter === "owned" ? has(it) : filter === "shop" ? !has(it) : true));
    const wide = slot === "background" || slot === "nameplate";
    const cards = items.map((it) => {
      const own = has(it);
      const on = config[slot] === it.id;
      return (
        <Card
          key={it.id}
          testId={`item-${it.id}`}
          name={it.name}
          selected={on}
          trying={on && !own}
          locked={!own && (!it.price || lvLocked(it))}
          wide={wide}
          onClick={() => put(slot, it.id)}
          art={
            slot === "title" ? (
              <span className="rounded-full px-3 py-[7px] text-center text-xs font-extrabold" style={titlePill(it.id)}>{it.name}</span>
            ) : slot === "nameplate" ? (
              <Nameplate id={it.id} className="flex aspect-[420/100] w-[94%] items-center px-2.5"><span className="text-xs font-extrabold">{user.name || "Học Sinh"}</span></Nameplate>
            ) : (
              artOf(it)
            )
          }
          status={saved[slot] === it.id && own ? <Using /> : own ? (it.free ? <span className="text-xs font-semibold text-[#6B6680]">Miễn phí</span> : <Owned />) : lvLocked(it) ? <LockNote text={`Lv.${it.minLevel}`} /> : it.price ? <Price text={"xu" in it.price ? `${fmt(it.price.xu)} xu` : `${it.price.gem} ngọc`} /> : <LockNote text="Hộp bí ẩn" />}
          aria={`${it.name}${own ? ", đã sở hữu" : it.price ? `, giá ${"xu" in it.price ? `${fmt(it.price.xu)} xu` : `${it.price.gem} ngọc`}` : ", khóa"}`}
        />
      );
    });
    return (
      <>
        {filter !== "shop" && (
          <Card testId={`none-${slot}`} name="Không dùng" selected={!config[slot]} trying={false} locked={false} wide={wide} onClick={() => put(slot, null)} art={<span className="text-2xl text-[#C9C4DA]">✕</span>} status={<span className="text-xs text-[#6B6680]">Bỏ trống</span>} aria="Không dùng" />
        )}
        {cards}
        {items.length === 0 && <p className="col-span-full py-12 text-center text-[#5F5B73]">Không có vật phẩm nào trong mục này.</p>}
      </>
    );
  }
}

/* ============================== Thành phần nhỏ ============================== */

const Empty = () => <span className="text-lg text-[#C9C4DA]" aria-hidden>—</span>;
const Using = () => <span className="text-xs font-bold text-[#5B2BD6]">Đang dùng</span>;
const Owned = () => <span className="text-xs font-semibold text-[#17703F]">Đã sở hữu</span>;
const Price = ({ text }: { text: string }) => (
  <span className="flex items-center gap-1.5 text-[13px] font-bold text-[#7A4E00]">
    <Coin size={14} />{text}
  </span>
);
const LockNote = ({ text }: { text: string }) => <span className="text-xs font-semibold text-[#8A3B12]">Mở khóa: {text}</span>;

/** Nút chọn bộ phận mặt: xem trước bộ phận đó trên khuôn mặt đang dùng */
function FacePartButton({ name, on, face, config, onClick, testId }: { name: string; on: boolean; face: number; config: AvatarConfig; onClick: () => void; testId: string }) {
  const uid = useId().replace(/:/g, "");
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      aria-label={name}
      title={`${name} (miễn phí)`}
      data-testid={testId}
      onClick={onClick}
      className="h-14 w-14 overflow-hidden rounded-full"
      // nền tròn cùng màu da đang xem (lỗi cũ: chỉ elip mặt đổi màu da, nền vẫn da sáng → như mảng tối giữa nút)
      style={{ backgroundColor: skinToneOf(config.skinTone) ?? "#FBE3D3", boxShadow: `0 0 0 3px #FFFFFF, 0 0 0 5px ${on ? ACCENT : "#E4E0F0"}` }}
    >
      <svg viewBox="29 36 62 62" className="h-full w-full" aria-hidden>
        <FaceArt uid={`fp${uid}`} face={face} config={config} x={26} y={44} width={68} height={46} />
        {config.brows && <Brows id={config.brows} hairColor={config.hairColor} />}
      </svg>
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-sm font-bold">{title}</p>
      {children}
    </div>
  );
}

function Card({ name, selected, trying, locked, onClick, art, status, testId, wide, aria }: {
  name: string; selected: boolean; trying: boolean; locked: boolean; onClick: () => void; art: React.ReactNode; status: React.ReactNode; testId?: string; wide?: boolean; aria: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={selected}
      aria-label={aria}
      onClick={onClick}
      className={cn(
        "studio-item relative flex flex-col gap-2.5 rounded-2xl p-2 pb-3 text-left",
        selected ? "border-2 border-[#5B2BD6] bg-[#F5F1FF] shadow-[0_6px_18px_rgba(91,43,214,0.16)]" : "border-2 border-[#ECE9F5] bg-white",
      )}
    >
      <span className={cn("relative flex w-full items-center justify-center overflow-hidden rounded-[10px] bg-[#F3F1FA]", wide ? "aspect-[112/62]" : "aspect-[83/68]")}>
        {art}
        {locked && (
          <span className="absolute inset-0 flex items-center justify-center bg-[rgba(30,27,46,0.35)]">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#3B3650]"><IconLock /></span>
          </span>
        )}
        {trying && <span className="absolute bottom-1.5 left-1.5 rounded-full bg-[#2A1F5C] px-2 py-[3px] text-[11px] font-bold text-white">Đang thử</span>}
      </span>
      {selected && (
        <span className="absolute -right-[7px] -top-[7px] z-[2] flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-[#5B2BD6] text-white" aria-hidden>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12l5 5L20 7" /></svg>
        </span>
      )}
      <span className="flex min-w-0 flex-col gap-1 px-1">
        <span className="truncate text-sm font-bold text-[#1E1B2E]">{name}</span>
        {status}
      </span>
    </button>
  );
}

/**
 * Thẻ kiểu tóc (kiểu tủ đồ game nhập vai): ảnh = đầu nhân vật đang chỉnh đội thử kiểu tóc đó, tên, giá / Đã có,
 * nhãn Mới (món mới ra) / Hot (nhiều bạn dùng), nút Chọn. Mỗi giới 10 kiểu.
 */
function HairCards({ gender, config, has, put, hot, saved }: { gender: Gender; config: AvatarConfig; has: (it: Item) => boolean; put: (slot: Slot, id: string | null) => void; hot: string[]; saved: string | null }) {
  const items = itemsOfSlot("hair").filter((it) => (it.gender ?? "male") === gender);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(132px,1fr))]" role="radiogroup" aria-label="Kiểu tóc">
      {items.map((it) => {
        const own = has(it);
        const on = config.hair === it.id;
        const price = it.price ? ("xu" in it.price ? `${fmt(it.price.xu)} xu` : `${it.price.gem} ngọc`) : "Hộp bí ẩn";
        const badge = hot.includes(it.id) ? "Hot" : it.isNew ? "Mới" : null;
        return (
          <button
            key={it.id}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={`${it.name}${own ? "" : `, ${price}`}`}
            data-testid={`item-${it.id}`}
            data-badge={badge ?? undefined}
            onClick={() => put("hair", it.id)}
            className={cn("relative flex flex-col overflow-hidden rounded-2xl border-2 bg-white text-left transition-shadow", on ? "border-[#5B2BD6] shadow-[0_6px_16px_rgba(91,43,214,0.18)]" : "border-[#ECE9F5] hover:shadow-[0_4px_12px_rgba(42,31,92,0.08)]")}
          >
            {badge && (
              <span className={cn("absolute left-1.5 top-1.5 z-10 rounded-md px-1.5 py-0.5 text-[11px] font-extrabold text-white shadow", badge === "Hot" ? "bg-[#E5484D]" : "bg-[#2F80ED]")}>{badge}</span>
            )}
            <span className="relative block aspect-square overflow-hidden bg-gradient-to-b from-[#EEF2FF] to-[#F8F6FF]" aria-hidden>
              <span className="block h-full w-full" style={{ transform: "scale(1.38) translateY(13%)" }}>
                <Chibi config={{ ...config, hair: it.id, gender, accessory: null, background: null, frame: null, effect: null }} size={96} className="h-full w-full" />
              </span>
            </span>
            <span className="flex flex-col gap-1.5 px-2.5 pb-2.5 pt-2">
              <span className="truncate text-[13px] font-bold text-[#2A1F5C]">{it.name}</span>
              <span className="flex items-center justify-between gap-1.5">
                <span className={cn("truncate text-xs font-semibold", own ? "text-[#1F8A4C]" : "text-[#8A5A00]")}>
                  {saved === it.id ? "Đang dùng" : own ? (it.free ? "Miễn phí" : "Đã có") : price}
                </span>
                <span className={cn("shrink-0 rounded-full py-1 text-[11px] font-bold", on ? "bg-[#5B2BD6] px-2 text-white" : "bg-[#FFE7A3] px-2.5 text-[#6B4A00]")} aria-hidden>{on ? "✓" : "Chọn"}</span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Chips({ slot, config, has, put, optional, only }: { slot: Slot; config: AvatarConfig; has: (it: Item) => boolean; put: (slot: Slot, id: string | null) => void; optional?: boolean; only?: (it: Item) => boolean }) {
  const chip = (on: boolean) => (on ? "border-[#5B2BD6] bg-[#F5F1FF] text-[#2A1F5C]" : "border-[#ECE9F5] bg-white text-[#3B3650]");
  return (
    <div className="flex flex-wrap gap-2.5">
      {optional && (
        <button type="button" aria-pressed={!config[slot]} onClick={() => put(slot, null)} data-testid={`none-${slot}`} className={cn("h-11 rounded-xl border-2 px-4 text-[13px] font-semibold", chip(!config[slot]))}>Không có</button>
      )}
      {itemsOfSlot(slot).filter((it) => !only || only(it)).map((it) => {
        const own = has(it);
        const on = config[slot] === it.id;
        const price = it.price ? ("xu" in it.price ? `${fmt(it.price.xu)} xu` : `${it.price.gem} ngọc`) : "Hộp bí ẩn";
        return (
          <button key={it.id} type="button" aria-pressed={on} data-testid={`item-${it.id}`} title={own ? it.name : `${it.name} — ${price}`} onClick={() => put(slot, it.id)} className={cn("flex h-11 items-center gap-1.5 rounded-xl border-2 px-4 text-[13px] font-semibold", chip(on))}>
            {it.name}
            {!own && <span className="text-[#8A3B12]" aria-label={`chưa sở hữu, ${price}`}><IconLock size={12} /></span>}
          </button>
        );
      })}
    </div>
  );
}

function Swatches({ slot, config, has, put, color }: { slot: Slot; config: AvatarConfig; has: (it: Item) => boolean; put: (slot: Slot, id: string | null) => void; color: (it: Item) => string }) {
  return (
    <div className="flex flex-wrap gap-3.5">
      {itemsOfSlot(slot).map((it) => {
        const own = has(it);
        const on = config[slot] === it.id;
        const price = it.price ? ("xu" in it.price ? `${fmt(it.price.xu)} xu` : `${it.price.gem} ngọc`) : "Hộp bí ẩn";
        return (
          <button
            key={it.id}
            type="button"
            data-testid={`item-${it.id}`}
            aria-pressed={on}
            aria-label={`${it.name}${own ? "" : ` (${price})`}`}
            title={`${it.name}${own ? "" : ` — ${price}`}`}
            onClick={() => put(slot, it.id)}
            className="relative h-10 w-10 rounded-full"
            style={{ background: color(it), boxShadow: `0 0 0 3px #FFFFFF, 0 0 0 5px ${on ? ACCENT : "#E4E0F0"}` }}
          >
            {!own && <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[#8A3B12] shadow"><IconLock size={10} /></span>}
          </button>
        );
      })}
    </div>
  );
}

/** Ô xem trước hiệu ứng không có ảnh canvas: nền tối + hạt tĩnh */
function EffectThumb({ kind }: { kind: string }) {
  const pts: [number, number][] = [[18, 22], [44, 14], [70, 30], [86, 12], [30, 44], [58, 48], [82, 46], [12, 50]];
  return (
    <svg viewBox="0 0 100 56" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden>
      <rect width="100" height="56" fill="#2A1F5C" />
      {pts.map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${0.6 + (i % 3) * 0.15})`}><FxShape kind={kind} i={i} /></g>
      ))}
    </svg>
  );
}
