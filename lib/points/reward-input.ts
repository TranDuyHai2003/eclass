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
  costVnd?: number | null;
  classIds: string[];
  isActive: boolean;
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
  isActive: boolean;
}

export type NormalizeRewardResult = { error: string } | { data: NormalizedReward; classIds: string[] };

export function normalizeRewardInput(input: RewardInput): NormalizeRewardResult {
  const title = input.title?.trim() ?? "";
  const price = Math.floor(Number(input.price));
  if (!title) return { error: "Nhập tên quà." };
  if (!Number.isFinite(price) || price < 1 || price > MAX_REWARD_PRICE) return { error: "Giá phải từ 1 xu trở lên." };
  const limit = intOrNull(input.perStudentMonthlyLimit);
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
      // Quà hiện vật nhận tại lớp → chỉ học sinh offline
      offlineOnly: input.kind !== "VIRTUAL",
      costVnd: intOrNull(input.costVnd),
      isActive: !!input.isActive,
    },
    classIds: Array.from(new Set((input.classIds || []).filter((id) => typeof id === "string" && id && id !== "__none__"))),
  };
}
