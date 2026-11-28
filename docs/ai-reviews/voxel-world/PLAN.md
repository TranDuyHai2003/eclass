# Thế giới voxel (Vùng Kỳ quan) — nâng cấp đồ hoạ, tối ưu mạnh, đủ tính năng kiểu Minecraft

Ngày: 28/11/2026. Nghiên cứu: Codex (0fps meshing / AO / lighting, Checchi cave culling, Starlight, noa-engine, Divine Voxel
Engine, Prismarine viewer, ClassiCube, GPU Gems clipmaps) — bản đầy đủ ở scratchpad `voxelmc/codex_answer.md`; tài liệu cũ
`docs/ai-reviews/game-3d/VOXEL_WORLD.md` (§4 hiệu năng, §5 thứ tự).

## Hiện trạng đo được (Node, 49 chunk quanh điểm xuất phát)
| Việc | Số đo |
|---|---|
| Sinh khối (worldgen) | 5,4 ms / chunk 32×32, luồng chính |
| Dựng lưới (cull + AO) | 8,2 ms / chunk, luồng chính |
| Mặt / chunk | ≈ 2 333 tứ giác, 328 KB đỉnh (Float32 ×9 / đỉnh) |
| Tầm nhìn | bán kính 1 / 2 / 3 chunk → sương 51 / 83 / 115 m |
| Streaming | 2 chunk / khung → khựng ~27 ms; React setState mỗi chunk |
| Nước | một mặt phẳng; hang "tối" bằng mẹo tô màu |

## Mục tiêu
- Luồng chính khi đi / sửa khối: p95 ≤ 8 ms (laptop), ≤ 12 ms (điện thoại); sửa khối → lưới mới < 50 ms.
- Tầm nhìn voxel 4–6 chunk (desktop) + địa hình xa (LOD) tới 300–500 m; điện thoại 150 m.
- Giữ phong cách anime (toon 2–3 dải + viền mực), thêm ánh sáng kiểu Minecraft (trời / khối, ngày đêm) và hoạ tiết 16×16.

## Giai đoạn
| # | Việc | Ghi chú kiểm tra |
|---|---|---|
| G1 | **Lõi mới**: `lib/world/voxel/chunkMesh.ts` (khối lề + ánh sáng BFS + lưới tham lam, đỉnh gọn Int16/Int8/Uint8), Web Worker pool (sinh + lưới, trả buffer chuyển nhượng, kèm cột đã sinh để luồng chính khỏi sinh lại), **ChunkManager** mệnh lệnh (không React state mỗi chunk), hàng đợi theo khoảng cách + hướng nhìn, ngân sách cài lưới 1 ms / 256 KB mỗi khung, huỷ việc cũ, phiên bản (revision) chống kết quả lỗi thời | test thuần (số mặt, gộp, AO, ánh sáng, cuộn đúng); so mặt cũ / mới cùng seed; đo luồng chính trên trình duyệt |
| G2 | **Đồ hoạ**: vật liệu toon + ánh sáng trời × giờ trong ngày + ánh sáng khối ấm; sắc độ theo hash ô trong shader (để gộp được); hoạ tiết 16×16 (DataArrayTexture, UV theo đơn vị khối); lá cắt alpha; sương / trời khớp; ngày đêm trong Vùng Kỳ quan | ảnh trước / sau; FPS |
| G3 | **Nước khối** (bề mặt + vách, trong suốt, vẽ sau) + dòng chảy CA có giới hạn mỗi tick; sương dưới nước | test CA (nguồn, chảy xuống trước, cạn khi bỏ nguồn) |
| G4 | **Lối chơi**: đào có thời gian + vết nứt, rơi đồ + nhặt, hotbar 9 + túi, chế độ sáng tạo / sinh tồn, bàn chế tạo + công thức, đuốc (ánh sáng khối), cát / sỏi rơi, giường = điểm hồi sinh; lưu IndexedDB theo chunk (trễ, có bản sửa), chuyển dữ liệu localStorage cũ | test giao dịch túi đồ / chế tạo; tải lại không mất / nhân đôi đồ |
| G5 | **Địa hình xa**: lưới độ cao theo vòng (2 / 4 / 8 m) từ cùng hàm sinh, sương chung, dải chuyển tiếp; đảo nổi / tàn tích xa = khối thô | tầm 300–500 m; số lệnh vẽ |
| G6 | **Mạng**: đăng ký sửa khối theo cột (ảnh chụp + delta có số hiệu), thao tác vĩ mô (Lò Ma trận đã có tin "transform") | selftest realtime |
| G7 | Đo lại: cave culling (Checchi) nếu dưới hang còn nhiều lệnh vẽ thừa; thử BatchedMesh nếu lệnh vẽ đắt | giữ cái nào giảm thời gian khung |

## Quy tắc lõi (từ nghiên cứu)
- Gộp mặt chỉ khi **cùng khối + màu + AO đều + ánh sáng đều** trên cả hình chữ nhật; mặt có AO / ánh sáng thay đổi giữa 4 góc giữ là tứ giác đơn (tránh mất dải chuyển).
- Sắc độ ngẫu nhiên từng khối tính trong fragment shader từ ô nguyên (không nướng vào đỉnh).
- Ánh sáng: 1 byte / ô (trời 4 bit cao, khối 4 bit thấp); ngày đêm chỉ đổi uniform, không dựng lại lưới.
- Mọi kết quả worker kèm phiên bản; lỗi thời → bỏ. Không cấp phát trong `useFrame`.

## Tiến độ
- **G1 (28/11)**: xong lõi + worker + ChunkManager.
  - `lib/world/voxel/chunkMesh.ts`: khối lề 8 ô, ánh sáng BFS trời / khối, lưới tham lam chỉ gộp khi AO + ánh sáng đều; đỉnh Int16 / Int8 / Uint8 (13 B / đỉnh, trước 36 B).
  - Test `tests/world/chunkMesh.test.ts`: cùng tập mặt đơn vị với mesher cũ, ít hơn ≈ 29 % tứ giác trên đồi gập ghềnh.
  - `components/world/voxel/voxel.worker.ts` + `chunkManager.ts` (ưu tiên khoảng cách + hướng nhìn, `rev` / `readyRev`, ngân sách cài 1,2 ms / 384 KB), `voxelMaterial.ts` (ánh trời × uDay, ánh khối ấm, sắc độ theo ô trong shader).
  - Luồng chính không còn sinh / dựng lưới. Worker: ~6 ms khối + ~7 ms ánh sáng + ~15 ms lưới mỗi chunk (Node).
  - Sửa: `setBlock` bỏ qua khi không đổi khối (kết nối lại không còn làm dựng lại hàng loạt).
- **Tối ưu worker (28/11)**: ánh trời chỉ xếp hàng "lớp vỏ" (ô < 15 hoặc cạnh cột bị che) thay vì mọi ô không khí → ánh sáng 6,97 → 1,98 ms; lưới ghi thẳng typed array tự giãn, bỏ mảng tạm mỗi tứ giác → 11,6 → 6,4 ms / chunk (Node, 49 chunk). Test hồi quy: ánh trời tối ưu trùng BFS đầy đủ (mái nhô, lá, địa hình thật).
- **G2 (một phần)**: ngày đêm theo giờ thật trong Vùng Kỳ quan (dùng chung HubDayCycle + trời shader), ánh trời voxel × uDay, đêm có ánh trăng lam (sàn 0,5 — học sinh vẫn nhìn rõ), địa hình xa dùng cùng vật liệu (biến thể `far`) nên sáng / tối khớp.
  - Hoạ tiết khối 64 px (23 lớp, pixel-art pastel anime sinh bằng Codex, nguồn ở `blender-src/voxel-tiles/`, đóng gói `scripts/voxel-tiles.py` → `public/world/voxel/tiles.png`, 142 KB): DataArrayTexture, UV theo toạ độ thế giới (mặt gộp vẫn lặp từng khối), `textureGrad` chống đường mipmap ở mép ô. Lớp "màu" chuẩn hoá trung bình = màu gốc khối (địa hình xa vẫn khớp), cỏ mặt trên là lớp "chi tiết" xám (giữ màu biome), đuốc giữ màu thô. Đỉnh thêm 1 byte lớp hoạ tiết (`lib/world/voxel/tiles.ts`); test `tests/world/voxelTiles.test.ts`.
- **G3 (bước 1, 28/11)**: biển anime `components/world/voxel/VoxelWater.tsx` (một lệnh vẽ): màu nông → sâu theo bản đồ độ sâu thật (worker địa hình xa tính 128² × 2 m quanh người chơi, `FarTerrain.depth`), bọt viền bờ + dải sóng chạy vào bờ, gợn 2 lớp, lấp lánh nắng toon, fresnel ra màu chân trời, sáng / tối cùng đường cong với voxel. Nước dạng khối: xem bước 2.
- **Đuốc / icon / vết nứt (28/11)**: khối "sprite" trong mesher (không sinh mặt, ánh sáng đi qua) — đuốc vẽ bằng hai mặt bắt chéo từ tranh đuốc (`TorchSprites.tsx`, InstancedMesh, lửa lay + HDR), vẫn là nguồn sáng khối 14; ánh khối ấm hơn (đêm: trời 0,4). Icon vật phẩm: khối = isometric dựng từ hoạ tiết (`scripts/voxel-icons.py`), vật phẩm khác (kể cả 8 vật phẩm bậc boss + nguồn nước) = tranh anime Codex (`scripts/voxel-items.py`) → `public/world/items/vox/`. Vết nứt: mặt nạ pixel-art (Codex) mã hoá ngưỡng lộ theo khoảng cách tâm → 8 nấc lan dần.
- **G6 (28/11)**: đăng ký khối theo cột chunk — client gửi `join {sub: true}` rồi `sub {a, d}` (9 × 9 cột quanh người chơi, chỉ phần chênh, trong nhịp gửi 10 Hz); server giữ chỉ mục theo cột, gửi ảnh chụp `chunks` cho cột mới đăng ký và chỉ phát `edit` tới người đang giữ cột đó (≤ 400 cột, ≤ 4 tin / giây). Client cũ (không cờ) nhận toàn bộ như trước. Lò rèn vẫn phát cả phòng. Selftest realtime + test `CHUNK` server = địa hình.
- **G3 (bước 2, 28/11)**: khối `water` (id 21) = NGUỒN; dòng chảy tính TẤT ĐỊNH trong mesher (`computeFlow`: hàng đợi ưu tiên theo mức 8 → 1, rơi xuống trước, chạm đáy lan ngang 7 ô) — không CA, không lưu, không gửi mạng; lề 8 ô ≥ tầm lan nên chunk kề nhau khớp. Lưới nước riêng mỗi chunk (`fluidMesh`, Float32 — mặt trên thấp theo mức) + `voxelWaterMaterial` (trong suốt, gợn + lấp lánh toon, cùng ánh trời / khối). `isSolidBlock` / `isTargetBlock`: đuốc + nước đi xuyên, tia nhắm bỏ qua nước. Test `tests/world/fluid.test.ts` (lan Manhattan, giếng + hầm, tất định / khớp mép chunk, cuộn mặt, va chạm). Bơi (28/11): `PlayerField.water` + `lib/world/swim.ts` (ngập > 0,55 m trên nước sâu > 0,9 m → nổi đầu trên mặt nước, đi chậm 0,62, nhảy = đạp nước / trèo bờ, nhìn xuống + bơi tới = lặn, không xuyên đáy; lội nông chậm 0,75), tư thế Swim_Fwd / Swim_Idle (UAL), Vùng Kỳ quan: biển + cột nước nguồn, mặt đất người chơi là đáy thật; test `swim.test.ts`. Còn: xô múc nước, thác nhiều tầng sát mép chunk có thể lệch.
- **G5 (một phần)**: `lib/world/voxel/farTile.ts` + `components/world/voxel/farTerrain.ts` — ô 64 m, bước 2 / 4 / 8 m, worker riêng, chân trời 170 / 280 / 420 m, sương khớp; test `tests/world/farTile.test.ts`.
- **G4 (28/11, vòng chơi đầu: nhặt → chế → xây → lưu)** — agent riêng, chưa commit.
  - Thuần + test (`tests/world/survival.test.ts`, `tests/world/voxelSave.test.ts`): `lib/world/itemDefs.ts` (mã vật phẩm chuỗi ổn định, khối / nguyên liệu toán / dụng cụ), `inventory.ts` (9 thanh nhanh + 27 túi, giao dịch trả túi mới — thêm một phần, bớt nguyên tử, gộp / đổi / chuyển nhanh, làm sạch dữ liệu lưu), `recipes.ts` (9 công thức bậc 0–1: ván 1 : 4, Bàn Dã chiến, đuốc, Cuốc Trục, Cuốc Tỉ lệ, Chìa Khảo sát, gạch, kính; kiểm nguyên liệu + chỗ trống cùng lúc), `mining.ts` (độ cứng / cấp dụng cụ / thời gian kiểu Minecraft, đồ rơi, dò tia ghi vào Int32Array không cấp phát, chặn đặt khối vào thân), `dropSim.ts` (bể SoA 64 ô, gộp chồng, nam châm, nhặt = một giao dịch, phần thừa nằm lại), `voxelSave.ts` (bản ghi IndexedDB theo chunk + túi, chuyển localStorage luỹ đẳng, bẩn có phiên bản), `ores.ts` (Tinh thể Số nguyên lộ thiên + vách hang nông; Đồng Tỉ lệ đồi đá + hang sâu — tất định, tránh điểm xuất phát).
  - Khối mới (cuối bảng, `MAX_BLOCK_ID` = 20): `intcrystal`, `copper`, `torch` (EMIT 14 — lõi tự soi hang), `bench`.
  - `components/world/craft/`: `BlockInteractor.tsx` (giữ chuột trái đào + vết nứt shader một lưới, sáng tạo phá ngay lặp 0,22 s, chuột phải đặt / mở bàn, đồ rơi một InstancedMesh), `VoxelHud.tsx` (vòng tiến độ + toạ độ khối bằng rAF, thanh nhanh 9 ô, dòng nhặt đồ, bảng Túi đồ & Chế tạo: tỉ lệ, ×k, "tối đa = min(⌊có/cần⌋)", kho sáng tạo), `invStore.ts`, `worldSave.ts` (IndexedDB `eclass-world`: khối + túi cùng giao dịch, trễ 1,5 s / tối đa 6 s, ghi khi ẩn trang; lỗi → giữ localStorage).
  - Gắn vào: Expanse chỉ đổi dòng import / mount `BlockInteractor`; WorldClient thay `BlockHud` bằng `VoxelHud` + overlay `"craft"`; nút cảm ứng "Phá" thành giữ-để-đào.
  - **Còn / rủi ro**: túi đồ theo trình duyệt (chưa theo tài khoản, chưa đồng bộ server — máy dùng chung ở trường thì chung túi); đồ rơi chưa lưu (tải lại khi đồ còn nằm đất → mất, không nhân đôi); dụng cụ chưa có độ bền; cát / sỏi rơi, giường / điểm hồi sinh, thang, cửa chưa làm; đuốc là khối đầy (cần model); server không trả kết quả (sửa bị giới hạn 6/s bị bỏ âm thầm → lệch); chế độ sáng tạo ai cũng bật được (có thể cần khoá theo lớp); mở nhiều tab cùng lúc → mỗi tab ghi đè bản ghi chunk / túi của tab kia (ai ghi sau thắng — nên thêm khoá BroadcastChannel / Web Locks).
  - Kiểm trên trình duyệt (28/11): đào khối cỏ → rơi Đất → nam châm nhặt → đặt lại (bớt túi); chế 12 ván → Bàn Dã chiến → đặt bàn → chuột phải mở bảng trạm "Bàn" → Cuốc Trục; tải lại trang: túi + khối (724 ô) còn nguyên; chuyển localStorage cũ (721 ô) sang IndexedDB.
- **Boss + sự kiện kiểu Terraria (28/11)** — agent riêng, chưa commit. Chi tiết: `docs/ai-reviews/voxel-world/BOSSES.md`.
  - Boss 1 **Kẻ Khảo sát Gấp** (Chìa Khảo sát: ban đêm hoặc chuột phải lên Bàn) — đoàn 12 toa, Quét Làn / Gập Ngược / Thả Thước; điều kiện thắng = phép đối xứng trục (Khiên Đối xứng ở 2/3 và 1/3 máu: đứng lên ẢNH của cọc qua ℓ). Boss 2 **Sổ Mưa** (Thẻ Rút) — xác suất + kỳ vọng E = v·(1 − p)ᵏ. Sự kiện **Đêm Đèn lồng** — bướm tuần hoàn, BCNN(2, 3) = 6. Vật phẩm bậc 2 + trạm "press" (Máy Ép Hoa văn trong túi + Bàn).
  - Thuần + test: `lib/world/foldbackSurveyor.ts`, `rainLedger.ts`, `lanternNight.ts` → `tests/world/bosses.test.ts` (24 test). Vẽ: `components/world/bosses/*` (1 lưới sàn shader cho mọi báo trước, InstancedMesh, không cấp phát mỗi khung).
  - **Nhiều người (28/11)**: mô hình "chủ trận" — server giữ chỗ trận + chuyển tiếp (bfight / bstate / bhit / bhost / bend, `realtime/bossrelay.mjs` sinh từ `lib/world/bossRelay.ts`), chủ mô phỏng với vị trí mọi người, khách áp gói (`lib/world/bossNet.ts`, `components/world/bosses/encounterNet.ts`). Test `tests/world/bossNet.test.ts` + selftest; thử 2 tab.
