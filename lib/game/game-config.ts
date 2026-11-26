import { prisma } from "@/lib/prisma";
import { EMPTY_GAME_CONFIG, applyGameConfig, type EarningConfig, type GameConfigData, type ItemPrices } from "./game-config-shared";

/**
 * Đọc cấu hình game admin sửa (bảng GameConfig), cache 30 giây trong tiến trình, áp vào ITEM_BY_ID / POINTS.
 * Gọi ở đầu các trang / action có dùng giá đồ hoặc mức xu; lúc khởi động (instrumentation.ts); và ngay sau khi admin lưu.
 * Lỗi đọc DB → giữ cấu hình đang áp (không làm hỏng trang / cộng xu).
 */
export * from "./game-config-shared";

const TTL_MS = 30_000;
let cache: { at: number; data: GameConfigData } | null = null;
let inflight: Promise<GameConfigData> | null = null;

async function read(): Promise<GameConfigData> {
  const rows = await prisma.gameConfig.findMany({ where: { key: { in: ["itemPrices", "earning"] } } });
  const get = (k: string) => rows.find((r) => r.key === k)?.value;
  return {
    itemPrices: ((get("itemPrices") as ItemPrices | undefined) ?? {}) as ItemPrices,
    earning: ((get("earning") as EarningConfig | undefined) ?? {}) as EarningConfig,
  };
}

export async function loadGameConfig(force = false): Promise<GameConfigData> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) {
    applyGameConfig(cache.data);
    return cache.data;
  }
  if (!force && inflight) return inflight;
  inflight = (async () => {
    try {
      const data = await read();
      cache = { at: Date.now(), data };
      applyGameConfig(data);
      return data;
    } catch (err) {
      console.error("[game-config] load failed:", err);
      return cache?.data ?? EMPTY_GAME_CONFIG;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Ghi một khoá cấu hình rồi áp ngay trong tiến trình này */
export async function writeGameConfig(key: "itemPrices" | "earning", value: ItemPrices | EarningConfig, userId: string) {
  await prisma.gameConfig.upsert({
    where: { key },
    create: { key, value, updatedById: userId },
    update: { value, updatedById: userId },
  });
  return loadGameConfig(true);
}
