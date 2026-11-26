"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { addShopRewardTemplates, archiveReward, saveReward } from "@/actions/points";
import type { RewardInput } from "@/lib/points/reward-input";
import type { ShopAdminData, TeacherRewardsPageData } from "@/lib/points/queries";
import type { GiftCodeBatch, UnusedGiftCode } from "@/lib/game/giftcode-queries";
import { RequestsTab } from "./manage/RequestsTab";
import { GrantTab } from "./manage/GrantTab";
import { GiftCodesTab } from "./manage/GiftCodesTab";
import { StatsTab } from "./manage/StatsTab";
import type { ManageTab } from "@/lib/points/manage-tabs";
import { rarityOf } from "@/lib/points/rarity";
import { REWARD_TEMPLATES, missingShopTemplates } from "@/lib/points/templates";
import { play } from "@/lib/sound";
import { CoinDot, fmt } from "./parts";
import { RewardArt } from "./RewardArt";
import { RewardImageField } from "./RewardImageField";
import { EarningManager, ItemPriceManager } from "./GameConfigManager";
import { EMPTY_GAME_CONFIG, type GameConfigData } from "@/lib/game/game-config-shared";
import type { AvatarConfig } from "@/lib/game/avatar";
import { vndToXu } from "@/lib/points/vnd";

type AdminReward = ShopAdminData["rewards"][number];
type Filter = "all" | "PHYSICAL" | "VIRTUAL" | "hidden";

const emptyForm = (kind: "PHYSICAL" | "VIRTUAL" = "PHYSICAL"): RewardInput => ({
  title: "",
  description: "",
  emoji: kind === "PHYSICAL" ? "🎁" : "🎫",
  price: kind === "PHYSICAL" ? 12000 : 6000,
  stock: null,
  perStudentMonthlyLimit: kind === "PHYSICAL" ? null : 1,
  kind,
  offlineOnly: kind === "PHYSICAL",
  costVnd: null,
  imageUrl: null,
  classIds: [],
  isActive: true,
});

const toForm = (r: AdminReward): RewardInput => ({
  id: r.id,
  title: r.title,
  description: r.description,
  emoji: r.emoji,
  price: r.price,
  stock: r.stock,
  perStudentMonthlyLimit: r.perStudentMonthlyLimit,
  kind: r.kind,
  offlineOnly: r.offlineOnly,
  costVnd: r.costVnd,
  imageUrl: r.imageUrl,
  classIds: r.classes.map((c) => c.id),
  isActive: r.isActive,
});

export type { ManageTab };

/** Mọi dữ liệu khu quản lý (trang /rewards nạp khi tài khoản là giáo viên / admin) */
export interface ManageData {
  shop: ShopAdminData;
  teacher: TeacherRewardsPageData;
  giftBatches: GiftCodeBatch[];
  unusedCodes: UnusedGiftCode[];
  manualMax: number;
  manualDailyCap: number;
  isAdmin: boolean;
}

/**
 * "Quản lý tiệm" — mọi việc quản lý quà & xu của thầy gom vào Tiệm quà (thầy yêu cầu 26/11/2026, thay trang /teacher/rewards):
 * đơn đổi quà, quà & thẻ, thưởng xu, mã quà tặng, thống kê; admin thêm giá đồ trang trí và mức xu các hoạt động.
 * Server action có sẵn đã kiểm quyền; trang tự làm mới nhờ revalidatePath / router.refresh.
 */
export function RewardManager({ data, gameConfig, avatar, tab, onTab }: { data: ManageData; gameConfig?: GameConfigData; avatar: AvatarConfig; tab: ManageTab; onTab: (t: ManageTab) => void }) {
  const pendingCount = data.teacher.pending.length;
  const tabs: [ManageTab, string, number?][] = [
    ["requests", "📬 Đơn đổi quà", pendingCount],
    ["rewards", "🎁 Quà & thẻ"],
    ["grant", "🪙 Thưởng xu"],
    ["codes", "🎟️ Mã quà tặng"],
    ["stats", "📊 Thống kê"],
    ...(data.isAdmin ? ([["prices", "🏷️ Giá đồ trang trí"], ["earning", "⚙️ Mức xu"]] as [ManageTab, string][]) : []),
  ];
  const current = tabs.some(([k]) => k === tab) ? tab : "rewards";
  return (
    <section className="ah-panel flex flex-col gap-4 p-4 sm:p-5" data-testid="reward-manager" aria-label="Quản lý tiệm">
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 className="ah-hand text-[24px] font-bold">🛠️ Quản lý tiệm</h2>
        <span className="text-xs font-extrabold text-[#6e4722]">Chỉ giáo viên / admin thấy khu này</span>
        <Link href="/teacher/homework/check" data-testid="mgr-review-link" className="ah-btn ah-sky ml-auto h-10 shrink-0 whitespace-nowrap px-3.5 text-[13px]">✍️ Duyệt chữa bài<span className="max-sm:hidden">&nbsp;(+280 / +400 xu)</span> →</Link>
      </div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto border-b-2 border-[#efe3cc] px-1 pb-3 [scrollbar-width:thin]" role="tablist" aria-label="Mục quản lý">
        {tabs.map(([k, label, badge]) => (
          <button key={k} type="button" role="tab" aria-selected={current === k} data-testid={`mgr-tab-${k}`} onClick={() => { play("click"); onTab(k); }} className={cn("ah-btn relative h-10 shrink-0 px-3.5 text-[13px]", current === k ? "ah-coral" : "ah-cream")}>
            {label}
            {!!badge && <span className="ml-1 rounded-full border-2 border-[#241e1a] bg-[#fbd048] px-1.5 text-[11px] leading-4 text-[#241e1a]">{badge}</span>}
          </button>
        ))}
      </div>
      {current === "requests" && <RequestsTab data={data.teacher} />}
      {current === "rewards" && <CatalogTab data={data.shop} />}
      {current === "grant" && <GrantTab data={data.teacher} manualMax={data.manualMax} manualDailyCap={data.manualDailyCap} />}
      {current === "codes" && <GiftCodesTab batches={data.giftBatches} unused={data.unusedCodes} classes={data.shop.classes} />}
      {current === "stats" && <StatsTab data={data.teacher} />}
      {current === "prices" && data.isAdmin && <ItemPriceManager key={JSON.stringify(gameConfig?.itemPrices ?? {})} config={gameConfig ?? EMPTY_GAME_CONFIG} avatar={avatar} />}
      {current === "earning" && data.isAdmin && <EarningManager key={JSON.stringify(gameConfig?.earning ?? {})} config={gameConfig ?? EMPTY_GAME_CONFIG} />}
    </section>
  );
}

/** Quà & thẻ: xem mọi quà (cả quà đang ẩn), thêm / sửa đủ trường (ảnh, giá tiền thật → xu), ẩn / hiện, xoá, thêm bộ quà mẫu */
function CatalogTab({ data }: { data: ShopAdminData }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [form, setForm] = useState<RewardInput | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const missing = missingShopTemplates(data.rewards.map((r) => r.title));
  const have = new Set(data.rewards.map((r) => r.title.trim().toLowerCase()));
  const quick = REWARD_TEMPLATES.filter((t) => !have.has(t.title.toLowerCase()));
  const list = data.rewards.filter((r) => (filter === "all" ? true : filter === "hidden" ? !r.isActive : r.kind === filter));
  const count = (f: Filter) => data.rewards.filter((r) => (f === "all" ? true : f === "hidden" ? !r.isActive : r.kind === f)).length;

  const act = (fn: () => Promise<{ success: boolean; message?: string; error?: string }>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (res.success) {
        play("coin");
        if (res.message) toast.success(res.message);
        after?.();
        router.refresh();
      } else {
        play("error");
        toast.error(res.error || "Có lỗi xảy ra");
      }
    });

  return (
    <div className="flex flex-col gap-4" data-testid="mgr-rewards">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-xs font-extrabold text-[#6e4722]">Học sinh thấy quà đang bật · bấm Sửa để đổi ảnh, giá, số lượng</span>
        <div className="ml-auto flex flex-wrap gap-2">
          {missing.length > 0 && (
            <button type="button" disabled={pending} data-testid="mgr-add-set" onClick={() => act(() => addShopRewardTemplates())} className="ah-btn ah-mint h-10 px-3.5 text-sm">
              + Thêm cả bộ quà mẫu ({missing.length})
            </button>
          )}
          <button type="button" data-testid="mgr-new" onClick={() => { play("click"); setForm(emptyForm(filter === "VIRTUAL" ? "VIRTUAL" : "PHYSICAL")); }} className="ah-btn ah-coral h-10 px-3.5 text-sm">
            + Thêm quà
          </button>
        </div>
      </div>

      {quick.length > 0 && (
        <details className="rounded-[16px] border-2 border-dashed border-[#c9b08a] bg-[#fffdf8] px-3 py-2" data-testid="mgr-templates">
          <summary className="cursor-pointer text-xs font-black text-[#6e4722]">⚡ Thêm nhanh từ mẫu ({quick.length} món chưa có) — bấm một món để mở form điền sẵn</summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {quick.map((t) => (
              <button key={t.title} type="button" data-testid="mgr-template" onClick={() => { play("click"); setForm({ ...emptyForm(t.kind), ...t, imageUrl: null, classIds: [], isActive: true }); }} className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border-2 border-[#d6c3a5] bg-white px-2.5 py-1 text-xs font-extrabold hover:border-[#241e1a]">
                <span aria-hidden>{t.emoji}</span> {t.title} <span className="text-[#9e6b3f]">{fmt(t.price)} xu</span>
              </button>
            ))}
          </div>
        </details>
      )}

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Lọc quà">
        {([["all", "Tất cả"], ["PHYSICAL", "🎁 Quà hiện vật"], ["VIRTUAL", "🎫 Thẻ đặc quyền"], ["hidden", "🙈 Đang ẩn"]] as [Filter, string][]).map(([k, label]) => (
          <button key={k} type="button" aria-pressed={filter === k} data-testid={`mgr-filter-${k}`} onClick={() => { play("click"); setFilter(k); }} className={cn("ah-btn h-9 px-3 text-[13px]", filter === k ? "ah-woodbtn" : "ah-cream")}>
            {label} <span className="opacity-75">{count(k)}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(230px,100%),1fr))] gap-4 max-sm:grid-cols-2 max-sm:gap-3">
        <button type="button" onClick={() => { play("click"); setForm(emptyForm(filter === "VIRTUAL" ? "VIRTUAL" : "PHYSICAL")); }} className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[20px] border-[3px] border-dashed border-[#c9b08a] bg-[#fffdf8] font-black text-[#9e6b3f] hover:bg-[#fff6e5]">
          <span className="text-4xl leading-none" aria-hidden>＋</span>
          Thêm quà mới
        </button>
        {list.map((r) => {
          const rar = rarityOf(r.price).key;
          return (
            <div key={r.id} data-testid="mgr-card" data-title={r.title} data-active={r.isActive} className={cn("ah-pcard cursor-default", `r-${rar}`, !r.isActive && "opacity-60 grayscale-[0.5]")}>
              <span className="ah-phead ah-hand">{r.emoji ? `${r.emoji} ` : ""}{r.title}</span>
              <RewardArt title={r.title} kind={r.kind} imageUrl={r.imageUrl} stock={r.stock} limit={r.perStudentMonthlyLimit} />
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-extrabold text-[#6e4722]">
                <span className="inline-flex items-center gap-1 rounded-full border-2 border-[#241e1a] bg-[#fffdf8] px-2 py-0.5 text-[12px] text-[#241e1a]"><CoinDot size={12} /> {fmt(r.price)}</span>
                <span>{r.stock === null ? "Không giới hạn" : `Còn ${r.stock}`}</span>
                {r.perStudentMonthlyLimit && <span>· {r.perStudentMonthlyLimit}/tháng</span>}
                {r.kind === "VIRTUAL" && r.offlineOnly && <span>· chỉ offline</span>}
                {r.classes.length > 0 && <span title={r.classes.map((c) => c.name).join(", ")}>· {r.classes.length} lớp</span>}
                {r.pending > 0 && <span className="text-[#b83d27]">· {r.pending} chờ trao</span>}
                {!r.isActive && <span className="text-[#b83d27]">· Đang ẩn</span>}
              </div>
              <div className="mt-auto grid grid-cols-3 gap-1.5">
                <button type="button" data-testid="mgr-edit" onClick={() => { play("click"); setForm(toForm(r)); }} className="ah-btn ah-cream h-9 px-1 text-[12px]">Sửa</button>
                <button type="button" disabled={pending} data-testid="mgr-toggle" onClick={() => act(() => saveReward({ ...toForm(r), isActive: !r.isActive }))} className="ah-btn ah-cream h-9 px-1 text-[12px]">{r.isActive ? "Ẩn" : "Hiện"}</button>
                <button
                  type="button"
                  disabled={pending}
                  data-testid="mgr-delete"
                  onClick={() => (armed === r.id ? act(() => archiveReward(r.id), () => setArmed(null)) : (play("click"), setArmed(r.id)))}
                  onBlur={() => armed === r.id && setArmed(null)}
                  className={cn("ah-btn h-9 px-1 text-[12px]", armed === r.id ? "ah-coral" : "ah-cream")}
                >
                  {armed === r.id ? "Xoá thật?" : "Xoá"}
                </button>
              </div>
            </div>
          );
        })}
        {list.length === 0 && <p className="ah-hand col-span-full p-6 text-center">Chưa có quà nào ở mục này.</p>}
      </div>

      {form && <RewardEditor form={form} setForm={setForm} classes={data.classes} pending={pending} onSave={() => act(() => saveReward(form), () => setForm(null))} />}
    </div>
  );
}

function RewardEditor({ form, setForm, classes, pending, onSave }: {
  form: RewardInput;
  setForm: (f: RewardInput | null) => void;
  classes: ShopAdminData["classes"];
  pending: boolean;
  onSave: () => void;
}) {
  const set = (patch: Partial<RewardInput>) => setForm({ ...form, ...patch });
  // Đang sửa / tải ảnh → chưa cho lưu (tránh lưu quà khi ảnh chưa lên xong)
  const [imgBusy, setImgBusy] = useState(false);
  // Thẻ đặc quyền không có chi phí thật → "giá trị (đ)" chỉ để tính giá xu, không lưu vào chi phí
  const [vndValue, setVndValue] = useState<number | null>(null);
  const num = (v: string) => (v.trim() === "" ? null : Math.max(0, Math.floor(Number(v)) || 0));
  const rar = rarityOf(Number(form.price) || 0);
  const field = "mt-1 h-11 w-full rounded-[14px] border-[2.5px] border-[#241e1a] bg-[#fffdf8] px-3 text-[15px] font-bold outline-none focus:ring-2 focus:ring-[#fbd048]";
  const label = "text-xs font-black text-[#6e4722]";
  return (
    <div className="fixed inset-0 z-[63] flex items-end justify-center bg-[rgba(36,30,26,0.55)] sm:items-center sm:p-4" onClick={(e) => e.target === e.currentTarget && setForm(null)}>
      <div role="dialog" aria-modal="true" aria-label={form.id ? "Sửa quà" : "Thêm quà"} data-testid="reward-editor" className="ah-dialog ah-panel v2-pop flex max-h-[94vh] w-full flex-col overflow-hidden rounded-b-none sm:max-w-[860px] sm:rounded-b-[26px]">
        <div className="flex shrink-0 items-center gap-3 border-b-2 border-[#efe3cc] px-4 py-3 sm:px-5">
          <h2 className="ah-hand flex-1 text-[22px] font-bold">{form.id ? "Sửa quà" : "Thêm quà mới"}</h2>
          <button type="button" aria-label="Đóng" onClick={() => setForm(null)} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-[2.5px] border-[#241e1a] bg-[#ef5b4c] text-lg font-black text-white shadow-[0_3px_0_#241e1a]">×</button>
        </div>
        <div className="flex min-h-0 flex-wrap gap-5 overflow-y-auto p-4 sm:p-5">
          <div className="flex min-w-0 flex-[2_1_380px] flex-col gap-3.5">
            <div className="flex gap-3">
              <label className="w-20 shrink-0"><span className={label}>Biểu tượng</span><input value={form.emoji ?? ""} maxLength={4} onChange={(e) => set({ emoji: e.target.value })} className={cn(field, "text-center text-xl")} /></label>
              <label className="min-w-0 flex-1"><span className={label}>Tên quà *</span><input data-testid="ed-title" value={form.title} maxLength={120} onChange={(e) => set({ title: e.target.value })} placeholder="VD: Gấu bông mèo" className={field} /></label>
            </div>
            <label><span className={label}>Mô tả (hiện trong hộp chi tiết)</span><textarea value={form.description ?? ""} maxLength={500} rows={2} onChange={(e) => set({ description: e.target.value })} className={cn(field, "h-auto py-2 text-sm")} /></label>
            <div>
              <span className={label}>Loại quà</span>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {([["PHYSICAL", "🎁 Quà hiện vật", "Nhận tại lớp · chỉ học sinh offline"], ["VIRTUAL", "🎫 Thẻ đặc quyền", "Quyền lợi, cất vào Túi đồ"]] as const).map(([k, t, hint]) => (
                  <button key={k} type="button" aria-pressed={form.kind === k} data-testid={`ed-kind-${k}`} onClick={() => set({ kind: k, offlineOnly: k === "PHYSICAL" ? true : form.offlineOnly })} className={cn("cursor-pointer rounded-[14px] border-[2.5px] p-2.5 text-left", form.kind === k ? "border-[#241e1a] bg-[#fff1c9] shadow-[0_3px_0_#241e1a]" : "border-[#d6c3a5] bg-[#fffdf8]")}>
                    <span className="block text-sm font-black">{t}</span>
                    <span className="block text-[11px] font-bold text-[#6e4722]">{hint}</span>
                  </button>
                ))}
              </div>
              {form.kind === "VIRTUAL" && (
                <label className="mt-2 flex items-center gap-2 text-[13px] font-bold"><input type="checkbox" data-testid="ed-offline" checked={!!form.offlineOnly} onChange={(e) => set({ offlineOnly: e.target.checked })} className="h-4 w-4" /> Chỉ dùng tại lớp (ẩn với học sinh online)</label>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <label><span className={label}>Giá (xu) *</span><input data-testid="ed-price" type="number" inputMode="numeric" min={1} value={form.price || ""} onChange={(e) => set({ price: Number(e.target.value) })} className={field} /></label>
              <label>
                <span className={label}>{form.kind === "PHYSICAL" ? "Giá tiền thật (đ)" : "Giá trị (đ)"}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  data-testid="ed-vnd"
                  value={(form.kind === "PHYSICAL" ? form.costVnd : vndValue) ?? ""}
                  placeholder="—"
                  onChange={(e) => {
                    // Nhập tiền thật → giá xu tự tính = ÷ 3,6 làm tròn lên trăm (thầy quy định 26/11); vẫn sửa tay được ô Giá
                    const v = num(e.target.value);
                    if (form.kind === "VIRTUAL") setVndValue(v);
                    set({ ...(form.kind === "PHYSICAL" ? { costVnd: v } : {}), ...(v ? { price: vndToXu(v) } : {}) });
                  }}
                  className={field}
                />
              </label>
              <label><span className={label}>Số lượng</span><input data-testid="ed-stock" type="number" inputMode="numeric" min={0} value={form.stock ?? ""} placeholder="∞" onChange={(e) => set({ stock: num(e.target.value) })} className={field} /></label>
              <label><span className={label}>Mỗi bạn / tháng</span><input type="number" inputMode="numeric" min={0} value={form.perStudentMonthlyLimit ?? ""} placeholder="∞" onChange={(e) => set({ perStudentMonthlyLimit: num(e.target.value) })} className={field} /></label>
            </div>
            <p className="-mt-1 text-[11px] font-bold text-[#6e4722]" data-testid="ed-price-hint">
              Nhập giá tiền thật → giá xu = tiền ÷ 3,6, làm tròn lên trăm{(() => { const v = form.kind === "PHYSICAL" ? form.costVnd : vndValue; return v ? ` (${v.toLocaleString("vi-VN")}đ → ${vndToXu(v).toLocaleString("vi-VN")} xu)` : ""; })()}. Mỗi bài tập làm tốt ≈ 500 xu. Độ hiếm tự theo giá: <b>{rar.label}</b>.
            </p>
            {classes.length > 0 && (
              <div>
                <span className={label}>Áp dụng cho lớp (không chọn = mọi lớp)</span>
                <div className="mt-1 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                  {classes.map((c) => {
                    const on = form.classIds.includes(c.id);
                    return (
                      <button key={c.id} type="button" aria-pressed={on} onClick={() => set({ classIds: on ? form.classIds.filter((x) => x !== c.id) : [...form.classIds, c.id] })} className={cn("cursor-pointer rounded-full border-2 px-2.5 py-1 text-xs font-extrabold", on ? "border-[#241e1a] bg-[#fbd048]" : "border-[#d6c3a5] bg-[#fffdf8]")}>
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <label className="flex items-center gap-2 text-[13px] font-bold"><input type="checkbox" data-testid="ed-active" checked={form.isActive} onChange={(e) => set({ isActive: e.target.checked })} className="h-4 w-4" /> Đang bán (học sinh thấy và đổi được)</label>
          </div>

          <div className="flex min-w-0 flex-[1_1_230px] flex-col gap-2">
            <span className={label}>Ảnh quà</span>
            <RewardImageField value={form.imageUrl} onChange={(url) => setForm({ ...form, imageUrl: url })} disabled={pending} onBusy={setImgBusy} />
            <span className={cn(label, "mt-2")}>Xem trước trên tiệm</span>
            <div className={cn("ah-pcard cursor-default", `r-${rar.key}`)}>
              {rar.key === "legendary" && <span className="ah-tabtop">CỰC PHẨM HUYỀN THOẠI</span>}
              <span className="ah-phead ah-hand">{form.title || "Tên quà"}</span>
              <span className="flex items-center justify-between gap-1.5">
                <span className="ah-ppill">{rar.label}</span>
                <span className="ah-pstock">{form.stock === null || form.stock === undefined ? "Không giới hạn" : `Còn ${form.stock}`}</span>
              </span>
              <RewardArt title={form.title || "quà"} kind={form.kind} imageUrl={form.imageUrl} stock={form.stock ?? null} limit={form.perStudentMonthlyLimit ?? null}>
                {rar.key === "legendary" && <span className="ah-sun" aria-hidden />}
              </RewardArt>
              <span className="ah-btn ah-gold h-[42px] gap-2 text-[15px]"><CoinDot size={17} />{fmt(Number(form.price) || 0)} Xu</span>
            </div>
            {!form.imageUrl && <p className="text-[11px] font-bold text-[#6e4722]">Không đăng ảnh thì tranh tự chọn theo tên quà (trà sữa, sổ, bút, sticker, bình nước, đèn, gấu bông, túi, tai nghe, vé…).</p>}
          </div>
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t-2 border-[#efe3cc] px-4 py-3 sm:px-5">
          <button type="button" onClick={() => setForm(null)} className="ah-btn ah-cream h-11 px-5">Huỷ</button>
          <button type="button" data-testid="ed-save" disabled={pending || imgBusy || !form.title.trim() || !(Number(form.price) >= 1)} onClick={onSave} className="ah-btn ah-gold h-11 px-6">{pending ? "Đang lưu…" : form.id ? "Lưu thay đổi" : "Thêm quà"}</button>
        </div>
      </div>
    </div>
  );
}
