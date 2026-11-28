# Phòng Lăng kính (Prism Hall) — lý thuyết màu trong Thế giới Bất Khả

Ngày 28/11/2026 · agent phụ · làm cục bộ, chưa commit.

## 1. Mục tiêu

Học sinh THPT **tự tay điều khiển** ánh sáng, kính lọc, toạ độ màu và chính mắt mình để hiểu lý thuyết màu thật:
trộn cộng (ánh sáng) và trộn trừ (kính lọc / mực), khối RGB và trụ HSV, vòng màu và phối màu, phổ và giản đồ CIE 1931,
đồng sắc (metamerism), gamma sRGB và ánh sáng tuyến tính, ảo giác màu, mù màu.

Mỗi trạm theo vòng **Đoán → Thao tác → Giải thích** (bài học từ Exploratorium / PhET): nhãn gợi ý đặt câu hỏi trước
("Chặn đèn đỏ thì bóng có màu gì?"), người chơi bấm F để đổi biến số, bảng số hiện phép toán thật.

## 2. Tóm tắt nghiên cứu (ChatGPT web, 28/11/2026, cùng các nguồn nó trích)

| Chủ đề | Kết luận dùng trong game | Nguồn |
|---|---|---|
| Bảo tàng dạy màu thế nào | Để người học **tự gây ra hiện tượng**. Triển lãm mạnh nhất là **Colored Shadows** (3 đèn R, G, B lên tường trắng; người đứng chắn → bóng cyan / magenta / vàng). Thêm Bird in a Cage (ảnh dư, nhìn 15–30 s), What is Color (tương phản đồng thời), Colored Rooms. | exploratorium.edu/exhibits/colored-shadows · annex.exploratorium.edu/xref/exhibits/colored_shadows.html · …/shadow_colors.html · …/colored_rooms.html · exploratorium.edu/exhibits/bird-in-a-cage · annex.exploratorium.edu/colorfest/whatiscolor.html |
| PhET Color Vision | Đèn R, G, B chỉnh được, kính lọc, chế độ photon. Mục tiêu: đoán màu nhìn thấy từ tổ hợp đèn, đoán ánh sáng nào qua kính lọc. | phet.colorado.edu/en/simulations/color-vision |
| Ngộ nhận cần nhắm | "Đỏ + lục = vàng" chỉ đúng với **ánh sáng**. Với sơn, kết quả thường là nâu xỉn, tuỳ phổ hấp thụ. "Ba màu cơ bản là RYB" chỉ là quy ước của hoạ sĩ. Có nhiều hệ: RGB (cộng), CMY(K) (trừ), RYB (truyền thống). Lăng kính **tách** màu có sẵn chứ không tạo ra màu. | (tổng hợp) |
| Mô hình vật lý | Ánh sáng cộng **phổ**: S = ΣSᵢ. Khi đã ở linear RGB thì C = Σαᵢ·Cᵢ. Kính lọc **nhân phổ**: S·T₁·T₂. Nhân màu RGB của từng kính chỉ là xấp xỉ. Sơn đục dùng Kubelka–Munk K/S = (1 − R∞)²/(2R∞) (ghi chú, chưa làm). | CIE, Dichter 2023 (JAIC 277) |
| HSV / HSL | Là phép đổi toạ độ lục giác của khối RGB, **không** đều về cảm nhận. Công thức chuẩn max / min / Δ. Sắc độ của màu xám không xác định. | W3C CSS Color 4 |
| Phối màu | Phải chọn vòng: HSV (ánh sáng), RYB (hoạ sĩ), **OKLCH** (cảm nhận, độ sáng đều). Đối của đỏ là cyan trên HSV, là lục trên RYB. | bottosson.github.io/posts/oklab · w3.org/TR/css-color-4 |
| CIE 1931 | x = X/(X+Y+Z). Màu cơ bản sRGB R(0,64; 0,33), G(0,30; 0,60), B(0,15; 0,06), D65 (0,3127; 0,3290). Màu ngoài tam giác thì **ghi là không hiển thị được**, không âm thầm cắt. Biên dưới của móng ngựa là đường tía (hỗn hợp, không phải bước sóng). | registry.color.org/rgb-registry/srgb · cie.co.at datatable (CMF, spectral locus) |
| Đồng sắc | Hai phổ khác nhau có thể cho cùng XYZ, ví dụ vàng 580 nm và đỏ + lục. | |
| Ảnh dư | Nhìn chăm chú 15–30 s rồi nhìn sang nền trắng. Ảnh dư thiên về màu đối lập. **Không** giả lập bằng (1 − RGB) trên màn hình: để mắt người chơi tự thấy. | Exploratorium Bird in a Cage |
| Tương phản / hằng sắc | Hai ô xám giống hệt trên nền vàng / lam trông khác nhau. Cho người chơi "hút màu" để thấy số giống nhau, rồi đổi nền. | Adelson checker-shadow · Exploratorium |
| Gamma | Mọi phép trộn làm trên linear. 0,5 sRGB = 0,214 tuyến tính. | IEC 61966-2-1 |
| Mù màu | Machado–Oliveira–Fernandes 2009, ma trận mức 1,0 nhân trên linear RGB (protan / deutan / tritan). Brettel–Viénot–Mollon 1997 là phương án LMS. Mô phỏng chỉ là công cụ minh hoạ. | Machado 2009 (IEEE TVCG) · vision.psychol.cam.ac.uk (Brettel 1997) |
| WebGL | Ba đèn: **một shader sàn** cộng 3 đóng góp (không hoà trộn trong suốt, không lo thứ tự vẽ). Không kẹp từng đèn trước khi cộng. Bóng màu: **mặt nạ che riêng cho từng đèn**, không cần shadow map; vật chắn đơn giản dùng hình chiếu giải tích. Kính lọc dùng phép nhân. Phổ lăng kính tính theo Cauchy / Snell + CMF, không dùng bảng "bước sóng → RGB" phổ thông. | (ChatGPT, mục 18–22) |

Phát hiện riêng khi đọc code: hậu kỳ của game là **Khronos PBR Neutral** (`WorldClient.tsx`, `ToneMapping` NEUTRAL; chế độ
siêu thực dùng AgX). Neutral gần như đồng nhất khi đỉnh < 0,76, nhưng nén vùng sáng và trừ một chút ở vùng tối. Vì vậy
trắng 1,0 không ra đúng trắng. Các màn hiển thị màu của phòng xuất `neutralInverse(d)` (nghịch đảo chính xác, có test) để
màn hình hiện **đúng** màu dự định d. Chế độ AgX chưa nghịch đảo (rủi ro ghi ở §8).

## 3. Vị trí và kiến trúc phòng

- Gắn vào **vòm tầng lửng 90°** của phòng Siêu khối (`tess_veil_observatory` trong `tess_room.glb`, x 13,7…14,6, |z| < 1,2,
  y 5…8). Trước đây chỗ này để dành cho "Góc quan sát". Kính viễn vọng / thấu kính hấp dẫn có thể làm sau ở chỗ khác.
- Sàn y = 5, trần y = 10,2. Hình chữ L: **cổ phòng** x 14,7…20,6, z −8,2…1,8 và **sảnh chính** x 14,7…27,4, z −21,4…−8,2.
  Test khẳng định mọi điểm sàn cách tâm Thiên văn đồ hơn 7,6 m (vỏ ngoài 7,3) và nằm ngoài vòng tường chính r 14.
- Va chạm / mặt đất / máy quay: `lib/world/tessRoom.ts`. `onUpper` gồm cả sàn phòng. `roomNav.elevated` bật khi ở
  trong phòng. `roomBlocked` dùng `prismHallBlocked` (tường, bệ, trụ sân khấu, hộp đèn, lăng kính, màn phổ).
  `insideRoomVolume` thêm khối phòng và khe vòm.
- Hiển thị: nhóm phòng chỉ hiện khi người chơi ở x cục bộ > 11,5 và y > 3,8 (đứng trên tầng lửng gần vòm hoặc trong phòng).
  Thiên văn đồ tự ẩn khi người chơi ở trong Phòng Lăng kính, nên không tốn lệnh vẽ.

## 4. Các trạm (bấm F ở bệ)

| # | Trạm | Thao tác (F) | Toán / khoa học hiện ra | Thử thách → phần thưởng |
|---|---|---|---|---|
| a | **Sân khấu ánh sáng RGB + bóng màu** (sàn trắng Ø5, 3 đèn treo 4,4 m, trụ trắng giữa) | 3 bệ R / G / B: 1 → ¾ → ½ → ¼ → 0 | C = r·(1,0,0) + g·(0,1,0) + b·(0,0,1). Vùng chồng: vàng, cyan, magenta, trắng. **Bóng của chính người chơi và của trụ**: mỗi đèn có mặt nạ che riêng (giao tia–trụ giải tích trong shader). Chặn đèn đỏ thì bóng có màu G + B = cyan. Bảng số còn cho mã sRGB (50 % ánh sáng = mã 188, không phải 128). | Pha đúng 3 / 6 màu mục tiêu ở vùng giữa → mở Ghi chép "Ánh sáng cộng" |
| b | **Đèn chiếu qua kính lọc CMY** (hộp đèn trắng → 3 kính → màn tường đông) | 3 bệ C / M / Y: đưa kính vào / rút ra | Phổ ra = S(λ)·T_C(λ)·T_M(λ)·T_Y(λ), quy ra XYZ (CMF) rồi sRGB. 3 kính đặt lệch nhau thành giản đồ Venn: C·Y = lục, M·Y = đỏ, C·M = lam, cả ba ≈ đen. Bảng số so **kết quả phổ** với **"lối tắt RGB"** (nhân màu từng kính) để thấy chúng lệch nhau. Có dòng nhắc: sơn đỏ + lục ra nâu. | Tạo đúng lục / đỏ / lam / đen ở đốm giữa → mở Ghi chép "Trộn trừ" |
| c | **Khối RGB / đĩa HSV đi bộ** (sàn 3 × 3 m + mạng 5³ khối nhỏ lơ lửng = khối RGB) | lát G (V) 0 → ¼ → … → 1 · chế độ RGB ↔ HSV · mục tiêu mới | Vị trí của bạn **là** màu: x → R, z → B, lát → G. Ở chế độ HSV: góc → H, bán kính → S, lát → V. Đọc số (R,G,B) · #hex · H S V. Đường chéo đen → trắng là trục xám. | Tìm 3 màu mục tiêu (ΔE_OKLab < 0,045) → mở Ghi chép "Không gian màu" |
| d | **Vòng hoà sắc** (đĩa Ø2,4 trên tường tây + 4 đèn lồng nhuộm màu theo bộ phối) | sắc gốc +30° · kiểu phối (bù / bù chia / bộ ba / tương đồng / vuông) · vòng HSV ↔ RYB ↔ OKLCH | Các góc H + {0, 180}, {0, 150, 210}, {0, ±120}, {±30}, {0, 90, 180, 270}. Ở vòng HSV, hai màu bù cộng lại = (1,1,1). Đổi vòng thì "màu bù của đỏ" đổi từ cyan (ánh sáng) sang lục (hoạ sĩ). OKLCH giữ độ sáng đều. | Xem đủ 3 vòng → mở Ghi chép "Vòng màu" |
| e | **Tường ảo giác** | "Nhìn chăm chú 15 s" · "Hút màu / đổi nền" | Ảnh dư: cờ **nền lam lục, sao lam** + dấu ngắm, đếm 15 s, rồi tường thành trắng: mắt thấy **cờ đỏ sao vàng**. Cơ chế đối lập Hering. Tương phản đồng thời: 2 ô xám #808080 giống hệt trên nền vàng và nền lam. F hiện mã số và tráo nền. | Làm cả hai → mở Ghi chép "Mắt không phải máy đo" |
| f | **Phòng tối Newton + giản đồ CIE** (tia nắng qua lỗ tường tây → lăng kính BK7 → dải phổ trên màn; giản đồ xy trên tường bắc) | Đầu dò bước sóng 450 … 650 nm · kính mô phỏng mù màu (thường / protan / deutan / tritan) | n(λ) = 1,5046 + 0,0042/λ²; tím lệch nhiều hơn đỏ. Giản đồ có móng ngựa, đường tía, tam giác sRGB, D65 và các chấm sống: màu đang pha ở sân khấu, đốm kính lọc, chỗ bạn đứng ở khối RGB. Vùng ngoài tam giác được gạch chéo và ghi "màn hình không hiện được". **Đồng sắc**: vàng 580 nm cạnh hỗn hợp đỏ 630 + lục 532 (cùng xy, cùng Y). Kính mù màu áp ma trận Machado lên mọi màn hiển thị của phòng. | Thử cả 3 kiểu mù màu → mở Ghi chép "Phổ, CIE và mù màu" |

## 5. Logic thuần + test

`lib/world/colorTheory.ts` (không three.js) và `tests/world/colorTheory.test.ts`. Các test kiểm:

- sRGB ↔ tuyến tính khứ hồi; 0,5 → mã 188.
- HSV / HSL khứ hồi trên 300 màu ngẫu nhiên; 6 đỉnh lục giác.
- Phối màu (bù, bộ ba, tương đồng, bù chia); bù + gốc = trắng với mọi H.
- RYB: đỏ ↔ lục, vàng ↔ tím.
- CIE: xy của R, G, B, D65 khớp chuẩn; đường phổ (xấp xỉ giải tích Wyman–Sloan–Shirley 2013) khớp bảng CIE ở 450 / 520 / 580 / 650 nm; màu phổ hiển thị có sắc độ đúng.
- Sân khấu: tổng vectơ, các vùng Venn, bóng màu cyan khi trụ chặn đèn đỏ, giao tia–trụ.
- Kính lọc: C·Y lục, M·Y đỏ, C·M lam, CMY gần đen; kết quả phổ khác lối tắt RGB.
- Đồng sắc: 580 nm ≈ 630 + 532 nm (|Δxy| < 0,008, cùng Y).
- OKLab: trắng L = 1; OKLCH khứ hồi; vòng OKLCH có L đều, vòng HSV thì không.
- Mù màu: mọi ma trận giữ trắng; đỏ và lục ô liu trùng sắc khi mô phỏng protan / deutan.
- Ảnh dư của cờ lam lục là cờ đỏ sao vàng.
- `neutralInverse`: chính xác khi đỉnh ≤ 0,76 và với xám tới 0,98; sai số < 0,02 với màu bão hoà tới 0,85.
- Khối / đĩa: góc khối = đen / trắng, mọi mục tiêu tới được.
- Lăng kính: tím lệch hơn đỏ; δ_min = 2·asin(n·sin 30°) − 60°.
- Phòng: không chồng Thiên văn đồ hay phòng chính; mọi bệ trong phòng, có va chạm, với tới được, không đè nhau.
- `tests/world/tessRoom.test.ts`: đi từ tầng lửng 90° qua vòm vào phòng; tường chặn; máy quay ở trong phòng.

## 6. Kết xuất và ngân sách

- Mọi màn màu trong **một ShaderMaterial "uber" duy nhất**, một lưới gộp nhiều tấm phẳng. Thuộc tính `aKind` chọn trạm:
  sàn sân khấu, màn kính lọc, sàn khối, đĩa vòng màu, tường ảo giác, màn phổ, giản đồ CIE. Kết quả là **1 lệnh vẽ** cho 7 màn.
  Trộn làm trên linear, nhân ma trận mù màu, rồi `neutralInverse`, xuất `toneMapped: false`.
- Vỏ + đạo cụ tĩnh: GLB nướng, gộp 1 lệnh vẽ. Không dùng đèn three.js nên không phải biên dịch lại.
- Phần phát sáng (nút, thấu kính, đèn lồng — màu qua mảng `uGlow`): 1. Chùm sáng giả thể tích (cộng): 1. Kính lọc: 1
  InstancedMesh. Mạng khối RGB: 1 InstancedMesh (125). Tổng **6 lệnh vẽ, ~24 nghìn tam giác**.
- Không có bóng động. Bảng số và chấm CIE cập nhật 4 lần/giây.
- Cấp chất lượng: chất lượng thấp bỏ chùm sáng thể tích.
- Đo trên trình duyệt (máy đang tải nặng, nhiều agent): trong phòng tổng cảnh 97–108 lệnh vẽ, GPU ≈ 10 ms, 22 FPS (nghẽn
  CPU do máy). Đứng trên tầng lửng nhìn vào vòm: 156–161 lệnh vẽ, GPU ≈ 10–11 ms.

## 7. Mô hình Blender

**Đã dựng bản đầu** (28/11, trước khi phiên chính lấy lại Blender): collection `COLOR_ROOM` trong `blender-src/hub_props.blend`,
script scratchpad `color_build.py` (dùng helper `vault_build.py`), nướng bằng `room_bake.py` (5 đèn vùng ấm ở trần, 1 đèn
điểm cyan ở vòm, `glow_ph_warm` phát sáng 6), thu gọn bằng `glb_slim.py`. Kết quả: `public/world/props/prism_hall.glb`
521 KB, 2 node `ph_shell` + `ph_props`, 16 vật liệu `ph_*` / `glow_ph_warm`. Trong code, mọi lưới GLB **gộp thành một lưới**
(albedo thành thuộc tính đỉnh, cùng công thức giải nén như `fx/baked.ts`), nên chỉ tốn 1 lệnh vẽ. Các phần đổi màu theo
trạng thái (nút bệ, thấu kính đèn, đèn chiếu, lỗ cửa chớp, thân đèn lồng) vẫn là hình code phát sáng.

Gốc toạ độ = gốc phòng Siêu khối, mét, +y lên.

| Node | Nội dung | Vật liệu |
|---|---|---|
| `ph_shell` | Sàn chữ L (lưới 0,8 m cho màu đỉnh) + viền đồng âm sàn; tường mận ốp tấm; chân tường gỗ 0,22; nẹp đồng y 0,9; trụ áp tường mỗi ~2,4 m (né các màn); gờ trần + dải hắt sáng; trần ô dầm; má / lanh tô / khung vòm 90° | `ph_floor`, `ph_floor_b`, `ph_wall`, `ph_wall_l`, `ph_wood`, `ph_brass`, `ph_brass_d`, `ph_ceil`, `glow_ph_warm` |
| `ph_props` | 16 bệ tiện (đế loe, thân thuôn, mũ sơn mài, vành đồng); viền sân khấu + trụ trắng đổ bóng; giàn tròn + 3 đèn Fresnel (vòng tản nhiệt, chạc chữ U); máy chiếu trên bàn gỗ + ống kính + giá kính; khung màn kính lọc, 2 khung tranh ảo giác, khung CIE; vành vòng màu 12 núm; màn phổ gỗ có chân; chân đồng + lăng kính tam giác; tấm lỗ cửa chớp; khung khối RGB; chụp + dây 4 đèn lồng | `ph_brass`, `ph_brass_d`, `ph_lacq`, `ph_white`, `ph_iron`, `ph_wood`, `ph_glass` |

Còn nên làm khi Blender rảnh: lăng kính kính thật (vật liệu `glass_*` có khúc xạ giả), đèn Fresnel chi tiết hơn (cánh
chắn sáng), đèn lồng giấy kiểu Hội An có nan, biển tên đồng cho từng trạm, NPC hướng dẫn (VRM + chân dung Codex).

Ảnh 2D (Codex, chưa làm): biểu tượng 6 trạm và minh hoạ cho 4 trang Ghi chép (đĩa Newton, Venn RGB / CMY, móng ngựa CIE,
cờ ảnh dư). Nguồn để ở `blender-src/color-src/`.

## 8. Rủi ro

- **AgX (chế độ siêu thực)**: chưa nghịch đảo, nên màu ở các trạm hơi nhạt và lệch. Số trên bảng vẫn đúng. Hướng xử lý:
  thêm nghịch đảo AgX, hoặc tạm dùng Neutral khi ở trong phòng.
- Hậu kỳ `HueSaturation +0.04` và `BrightnessContrast +0.03` (cấp chất lượng cao) làm lệch màu rất ít, khoảng 1–3 %.
- Viền mực (Ink) vẽ trên mép các màn. Chấp nhận được.
- Ảnh dư phụ thuộc người xem. Trang ghi chép nói rõ điều này. Không giả lập ảnh dư trên màn hình.
- Chưa có NPC dẫn đường. Mô hình Blender mới là bản đầu (§7).
- Nhãn DOM của phòng chỉ hiện khi phòng hiện.
