import { unstable_rethrow } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { EMPTY_GAME_CONFIG, applyGameConfig, type ChestConfig, type EarningConfig, type GameConfigData, type ItemPrices } from "./game-config-shared";

/**
 * Đọc cấu hình game admin sửa (bảng GameConfig), cache 30 giây trong tiến trình, áp vào ITEM_BY_ID / POINTS.
 * Gọi ở đầu các trang / action có dùng giá đồ hoặc mức xu; lúc khởi động (instrumentation.ts); và ngay sau khi admin lưu.
 * Lỗi đọc DB → giữ cấu hình đang áp (không làm hỏng trang / cộng xu).
 */
export * from "./game-config-shared";

const TTL_MS = 30_000;

/**
 * Test: mỗi file test chạy trong tiến trình riêng, song song → cấu hình để trong bộ nhớ của tiến trình (không đọc / ghi DB),
 * tránh file này ghi cấu hình làm lệch xu của file khác. tests/setup/register.cjs đặt GAME_CONFIG_SOURCE=memory;
 * test nào cần thử đường DB thật thì đặt lại "db".
 */
let cache: { at: number; data: GameConfigData } | null = null;
const memoryMode = () => process.env.GAME_CONFIG_SOURCE === "memory";
let memory: GameConfigData = EMPTY_GAME_CONFIG;
export function setGameConfigForTests(cfg: Partial<GameConfigData> | null) {
  memory = { itemPrices: cfg?.itemPrices ?? {}, earning: cfg?.earning ?? {}, chests: cfg?.chests ?? {} };
  cache = null;
  applyGameConfig(memory);
}
let inflight: Promise<GameConfigData> | null = null;

async function read(): Promise<GameConfigData> {
  const rows = await prisma.gameConfig.findMany({ where: { key: { in: ["itemPrices", "earning", "chests"] } } });
  const get = (k: string) => rows.find((r) => r.key === k)?.value;
  return {
    itemPrices: ((get("itemPrices") as ItemPrices | undefined) ?? {}) as ItemPrices,
    earning: ((get("earning") as EarningConfig | undefined) ?? {}) as EarningConfig,
    chests: ((get("chests") as ChestConfig | undefined) ?? {}) as ChestConfig,
  };
}

export async function loadGameConfig(force = false): Promise<GameConfigData> {
  if (memoryMode()) {
    applyGameConfig(memory);
    return memory;
  }
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
      // Lỗi nội bộ của Next (vd đánh dấu trang phải dựng động khi build) phải ném lại, không được nuốt
      unstable_rethrow(err);
      console.error("[game-config] load failed:", err);
      return cache?.data ?? EMPTY_GAME_CONFIG;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Ghi một khoá cấu hình rồi áp ngay trong tiến trình này */
export async function writeGameConfig(key: "itemPrices" | "earning" | "chests", value: ItemPrices | EarningConfig | ChestConfig, userId: string) {
  if (memoryMode()) {
    memory = { ...memory, [key]: value };
    return loadGameConfig(true);
  }
  await prisma.gameConfig.upsert({
    where: { key },
    create: { key, value, updatedById: userId },
    update: { value, updatedById: userId },
  });
  return loadGameConfig(true);
}
