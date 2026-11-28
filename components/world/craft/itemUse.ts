"use client";
/**
 * "Dùng" vật phẩm đang cầm (chuột phải / nút Đặt trên điện thoại) cho vật phẩm KHÔNG phải khối — vd. Chìa Khảo sát,
 * Thẻ Rút (components/world/bosses/ExpanseBosses.tsx đăng ký). Trả true nếu đã xử lý (BlockInteractor dừng ở đó).
 */
export type UseCtx = { /** đang nhắm vào Bàn Dã chiến */ bench: boolean };
export const ITEM_USE: Record<string, (ctx: UseCtx) => boolean> = {};
