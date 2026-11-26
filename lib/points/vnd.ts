/**
 * Quy đổi tiền thật → xu (thầy quy định 26/11/2026): chia 3,6 rồi làm tròn LÊN hàng trăm (20.000đ → 5.600 xu).
 * Tính bằng số nguyên (vnd·10 / 3600) để không sai số dấu phẩy động. Dùng cho quà, thẻ đặc quyền, thú cưng, khung, bảng tên.
 */
export const VND_PER_XU = 3.6;
export function vndToXu(vnd: number): number {
  const v = Math.max(0, Math.floor(Number(vnd) || 0));
  return Math.ceil((v * 10) / 3600) * 100;
}
