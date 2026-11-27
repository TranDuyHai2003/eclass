/**
 * Hành động tương tác tổng quát: cảnh tự đăng ký hàm theo id (registerAction), điểm gần nhất trả { kind: "action", id };
 * WorldClient chỉ gọi runAction(id) — thêm điểm khám phá mới không phải sửa WorldClient.
 */
const ACTIONS = new Map<string, () => void>();

export function registerAction(id: string, fn: () => void): () => void {
  ACTIONS.set(id, fn);
  return () => {
    if (ACTIONS.get(id) === fn) ACTIONS.delete(id);
  };
}

export function runAction(id: string): boolean {
  const fn = ACTIONS.get(id);
  if (!fn) return false;
  fn();
  return true;
}
