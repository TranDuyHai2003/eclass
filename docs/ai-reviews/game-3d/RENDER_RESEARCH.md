# Nghiên cứu kỹ thuật render — nước, cel shading, modeling, tối ưu (27/11/2026)

Nguồn chính: brainstorm với ChatGPT (web, chế độ High). ChatGPT đã tổng hợp các chia sẻ công khai sau:
- miHoYo / HoYoverse:
  - GDC 2021 "Genshin Impact: Crafting an Anime Style Open World"
  - Unite 2017 / Unite Beijing 2018 (Honkai Impact 3rd)
  - Unite 2020 (Genshin, từ mobile lên console)
- Hypergryph:
  - phỏng vấn GCORES về Arknights: Endfield
  - Unite Seoul 2026 (ECS, render graph, batching)
- Các studio khác:
  - Valve, "Water Flow in Portal 2" (SIGGRAPH 2010)
  - LIGHTSPEED, Photon Water System (GDC 2023)
  - NVIDIA GPU Gems: "Effective Water Simulation from Physical Models"; ch. 38 "Fast Fluid Dynamics" — nền của mô phỏng PavelDoGreat
  - Crest Ocean
- Bài báo:
  - Jeschke & Wojtan, Water Wave Packets (2017)
  - Water Surface Wavelets (SIGGRAPH 2018)
- Bản tái hiện cộng đồng:
  - Firefly-Render-Three (NPR Star Rail trên three.js)
  - StarRailNPRShader, HoyoToon
  - các bài reverse-engineering nước / thác Genshin (RenderDoc)
  - three-stylized-water

Lưu ý: ChatGPT tự nói rõ các thông số bên dưới là preset đề xuất, không phải thông số nội bộ của HoYo.

## Nước (đã áp dụng — `components/world/fx/water.ts`, `scene/HubWater.tsx`)
- **Pháp tuyến 4 lớp.** Ba lớp normal map lặp:
  - macro 5 m, tốc độ (0,013; 0,009), cường độ 0,07;
  - medium 1,4 m, tốc độ (−0,026; 0,018), cường độ 0,12;
  - micro 0,32 m, tốc độ (0,045; −0,031), cường độ 0,045.

  Lớp thứ tư là trường sóng mô phỏng × 0,65. Phản xạ chỉ dùng macro + medium; lấp lánh mới dùng micro.
- **LUT độ sâu:** #D5F8EF (0 m) → #A1EBDD (0,08 m) → #65D5D5 (0,25 m) → #37B4CC (0,5 m) → #218BAE (0,8 m).
- **Fresnel:** F0 0,025, mũ 4, phản xạ × 0,75, độ bão hoà phản xạ 0,9. Phản chiếu mặt phẳng 384² cập nhật 20 Hz (Siêu: 768²); điện thoại yếu dùng cubemap hoặc trời.
- **Specular 3 tầng:**
  - ánh rộng: mũ 48, cường độ 0,12;
  - điểm gắt: mũ 384, cắt ngưỡng 0,35;
  - lấp lánh: mặt nạ nhiễu 0,72–0,84, chỉ phủ 1–3 % mặt nước.
- **Bọt:** SDF giải tích của thành hồ — một vạch mảnh liền cộng một dải đứt đoạn bên ngoài.
- **Caustics:** texture có cấu trúc hữu cơ (không dùng Voronoi đều), 2 lớp 1,3 m / 0,9 m, lấy min, mũ 1,3, cường độ 0,35, chiếu theo tia nắng khúc xạ xuống đáy.
- **Tia phun, màn tràn, thác:** dùng MESH + texture vệt chảy; hạt chỉ cho giọt tách ra hoặc văng.
  - Tia: ống 32–48 đoạn × 8 cạnh, lõi #9DDFEA, sáng #F0FCFF.
  - Màn tràn: 48–64 × 6–10 đoạn, bán kính lượn ±1–3 cm.
  - Splash và hơi nước dùng alpha blend, không cộng sáng (cộng sáng làm nước trông như phép thuật).
- **Lội nước:**
  - Gợn theo nhịp bước 1,5–2,5 Hz.
  - Giọt văng: đi bộ 4–8 giọt/bước, chạy 10–16, nhảy xuống 24–48.
  - Nhân vật ướt 15–35 s: albedo × (0,72; 0,79; 0,85), độ nhám → 0,22.
  - Vệt sóng sau lưng (wake): nửa góc 20–35°.
- **Ngân sách cho điện thoại khá (60 FPS):**
  - mặt nước 1,3 ms; phản chiếu 1,5 ms; VFX nước 0,7 ms; mô phỏng 0,2 ms;
  - 400–600 hạt;
  - mô phỏng 30–60 Hz.

## Cel shading / modeling / tối ưu — 10 việc ưu tiên (theo ChatGPT)
1. **Sửa pipeline ánh sáng.** Chỉ nướng ánh sáng gián tiếp; nắng trực tiếp tính thời gian thực, kèm bóng đổ. Bỏ IBL khuếch tán bị tính trùng. Cách này cũng là nền cho chu kỳ ngày đêm.
2. **Môi trường dùng stylized PBR** (không dùng MeshToon):
   - cẩm thạch: độ nhám 0,45–0,65;
   - vàng: độ nhám 0,22–0,38, kim loại 0,85–1;
   - gỗ: độ nhám 0,6–0,8.
3. **Modeling:**
   - vát cạnh: cột 2–6 cm, thành hồ 1,5–3,5 cm, bậc 0,8–2 cm;
   - weighted normals;
   - trim sheet;
   - phân cấp hình khối.
4. **Tán cây:**
   - 12–24 cụm lá, mỗi cụm 12–24 thẻ lá 0,25–0,55 m;
   - pháp tuyến hướng về tâm của từng cụm;
   - tán xạ xuyên lá;
   - gió 3 tầng (cành 0,2–0,4 Hz, cụm 0,4–0,8 Hz, lá 1,5–2,5 Hz);
   - alphaTest 0,5;
   - LOD: 3–6 nghìn → 1–2 nghìn → 200–500 tam giác → impostor.
5. **Nhân vật VRM:** ramp atlas 256×8 theo vật liệu; bóng mặt bằng SDF điều khiển theo xương đầu.
6. **Bóng đổ:**
   - shadow map bám người chơi (1024² trên điện thoại, 2048² trên máy tính), snap theo texel;
   - lighting volume cho nhân vật khi đi dưới vòm, dưới tán cây, cạnh hồ.
7. Nước: các lớp như trên.
8. **Viền:**
   - nhân vật: inverted hull, độ dày theo vertex color, smooth normal riêng;
   - môi trường: hậu kỳ có mặt nạ, chỉ làm tối màu (× 0,52, độ đậm 0,2–0,45); tắt trên nước, cây lá, hạt;
   - rim theo độ sâu ở mức cao.
9. **Tối ưu:**
   - chia cảnh thành khối 8–16 m, InstancedMesh, LOD;
   - KTX2 (ETC1S / UASTC), Meshopt;
   - khoảng 8 họ shader, 15–30 chương trình;
   - biên dịch trước bằng compileAsync.
10. **Grading:**
    - AgX hoặc Neutral;
    - độ tương phản 1,03–1,08, độ bão hoà 1,03–1,10;
    - bloom 0,12–0,25;
    - độ phân giải động.

**Ngân sách toàn cảnh:**
- Điện thoại khá: 600 nghìn tam giác, 120–180 lệnh vẽ, texture 192–256 MiB.
- Máy tính: 1,5 triệu tam giác, 200–400 lệnh vẽ.

## Số đo thực tế (công cụ `window.__perf` — PerfProbe)
- Quảng trường, bản đầu: 337 lệnh vẽ; 1,2 triệu tam giác; GPU 21 ms.
- Phản chiếu mặt phẳng vẽ lại cả cảnh: tắt đi còn 165 lệnh vẽ và 0,6 triệu tam giác.
- Cỏ: khoảng 540 nghìn tam giác (tính cả lượt phản chiếu).
- Cây: khoảng 160 nghìn tam giác.
- Đã sửa:
  - phản chiếu chỉ còn layer 0, 384², 20 Hz, tắt MSAA;
  - sàn: fbm 5 tầng ở mỗi điểm ảnh → texture nhiễu nướng sẵn.

## 2026-11-27 — Nước tương tác v2, cỏ kiểu Genshin, siêu thực kiểu Endfield (nghiên cứu Codex, `--search`)

### Nước tương tác (Quảng trường)
- Chẩn đoán: giọt 1,5–4,5 cm chỉ 2–6 px ở 5 m; bọt lấy ngưỡng |vận tốc| của lưới 11,6 cm nên vành sóng lan không bao giờ vượt ngưỡng.
- Đã làm:
  - **Bộ đệm bọt GPU 256²** (`FoamSim`): trôi theo độ dốc sóng + dòng xoáy quanh tượng, nửa đời 1,1 s. Nhận dấu từ bước lội (mỗi 0,22 m, có hai dấu lệch sau lưng), cú đáp, tia rơi, nhát chém, mũi kiếm quét nước.
  - **8 vòng gợn giải tích** trong shader nước: r0 0,2 m, lan 2 m/s, dải 10–16 cm, vòng thứ hai trễ 0,12 s, vành bị nhiễu cắt thành đoạn. Chuỗi vòng từ người chạy tự tạo wake chữ V (Yuksel wave particles).
  - **Vương miện, cột nước, màn chém** (`fx/splash.ts`): mesh instanced, chuyển động hoàn toàn trong vertex shader. Độ mạnh `s = clamp((v−2)/5, 0, 1)`.
  - Giọt chính 5–9 cm có viền sẫm. Nền giảm 40% pháp tuyến ở vùng nhiễu động; bọt dày giảm phản xạ.
- Lỗi tìm ra khi kiểm tra: `recalc_face_normals` lật đáy và thành lòng hồ ("bát hở"), nên three cull mặt sau và người chơi nhìn xuyên xuống đá đáy đảo (các mảng nêm xanh sẫm). Đã sửa trong `hub_bake.py` và xuất lại GLB.
- Chi phí: cả nước (gồm phản chiếu) khoảng 1,6 ms GPU. Khung hình đang bị giới hạn bởi CPU (lượt vẽ lại phản chiếu).

### Cỏ (Genshin / Ghost of Tsushima)
- `lib/world/hubGrass.ts` (+ test):
  - phân bố theo cụm và mảng dày/thưa;
  - 3 dáng lá; cao 12–32 cm, 7% lá 35–45 cm.
- Shader:
  - lá Bézier 9 đỉnh;
  - **màu gốc = màu nền bồn tại chỗ mọc** (cùng noise texture);
  - pháp tuyến hoà 80→92% về mặt đất;
  - gió 2 lớp, ngọn lệch 6–18% chiều cao (trước đây tới ~150%, nên cỏ nằm rạp);
  - rạp bán kính 1 m; AO gốc 0,82; ánh xuyên lá 0,12.
- Mật độ 12k / 32k / 60k lá. Cỏ chỉ tốn khoảng 0,3 ms GPU.

### Siêu thực (Hư Không Nghịch Lý + Thế giới Bất Khả)
- **Bỏ viền ở mọi mức chất lượng**: nhánh máy yếu trước đây luôn vẽ Ink, nên khi chất lượng tự hạ xuống "low" thì viền vẫn còn.
- Nhân vật VRM:
  - ẩn pass viền MToon;
  - toony 0,95 → 0,3;
  - bóng sâu và lạnh;
  - giEqualization 0,5;
  - rim lạnh ôm silhouette.
- Hậu kỳ:
  - AO 0,5 m;
  - bloom ngưỡng 1,2;
  - bỏ tách màu, hạt phim 0,02;
  - chỉnh màu **sau** AgX, vì trước AgX thì đèn HDR bị đẩy âm, log ra NaN và thành ô đen.
- **Sương theo độ cao** (giải tích, 1 lần đọc depth): y0 −3 m, H 6 m, k 0,012. Lưu ý: trong pass hậu kỳ, `cameraPosition` là camera của quad nên phải truyền `uEye` riêng.
- Màu:
  - bão hoà ×1,22 (HSL);
  - kim loại nhám 0,18, env 1,45;
  - sơn/tấm ốp có clearcoat;
  - sàn sân: ô thoi xanh ngọc + ngà, ron vàng kim loại thật (bổ sắc với trời tím).
