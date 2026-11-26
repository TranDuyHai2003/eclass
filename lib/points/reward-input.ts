import { CDN_DOMAIN } from "@/lib/cdn-url";

/** Chuẩn hoá dữ liệu form quà của giáo viên (dùng ở actions/points.ts, có test riêng) */
export interface RewardInput {
  id?: string;
  title: string;
  description?: string | null;
  emoji?: string | null;
  price: number;
  stock?: number | null;
  perStudentMonthlyLimit?: number | null;
  kind: "PHYSICAL" | "VIRTUAL";
  /** Chỉ học sinh offline — quà hiện vật luôn bật; thẻ đặc quyền dùng tại lớp (miễn trực nhật, chọn chỗ…) thầy tự bật */
  offlineOnly?: boolean | null;
  costVnd?: number | null;
  /** Ảnh quà admin đăng (CDN); undefined = giữ ảnh cũ (form không có ô ảnh), null / "" = bỏ ảnh */
  imageUrl?: string | null;
  classIds: string[];
  isActive: boolean;
}

/**
 * Ảnh quà chỉ nhận ảnh trên CDN của web (https, host CDN / Backblaze) hoặc đường dẫn tĩnh của web ("/…", không "//").
 * Trả về chuỗi đã chuẩn hoá, null (không ảnh) hoặc false (không hợp lệ).
 */
export function normalizeRewardImageUrl(v: unknown): string | null | false {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return false;
  const url = v.trim();
  if (!url) return null;
  if (url.length > 500) return false;
  if (url.startsWith("/")) return url.startsWith("//") || url.includes("\\") ? false : url;
  try {
    const u = new URL(url);
    const cdnHost = new URL(CDN_DOMAIN).hostname;
    if (u.protocol !== "https:") return false;
    return u.hostname === cdnHost || u.hostname.endsWith(".backblazeb2.com") ? u.toString() : false;
  } catch {
    return false;
  }
}

const intOrNull = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export const MAX_REWARD_PRICE = 1_000_000;

export interface NormalizedReward {
  title: string;
  description: string | null;
  emoji: string | null;
  price: number;
  stock: number | null;
  perStudentMonthlyLimit: number | null;
  kind: "PHYSICAL" | "VIRTUAL";
  offlineOnly: boolean;
  costVnd: number | null;
  /** Chỉ có khi form gửi ô ảnh (thiếu → Prisma giữ ảnh cũ) */
  imageUrl?: string | null;
  isActive: boolean;
}

export type NormalizeRewardResult = { error: string } | { data: NormalizedReward; classIds: string[] };

export function normalizeRewardInput(input: RewardInput): NormalizeRewardResult {
  const title = input.title?.trim() ?? "";
  const price = Math.floor(Number(input.price));
  if (!title) return { error: "Nhập tên quà." };
  if (!Number.isFinite(price) || price < 1 || price > MAX_REWARD_PRICE) return { error: "Giá phải từ 1 xu trở lên." };
  const limit = intOrNull(input.perStudentMonthlyLimit);
  const image = input.imageUrl === undefined ? undefined : normalizeRewardImageUrl(input.imageUrl);
  if (image === false) return { error: "Ảnh quà không hợp lệ — hãy đăng lại ảnh." };
  return {
    data: {
      title: title.slice(0, 120),
      description: input.description?.trim().slice(0, 500) || null,
      emoji: input.emoji?.trim().slice(0, 16) || null,
      price,
      stock: intOrNull(input.stock),
      // 0 lần/tháng vô nghĩa → coi như không giới hạn
      perStudentMonthlyLimit: limit && limit > 0 ? limit : null,
      kind: input.kind === "VIRTUAL" ? "VIRTUAL" : "PHYSICAL",
      // Quà hiện vật nhận tại lớp → chỉ học sinh offline; thẻ đặc quyền: theo lựa chọn của thầy
      offlineOnly: input.kind !== "VIRTUAL" || input.offlineOnly === true,
      costVnd: intOrNull(input.costVnd),
      ...(image === undefined ? {} : { imageUrl: image }),
      isActive: !!input.isActive,
    },
    classIds: Array.from(new Set((input.classIds || []).filter((id) => typeof id === "string" && id && id !== "__none__"))),
  };
}
