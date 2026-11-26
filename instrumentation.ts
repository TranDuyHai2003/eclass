/** Chạy một lần khi server khởi động: nạp cấu hình game admin đã sửa (giá đồ, mức xu) vào bộ nhớ. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { loadGameConfig } = await import("@/lib/game/game-config");
    await loadGameConfig(true);
  } catch (err) {
    console.error("[instrumentation] loadGameConfig failed:", err);
  }
}
