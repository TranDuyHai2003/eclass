import { auth } from "@/auth";

export const DEMO_READ_ONLY_MESSAGE =
  "Demo Mode — tài khoản chỉ xem, không thể thay đổi dữ liệu.";

/**
 * Kiểm tra người dùng hiện tại có phải tài khoản demo (chỉ xem) không.
 * Giá trị isDemo lấy từ session, được làm mới từ database ở callback session (auth.ts),
 * nên không thể giả mạo từ client.
 */
export async function isDemoUser(): Promise<boolean> {
  const session = await auth();
  return !!session?.user?.isDemo;
}

/**
 * Dùng ở đầu các Server Action có ghi dữ liệu:
 *   const blocked = await demoGuard();
 *   if (blocked) return blocked;
 */
export async function demoGuard() {
  if (await isDemoUser()) {
    return { success: false as const, error: DEMO_READ_ONLY_MESSAGE };
  }
  return null;
}

/** Dùng cho các Server Action không trả về dạng { success, error }. */
export async function assertNotDemo() {
  if (await isDemoUser()) {
    throw new Error(DEMO_READ_ONLY_MESSAGE);
  }
}
