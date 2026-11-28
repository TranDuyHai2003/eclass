/**
 * Tín hiệu tải thật từ trong Canvas (R3F) ra màn chờ (DOM) — một đối tượng dùng chung, đọc ~10 lần / giây, không gây render lại.
 *  mounted   ← LoadProbe (cảnh đã qua Suspense)
 *  prewarm   ← PrewarmShaders (compileAsync + texture lên GPU xong)
 *  stable    ← LoadProbe (số khung mượt liên tiếp SAU khi shader xong)
 *  build     ← Expanse (chunk gần đã có lưới / cần)
 */
export const LOAD_SIG = {
  mounted: "",
  prewarm: { scene: "", done: false },
  stable: 0,
  build: null as null | (() => { done: number; need: number }),
};
