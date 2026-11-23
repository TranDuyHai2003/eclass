import { normalizeRewardInput } from "./reward-input";
import { missingShopTemplates } from "./templates";
import type { Tx } from "./engine";

/**
 * Thêm một lần cả bộ quà của tiệm (10 quà hiện vật + 7 thẻ đặc quyền theo canvas) — bỏ qua món đã có cùng tên.
 * Quà thêm vào đang bật, áp dụng mọi lớp; thầy sửa giá / tồn kho sau.
 */
export async function addShopTemplatesInTx(tx: Tx, staffId: string): Promise<number> {
  const existing = await tx.reward.findMany({ where: { deletedAt: null }, select: { title: true } });
  const todo = missingShopTemplates(existing.map((r: { title: string }) => r.title));
  for (const t of todo) {
    const { shop: _shop, ...input } = t;
    const parsed = normalizeRewardInput({ ...input, classIds: [], isActive: true });
    if ("error" in parsed) throw new Error(parsed.error);
    await tx.reward.create({ data: { ...parsed.data, createdById: staffId } });
  }
  return todo.length;
}
