# Kế hoạch: Quảng trường Khởi nguyên "đẹp như Genshin" (28/11/2026)

Người dùng: Quảng trường (cảnh `hub`) "vẫn quá rẻ tiền". Mục tiêu: ấm, thơ, giờ vàng kiểu Mondstadt / Penacony. Nhân vật VRM/MToon giữ cel.
Chỉ làm ở máy local: không commit / push / deploy, không đụng `README*.md`.
Nghiên cứu: [RESEARCH.md](RESEARCH.md) (Codex, có trích GDC 2021 Haoyu Cai, Unite 2020 miHoYo, GDC 2025 Star Rail, Ghost of Tsushima…).

## 1. Ảnh "trước" và chấm điểm (skill threejs-aaa-graphics-builder, thang 0–3)

Ảnh: `shots/before-h{17,12,21}-{spawn,overview,north,bed}.jpg`, `shots/before-phone-h17-*.jpg` (Iris Xe, mức Vừa, 1280×720 → canvas 1094×615).

Tương đương thể loại (hub không có quái chính): *Hero* = nhân vật + NPC; *Obstacles* = mốc định hướng (tượng đài, cổng, lối);
*Interactables* = cổng / NPC / gương / bảo tàng; *VFX/motion* = chuyển động môi trường.

| Hạng mục | Trước | Bằng chứng |
|---|---|---|
| Art direction | 1,5 | chủ đề "đảo toán nổi" có, nhưng cả khung là một màu tím-xám nhạt; không có ngôn ngữ vẽ tay thống nhất |
| Hero/player | 2 | VRM anime có viền, bóng mềm dưới chân (không thuộc phạm vi đổi) |
| Mốc định hướng | 1,5 | tượng đài bị cắt đỉnh ở điểm vào; 26 đèn giống hệt thành "hàng rào cọc" che tầm nhìn |
| Interactables | 2 | mặt cổng xoáy màu đích, nhãn, gợi ý F |
| World/environment | 1,5 | sân lát rộng trống, lặp; chân trời là lan can + trời trống; cây "kẹo mút" nhỏ |
| Materials | 1 | lưới gạch kiểu nhà tắm (ron tối 26%), sàn bóng phản chiếu trời hồng → tím xám; hồ xanh "bể bơi" |
| Lighting/render | 1 | giờ vàng bị bạc màu, không có bóng cây / tiếp xúc; viền mực đen trên cỏ, đèn, mép tán (chấm đen dither) |
| VFX/motion | 1,5 | cỏ + nước có chuyển động; không có sự sống (cánh hoa, đom đóm) |
| UI/HUD | 2 | HUD đã thiết kế (ngoài phạm vi) |
| Performance evidence | 2 | có đo (bảng dưới) |
| **Trung bình** | **1,6** | lỗi tự động: "sương / bloom thay cho hình khối", "khoảng trống không có chủ ý" |

Số đo trước (Iris Xe, mức Vừa, `__hour = 17`, `window.__perf(4000)`):

| Góc | fps | cpuMs | gpuMs | calls | tris |
|---|---|---|---|---|---|
| spawn | 29,6 | 29,4 | 10,9 | 466 | 945k |
| overview | 38,3 | 24,2 | 9,6 | 419 | 916k |

Phân rã lệnh vẽ (bọc `renderBufferDirect`, một khung ở spawn): **~288 / 470 lệnh là VRM** (người chơi + 2 NPC: mỗi mảnh tóc `Hair001baked_N`
vẽ 2 lần — màu + viền MToon); hub tự có ~110 (model gộp 51, cây/đèn/ghế 20, cỏ 12, nước / tia / thác …), còn lại hậu kỳ (19 tam giác toàn màn hình của bloom).
→ Máy nghẽn CPU vì số lệnh vẽ; GPU còn dư. Hub phải giữ **net lệnh vẽ ≤ 0**; phần GPU (shader) có chỗ.
(Gộp tóc VRM sẽ bớt ~200 lệnh nhưng thuộc `player/Avatar.tsx` — agent khác đang sửa → chỉ ghi khuyến nghị.)

## 2. Thay đổi chọn (theo thứ tự ưu tiên của RESEARCH §8, đã lọc theo ảnh)

1. **Bố cục / đèn** (`lib/world/hubLayout.ts`): bỏ 8 đèn ở cửa 4 lối chéo (giữ cặp đèn ở 4 lối chính = ngưỡng cổng / bảo tàng / đình),
   cây to hơn (s 0,85–1,2 → 1,1–1,45) để tán khung tượng đài và che bớt sân trống. 0 lệnh vẽ.
2. **Sàn yên lại + vẽ tay** (`floorMaterial`): đá sa thạch kem `#DCCBB0` × texture vân vẽ tay (Codex) ; phiến 2–3 m so le trên lối,
   ron 6% (thay 26%), nhám 0,6 / phản xạ môi trường 0,35 (hết bóng gương tím); bỏ bớt vạch vàng (giữ quanh hồ, mép lối, ngã ba);
   bồn cỏ dùng texture cỏ vẽ tay; giờ vàng nhuộm ấm (không lăng tím). 0 lệnh vẽ.
3. **Bóng cây + tiếp xúc** (shader chung sàn + cỏ): bóng đổ giải tích của 16 tán theo hướng nắng thật (`DAY.light`, dài theo
   `h / tan(cao độ)`, loang lổ như nắng xuyên lá) + AO tiếp xúc dưới gốc / đèn / ghế. 0 lệnh vẽ.
4. **Ánh sáng / chỉnh màu**: viền mực ở hub thành nét **màu** (tone 0,5, độ mạnh 0,8, tầm 45–60 m) thay nét đen; bloom ngưỡng 1,2;
   hiệu ứng `HubAtmos` (gộp vào cùng EffectPass với Ink, đọc depth sẵn có): sương độ cao + phối cảnh khí quyển nghiêng về hướng mặt trời
   (màu theo `DAY`), chỉnh màu ấm sáng / lạnh tối nhẹ + vibrance. Bỏ `<fog>` cố định màu đào (đêm vẫn đào). 0 lệnh vẽ.
5. **Chân trời nhiều lớp**: (a) bầu trời: dải đảo nổi / núi xa vẽ trong shader vòm (2 lớp, phối cảnh khí quyển), quầng mặt trời Mie,
   mây ti; (b) **mây tích billboard** quanh đảo (InstancedMesh 1 lệnh: SDF nhiều cục + viền bạc ngược sáng + thân / mép sáng tách biệt
   như Genshin GDC); (c) biển mây gộp VÀO shader vòm (giao tia–mặt phẳng y = −40) → bỏ 1 lệnh vẽ.
6. **Tán cây**: chuyển sắc trong tán (lõi lạnh đậm → ngoài sáng → viền nắng ấm), ánh xuyên lá mạnh khi ngược nắng giờ vàng,
   cây hoa hồng anh đào mềm hơn; nới vùng dither "chắn nhân vật" (tối thiểu 0,12 → 0,4) để bớt chấm.
7. **Cỏ**: gốc khớp màu nền đã chiếu sáng, ngọn ô-liu / rơm, bóng cây; **khóm hoa** (atlas Codex 4 loại) dọc mép lối, quanh gốc cây,
   cạnh ghế — 1 lệnh instanced, gió + rạp theo người chơi.
8. **Gộp lệnh vẽ bù**: 4 thác (cùng hình + vật liệu) → 1 InstancedMesh (−3); biển mây vào vòm (−1).
9. **Hồ**: (nếu còn thời gian) màu ngọc bích sẫm ở giữa → nhạt ở bờ thay xanh "bể bơi".
10. **Sự sống**: cánh anh đào / hạt bồ công anh / lá bạch quả bay ban ngày, đom đóm ban đêm — 1 lệnh instanced, hoạt hoạ toàn bộ trong
    vertex shader (không cập nhật JS mỗi hạt).

Không làm: panorama ảnh (bộ nhớ `sky-shader-not-panorama`), phong cách siêu thực (hub giữ anime), MSAA + alpha-to-coverage
(đổi composer, đo riêng sau), gộp tóc VRM (ngoài phạm vi).

## 3. Nguồn tài sản

- Codex image gen (`codex exec --sandbox workspace-write`, brief `blender-src/hub-src/BRIEF.md`, nguồn gitignore `blender-src/hub-src/`):
  `stone_paint`, `grass_paint`, `flower_atlas`, `petal_atlas`.
- Xử lý: `scripts/hub-genshin-art.py` → `public/world/fx/tex/hub/` (jpg 512², atlas PNG RGBA cắt magenta + chảy màu viền).
- Bầu trời / mây / đảo xa: shader (không ảnh panorama).

## 4. Ngân sách

| Chỉ số (spawn, mức Vừa) | Trước | Trần sau |
|---|---|---|
| Lệnh vẽ | 466 | ≤ 466 (dự kiến −1: +3 mây/hoa/hạt, −4 thác/biển mây) |
| cpuMs | 29,4 | ≤ 30 (nhiễu ±30% do nhiều agent) |
| gpuMs | 10,9 | ≤ 13 (máy nghẽn CPU; GPU còn dư) |
| Texture mới | — | 2 × jpg 512² + 2 atlas (512², 256²) ≈ 340 KB |
| Cấp phát mỗi khung | — | 0 (vector / màu tạm dùng lại) |

Mức Thấp: hoa 40%, hạt 35%, mây billboard ít hơn; không thêm lượt vẽ phụ. Mọi vật liệu / hình học / texture tự tạo được dispose khi rời cảnh.

## 5. Kiểm chứng

- Ảnh sau cùng góc / giờ: `shots/after-h{17,12,21}-*.jpg`, `shots/after-phone-h17-*.jpg` (844×390); chấm lại 10 hạng mục.
- `window.__perf(4000)` spawn + overview, so cùng cấu hình; phân rã lệnh vẽ.
- Ngày ↔ đêm: 12 h, 17 h, 21 h (đèn, đom đóm, sương đêm lam).
- `npx tsc --noEmit -p .`, `npx eslint <file đã sửa>`, test world (`tests/world/*.test.ts` trừ service), `node realtime/selftest.mjs`.
- Test thuần cho phần logic mới (vị trí khóm hoa không nằm trên lối / trong vật cản; bóng cây theo hướng nắng).

## 6. Trạng thái (28/11/2026, dừng theo yêu cầu "wrap up")

### Đã làm
| # | Hạng mục | File |
|---|---|---|
| 1 | Bỏ 8 đèn ở 4 lối chéo; cây to 1,1–1,45× | `lib/world/hubLayout.ts` |
| 2 | Sàn sa thạch vẽ tay (Codex) + phiến so le, ron 10%, nhám 0,6, viền lối đá xám lam, vàng chỉ ở chỗ hội tụ; bồn cỏ = thảm cỏ vẽ tay | `scene/HubPlaza.tsx` (`floorMaterial`) |
| 3 | AO tiếp xúc (canvas 512² tĩnh) + bóng tán giải tích theo nắng thật (canvas 256², vẽ lại khi mặt trời dịch) + "giờ vàng" ấm; dùng chung sàn / cỏ / hoa | `fx/hubShade.ts` (mới), `lib/world/hubFlora.ts` (mới) |
| 4 | Ink nét màu ở hub (`tone`, `strength`, `dedither`); `HubAtmos` (sương độ cao + phối cảnh khí quyển theo DAY + split-tone / vibrance) cùng EffectPass; bloom hub ngưỡng 1,2 / 0,5; bỏ `<fog>` đào cố định | `fx/Ink.tsx`, `fx/HubAtmos.tsx` (mới), `WorldClient.tsx` |
| 5 | Vòm trời: đảo nổi xa 2 lớp + biển mây gộp vào vòm (chỉ `HubSky hub`; Expanse giữ cũ) + quầng Mie; mây tích billboard 1 lệnh | `scene/HubPlaza.tsx` (`hubSky`), `scene/HubClouds.tsx` (mới) |
| 6 | Tán cây: lõi lục lam mát → ngọn ấm, ánh xuyên lá mạnh khi nắng thấp, viền nắng ở mép; anh đào hồng phấn; dither chắn nhân vật tan hẳn ở lõi | `fx/foliage.ts`, `fx/nearFade.ts`, `HubPlaza.tsx` |
| 7 | Cỏ: gốc = màu thảm cỏ vẽ tay (mip mờ), ngọn ô-liu ấm, bóng tán + AO; khóm hoa (atlas Codex) 1 lệnh instanced | `HubPlaza.tsx`, `scene/HubFlora.tsx` (mới) |
| 8 | 4 thác gộp 1 hình học (−3 lệnh); `CloudSeaGold` bỏ (−1) | `HubPlaza.tsx` |
| 10 | Cánh anh đào / lá / hạt bồ công anh ban ngày + đom đóm ban đêm, 1 lệnh | `scene/HubFlora.tsx` |
| — | GI nướng ở hub bớt rực tím hồng + ấm (`HubDayCycle warm`, chỉ hub) | `scene/HubNight.tsx` |
| — | Art: `blender-src/hub-src/*` (gitignore) → `scripts/hub-genshin-art.py` → `public/world/fx/tex/hub/` (≈ 340 KB) | |
| — | Test thuần: `tests/world/hubFlora.test.ts` (đã chạy pass cùng hubLayout / hubGrass) | |

Số đo sau (Iris Xe, mức Vừa, 17 h, spawn; nhiễu ±30% do nhiều agent): calls 466–467 (trước 466), cpuMs 24–28 (trước 29,4),
gpuMs 11–15 (trước 10,9; A/B: hoa + hạt + mây ≈ +0,7–0,9 ms, cỏ ≈ +2 ms do 4 lần đọc texture ở vertex shader).

### Còn lại / chưa làm
- Chấm điểm lại đầy đủ + bộ ảnh after đủ 3 giờ × 4 góc + điện thoại 844×390 (mới có 8 ảnh `shots/after-*.jpg`, chưa có ảnh điện thoại).
- `npx eslint` + toàn bộ test world + `realtime/selftest.mjs` chưa chạy lại sau các chỉnh cuối (chỉ chạy `tsc`).
- Cỏ: tính trước màu gốc + AO tĩnh vào thuộc tính instance (bớt 3 lần đọc texture / đỉnh, ~1–2 ms GPU).
- Hồ: màu ngọc bích sẫm giữa / nhạt bờ (mục 9) chưa làm.
- Tán cây nhiều khối (Blender) chưa làm; đỉnh tượng đài vẫn bị cắt ở điểm vào.
- Gộp tóc VRM (~200 / 466 lệnh vẽ là mảnh tóc × 2 lượt viền) — ngoài phạm vi, khuyến nghị cho agent nhân vật.
