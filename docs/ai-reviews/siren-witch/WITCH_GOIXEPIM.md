# Phù thuỷ #2 — Gối Xếp Im (sóng dừng, lộ dạng ngang) — trạng thái 28/11/2026

Chưa commit. Chỉ gắn qua móc DEV (`window.__witch("goixepim")` trong `SirenWorld.tsx`); khu "Sa Mạc Tấm Đồng" gắn chính thức bằng
`<GoiXepIm origin={{x,y,z}} radius={r} yaw={ψ} seed={…} onDefeat={…} />`.

## Đã xong
- Logic thuần `lib/world/witchGoiXepIm.ts` + `tests/world/witchGoiXepIm.test.ts` (13 test): máy trạng thái ngủ → lộ dạng →
  khúc mẫu vô hại → chiến đấu → dự đoán → ru ngủ → xong; mode n = 2 → 3 → 4; nút u = kL/n; Gập Bụng (tầm đập D·reach(u)) và
  Dây Chỉ Quất (bao |v − VC| < HW + AW·|sin|); báo trước ≥ 2 phách; thắng = đánh từ dải NÚT (bụng nuốt đòn) + lượt dự đoán nút
  của mode mới (đứng đúng → nút được may ngay). `DANGER_EXPR` / `TILT_EXPR` là chuỗi GLSL-cũng-là-JS: test so tập an toàn vẽ ra
  với luật ở 44k điểm; đỉnh vách lúc đập rơi đúng mép vùng hiểm. Tất định (seed + thời gian).
- Hình `components/world/scene/siren/witches/GoiXepIm.tsx`: 3 lệnh vẽ (con rối giấy instancing 40 quad, vách vải 160 × 12
  uốn bằng TILT_EXPR, sàn báo đòn DANGER_EXPR alpha-test); StrikeFx "crest" + bụi Puffs lúc đập; âm sirenSynth (dây ngân
  n·110 Hz, gõ gỗ đếm nhịp, nỉ đập); HUD riêng `WitchHud.tsx` (cột phải, sơ đồ bao sóng dừng, "? ? ?" khi dự đoán);
  ghi chép Thư khố `standingwave` (lib/world/story.ts); questEvent kill "goixepim"; giảm chuyển động; không cấp phát mỗi khung.
- Art Codex: nguồn `blender-src/siren-src/witches/goixepim/` (BRIEF.md), script `scripts/siren-witch-goixepim.py`
  → `public/world/siren/witches/goixepim.webp` + `lib/world/witchGoiXepImAtlas.ts`.
- Ảnh: `shots/witch-goixepim/01…08`. `__perf` (máy dev tải nặng): +2…3 lệnh vẽ, +3,8k tam giác, GPU +0,3 ms (nhiễu).

## Còn lại / rủi ro
- Vách không chặn đường đi (người chơi xuyên qua vải) — khu Sa Mạc nên thêm va chạm nếu cần.
- Chưa đồng bộ mạng (logic tất định đã sẵn: seed + mốc thời gian + sự kiện ghim).
- Vách cao 5 m dễ bị cắt khung ở camera gần; chưa kiểm màn hình điện thoại dọc / ngang kỹ.
- Mốc `e.home` của Enemy đặt rất xa để vòng "nút giao thoa" của Siren.tsx không đụng tới.
- Dev: `window.__gxi.force("fight"|"predict"|"hush"|"reveal"|"dormant", "slam"|"whip")`, `window.__gxi.tp(u, v)`.
