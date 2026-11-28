# Thư khố bỏ hoang — cảnh tả thực mẫu trong Thế giới Bất Khả (hyper-real)

Ngày: 28/11/2026. Yêu cầu: "game nhựa nhựa rẻ tiền… astra (GPT) làm game kinh dị như thật bằng three.js + Blender MCP" →
"dựng cảnh mới trong thế giới bất khả, giống bot ấy", "áp dụng kỹ thuật state of the art của computer graphics, PBR…,
bật WebGPU nếu mạnh hơn và support". Tài sản CC0 Poly Haven tải qua API (người dùng đồng ý), nguồn ở `blender-src/real-src/`
(gitignore).

## Vì sao game hiện trông "nhựa" (tự đánh giá)
1. Bề mặt không có vật liệu thật: khối Blender tô màu đỉnh, không texture / normal / độ nhám biến thiên.
2. Ánh sáng: toon 2–3 dải + đèn chung; thiếu GI, bóng mềm, AO màn hình, thể tích.
3. Hậu kỳ: thiếu chỉnh màu (LUT), hạt phim, DOF, viền tối; viền mực hoạt hình làm mọi thứ thành đồ chơi.
4. Hình khối đơn giản (ít vát cạnh / chi tiết nhỏ / tỉ lệ thật).

## Kỹ thuật (state of the art khả thi trên web)
| Lớp | Kỹ thuật | Ghi chú |
|---|---|---|
| Vật liệu | PBR metal-roughness (MeshPhysical/Standard), texture quét 2K (albedo, normal GL, roughness, AO), texel density đồng đều (~512 px/m), UV mở đúng tỉ lệ | Chuẩn glTF → chạy được cả WebGL2 lẫn WebGPU |
| GI tĩnh | Nướng **path tracing Cycles** (ánh sáng gián tiếp, bóng mềm diện rộng, AO) vào lightmap UV2, khử nhiễu OIDN, HDR (RGBM / EXR→half) | "Lightmap + IBL" như game AAA nội thất |
| Phản xạ | Cubemap chụp trong phòng + **hiệu chỉnh hình hộp** (box-projected / parallax-corrected), che phản xạ theo lightmap (specular occlusion) | Sàn gỗ bóng, kính, kim loại phản chiếu đúng chỗ |
| Động | Đèn pin người chơi: SpotLight bóng **PCSS / VSM** mềm theo khoảng cách; đèn chập chờn (một đèn thật + emissive nướng) | Kinh dị = ánh sáng có hướng, phần lớn tối |
| Nhân vật trong cảnh nướng | **Light probe SH** (từ cubemap) cho nhân vật / vật động khớp ánh sáng nướng | Không "dán" lên cảnh |
| Không khí | Sương thể tích rẻ: cone đèn raymarch ít bước + nhiễu 3D, bụi lơ lửng (instanced, tán xạ theo đèn) | Vệt sáng xuyên cửa sổ |
| Màn hình | AO thời gian thực (GTAO/N8AO), tone map **AgX**, LUT điện ảnh, bloom vật lý (mip), DOF nhẹ, viền tối, hạt phim, quang sai nhẹ, **SMAA/TAA**; tắt viền mực trong cảnh này | Theo cấp chất lượng |
| WebGPU | three 0.187 có WebGPURenderer + TSL (GTAO, SSR, SSGI, TRAA node). Game có 92 file shader GLSL tự viết → KHÔNG đổi toàn cục. Thử riêng cảnh này: phát hiện `navigator.gpu`, đo so với WebGL2, báo người dùng | Vật liệu chuẩn nên không phải viết lại |

## Cảnh
Hành lang lưu trữ cũ (~6 × 22 × 5 m) gắn với Thế giới Bất Khả (mục chương "Hồi âm trong Thư khố"): sàn ván cũ, tường vữa bong,
chân tường bê tông nứt, kệ / tủ gỗ, sách, bàn đọc, ghế bành, đồng hồ quả lắc, gương chạm (kinh dị), đèn dầu / đèn tường,
đèn chùm; cửa sổ cao cuối hành lang hắt trăng lạnh, đèn vàng ấm chập chờn. Một nét "bất khả": hành lang lặp (đi tới cuối lại
về đầu, mỗi vòng đồ đạc lệch một chút).

## Mở rộng (người dùng: "thư khố to hơn, như các hầm SCP, Backrooms")
Không gian **vô tận kiểu liminal**: bộ **mô-đun 4 × 4 × 3,2 m**, mỗi ô có đèn huỳnh quang riêng → ánh sáng nướng **theo từng
mô-đun** vẫn liền mạch khi ghép (nướng mô-đun ở giữa 3 × 3 bản sao để biên khớp — như vòng cầu thang Penrose). Loại mô-đun:
sàn trống, tường (xoay 90°·k), lối kệ sách 2 dãy, cột bê tông, cửa hầm thép SCP (sọc cảnh báo, đèn đỏ), ô đèn hỏng (tối),
cầu thang xuống tầng sâu hơn. Ghép **tất định** theo băm toạ độ ô quanh người chơi (như thế giới voxel), mỗi loại mô-đun một
InstancedMesh dùng chung lightmap → vài lệnh vẽ cho hàng trăm ô; sương giới hạn tầm nhìn ~30 m. Nét "bất khả": phòng phía
sau đổi khi không nhìn, hành lang lặp, tầng sâu hơn tối và lạnh hơn. Hành lang cửa sổ đã dựng = sảnh vào.

## Ngân sách
Desktop 60 FPS; điện thoại 30 FPS (lightmap + 1 đèn bóng + AO nửa độ phân giải, tắt DOF / thể tích). ≤ 60 lệnh vẽ, ≤ 400k
tam giác desktop; texture KTX2 / WebP khi đóng gói.

## Kiểm
Ảnh so sánh trước / sau, `__perf`, test logic (hành lang lặp, va chạm), tsc / eslint / test world.

## Tiến độ
- 28/11: kế hoạch; tải tài sản Poly Haven (texture 2K, HDRI, mô hình 1K) vào `blender-src/real-src/` (script
  scratchpad `ph_dl.py`).
- 29/11 (dừng giữa chừng để tắt máy — làm tiếp từ đây):
  - File Blender riêng `blender-src/archive.blend` (đã lưu): collection ARCH (sảnh hành lang cửa sổ vòm — lỗ khoét cửa sổ
    còn 2 mặt chắn, cần sửa), LIGHTS, MODS (mô-đun 4 × 4 × 3,2 m: `mod_cell`, `mod_cell_dark`, `mod_wall`, `mod_pillar`,
    `mod_door` cửa hầm SCP, `mod_shelf` lối kệ thép + sách), PREVIEW (bản ghép thử ở x = 100), IMPORT (gốc Poly Haven).
  - Vật liệu PBR thật đã gắn (thảm bẩn, giấy dán tường bong, trần vữa, bê tông nứt, thép sơn gỉ, gỗ sẫm); UV hộp cục bộ
    theo mét. Sách: nướng từ bộ bách khoa 67k tam giác → hộp 12 tam giác (màu + normal, `real-src/_baked/books_*.png`).
  - UV lightmap `LM` đã mở cho cả 6 mô-đun; mặt không bao giờ thấy của ô đã xoá. Thử nướng `mod_cell` (CPU, 25 s @128).
  - Script nướng `scratchpad/archive_bake.py` (ngữ cảnh 3 × 3 ô sáng, thang phân vị 98 %, khử nhiễu theo đảo UV, ra
    `public/world/archive/lm_<mô-đun>.png` + `_scales.json`). Chạy: trong Blender đặt `NAMES = [...]; SAMPLES = 256` rồi exec.
  - Máy không có GPU rời (i5-1135G7 + Iris Xe) → Cycles nướng bằng CPU; ngân sách hiệu ứng thời gian thực phải theo máy này.
- Lightmap đã nướng (256 mẫu, CPU): `mod_cell` (thang 10,56), `mod_cell_dark` (1,03), `mod_wall` (2,35) → `public/world/archive/`. Nghiên cứu kỹ thuật (Codex, có nguồn): `RESEARCH_SOTA.md` — ưu tiên trên Iris Xe: lightmap + probe SH cho vật động + cubemap parallax cho thép + đèn pin cookie/PCF; WebGPU thử riêng (TRAA/TAAU, GTAO, SSR hoặc sương theo chùm đèn). Lưu ý: KHÔNG dùng nguyên `bakedPBR` của realify (tắt khuếch tán trực tiếp → đèn pin mất tác dụng).
- 28/11 chiều: nướng lại CẢ 6 mô-đun trên server LAN có GPU (RTX A4000, CUDA — OptiX lỗi với driver 535): 2048 mẫu, lightmap 1024–2048 px, tổng ~2,5 phút (laptop: ~25 s cho 128 mẫu / mô-đun). Kết quả trong `public/world/archive/` + `_scales.json`. Lưu ý: UV lightmap của `mod_shelf` xếp kém (nhiều đảo tí hon) → vòng sau xếp lại / nướng AO vật nhỏ vào màu đỉnh.
- Còn: → xuất GLB (texture WebP 1K, UV1 cho lightmap) → cảnh three.js (bộ sinh ô tất định + InstancedMesh
  mỗi mô-đun + lightMap channel 1, đèn pin có bóng mềm, sương, GTAO, AgX + LUT, hạt phim; tắt viền mực) → lối vào từ
  Thế giới Bất Khả → thử WebGPU riêng cảnh này + đo.

- 28/11 tối (đưa vào game, bản đầu — CHƯA kiểm bằng mắt xong):
  - Sửa cửa sổ vòm sảnh trong `archive.blend` (xoá 6 mặt chắn, thêm mặt dày ô cửa; bản trước khi sửa: `archive.before-window-fix.blend`).
  - Xuất GLB bằng Blender chạy nền (`blender -b … --python export.py`, script ở scratchpad): `public/world/archive/archive.glb` (~1,5 MB, mô-đun + sảnh, UV0 vật liệu + UV1 lightmap). Sảnh: bỏ tường đầu cũ (cửa đôi đóng) → tường mới có lối 4 m khớp một ô; mở UV lightmap, nướng lại trên server GPU (2048², 1024 mẫu, ~24 s) → `lm_arch_hall.webp`. Bản `.blend` phụ để nướng: `blender-src/archive_export.blend`.
  - Texture 1K WebP (`public/world/archive/tex/`, ~3,8 MB; phép Mix của Blender nướng sẵn vào ảnh màu) + lightmap WebP (~0,8 MB; PNG gốc chuyển sang `blender-src/archive-lm/`). Tổng `public/world/archive` ≈ 6 MB. Ghi công Poly Haven CC0 trong `public/world/CREDITS.md`.
  - Bố cục thuần + test: `lib/world/archiveLayout.ts`, `tests/world/archiveLayout.test.ts` (tất định, hành lang lưới i≡0/j≡0 mod 3 luôn mở, loang từ chỗ xuất hiện tới mọi ô mở 13 × 13 kể cả khi phòng đổi epoch, va chạm tường / cửa / cột / kệ / sảnh, máy quay dừng trước tường, chỉ đổi ô phòng xa sau lưng).
  - Cảnh `archive` (`components/world/scene/archive/ArchiveScene.tsx`): InstancedMesh mỗi (mô-đun × vật liệu), lightmap kênh 1 (`lightMapIntensity` = thang × π), bề mặt nướng bỏ ánh sáng môi trường thời gian thực (vá shader) → bán cầu chỉ chiếu nhân vật (probe theo ô đang đứng); đèn pin SpotLight bóng PCF + cookie; sương mũ ~0,065 dày / lạnh dần theo độ sâu; đèn huỳnh quang chập chờn theo màu instance; kim loại phản chiếu cubemap chụp một lần (PMREM). Hậu kỳ riêng `ArchivePost.tsx` (N8AO nửa độ phân giải, bloom, AgX, hạt phim, viền tối, SMAA; không viền mực).
  - Đăng ký: `SceneId` thêm `archive`, `WorldClient` (cảnh, chỗ xuất hiện, hậu kỳ riêng, bỏ Sky / Lights chung), i18n, thẻ chương, bảng màu lỗ sâu, tên HUD. Vào bằng `window.__go("archive")` (bản dev). Về: đứng dưới cửa sổ trăng cuối sảnh, bấm F.
  - Lỗi đã thấy và đã sửa (chưa kiểm lại bằng ảnh): tường đầu sảnh cũ có cửa đôi đóng kín che máy quay → màn đen ở chỗ xuất hiện.
- Còn:
  - Kiểm bằng mắt + chụp ảnh (sảnh, hành lang, lối kệ, cửa SCP, ô tối có đèn pin, so sánh với cảnh toon) và đo `__perf` trong cảnh (lần đo đầu: 160 lệnh vẽ, 640k tam giác, 32 lượt render mỗi khung — vượt ngân sách, cần tìm nguồn: bóng đèn pin vẽ lại kệ 12,4k tam giác, N8AO + bloom).
  - Cửa vào từ sân Bất Khả: đã có `ArchiveDoor.tsx` + `GATE` / `gateBlocked` trong `archiveLayout.ts` nhưng CHƯA gắn vào `Impossible.tsx` (gỡ ra vì chưa kiểm vị trí) — gắn lại: render `<ArchiveDoor />` trong Court, `gateBlocked` trong impBlocked, cổng `archive` trong impNearby (WorldClient đã có chỗ xuất hiện khi trở về).
  - Giảm tam giác kệ (decimate hoặc LOD), chỉ cho kệ gần đổ bóng; âm nền (tiếng ù huỳnh quang); thử WebGPU.

- 29/11 (nối vào game + kiểm bằng trình duyệt thật — Chrome headless qua CDP, GPU Iris Xe, ANGLE D3D11, 1094 × 615, mức "mid"):
  - Cửa hầm SCP (`ArchiveDoor.tsx`) đã gắn vào sân Thế giới Bất Khả ở mép đông (x 18,2; z −1,5; mặt quay về tâm sân), có va chạm (`gateBlocked`), nhắc "Mở cửa hầm (Thư khố bỏ hoang)" / "Open the vault door…", bấm F → lỗ sâu → Thư khố. Về: đứng dưới cửa sổ trăng cuối sảnh, F → xuất hiện trước cửa hầm ở sân (đã kiểm cả hai chiều).
  - Màn đen ở chỗ xuất hiện: ĐÃ HẾT (nguyên nhân: tường đầu sảnh cũ có cửa đôi đóng kín che máy quay; đã thay bằng tường có lối 4 m + nướng lại lightmap sảnh). Mép cửa sổ ô lộ nền xanh của trang → nền cảnh = màu sương (cùng một Color), sương dày hơn (0,085).
  - Hiệu năng: kệ thép giảm 12,4k → 3,7k tam giác (Decimate collapse giữ đường nối UV); chỉ kệ trong 3 × 3 ô quanh người chơi đổ bóng đèn pin (InstancedMesh riêng); cửa sổ ô 11 × 11 → 9 × 9; bloom mipmap 4 mức. 32 lượt render / khung KHÔNG phải probe hay cubemap (cubemap chụp đúng một lần khi gắn cảnh): mức "low" (không hậu kỳ) chỉ 2 lượt — phần còn lại là các lượt toàn màn hình của N8AO / bloom / SMAA; giờ còn 24.
  - Đo `window.__perf(4000)` khi đã ở hẳn trong cảnh (scene = archive, đứng trong hành lang / ô tối): ~41 FPS, CPU ~22 ms, GPU ~11 ms, 139–152 lệnh vẽ, ~305k tam giác. Riêng môi trường Thư khố ≈ 32 lệnh vẽ, ~93k tam giác (tắt hết nhóm perf:ar_* còn 115 lệnh / 219k tam giác — là nhân vật VRM, hiệu ứng chung và các lượt hậu kỳ, có ở mọi cảnh). Mức "low": 60 FPS, 77 lệnh vẽ, 175k tam giác, 2 lượt render. → Tam giác đạt ngân sách (≤ 400k); lệnh vẽ toàn khung vượt 60 do phần chung của game, không phải do Thư khố.
  - Ảnh: `shots/00-impossible-door.jpg`, `01-entrance.jpg`, `02-corridor.jpg`, `03-shelf-aisle.jpg`, `04-scp-door.jpg`, `05-dark-flashlight.jpg`.
- Còn:
  - Ô "tối" vẫn khá sáng (lightmap nướng với các ô hàng xóm sáng) và vệt đèn pin chưa nổi rõ → tăng cường độ đèn pin / giảm lightmap ô tối, thêm ảnh so trước / sau với cảnh hoạt hình.
  - CPU ~22 ms/khung ở mức mid (giới hạn FPS): cân nhắc tắt N8AO mặc định ở mức mid trên máy này, gộp vật liệu cửa hầm (6 lệnh vẽ).
  - Âm nền (ù huỳnh quang), thử WebGPU.
