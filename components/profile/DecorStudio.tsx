"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Check, CircleHelp, Loader2, Lock, LogOut, RotateCcw, ShoppingBag } from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { buyBundle, saveAvatar } from "@/actions/avatar";
import { ITEM_BY_ID, itemsOfSlot, type Item, type Slot } from "@/lib/game/items";
import { PRESETS, type Preset } from "@/lib/game/presets";
import type { AvatarConfig } from "@/lib/game/avatar";
import { play } from "@/lib/sound";
import { Chibi, FxShape } from "@/components/avatar/Chibi";
import { PetSvg } from "@/components/avatar/PetSvg";
import { CoinBurst } from "@/components/game/CoinBurst";
import { Confetti } from "@/components/points/Confetti";
import { RAR_STYLE } from "@/components/studio/rarity";
import { AvatarRing, ProfileBanner } from "./ProfileBanner";
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
  /** `/profile?try=<itemId>` (nút "Thử trên hồ sơ" ở tiệm): mặc thử sẵn món này */
  initialTry?: string | null;
}

type Tab = "char" | "pet" | "frame" | "background" | "effect" | "title";
type Filter = "all" | "owned" | "shop";
const TABS: { key: Tab; label: string; slots: Slot[] }[] = [
  { key: "char", label: "Nhân vật", slots: ["hair", "hairColor", "eyes", "outfit", "accessory", "skin"] },
  { key: "pet", label: "Thú cưng", slots: ["pet"] },
  { key: "frame", label: "Khung viền", slots: ["frame"] },
  { key: "background", label: "Hình nền", slots: ["background"] },
  { key: "effect", label: "Hiệu ứng", slots: ["effect"] },
  { key: "title", label: "Danh hiệu", slots: ["title"] },
];
const TAB_OF: Partial<Record<Slot, Tab>> = Object.fromEntries(TABS.flatMap((t) => t.slots.map((s) => [s, t.key])));
const SLOT_KEYS: Slot[] = ["skin", "hair", "hairColor", "eyes", "outfit", "accessory", "frame", "background", "effect", "title", "pet"];
const same = (a: AvatarConfig, b: AvatarConfig) => SLOT_KEYS.every((k) => (a[k] ?? null) === (b[k] ?? null));
const fmt = (n: number) => n.toLocaleString("vi-VN");
const priceText = (xu: number, gem: number) => [xu ? `${fmt(xu)} xu` : "", gem ? `${gem} ngọc` : ""].filter(Boolean).join(" + ");
const noFx = { background: null, frame: null, effect: null } as const;

/** "Hồ sơ & Trang trí" theo artifact GĐ9: thẻ xem trước + Tủ đồ & Cửa hàng; bấm món chưa có = mặc thử; "Mua & lưu" một lần. */
export default function DecorStudio({ user, config: initial, owned: ownedInit, wallet, canEarn, isDemo, completedLessons, level, initialTry }: DecorStudioProps) {
  const router = useRouter();
  const tryItem = initialTry ? ITEM_BY_ID[initialTry] : undefined;
  const [config, setConfig] = useState<AvatarConfig>(() => (tryItem ? { ...initial, [tryItem.slot]: tryItem.id } : initial));
  const [saved, setSaved] = useState<AvatarConfig>(initial);
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
  const buyable = trying.filter((it) => it.price);
  const gachaLocked = trying.filter((it) => !it.price);
  const cost = buyable.reduce((s, it) => ({ xu: s.xu + (it.price && "xu" in it.price ? it.price.xu : 0), gem: s.gem + (it.price && "gem" in it.price ? it.price.gem : 0) }), { xu: 0, gem: 0 });
  const lackXu = Math.max(0, cost.xu - balance);
  const lackGem = Math.max(0, cost.gem - gems);
  const affordable = lackXu === 0 && lackGem === 0;
  const dirty = !same(config, saved);

  const put = (slot: Slot, id: string | null) => {
    play("click");
    setConfig((c) => ({ ...c, [slot]: id }));
  };
  const applyPreset = (p: Preset) => {
    play("click");
    setConfig((c) => ({ ...c, ...p.items }));
  };
  const goTab = (t: Tab) => {
    play("tick");
    setTab(t);
    setFilter("all");
  };
  const dropTrying = () => {
    play("tick");
    setConfig((c) => {
      const next = { ...c };
      for (const it of trying) next[it.slot] = saved[it.slot] ?? null;
      return next;
    });
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
    { icon: "⭐", label: "Chăm học", hint: "Học xong 10 bài", ok: completedLessons >= 10, from: "#c084fc", to: "#7c3aed" },
    { icon: "🛡️", label: "Học bá", hint: "Học xong 50 bài", ok: completedLessons >= 50, from: "#4ade80", to: "#15803d" },
    { icon: "🌟", label: "Thăng cấp", hint: "Đạt cấp 3", ok: (level?.level ?? 1) >= 3, from: "#60a5fa", to: "#1d4ed8" },
    { icon: "🏆", label: "Nhà sưu tầm", hint: "Sở hữu 10 món", ok: owned.size >= 10, from: "#fbbf24", to: "#c2410c" },
  ];

  // Thanh hành động
  const bar = gachaLocked.length
    ? { tone: "warn" as const, title: `${gachaLocked[0].name} chỉ có trong Hộp bí ẩn`, sub: "Bỏ món đó để lưu, hoặc mở rương ở Tiệm quà" }
    : buyable.length
      ? {
          tone: affordable ? ("ok" as const) : ("warn" as const),
          title: `${buyable[0].name}${buyable.length > 1 ? ` +${buyable.length - 1} món` : ""} · ${priceText(cost.xu, cost.gem)}`,
          sub: affordable ? "Bấm Mua & lưu để dùng ngay" : `Bạn còn thiếu ${priceText(lackXu, lackGem)}`,
        }
      : dirty
        ? { tone: "ok" as const, title: "Có thay đổi chưa lưu", sub: "Lưu để bạn bè thấy trên bảng xếp hạng" }
        : { tone: "ok" as const, title: "Đã lưu", sub: "Hồ sơ đang hiển thị đúng như bạn thấy" };

  const tabMeta = TABS.map((t) => {
    const items = t.key === "char" ? PRESETS.length : itemsOfSlot(t.slots[0]).length;
    const ownedN = t.key === "char"
      ? PRESETS.filter((p) => Object.values(p.items).every((id) => !id || has(ITEM_BY_ID[id]))).length
      : itemsOfSlot(t.slots[0]).filter(has).length;
    return { ...t, count: `${ownedN}/${items}` };
  });

  return (
    <div className="flex flex-col items-start gap-6 lg:flex-row" data-testid="decor-studio">
      <CoinBurst burst={burst} />
      <Confetti burst={confetti} />

      {/* ===== Thẻ xem trước ===== */}
      <section aria-label="Xem trước hồ sơ" className="studio-card w-full shrink-0 overflow-hidden lg:sticky lg:top-24 lg:max-w-[380px]" data-testid="profile-card">
        <ProfileBanner config={config} name={user.name} showAvatar={false} previewing={dirty} />
        <div className="flex flex-col gap-[18px] px-6 pb-6">
          <div className="-mt-[52px] flex items-end gap-3.5">
            <AvatarRing frameId={config.frame} image={user.image} name={user.name} className="h-28 w-28 shrink-0 rounded-full bg-[#EEF0FB] shadow-[0_0_0_4px_#fff]" />
            <div className="flex min-w-0 flex-col gap-1.5 pb-1.5">
              <p className="truncate text-[22px] font-extrabold leading-tight">{user.name || "Học sinh"}</p>
              <p className="truncate text-[13px] text-[#6B6680]">{user.email || "Chưa có email"}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {titleItem ? (
              <span className={cn("rounded-full px-3 py-1.5 text-[13px] font-bold", RIBBON[titleItem.rarity])} data-testid="profile-title">{titleItem.name}</span>
            ) : level ? (
              <span className="rounded-full bg-[#F3E3C3] px-3 py-1.5 text-[13px] font-bold text-[#6B4512]">{level.icon} {level.name}</span>
            ) : null}
            <span className="text-xs text-[#6B6680]">{titleItem ? "Danh hiệu đang dùng" : "Danh hiệu theo cấp"}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-0.5 rounded-[14px] bg-[#F3F0FF] px-4 py-3.5">
              <span className="text-2xl font-extrabold text-[#4319A8] tabular-nums">{completedLessons}</span>
              <span className="text-[13px] text-[#4B4566]">bài đã học</span>
            </div>
            <Link href="/rewards" className="flex flex-col gap-0.5 rounded-[14px] bg-[#FFF6DB] px-4 py-3.5 transition-colors hover:bg-[#FFEDB8]">
              <span className="text-2xl font-extrabold text-[#7A4E00] tabular-nums" data-testid="decor-xu">{fmt(balance)}</span>
              <span className="text-[13px] text-[#6B4E12]">xu hiện có{gems ? ` · ${gems} ngọc` : ""}</span>
            </Link>
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] font-bold text-[#3B3650]">Đang trang bị</span>
              <span className="text-xs text-[#6B6680]">Bấm để đổi</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([
                ["char", "Nhân vật", <Chibi key="c" config={{ ...config, ...noFx }} size={40} />],
                ["pet", "Thú cưng", config.pet ? <PetSvg key="p" itemId={config.pet} size={44} /> : <Empty key="p" />],
                ["frame", "Khung", config.frame ? <span key="f" className="relative block h-12 w-12"><span className="absolute inset-[15%] rounded-full bg-[#DDD6FE]" /><FrameRing frameId={config.frame} className="absolute inset-0 h-full w-full" /></span> : <Empty key="f" />],
                ["background", "Nền", <span key="b" className="block h-9 w-16 overflow-hidden rounded-md"><ProfileScene bgId={config.background} /></span>],
                ["effect", "Hiệu ứng", config.effect ? <span key="e" className="block h-9 w-16 overflow-hidden rounded-md"><EffectThumb kind={ITEM_BY_ID[config.effect]?.v ?? ""} /></span> : <Empty key="e" />],
                ["title", "Danh hiệu", titleItem ? <span key="t" className={cn("max-w-full truncate rounded-full px-1.5 py-0.5 text-[9px] font-extrabold", RIBBON[titleItem.rarity])}>{titleItem.name}</span> : <Empty key="t" />],
              ] as [Tab, string, React.ReactNode][]).map(([k, label, art]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => goTab(k)}
                  aria-label={`${label}: đổi`}
                  data-testid={`equipped-${k}`}
                  className={cn("flex flex-col items-center gap-1.5 rounded-xl border-2 px-1.5 py-2", tab === k ? "border-[#5B2BD6] bg-[#F5F1FF]" : "border-[#ECE9F5] hover:border-[#C4B5FD]")}
                >
                  <span className="flex h-[52px] w-16 items-center justify-center overflow-hidden rounded-lg bg-[#F3F1FA]">{art}</span>
                  <span className="text-[11px] font-semibold text-[#4B4566]">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] font-bold text-[#3B3650]">Huy hiệu</span>
              <Link href={`/profile/${user.id}`} className="text-xs font-semibold text-[#5B2BD6] hover:text-[#4319A8]">Xem hồ sơ công khai</Link>
            </div>
            <div className="flex gap-2.5">
              {medals.map((m) => (
                <div key={m.label} role="img" aria-label={`${m.label}: ${m.hint}${m.ok ? ", đã đạt" : ", chưa đạt"}`} title={`${m.label}: ${m.hint}`} data-testid="medal" data-ok={m.ok ? "1" : "0"} className={cn("flex h-12 w-12 items-center justify-center rounded-[14px] border border-[#ECE9F5] bg-[#F6F5FB]", !m.ok && "opacity-40 grayscale")}>
                  <Medal icon={m.icon} from={m.from} to={m.to} />
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
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#F1C9D3] bg-white font-bold text-[#B4233F] transition-colors hover:bg-[#FFF1F4]"
          >
            <LogOut className="h-4 w-4" aria-hidden /> Đăng xuất
          </button>
        </div>
      </section>

      {/* ===== Tủ đồ & Cửa hàng ===== */}
      <section aria-label="Tủ đồ và cửa hàng" className="studio-card flex w-full min-w-0 flex-1 flex-col" data-testid="decor-panel">
        <div className="flex flex-col gap-4 px-4 pt-5 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-xl font-extrabold">Tủ đồ &amp; Cửa hàng</h2>
              <p className="text-[13px] text-[#5F5B73]">Chọn để xem thử trên hồ sơ trước khi lưu hoặc mua.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-[#ECE9F5] bg-[#F6F5FB] p-1 lg:hidden" data-testid="decor-mini-preview" aria-hidden>
                <Chibi config={config} size={44} />
              </div>
              <Link href="/courses" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#5B2BD6] hover:text-[#4319A8]">
                <CircleHelp className="h-4 w-4" aria-hidden /> Cách kiếm thêm xu
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
                className={cn("flex h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-bold transition-colors", tab === t.key ? "border-[#5B2BD6] bg-[#5B2BD6] text-white" : "border-[#E4E0F0] bg-white text-[#3B3650] hover:border-[#C4B5FD]")}
              >
                {t.label}
                <span className={cn("rounded-full px-1.5 py-0.5 text-[11px] font-bold", tab === t.key ? "bg-white/20 text-white" : "bg-[#F3F1FA] text-[#4B4566]")}>{t.count}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {tab === "char" && (
              <div className="flex gap-1 rounded-xl bg-[#F3F1FA] p-1" role="radiogroup" aria-label="Kiểu chỉnh nhân vật">
                {([["preset", "Mẫu có sẵn"], ["custom", "Tuỳ chỉnh tóc & mắt"]] as const).map(([k, label]) => (
                  <button key={k} type="button" role="radio" aria-checked={charMode === k} data-testid={`char-${k}`} onClick={() => { play("tick"); setCharMode(k); }} className={cn("h-9 rounded-[9px] px-3.5 text-[13px] font-bold", charMode === k ? "bg-white text-[#2A1F5C] shadow-[0_1px_3px_rgba(30,27,46,0.12)]" : "text-[#5F5B73]")}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            {!(tab === "char" && charMode === "custom") && (
              <div className="ml-auto flex gap-1.5" aria-label="Lọc">
                {([["all", "Tất cả"], ["owned", "Đã sở hữu"], ["shop", "Cửa hàng"]] as const).map(([k, label]) => (
                  <button key={k} type="button" aria-pressed={filter === k} data-testid={`filter-${k}`} onClick={() => { play("tick"); setFilter(k); }} className={cn("h-[34px] rounded-full border px-3 text-[13px] font-semibold", filter === k ? "border-[#2A1F5C] bg-[#2A1F5C] text-white" : "border-[#E4E0F0] bg-white text-[#3B3650]")}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="min-h-[420px] flex-1 px-4 pb-6 pt-4 sm:px-6 lg:max-h-[min(620px,calc(100vh-18rem))] lg:overflow-y-auto" role="tabpanel">
          {tab === "char" && charMode === "preset" && (
            <Grid>
              {PRESETS.map((p) => {
                const items = Object.values(p.items).filter((x): x is string => !!x).map((id) => ITEM_BY_ID[id]);
                const missing = items.filter((it) => !has(it));
                if (filter === "owned" && missing.length) return null;
                if (filter === "shop" && !missing.length) return null;
                const xu = missing.reduce((s, it) => s + (it.price && "xu" in it.price ? it.price.xu : 0), 0);
                const gem = missing.reduce((s, it) => s + (it.price && "gem" in it.price ? it.price.gem : 0), 0);
                const match = (c: AvatarConfig) => (Object.keys(p.items) as Slot[]).every((k) => (c[k] ?? null) === (p.items[k] ?? null));
                const locked = missing.some((it) => !it.price);
                return (
                  <Card
                    key={p.id}
                    testId={`preset-${p.id}`}
                    selected={match(config)}
                    trying={match(config) && missing.length > 0}
                    locked={false}
                    onClick={() => applyPreset(p)}
                    art={<Chibi config={{ ...config, ...p.items, ...noFx }} size={76} className="studio-art" />}
                    name={p.name}
                    status={match(saved) ? <Using /> : missing.length === 0 ? <Owned /> : locked ? <LockNote text="Có món từ Hộp bí ẩn" /> : <Price text={priceText(xu, gem)} />}
                  />
                );
              })}
            </Grid>
          )}
          {tab === "char" && charMode === "custom" && (
            <div className="flex flex-col gap-[22px]">
              <Section title="Màu tóc">
                <Swatches slot="hairColor" config={config} has={has} put={put} render={(it) => <span className="block h-full w-full rounded-full" style={{ background: it.v?.startsWith("url(") ? "conic-gradient(#F87171,#FBBF24,#34D399,#60A5FA,#A78BFA,#F87171)" : it.v }} />} />
              </Section>
              <Section title="Kiểu tóc">
                <SlotGrid slot="hair" small config={config} saved={saved} filter="all" has={has} put={put} art={(it) => <Chibi config={{ ...config, ...noFx, hair: it.id, accessory: null }} size={58} className="studio-art" />} />
              </Section>
              <Section title="Màu mắt">
                <Swatches slot="eyes" config={config} has={has} put={put} render={(it) => <span className="block h-full w-full rounded-full" style={{ background: `radial-gradient(circle at 50% 55%, #111 0 22%, ${it.v} 24% 62%, #fff 64%)` }} />} />
              </Section>
              <Section title="Trang phục">
                <SlotGrid slot="outfit" small config={config} saved={saved} filter="all" has={has} put={put} art={(it) => <Chibi config={{ ...config, ...noFx, outfit: it.id }} size={58} className="studio-art" />} />
              </Section>
              <Section title="Phụ kiện">
                <SlotGrid slot="accessory" small optional config={config} saved={saved} filter="all" has={has} put={put} art={(it) => <Chibi config={{ ...config, ...noFx, accessory: it.id }} size={58} className="studio-art" />} />
              </Section>
              <Section title="Màu da">
                <Swatches slot="skin" config={config} has={has} put={put} render={(it) => <span className="block h-full w-full rounded-full" style={{ background: it.v }} />} />
              </Section>
            </div>
          )}
          {tab === "pet" && <SlotGrid slot="pet" optional config={config} saved={saved} filter={filter} has={has} put={put} art={(it) => <PetSvg itemId={it.id} size={76} className="studio-art" />} />}
          {tab === "frame" && (
            <SlotGrid
              slot="frame" optional config={config} saved={saved} filter={filter} has={has} put={put}
              art={(it) => (
                <span className="studio-art relative block h-[78px] w-[78px]">
                  <span className="absolute inset-[15%] rounded-full bg-gradient-to-br from-[#DDD6FE] to-[#BFDBFE]" />
                  <FrameRing frameId={it.id} className="absolute inset-0 h-full w-full" />
                </span>
              )}
            />
          )}
          {tab === "background" && <SlotGrid slot="background" wide optional config={config} saved={saved} filter={filter} has={has} put={put} art={(it) => <ProfileScene bgId={it.id} className="h-full w-full" />} />}
          {tab === "effect" && <SlotGrid slot="effect" wide optional config={config} saved={saved} filter={filter} has={has} put={put} art={(it) => <EffectThumb kind={it.v ?? ""} />} />}
          {tab === "title" && (
            <SlotGrid
              slot="title" optional config={config} saved={saved} filter={filter} has={has} put={put}
              art={(it) => <span className={cn("studio-art rounded-full px-3 py-1.5 text-center text-xs font-extrabold", RIBBON[it.rarity])}>{it.name}</span>}
            />
          )}
        </div>

        {/* Thanh hành động */}
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 rounded-b-[20px] border-t border-[#ECE9F5] bg-[#FBFAFE]/95 px-4 py-3.5 backdrop-blur sm:px-6">
          <div className="flex min-w-0 flex-[1_1_240px] items-center gap-2.5">
            <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]", bar.tone === "warn" ? "bg-[#FFF6DB] text-[#7A4E00]" : "bg-[#E7F7EE] text-[#17703F]")} aria-hidden>
              {bar.tone === "warn" ? <AlertTriangle className="h-[18px] w-[18px]" /> : <Check className="h-[18px] w-[18px]" />}
            </span>
            <div className="flex min-w-0 flex-col" aria-live="polite" data-testid="decor-status">
              <span className="truncate text-sm font-bold">{bar.title}</span>
              <span className="truncate text-xs text-[#5F5B73]">{bar.sub}</span>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap gap-2.5">
            {dirty && (
              <button type="button" data-testid="decor-reset" disabled={pending} onClick={() => { play("tick"); setConfig(saved); }} className="flex h-11 items-center gap-2 rounded-xl border border-[#E4E0F0] bg-white px-4 font-bold text-[#3B3650] hover:bg-[#F6F5FB]">
                <RotateCcw className="h-4 w-4" aria-hidden /> Hoàn tác
              </button>
            )}
            {buyable.length > 0 && !affordable && !gachaLocked.length && (
              <Link href="/courses" className="flex h-11 items-center rounded-xl border border-[#F3DC8E] bg-[#FFF6DB] px-4 font-bold text-[#7A4E00]">Kiếm xu</Link>
            )}
            {gachaLocked.length ? (
              <button type="button" data-testid="decor-drop" onClick={dropTrying} className="flex h-11 items-center gap-2 rounded-xl bg-[#2A1F5C] px-5 font-bold text-white">
                <Lock className="h-4 w-4" aria-hidden /> Bỏ món chưa có
              </button>
            ) : buyable.length ? (
              <button
                type="button"
                data-testid="decor-buy"
                disabled={pending || !canEarn || isDemo || !affordable}
                onClick={buyAndSave}
                title={isDemo ? "Tài khoản demo chỉ xem" : !canEarn ? "Tài khoản cần được thầy duyệt" : !affordable ? "Chưa đủ xu/ngọc" : "Mua các món đang thử rồi lưu"}
                className="flex h-11 items-center gap-2 rounded-xl bg-[#5B2BD6] px-5 font-bold text-white hover:bg-[#4C22BC] disabled:cursor-not-allowed disabled:bg-[#E4E0F0] disabled:text-[#6B6680]"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" aria-hidden />} Mua &amp; lưu
              </button>
            ) : (
              <button
                type="button"
                data-testid="decor-save"
                disabled={pending || !dirty || isDemo}
                onClick={save}
                title={isDemo ? "Tài khoản demo chỉ xem" : undefined}
                className="flex h-11 items-center gap-2 rounded-xl bg-[#5B2BD6] px-5 font-bold text-white hover:bg-[#4C22BC] disabled:cursor-not-allowed disabled:bg-[#E4E0F0] disabled:text-[#6B6680]"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" aria-hidden />} Lưu trang trí
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ============================== Thành phần nhỏ ============================== */

export const RIBBON: Record<Item["rarity"], string> = {
  common: "bg-[#DDF3E4] text-[#17603A]",
  rare: "bg-[#0E7490] text-white",
  epic: "bg-[#7C3AED] text-white",
  legendary: "bg-[#2A1F5C] text-[#FDE68A]",
};

const Empty = () => <span className="text-lg text-[#C9C4DA]" aria-hidden>—</span>;
const Using = () => <span className="text-xs font-bold text-[#5B2BD6]">Đang dùng</span>;
const Owned = () => <span className="text-xs font-semibold text-[#17703F]">Đã sở hữu</span>;
const Price = ({ text }: { text: string }) => (
  <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#7A4E00]">
    <span className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-[#D8961B] bg-[#F5B82E]" aria-hidden />{text}
  </span>
);
const LockNote = ({ text = "Mở khoá: Hộp bí ẩn" }: { text?: string }) => <span className="text-xs font-semibold text-[#8A3B12]">{text}</span>;

function Medal({ icon, from, to }: { icon: string; from: string; to: string }) {
  return (
    <svg viewBox="0 0 40 48" className="h-10 w-8" aria-hidden>
      <path d="M12 26L8 46l7-4 3 6 4-20zM28 26l4 20-7-4-3 6-4-20z" fill={to} opacity="0.85" />
      <circle cx="20" cy="18" r="15" fill={to} />
      <circle cx="20" cy="18" r="12" fill={from} stroke="#fff" strokeWidth="1.5" strokeOpacity="0.7" />
      <text x="20" y="23" textAnchor="middle" fontSize="13">{icon}</text>
    </svg>
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

function Grid({ children, wide, small }: { children: React.ReactNode; wide?: boolean; small?: boolean }) {
  return <div className={cn("grid content-start gap-3.5", wide ? "grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(190px,1fr))]" : small ? "grid-cols-3 sm:grid-cols-[repeat(auto-fill,minmax(120px,1fr))]" : "grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]")}>{children}</div>;
}

function Card({ selected, trying, locked, onClick, art, name, status, testId, rarity, wide, small }: {
  selected: boolean; trying: boolean; locked: boolean; onClick: () => void; art: React.ReactNode; name: string; status: React.ReactNode; testId?: string; rarity?: Item["rarity"]; wide?: boolean; small?: boolean;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "studio-item relative flex flex-col gap-2.5 rounded-2xl border-2 bg-white p-2 pb-3 text-left",
        selected ? "border-[#5B2BD6] bg-[#F5F1FF] shadow-[0_8px_22px_rgba(91,43,214,0.16)]" : "border-[#ECE9F5] hover:border-[#C4B5FD]",
        rarity === "legendary" && "shimmer",
      )}
    >
      <span className={cn("relative flex w-full items-center justify-center overflow-hidden rounded-[10px]", wide ? "aspect-[16/9]" : small ? "h-[72px]" : "aspect-[83/68]", rarity ? RAR_STYLE[rarity].tile : "bg-[#F3F1FA]")}>
        {art}
        {locked && (
          <span className="absolute inset-0 flex items-center justify-center bg-[#1E1B2E]/35">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#3B3650]"><Lock className="h-4 w-4" aria-hidden /></span>
          </span>
        )}
        {trying && <span className="absolute bottom-1.5 left-1.5 rounded-full bg-[#2A1F5C] px-2 py-0.5 text-[11px] font-bold text-white">Đang thử</span>}
      </span>
      {selected && (
        <span className="absolute -right-[7px] -top-[7px] z-[2] flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-[#5B2BD6] text-white" aria-hidden>
          <Check className="h-3 w-3" />
        </span>
      )}
      <span className="flex min-w-0 flex-col gap-1 px-1">
        <span className="truncate text-sm font-bold">{name}</span>
        {status}
      </span>
    </button>
  );
}

function SlotGrid({ slot, config, saved, filter, has, put, art, optional, wide, small }: {
  slot: Slot; config: AvatarConfig; saved: AvatarConfig; filter: Filter; has: (it: Item) => boolean; put: (slot: Slot, id: string | null) => void; art: (it: Item) => React.ReactNode; optional?: boolean; wide?: boolean; small?: boolean;
}) {
  const items = itemsOfSlot(slot).filter((it) => (filter === "owned" ? has(it) : filter === "shop" ? !has(it) : true));
  return (
    <Grid wide={wide} small={small}>
      {optional && filter !== "shop" && (
        <Card testId={`none-${slot}`} selected={!config[slot]} trying={false} locked={false} onClick={() => put(slot, null)} art={<span className="text-2xl text-[#C9C4DA]">✕</span>} name="Không dùng" status={<span className="text-xs text-[#6B6680]">Bỏ trống</span>} wide={wide} small={small} />
      )}
      {items.map((it) => {
        const own = has(it);
        const on = config[slot] === it.id;
        return (
          <Card
            key={it.id}
            testId={`item-${it.id}`}
            rarity={it.rarity}
            selected={on}
            trying={on && !own}
            locked={!own && !it.price}
            onClick={() => put(slot, it.id)}
            art={art(it)}
            name={it.name}
            status={saved[slot] === it.id && own ? <Using /> : own ? (it.free ? <span className="text-xs font-semibold text-[#6B6680]">Miễn phí</span> : <Owned />) : it.price ? <Price text={"xu" in it.price ? `${fmt(it.price.xu)} xu` : `${it.price.gem} ngọc`} /> : <LockNote />}
            wide={wide}
            small={small}
          />
        );
      })}
      {items.length === 0 && <p className="col-span-full py-12 text-center text-[#5F5B73]">Không có vật phẩm nào trong mục này.</p>}
    </Grid>
  );
}

function Swatches({ slot, config, has, put, render }: {
  slot: Slot; config: AvatarConfig; has: (it: Item) => boolean; put: (slot: Slot, id: string | null) => void; render: (it: Item) => React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap gap-3.5">
      {itemsOfSlot(slot).map((it) => {
        const own = has(it);
        const on = config[slot] === it.id;
        const price = it.price ? ("xu" in it.price ? `${fmt(it.price.xu)} xu` : `${it.price.gem} ngọc`) : "chỉ từ Hộp bí ẩn";
        return (
          <button
            key={it.id}
            type="button"
            data-testid={`item-${it.id}`}
            aria-pressed={on}
            aria-label={`${it.name}${own ? "" : ` (${price})`}`}
            title={`${it.name}${own ? "" : ` — ${price}`}`}
            onClick={() => put(slot, it.id)}
            className={cn("relative h-10 w-10 rounded-full p-0.5 transition-transform hover:scale-110", on ? "shadow-[0_0_0_3px_#fff,0_0_0_5px_#5B2BD6]" : "shadow-[0_0_0_1px_#E4E0F0]")}
          >
            {render(it)}
            {!own && <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[#5B2BD6] shadow"><Lock className="h-2.5 w-2.5" aria-hidden /></span>}
          </button>
        );
      })}
    </div>
  );
}

/** Ô xem trước hiệu ứng: nền tối + hạt tĩnh (lưới chọn không chạy hoạt ảnh) */
export function EffectThumb({ kind }: { kind: string }) {
  const pts: [number, number][] = [[18, 22], [44, 14], [70, 30], [86, 12], [30, 44], [58, 48], [82, 46], [12, 50]];
  return (
    <svg viewBox="0 0 100 56" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden>
      <rect width="100" height="56" fill="#2A1F5C" />
      {kind === "thunder" && <ellipse cx="50" cy="28" rx="20" ry="20" fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeDasharray="5 3" />}
      {pts.map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${0.6 + (i % 3) * 0.15})`}><FxShape kind={kind} i={i} /></g>
      ))}
    </svg>
  );
}
