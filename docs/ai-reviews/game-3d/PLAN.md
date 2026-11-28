# Thế giới Toán 3D — MVP "Thung lũng Hàm số" (26/11/2026)

Nghiên cứu nền: `RESEARCH.md` (cùng thư mục). Công nghệ đã chốt: three.js + React Three Fiber, nhân vật VRM (VRoid), asset Quaternius (CC0), phong cách anime cel-shading (thiết kế riêng — **không** dùng/tái tạo nhân vật, hình ảnh của Genshin/Honkai).

## Mục tiêu MVP
Kiểm chứng 3 giả thuyết với một khu duy nhất:
1. Học sinh **tự phát hiện** quy luật đạo hàm ↔ đồ thị trong sandbox 3D và thấy vui.
2. **Ôn giãn cách ngụy trang thành gameplay** (Sinh vật Hồi âm) kéo học sinh quay lại hằng ngày.
3. Kỹ năng trong game **chuyển được sang đề thi** (Phần I / II / III).

Ngoài phạm vi MVP: realtime nhiều người, chat, co-op, Xưởng đề, boss lớp, cộng xu thật (cần thầy duyệt), các khu khác.

## Quyết định mặc định (đổi được — chưa có trả lời của thầy)
- **Không cộng xu thật.** Phần thưởng MVP = phát hiện, huy hiệu thành thạo, sinh vật được thuần hoá. Không tiền tệ mới.
- Ai vào được: học sinh đã đăng nhập; thầy/admin vào xem được. Demo: chỉ xem (mọi action ghi trả `DEMO_READ_ONLY_MESSAGE`).
- Không đồng hồ đếm ngược ở mọi màn của MVP.
- Phiên chơi gợi ý 15–20 phút; chưa áp giới hạn cứng (chờ ý kiến pháp lý về NĐ 147/2024).

## Trải nghiệm
### Sảnh (Hub) — `/world`
- Quảng trường nổi trên mây, trời gradient, cỏ lay gió, cel-shading + viền + bloom nhẹ. Nhân vật VRM đi lại (WASD / joystick ảo trên điện thoại), camera góc ba.
- Các điểm tương tác (bước vào vòng sáng):
  - **Cổng Thung lũng Hàm số** → chuyển cảnh vào khu.
  - **Bảo tàng Khám phá** → bảng hiện vật (overlay 2D).
  - **Sinh vật Hồi âm hoang dã** (kiến thức đến hạn ôn) lảng vảng quanh sảnh → chạm vào để thuần hoá (2–5 câu biến thể, xen kẽ KC).

### Thung lũng Hàm số (2.5D trong 3D)
- Địa hình là đồ thị f(x) = ax³ + bx² + cx + d; nhân vật trượt theo đường cong, **nghiêng theo độ dốc**; mũi tên tiếp tuyến + bảng "độ dốc" dưới chân; parabol f′ vẽ mờ phía dưới (bật/tắt).
- Thanh trượt a, b, c, d (bước 0,5). Không chấm điểm ở chế độ khám phá.
- **3 phát hiện** (theo thứ tự, mỗi cái mở một năng lực):

| ID | Phát hiện | Cách xác nhận (server chấm) | Năng lực mở |
|---|---|---|---|
| `D_STILLPOINT` | Ở đỉnh/đáy độ dốc bằng 0 | Server phát một đường cong; học sinh **đặt neo** tại mọi điểm cực trị (x gửi lên, sai số ≤ 0,15) | **Neo móc** — bám vào điểm dừng |
| `D_SLOPE_SIGN` | f′ > 0 ⇔ đi lên | Cho bảng dấu f′ của thung lũng bị sương che; chọn đúng các khoảng "đi lên" | **Cảm biến leo** — hiện màu dấu f′ trên đường |
| `D_FLAT_NOT_PEAK` (cú xoắn) | f′ = 0 nhưng không đổi dấu thì không phải cực trị (x³) | Đường cong có điểm uốn nằm ngang; học sinh phải nhận ra neo không bám được (chọn "không có cực trị") | **Kính đổi dấu** — chỉ ra nơi f′ đổi dấu |

- Mỗi phát hiện đi theo nhịp: **thấy khoảng trống** (gờ đá không với tới) → **dự đoán + cược tự tin (1–3)** → thử trong sandbox → xác nhận → **mới hiện tên gọi chính thức** → thẻ bảo tàng.
- Thang gợi ý 4 bậc (quan sát → câu hỏi → dự đoán → trường hợp nhỏ); dùng gợi ý hạ điểm FSRS lần đó.

### Luyện & Sinh vật Hồi âm
- Sau khi xác nhận phát hiện, KC liên quan được **thuần hoá** → sinh vật xuất hiện (hình dạng theo KC).
- **5 KC** của MVP:

| KC | Nội dung | Dạng câu |
|---|---|---|
| `kc.slope_sign` | Khoảng đồng biến/nghịch biến từ f′ (công thức hoặc bảng dấu) | Phần I |
| `kc.extremum_from_fprime` | Cực trị từ f′ đổi dấu (bẫy: nghiệm kép) | Phần I, Phần II |
| `kc.cubic_shape` | Số cực trị của bậc ba theo dấu a và Δ′ = b² − 3ac | Phần I |
| `kc.extremum_value` | Giá trị cực đại/cực tiểu | Phần III (≤ 4 ký tự) |
| `kc.minmax_interval` | GTLN/GTNN trên đoạn (bẫy: quên đầu mút) | Phần III |

- **Khoá 4 chìa (Phần II):** một hàm, 4 mệnh đề a→d tăng dần; điểm 0,1 / 0,25 / 0,5 / 1 theo số mệnh đề đúng.
- Mọi phương án nhiễu gắn **mã ngộ nhận** (`M_FPRIME_ZERO_IS_EXTREMUM`, `M_FORGOT_ENDPOINT`, `M_X_NOT_POINT`, `M_SIGN_FLIP`, `M_DELTA_WRONG`…) → phản hồi gọi tên ngộ nhận + đồ thị phản ví dụ.

## Kiến trúc
### Nguyên tắc an toàn (bài học từ lỗi lộ đáp án ở trang làm bài)
- **Đáp án không bao giờ xuống client.** Server sinh câu từ `(familyId, seed)`, lưu `WorldChallenge`, chỉ gửi đề (văn bản + dữ liệu vẽ). Khi nộp, server **sinh lại từ seed** để chấm.
- Mỗi challenge chỉ nộp được **một lần**, thuộc đúng user, hết hạn sau 2 giờ.
- Phát hiện chỉ được ghi nhận khi server chấm đúng bài xác nhận.

### Thư mục
```
lib/world/
  rng.ts              PRNG có seed (mulberry32), thuần
  cubic.ts            toán hàm bậc ba: f, f′, nghiệm f′, cực trị, bảng dấu, min/max trên đoạn — thuần
  generators.ts       5 họ câu × định dạng (MCQ, TF4, SHORT) + bài xác nhận 3 phát hiện — thuần, có seed
  grading.ts          chấm MCQ / TF4 (thang 0,1/0,25/0,5/1) / SHORT (≤4 ký tự, dấu phẩy thập phân) / neo — thuần
  memory.ts           FSRS (ts-fsrs) theo KC + Elo (Pelánek) — thuần
  kcs.ts              danh mục KC, phát hiện, ngộ nhận (văn bản tiếng Việt)
  service.ts          dùng Prisma: phát challenge, nộp, cập nhật trí nhớ/Elo, ghi phát hiện, đọc trạng thái
actions/world.ts      server actions: auth + demoGuard + gọi service
app/world/page.tsx            server: auth, đọc trạng thái, render client (dynamic, ssr:false)
app/world/preview/page.tsx    CHỈ dev (production → notFound): dữ liệu giả, để kiểm tra hình ảnh không cần DB
components/world/
  WorldClient.tsx     khung: Canvas + overlay UI + máy trạng thái cảnh
  scene/              Sky, Ground/Island, Grass, Portal, Museum, Creature, ValleyTrack, Toon materials, PostFX
  player/             VRM loader, retarget animation Quaternius → VRM, controller (phím + joystick), camera
  ui/                 HUD, ChallengePanel (KaTeX), DiscoveryFlow, Museum, Sliders, Joystick
public/world/         models (.vrm, .glb), textures — đã nén (meshopt/KTX2 khi có thể)
```

### Dữ liệu (Prisma)
```prisma
/// Trí nhớ + năng lực của học sinh theo từng đơn vị kiến thức (KC)
model WorldKnowledge {
  userId     String
  kc         String
  // FSRS
  stability  Float     @default(0)
  difficulty Float     @default(0)
  reps       Int       @default(0)
  lapses     Int       @default(0)
  state      Int       @default(0)      // ts-fsrs State
  lastReview DateTime?
  dueAt      DateTime?
  // Elo
  theta      Float     @default(0)
  eloN       Int       @default(0)
  tamedAt    DateTime?
  updatedAt  DateTime  @updatedAt
  user       User      @relation(...)
  @@id([userId, kc])
  @@index([userId, dueAt])
}

/// Độ khó Elo của từng họ câu (chung cho mọi học sinh)
model WorldItemStat { familyId String @id; difficulty Float @default(0); n Int @default(0) }

/// Một câu đã phát cho học sinh (đáp án KHÔNG lưu — sinh lại từ seed)
model WorldChallenge {
  id String @id @default(cuid()); userId String; familyId String; kc String; seed Int
  context String  // explore | discovery | review | practice
  issuedAt DateTime @default(now()); answeredAt DateTime?
  correct Boolean?; score Float?; confidence Int?; hints Int @default(0); responseMs Int?
  misconception String?; answer Json?
  @@index([userId, issuedAt])
}

/// Phát hiện trong Bảo tàng
model WorldDiscovery {
  userId String; discoveryId String
  stage String          // hunch | confirmed | explained | mastered
  prediction Json?; explanation String?
  firstAt DateTime @default(now()); updatedAt DateTime @updatedAt
  @@id([userId, discoveryId])
}
```
- Sinh vật **không có bảng riêng**: trạng thái tính từ `WorldKnowledge` (chưa thuần / đã thuần / đang mờ R<0,95 / hoang R<0,9).
- `prisma db push` chỉ chạy ở DB local; production cần người dùng duyệt lúc deploy.

### Luồng chấm & cập nhật
1. `requestChallenge({ kc?, mode })` → chọn KC (ôn: KC đến hạn sớm nhất; luyện: KC chỉ định) → chọn họ câu có P(đúng) ≈ 0,75 (luyện) / 0,85 (ôn) theo Elo → seed ngẫu nhiên → lưu → trả đề.
2. `submitChallenge({ id, answer, confidence, hints, responseMs })` → kiểm tra chủ sở hữu, chưa nộp, chưa hết hạn → sinh lại → chấm → điểm FSRS (Sai → Again; đúng + gợi ý/rất chậm → Hard; đúng → Good; đúng + nhanh + tự tin 3 → Easy) → cập nhật FSRS + Elo (học sinh và họ câu) trong một giao dịch → trả kết quả + giải thích + mã ngộ nhận + **lúc này mới trả đáp án**.
3. Lỗi sai khi tự tin 3 → đặt `dueAt` sớm (ưu tiên ôn).

### Hiệu năng & đồ hoạ
- Toon material tự viết (gradient 3–4 bậc + rim light) cho môi trường; MToon cho VRM; viền bằng inverted hull; bloom + vignette nhẹ (`@react-three/postprocessing`).
- Mục tiêu: ≥ 30 fps trên điện thoại tầm trung; tải ban đầu ≤ 15 MB (VRM đã giảm polygon/texture). `dpr` tối đa 1,5 trên điện thoại; tắt hậu kỳ khi fps thấp (`PerformanceMonitor`).
- Màn giải toán là overlay 2D gọn (KaTeX), không có hiệu ứng trang trí.
- Model lớn sau này chuyển lên CDN B2 (hiện để `public/world/`).

## Rủi ro
| Rủi ro | Giảm thiểu |
|---|---|
| Lộ đáp án | Seed + chấm server, đáp án chỉ trả sau khi nộp; test hồi quy kiểm payload đề không chứa đáp án |
| Nộp lại / giả challenge của người khác | Kiểm `userId`, `answeredAt IS NULL` bằng `updateMany` có điều kiện (chống bấm 2 lần) |
| Máy yếu / iOS cũ | `PerformanceMonitor`, bản không hậu kỳ, giới hạn dpr; thông báo khi không có WebGL2 |
| Bản quyền model | Chỉ dùng CC0 (Quaternius) và VRM có giấy phép cho phép dùng thương mại + phân phối trong ứng dụng; ghi nguồn vào `public/world/CREDITS.md` |
| FSRS dùng cho câu biến thể là ngoại suy | Tham số mặc định, log đầy đủ để khớp lại sau |
| Không có DB local trên máy này | Logic thuần có test riêng chạy không cần DB; test service (DB) viết sẵn, chạy khi có DB local |

## Giai đoạn
1. **Nền logic** — `rng`, `cubic`, `generators`, `grading`, `memory`, `kcs` + unit test thuần (không DB).
2. **Dữ liệu & server** — schema, `service.ts`, `actions/world.ts` + test DB (tạo/nộp/chống nộp lại/không lộ đáp án/FSRS + Elo).
3. **Thế giới 3D** — tải model, sảnh, nhân vật VRM + animation, điều khiển phím/joystick, phong cách anime, route preview.
4. **Thung lũng & phát hiện** — đường ray đồ thị, thanh trượt, 3 phát hiện + năng lực, luồng dự đoán/gợi ý.
5. **Ôn tập & bảo tàng** — sinh vật hoang trong sảnh, panel câu hỏi (MCQ/TF4/SHORT), bảo tàng.
6. **Hoàn thiện** — điện thoại, hiệu năng, liên kết từ trang chủ/tiệm, e2e.

## Kiểm thử
- Unit (thuần): toán bậc ba (cực trị, nghiệm kép, bảng dấu, min/max đoạn); generator cùng seed ⇒ cùng đề, đề luôn có đáp án hợp lệ & các phương án khác nhau; payload đề **không chứa** đáp án; chấm TF4 đúng thang; SHORT chấp nhận "-1,5" / "-1.5", từ chối > 4 ký tự; FSRS: đúng ⇒ hạn xa hơn, sai ⇒ lapses+1; Elo hội tụ đúng chiều.
- DB: phát/nộp/nộp lại bị từ chối/challenge người khác bị từ chối/hết hạn; phát hiện chỉ ghi khi đúng; demo bị chặn.
- E2E (khi có server): vào `/world`, đi tới cổng, mở thung lũng, kéo thanh trượt, mở bảo tàng; 390 / 768 / 1366 px; không lỗi JS.


---

## Cập nhật 26/11/2026 (theo yêu cầu người dùng trong phiên)

### Định hướng đã đổi
- **Vai trò của game: thú vị, lạ, hiểu bản chất — không luyện đề.** Luyện đề thuộc hệ thống bài tập của web. Bỏ nhãn Phần I/II/III và thang điểm đề khỏi giao diện; thử thách ưu tiên dạng trực giác (ghép đồ thị f ↔ f′, đặt neo, chọn khoảng đi lên). Họ câu dạng đề vẫn còn trong generator (dùng cho Elo/ôn), có thể giảm dần.
- **Khám phá không cần giấy bút**; mở rộng sang **vật lý** và **khoa học máy tính**; kỳ quan toán học/vật lý ngoài chương trình (đại học, hiện đại) để khơi tò mò.
- **Nhiều thế giới + lỗ sâu** thay vì dồn vào một chỗ: Sảnh · Thung lũng Hàm số · Vùng Kỳ quan (vô hạn, sinh theo seed, stream theo chunk). Xem `WORLD_DESIGN.md`.
- **Tiếng Anh là ngôn ngữ chính**, có tiếng Việt (`lib/world/i18n.ts`; nội dung kiểu `{ en, vi }`; mỗi câu hỏi lưu `lang` để lời giải trả đúng ngôn ngữ).
- **Desktop + mobile, ưu tiên hiệu năng mobile**: mức low/mid/high, fullscreen khi bắt đầu, joystick. Xem `TECH.md`.
- **UI riêng** học theo ngôn ngữ thiết kế game anime (khung tối viền vàng + hoa văn góc; nút bình hành nghiêng; chuyển cảnh sọc chéo / lỗ sâu; `motion`), icon vector (lucide) thay emoji.

### Đã làm
- Logic: `lib/world/{rng,cubic,generators,grading,memory,kcs,reveals,i18n,service,wonders,terrain,avatars}.ts`; `actions/world.ts`; schema `WorldKnowledge/WorldItemStat/WorldChallenge(lang)/WorldDiscovery`.
- 3D: sảnh (mặt đất shader tranh vẽ, cỏ instanced, cổng, bảo tàng, gương, NPC VRM, sinh vật sprite anime có hộ thể), thung lũng (đường ray đồ thị, f′, neo, năng lực), Vùng Kỳ quan (chunk vô hạn, nước, cây instanced, 5 kỳ quan: tesseract, Klein, Lorenz, Poincaré, hố đen thấu kính hấp dẫn).
- Nhân vật: 11 VRM (VroidHub, giấy phép đã kiểm — `public/world/CREDITS.md`), animation Quaternius UAL retarget sang VRM; texture đã thu nhỏ ≤1024².
- Tranh 2D (panorama trời, key art, 5 sinh vật) tạo bằng Codex theo brief thiết kế gốc.
- Trang `/world` (đăng nhập) và `/world/preview` (chỉ dev, dữ liệu giả lập trên trình duyệt).

### Chưa làm / tiếp theo
1. Map đầu đẹp hơn: texture vẽ tay lát liền (đang tạo), thay khối thô bằng model Quaternius (kiến trúc, đá), ánh sáng/màu.
2. Torus Archipelago + Arc Bow; Chance Bazaar; Wave Coast (WORLD_DESIGN §3 vùng tiếp theo).
3. Việc hiệu năng trong TECH.md (NPC culling, bỏ cấp phát trong useFrame, compileAsync, KTX2, CDN).
4. Chạy `npm test` trên DB local (máy hiện chưa có DB / `.env`) — `tests/world/service.test.ts` viết sẵn.
5. Kiểm tra thật trên iPhone cũ / Android tầm thấp.

### Cập nhật vòng 2 (26/11/2026, tối)
- Người dùng chọn **chỉ cải tiến bằng code** (không mua/thuê/AI-3D asset).
- Sảnh: biển mây shader, thác nước, thiên cầu vàng, cánh hoa bay, đảo xa hậu cảnh, kiến trúc procedural (cột lathe + viền vàng, cổng vòm + đá rune, đình bát giác mái cong), texture vẽ tay (cỏ, đường lát, vách), bóng tiếp đất NPC, đèn ngược sáng, MToon chỉnh rim/bóng.
- Camera kiểu game nhập vai: khoá chuột (rê xoay 2 trục), lăn zoom; điện thoại vuốt nửa phải + chụm zoom; gần nhân vật (4,2 m, ngang vai).
- Vùng Kỳ quan chuyển sang **voxel kiểu Minecraft** (khối 1 m, chỉ sinh mặt lộ, vô hạn theo chunk).
- Hiệu năng: sửa PerformanceMonitor lật qua lật lại (chỉ hạ, không tự nâng); điện thoại render ≥1,5× (trước 1× → nhoè); mức high chỉ bật tay (đo desktop: high ~23 fps — chưa rõ nguyên nhân, mid ~55, low ~58).
- Còn lại: đặt/phá khối; điều tra mức high; drei `<Html>` cảnh báo unmount với React 19 (thay nhãn bằng sprite/troika); NPC culling; KTX2.

### Cập nhật vòng 3 (26/11/2026, khuya)
- **Nhiều map, mỗi map một không gian toán/lý riêng** (voxel chỉ là một map): Sảnh · Thung lũng Hàm số · Vùng Kỳ quan (voxel vô hạn, đặt/phá khối, hotbar, dò tia DDA, edits lưu cục bộ — đơn vị sẽ đồng bộ khi có multiplayer) · **Sảnh Bất Khả** (non-Euclid: bốt "trong lớn hơn ngoài" bằng MeshPortalMaterial; hành lang lặp — không gian dán thành vòng).
- Map tiếp theo (WORLD_DESIGN): Torus Archipelago, Hyperbolic Forest, Spherical Moonlet, Tesseract Ruins, **Vũ trụ** (cơ học quỹ đạo, Orbit Sling, hố đen) — mỗi map có cơ chế combat + VFX riêng; câu đố phản trực giác.
- Nhân vật: viền mực MToon (tự sinh pass outline), mảng sáng/tối dứt khoát (toon 2 bậc), texture 2048, đặt chân bám đất, **động tác + biểu cảm** (12 động tác UAL, 5 biểu cảm VRM; phím G), va chạm (sảnh: collider tròn, trượt dọc; voxel: tường > 1 khối).
- Sinh vật Hồi âm dựng **hoàn toàn bằng toán** (sóng sin, siêu-ellipsoid + parabol, nút ba lá, phyllotaxis góc vàng, đa diện đều lồng nhau) thay ảnh 2D.
- Hiệu năng: cache độ cao cột voxel; NPC xa cập nhật 12 Hz; cổng portal dùng bản nội thất rút gọn (16 → 33 fps khi nhìn qua cửa).
- **Việc còn lại ưu tiên:** portal bằng stencil (1 lượt vẽ, không render target) để Sảnh Bất Khả đạt 60 fps; multiplayer (Colyseus — cần quyết định hạ tầng/chi phí); câu đố hoàn chỉnh cho hành lang lặp; drei `<Html>` cảnh báo React 19; mức "high" chậm.

### Cập nhật vòng 4 — nhiều người chơi (26/11/2026)
- Máy chủ realtime `realtime/` (Node 22 + ws, ~16 MB RAM) chạy Docker trên một máy chủ nội bộ (địa chỉ/thư mục cài đặt giữ ngoài repo). Phòng theo map (40 người/kênh), ảnh chụp 10 Hz (vị trí, tư thế, động tác, biểu cảm, avatar), đồng bộ khối voxel (kiểm tra hợp lệ, giới hạn 6 khối/giây, trong tầm 16 m, lưu `data/edits-expanse.jsonl`; demo không được sửa).
- Không mở port: LAN `ws://<máy chủ>:2567`; Internet qua Cloudflare quick tunnel (`./tunnel-url.sh`, địa chỉ đổi khi khởi động lại). Subdomain cố định chờ chủ tài khoản Cloudflare cấp quyền "Cloudflare One Connector: cloudflared Write".
- Client `components/world/net.ts` (tự kết nối lại, nội suy ~200 ms), `RemotePlayers` (VRM cho vài người gần, còn lại chibi), HUD "N online". Next ký token HMAC 10 phút (`WORLD_RT_SECRET`, `WORLD_RT_URL`); preview dev dùng token khách (`ALLOW_ANON=1` — tắt khi lên production).
- Đã kiểm thử 2–3 phiên cùng phòng qua LAN và qua tunnel.


## Cập nhật vòng 5 — cel shading mọi map, chiến đấu, hành trang, HUD mới

**Đã làm**
- Viền mực màn hình (`fx/Ink.tsx`, Laplacian của 1/độ sâu) chạy ở MỌI mức chất lượng và mọi map (kể cả voxel); cỏ không ghi độ sâu để khỏi nhiễu viền. Viền VRM giữ ~1,6 px theo khoảng cách (`fitOutline`), viền nhuốm màu bề mặt.
- Vùng tối toon có sắc (gradient RGB, sửa chunk `gradientmap_pars_fragment`), nhân vật sáng hơn (shade = màu gốc pha tím hồng, shift −0,28, mặt VRoid giữ cài đặt gốc), tone map Neutral cuối chuỗi hậu kỳ (composer tắt tone map của renderer — xem CEL_SHADING.md), giảm đèn ngược.
- Chiến đấu (`combat/`): 8 vũ khí toán–lý (Kiếm Vectơ, Cung Parabol ném xiên tự giải, Trượng Fourier, Đòn bẩy Archimedes mô-men, Chuỳ Con lắc, Cuộn Coulomb sét lan, Đĩa Xoắn Vàng, Lăng kính Snell 3 chùm), nhảy (trọng lực), Lướt Tiếp tuyến (E, khung bất tử), Tích phân Bùng nổ (Q, năng lượng tích từ đòn đánh), đổi vũ khí (R). Quái toán học (Slime Nhiễu, Hồn Möbius, Bọ Sierpiński) có báo trước đòn, thanh máu, số sát thương bay.
- Hành trang (`combat/items.ts`, `ui/Bag.tsx`): thẻ theo độ hiếm 3–5★, ý tưởng toán học của từng vũ khí, 3 ô trang bị, nguyên liệu; rơi đồ có cột sáng + hút về người chơi; dòng nhặt đồ; thẻ khoe vũ khí mới. Lưu localStorage (chưa có bảng DB).
- Mô hình vũ khí `public/world/weapons/weapons.glb` (Blender: 3 mesh Quaternius CC0 + 5 mesh dựng riêng), icon vật phẩm vẽ kiểu anime (`public/world/items`).
- HUD mới (`ui/Hud.tsx`, `ui/hud.css`): minimap, nút kính tròn, menu trượt, thanh máu, bảng kỹ năng (vòng hồi chiêu, vòng năng lượng), gợi ý F; vùng an toàn tai thỏ (`viewport-fit: cover`), co theo chiều cao màn hình (--u), không layout shift.
- Sửa gốc lỗi "UI thô": preflight của dự án bị polyfill cascade-layers nâng độ ưu tiên (`*:not(#\#):not(#\#)`) → xoá padding/margin/border/bo góc của toàn bộ CSS game. Đã thêm `!important` cho các thuộc tính đó trong `world.css`/`hud.css`.

**Nghiên cứu mới**: `CEL_SHADING.md`, `COMBAT_VFX_RESEARCH.md` (săn quái tổ đội, break bar, phản ứng toán học, niệm chú aria + 8 phép). `SPELLS_ECOLOGY.md` (phép vẽ trên màn hình, sinh thái kỳ lạ) — agent bị dừng giữa chừng, cần chạy lại.

**Tiếp theo (đề xuất)**
1. Cảm giác đòn: hitlag theo cặp, sát thương đúng khung chạm, blend 0,06 s, rung theo hướng (COMBAT_VFX_RESEARCH P1).
2. Phép vẽ trên màn hình ($P/$Q recognizer) + phép không gian (thiên thạch quỹ đạo Kepler, hố đen thấu kính hấp dẫn).
3. Hiệu ứng môi trường: nước chảy, dung nham, plasma, điện; kỳ quan vô hạn / ouroboros; cây L-system, thêm quái/cây dựng bằng Blender.
4. Săn boss tổ đội qua server realtime (server giữ trạng thái boss) — cần máy chủ realtime truy cập được.
5. Lưu hành trang lên DB (Prisma) khi chốt thiết kế.


## Cập nhật vòng 6 — realtime local, mô hình Blender, quái kỳ dị

- **Realtime chạy local để test** (khi không vào được máy chủ): `cd realtime && npm i && PORT=2567 ALLOW_ANON=1 WORLD_RT_SECRET=<bất kỳ> node server.mjs`, rồi chạy dev với `NEXT_PUBLIC_WORLD_RT_URL=ws://localhost:2567`. Đã thử 2 tab: thấy nhau, đếm người online đúng.
- Người chơi khác giờ hiện **VRM thật** kể cả khi trùng nhân vật với mình (mỗi người một bản VRM, trong ngân sách theo mức đồ hoạ) — trước đây thành hình chibi.
- **Mô hình Blender kiểu anime** (màu tham khảo Madoka Exedra): `monsters.glb` (Slime Nhiễu mắt anime + thạch bóng + vương miện π, Hồn Möbius có vầng dải Möbius, Bọ Sierpiński mai tam giác) — tổng ~8,9k tam giác; `props.glb` (Ouroboros ∞ rắn cắn đuôi trên lemniscate, hoa hướng dương hạt góc vàng). Chuyển vật liệu bằng `fx/glbToon.ts` (toon 2 tông + glow HDR).
- **Cơ chế quái phải hiểu mới đánh được**: Bọ taxicab chỉ nhảy từng ô theo trục x/z (khoảng cách L1, đi zigzag), đòn đánh hình chữ thập → đứng chéo là an toàn; mai Sierpiński đỡ 70% đòn trực diện → phải đánh vòng. Hồn Möbius chỉ "có thật" khi sin(2πt/3) > 0 (vầng sáng bừng) — lệch pha thì đòn đi xuyên ("phase ∅").
- **Hoạt ảnh sống động**: quái nảy co giãn khi trúng đòn (lò xo tắt dần), bọ nhảy ô theo cung parabol, tiếp đất có vòng bụi + rung nhẹ, hoa hướng dương lắc gió / quay về phía người chơi / nảy lò xo khi đi ngang, khiên trúng đòn nhỏ gọn hơn.
- Đang nghiên cứu (agent): `SPELLS_ECOLOGY.md` — 12+ quái kỳ dị có quy luật để khám phá, phép vẽ trên màn hình, hiệu ứng môi trường (nước, dung nham, plasma, điện).

- **Phép vẽ trên màn hình (Sigil, phím T / nút bút)**: vẽ một nét → nhận dạng theo đặc trưng đường cong (`lib/world/sigil.ts`, có test hồi quy `tests/world/sigil.test.ts`): tròn → Khiên Đường tròn Đơn vị, zigzag → Sét Hàm Bậc thang, xoắn ốc → Chân trời Sự kiện (lỗ đen hút quái rồi sập), parabol → Thiên thạch Đạn đạo (rơi theo parabol thật), sóng sin → Sóng Chồng chập. Độ chính xác (khớp đường cong) → Perfect ×1,5 / Good ×1,2 / OK ×1 / Rough ×0,6. Vẽ sai → gợi ý, không mất gì.
- **Poise**: đòn đánh chỉ ngắt đòn quái đang vung khi dồn đủ sát thương (chống khoá cứng) — nền cho boss / quái theo quy luật (SPELLS_ECOLOGY.md §1).
- Tiếp theo theo SPELLS_ECOLOGY.md: Field Notes (nhật ký khám phá quy luật), quái mới Knight Imp / Zeno Tortoise / Greedy Ghoul, nước flow-map toon, cây L-system.


## Hàng đợi công việc (làm tuần tự đến hết — cập nhật trạng thái tại đây)

Nguồn: CEL_SHADING.md, COMBAT_VFX_RESEARCH.md, SPELLS_ECOLOGY.md, VFX_PIPELINE.md, VOXEL_WORLD.md.

- [x] F0 Relight (bù hệ số π): key #fff0dc×2.4, hemisphere #bcd6ff/#a08cb8×1.1, ramp mới, hậu kỳ dịu hơn, fog/snow — VFX_PIPELINE §6.3
- [x] **S1 Cốt truyện + nhiệm vụ + hội thoại + Thư khố** — xong: `story/quest.ts`, `ui/Story.tsx`, `ui/story.css`, 6 chân dung `public/world/portraits`; chương I có 9 nhiệm vụ, 10 trang Thư khố (phím J). Còn lại về sau: chương II gắn với boss. (`lib/world/story.ts` đã có dữ liệu chương I): store nhiệm vụ + sự kiện (kill/cast/collect/enter/talk), khung hội thoại kiểu Blue Archive có chân dung (Codex đang vẽ 6 chân dung), theo dõi nhiệm vụ kiểu Genshin, Thư khố định lý / nhà toán học, NPC Sương/Diệp nói chuyện được.
- [~] **U1 Giao diện kiểu game (Blue Archive / Genshin)** — đã có: font Chakra Petch + M PLUS Rounded 1c, nút thẻ trắng kiểu BA, hội thoại kiểu BA; còn: bảng Bag/Menu/Emote/Start screen theo phong cách thẻ, hiệu ứng chuyển cảnh: font game có tiếng Việt (tiêu đề kiểu cyber + thân chữ tròn), nút thẻ nghiêng, khung thẻ, không còn cảm giác web.
- [~] **V1 Hệ VFX dùng chung** — đã có: `fx/fxmat.ts` (mặt nạ/xói mòn/ramp/alpha bậc/hybrid blend), bộ texture `public/world/fx/tex` (noise, ramps 16 hàng, ring, streak, beam, + slash/star/burst/arc/debris/crater vẽ bằng Codex), vệt chém + vòng sóng + tia trúng đòn + sét dải + hố thiên thạch dùng FxMat, quái tan biến mép cháy, hạt sao/mảnh/chip Blender. Đã thêm (T16): dải vệt cho mũi tên / thiên thạch / quả lắc / đĩa xoắn (`fx/Ribbons.tsx`), bóng mờ khi lướt (`fx/DashGhosts.tsx`), cột sáng đồ rơi bằng FxMat chế độ 3, giới hạn hạt theo mức hiệu ứng (`lib/world/vfxBudget.ts`). Còn: ShockWave méo vòng, lô instanced mesh Blender cho mảnh vỡ. (VFX_PIPELINE F1–F9): 1 vật liệu chung (mặt nạ + nhiễu xói mòn + ramp màu + alpha bậc + polar), 3 lô instanced (sprite, mesh Blender, dải trail), gói trúng đòn, chém 3 đòn, tan biến khi chết, cột sáng đồ rơi, trail, vòng sóng, sét, thiên thạch, lỗ đen; bộ texture 14 tấm (noise thủ tục, glyph SVG, phần còn lại vẽ bằng Codex).
- [~] **W1 Kho voxel nhanh** — đã có: khoá số 53-bit (hết cấp phát chuỗi mỗi lần tra), chỉ mục theo cột cho columnRange, lưu trễ 1 s (giữ định dạng cũ), test `tests/world/voxels.test.ts`. Còn: worker + greedy meshing + AO đỉnh, mảng 32³. (VOXEL_WORLD rec 1–2): khoá số + mảng 32³, lưu IndexedDB trễ, worker sinh + greedy meshing, AO đỉnh.
- [~] **W2 Biome toán học** — đã có (`lib/world/terrain.ts` mathBiome, ~20–25% đất, cách điểm xuất phát ≥ 60 m): Đồng bằng Hàm số (mặt đất = đồ thị 6·sin(x/12)·cos(z/15), nền giấy kẻ ô vạch mỗi 8 khối), Cao nguyên Sierpiński (bậc khi (i&j)=0), Cao nguyên Fractal (Mandelbrot), Hồ Yên ngựa (x²−z²). Ví dụ toạ độ: function (−32, −328), fractal (−13, −129), saddle (0, −130), sierpiński (−30, −152). Voronoi Steppe, nhiễu tất định (`dsin`/`dcos`), biển báo biome: xong (T15). (Function Plains, Saddle/Bowl lakes, Sierpiński Badlands, Fractal Highlands, Voronoi Steppe) + nhiễu tất định.
- [x] **W4 Sét + lồng Faraday** (`scene/Storm.tsx`: bão theo đồng hồ chung mỗi 100 s, trời tối + mưa, sét đánh điểm cao nhất / khối vàng, trong lồng vàng ≥ 14 khối thì an toàn → mở trang Thư khố). Còn: cột thu lôi (rolling sphere), cát hoá thuỷ tinh.
- [x] **W3 Matrix Forge** — `lib/world/matrixForge.ts` (biến đổi khối bằng ma trận 3×3, ánh xạ ngược khi det ≠ 0, ép dẹt khi det = 0, test), `scene/Forge.tsx`: đế vàng 7×7 ở (−10, 9) trong Vùng Kỳ quan, bảng 6 thẻ ma trận (quay, gương, trượt, kéo, phóng ×2, chiếu) hiện det + số khối trước → sau + lịch sử để thấy AB ≠ BA. Symmetry Totem: xong (T15). Mạng (T21): MỘT thông điệp `forge` `{m, y, c}` (ma trận + mặt đế + danh sách ô nguồn ≤ 441 đã mã chỉ số) thay cho từng khối; server (`realtime/forge.mjs` sinh từ `lib/world/matrixForge.ts`) kiểm, khai triển y hệt, lưu từng khối (người vào sau thấy) rồi phát op; test `forgeOp.test.ts` + `realtime/selftest.mjs`. Bản sao của Totem Đối xứng vẫn chỉ ở máy người đặt.
- [~] **W5 Hang động 3D + đảo nổi** — xong (T17): mật độ 3D trên lưới thô 4 m (`lib/world/density.ts`: hang pho mát + đường hầm mì ống + phần nhô phân lớp, chỉ ở vùng hang ~25 % chunk, cách điểm xuất phát ≥ 90 m, sàn hang ≥ y −1), miệng hang đi bộ xuống được + khoang pha lê, Đảo Phyllotaxis (55 đảo, θ = n·137,5°, r = 5√n, cầu thang xoắn, biển báo). Còn: hang sâu dưới mực nước (cần nước dạng khối), Lattice Caverns (gyroid), section culling / che khuất trong hang, ánh sáng trời (hiện chỉ tô tối khối thấp hơn mặt đất ≥ 3), ~~quái đi theo `surfaceAt`~~ (xong T15: `Enemies` nhận `ground(x, z, y)`, Expanse dò sàn thật từ ngang hông quái), miệng hang gần điểm xuất phát (gần nhất ~230 m).
- [~] **W6 Cấu trúc** — xong (T17): khung `lib/world/structures.ts` (vùng 192 m + chunk 32 m, hộp bao, cache), cây voxel L-system 4 loài (`lib/world/lsystem.ts`, thay cây instanced), mê cung WFC 9×9 (`lib/world/wfc.ts`) có kho báu vàng, Rừng Đồ thị (Kruskal + cầu dây tạo chu trình). Còn: hoạt cảnh WFC "sụp hàm sóng", Königsberg grove + thắp cầu khi đi qua mỗi cầu đúng một lần (đường Euler), Maze Temple (DFS / Prim / Wilson), Recursion Spire (shape grammar), sinh trong worker, ~~khối mới (id ≥ 10) chưa gửi qua mạng~~ (xong T15: `MAX_BLOCK_ID` = 16 + test).
- [x] **B1 Boss tổ đội "Fourier Siren"** — xong bản đầu: `lib/world/boss.ts` (logic thuần, test được) + `realtime/boss.mjs` (bản JS tự sinh cho server, server là nguồn sự thật trong phòng "siren", nhận đòn đánh giới hạn 12/s, ≤150), `scene/Siren.tsx` (đấu trường Mê cung Hoạ âm: nền cắt giấy Codex, sàn phím đàn, cắt giấy lơ lửng), boss Blender `public/world/boss/siren.glb`, 4 đòn: Sóng dừng / Nhịp phách / Sao chổi Lissajous / Nút giao thoa (phải phá cả 2 trong 1 s), thanh Coherence → BREAK 6 s ×1,5, thanh máu boss kiểu Genshin. Đã test 2 người trên server realtime local: máu boss đồng bộ chính xác giữa 2 tab (server là nguồn sự thật). Thưởng + chương II đã có. Máy quay tự lùi xa + hạ góc khi đứng sát boss, sóng xung kích hậu kỳ (`impact()`) + vòng sáng khi Sóng dừng đập / BREAK / boss gục: xong (T16). ShockWave méo vòng thật: xong (T15, `shockwave()` trong `fx/Lensing.tsx`). + phó bản kiểu Madoka Exedra: server giữ trạng thái boss, báo trước đòn ≥ 600 ms, break bar "Coherence", phản ứng toán học giữa vũ khí.
- [x] **H1 Vũ khí cận chiến cầm trên tay + hoạt ảnh mượt** — kiếm/đòn bẩy/trượng tay phải, cung tay trái (trục tính từ xương ngón, không phụ thuộc model), blend 0,06 s, mỗi nhát chuỗi chém đổi điểm bắt đầu/tốc độ, nhảy 3 pha, thế cầm kiếm sau khi đánh. Đệm phím 150 ms + huỷ đòn bằng lướt: xong (T16, `lib/world/inputBuffer.ts`). Còn: —. (gắn mô hình vào xương tay VRM, blend 0,06 s vào đòn, chuỗi chém đổi tốc/điểm bắt đầu, Jump_Start→Loop→Land, tư thế cầm kiếm Sword_Idle, huỷ đòn bằng lướt, đệm phím 150 ms)
- [x] **G1 Bay lượn + bổ nhào + cột gió** — bấm nhảy trên không mở tàu lượn origami (Blender), rơi ≤ 1,8 m/s, cột gió nâng lên; đánh trên không = bổ nhào, chạm đất nổ sóng theo độ cao rơi (thế năng). Cột gió ở sảnh + 4 cột trong phó bản.
- [x] **B2 Phó bản nhiều tầng** — 4 đài nổi (3,4 m / 5 m) + 4 cột gió quanh Siren; sóng dừng / nhịp phách chỉ trúng người dưới đất, sao chổi Lissajous thứ hai bay ở tầm đài cao.
- [x] **G2 Chế độ ngắm (cung) + VFX cung/pháp khí** — chuột phải / nút ngắm: camera qua vai + FOV hẹp, tâm ngắm có vòng tích lực, tên theo tia camera (bù trọng lực), tích lực 1 s ×2,2 xuyên thấu; vòng phép đứng khi niệm trượng / cuộn / lăng kính. — giữ chuột phải / nút ngắm: camera qua vai, tâm ngắm, tên bay theo tia camera, bắn tích lực (giữ 1 s), vệt tên ribbon, vòng phép khi niệm (học Genshin).
- [~] **M1 Quái cần phối hợp** — đã có (mô hình Blender `monsters2.glb`): Quỷ Mã Cờ (nhảy nước mã, chỉ đánh 8 ô mã → đứng sát cạnh an toàn), Rùa Zeno (đòn thứ k chỉ ½ᵏ, nghỉ 1,2 s để chuỗi lại), Song Sinh Giao Thoa (chỉ chịu đòn khi cả hai bị đánh trong 0,2 s; vân sáng cos²(πΔr/λ) gây sát thương) + Ghi chép thực địa mở trang Thư khố khi khám phá quy luật. Đã vẽ vân giao thoa trên mặt đất (vân sáng đỏ nhấp nháy theo nhịp 1,6 s, vân tối an toàn). Chương II: vào Mê cung + hạ Siren (thưởng rơi đồ + trang Thư khố Chuỗi Fourier). Đã thêm (T16): Ma Tham Lam (thuật toán tham lam → kẹt ở cực tiểu địa phương trong rào chữ U), Hộ Vệ Nguyên Tố (khiên n chia theo loạt đòn là ước của n; nguyên tố chỉ vỡ bởi đúng p đòn liền), Cua Chuông (bàn Galton → cột sỏi hình chuông, hai đuôi = hông hở mai) + 3 trang Ghi chép. Còn: mô hình Blender cho 3 quái mới (đang ghép khối tạm), Taxicab Rook / Modulo Clock / Markov Jackal…: Interference Twins (phải đánh cùng lúc), Knight Imp, Zeno Tortoise, Greedy Ghoul, Prime Warden; Field Notes ghi quy luật đã khám phá.
- [ ] **C1 Hầm Bổ đề (The Lemma Vaults) — giải đố co-op 3–4 người** — thiết kế đầy đủ trong `COOP_PUZZLE.md` (9 phòng; MVP: Cầu Königsberg, Cân Archimedes, Dàn hợp xướng Fourier; ping + nói nhanh + đếm ngược "Ba-hai-một", bạn đồng hành linh hồn cho ghế trống, phòng party theo mã). Đã sửa P0.1: kết nối lại xin token mới (trước đây hết hạn sau 10 phút là mất kết nối vĩnh viễn).
- [x] **A1 SFX** đồng bộ với VFX (lớp âm theo nguyên tố), nhạc nền theo vùng — xem T14 + `AUDIO.md`.
- [x] **T1 Du hành lỗ sâu giữa các vùng** — `ui/WormholeTravel.tsx`: canvas WebGL riêng 2 s (ống log-cực, vệt sao theo vận tốc, vành Einstein, tách sắc ở rìa, bảng màu vùng đi → vùng đến), đổi cảnh ở 45 % khi đang trong ống; `ui/AreaTitle.tsx` hiện tên vùng kiểu Genshin khi tới.
- [x] **T2 Bốt Siêu khối (lớn hơn bên trong; cảm hứng TARDIS nhưng thiết kế riêng — `TESSERACT_BOOTH.md`)** — làm lại toàn bộ:
  - Vỏ ngoài "Hyperkiosk" (Blender, `props/kiosk.glb`, AO nướng vào màu đỉnh): thân bát giác sơn mài tím, trụ đồng có khe neon hồng, cửa vòm 2 lá thu vào hốc khi lại gần (khe portal mở theo), cửa sổ chia ô hình chữ nhật vàng + xoắn ốc vàng + quạt nan, kính "interior mapping" (sảnh ảo sâu 30 m sau tấm kính 1,2 m), biển neon TESSERACT, đèn siêu khối 4D lơ lửng, vũng sáng neon dưới chân. Mặt nạ portal đúng hình vòm cửa.
  - Phòng điều khiển (Blender, `props/tess_room.glb`, 3,2 MB / 1,2 MB gzip): Ø28 m, tường 12,5 m + mái elip tới 20 m có giếng trời, 10 sườn neon, tầng lửng móng ngựa ở 5 m + cầu kính mũi tàu trước cửa sổ Ø11 m, 2 cầu thang cong 28 bậc (đi lên được), 6 cột đồng, tiền sảnh hẹp tối 3 m (nén → bung ra), hành lang Thư viện (kệ sách) và Thiên văn đồ, 2 vòm tầng trên. Bàn điều khiển ngũ giác + Hypercore (cột kính, khối 12/20 mặt lồng nhau, siêu khối 4D, cột sáng tới giếng trời) + 3 vòng con quay 1 : φ : φ².
  - Ánh sáng: GI nướng bằng Cycles vào màu đỉnh (trực tiếp + gián tiếp: neon hắt màu, bóng đổ mềm dưới ban công, ánh cửa sổ), vẽ không chiếu sáng + bậc hoá nhẹ kiểu anime. KHÔNG có đèn three.js nào trong bốt.
  - VFX sống: 637 lỗ sáng phyllotaxis (góc vàng; 260 trên tường, 377 = số Fibonacci trên mái) instanced; sàn Penrose P3 (deflation tam giác Robinson) sáng dưới chân; băng Turing 256 ô chạy quanh chân mái; dải dữ liệu cuộn; xung trên cáp; tia sáng thể tích giả (giếng trời, cửa sổ) + bụi lơ lửng; HUD hologram trên cửa sổ; bầu trời tinh vân fbm.
  - Bảng điều khiển hologram cyberpunk (`ui/HoloConsole.tsx`): bản đồ sao ngũ giác, biểu tượng nét SVG động, tuyến nhảy, nút KHỞI HÀNH.
  - Du hành "The Fold" 4,8 s: cửa chớp mống mắt 12 lá đóng kín 0,35 s để đổi vũ trụ, dolly-zoom (FOV +26°, máy quay áp sát), phòng tối + nhuốm tím, loé sáng, rung, sao kéo vệt, lỗ sáng quét nhanh, con quay tăng tốc, âm Shepard–Risset đi lên mãi.
  - 5 cảnh đích dựng riêng cho cửa sổ (`TessVistas.tsx`): Hệ Mặt Trời (Kepler III, hành tinh cel tự chiếu), lỗ đen (vùng tối + vành photon + đĩa bồi tụ Doppler + mặt sau bị bẻ cong), Lorenz RK4 14 000 điểm có sao chổi, đĩa Poincaré {7,3} trôi theo Möbius, siêu khối 15 m.
  - Hiệu năng: hết khựng khi bước vào (447 → 83 ms khung tệ nhất) và khi du hành (số chương trình shader không tăng): mọi thứ luôn gắn + bật/tắt visible, biên dịch sẵn + vẽ khởi động một khung ẩn có RT (khớp khoá chương trình của EffectComposer, tạm hiện mọi vật thể ẩn), vành lỗ sáng phẳng (−112k tam giác).
  - Logic thuần + test (`lib/world/tessRoom.ts`, `tests/world/tessRoom.test.ts`): mặt đất nhiều tầng (bệ, cầu thang, tầng lửng, cầu kính), va chạm (lan can, gầm cầu thang, cột, tiền sảnh), giới hạn máy quay trong phòng, vị trí lỗ sáng.
  - Cổng Mandelbrot (H2): xong T15 — `scene/MandelPortal.tsx` trên tầng lửng 56°, đĩa shader lặn ×1 500 vào Thung lũng Cá ngựa (tô theo ước lượng khoảng cách tới biên), bục Julia (c = vị trí chân, khớp hình cardioid khắc trên bục; `lib/world/mandel.ts` + test), khung Blender `props/mandel_portal.glb`.
  - Con lắc sóng (A4): xong T15 — `scene/PendulumWave.tsx` dưới mép tầng lửng 292°–316°, 24 quả Nₖ = 29 + k dao động / 90 s (góc giải tích, `lib/world/pendulumWave.ts` + test), cần gạt F thả lại cùng pha; mô hình Blender `props/pendulum_wave.glb`.
  - Bảng Galton (I2): xong T15 — `scene/GaltonBoard.tsx` trên tường 30°, 240 viên qua 10 hàng đinh (đường bay giải tích, `lib/world/galtonBoard.ts` + 4 test: trung bình / phương sai Nhị thức, liền mạch, đậu đúng chỗ), nút thả + cần nghiêng p = ½ → 0,7 → 0,3, đường kỳ vọng lam; mô hình `props/galton_board.glb`. Đạo cụ phòng dùng `scene/roomProps.ts` + `roomUniforms.ts` (PROP_U: hệ số nướng riêng, chung phơi sáng du hành).
  - Khe Young lượng tử (I3): xong T15 — `scene/DoubleSlit.tsx` tường 60°: súng bắn từng hạt (26/s) qua tấm chắn hai khe (khối giữa co theo d) → chấm lên màn DataTexture 256 × 64, vân giao thoa hiện dần; bệ trái bật máy dò đường đi (vân biến mất), bệ phải đổi d (Δy = λL/d). `lib/world/doubleSlit.ts` (I ∝ cos²·sinc², lấy mẫu loại bỏ) + 4 test; mô hình `props/double_slit.glb`.
  - Đàn laser Lissajous (I4): xong T15 — `scene/LissajousHarp.tsx` 335°, 6 tia tần số 1…6 (đứng vào tia + F), tường vẽ x = sin(at + δ), y = sin(bt) bằng dải tính trong vertex shader, loa phát hai hoạ âm tỉ lệ a : b + tên quãng (`lib/world/lissajous.ts` + 3 test); mô hình `props/lissajous_harp.glb`. Sợi Hopf (H7): đã có ở phòng thí nghiệm vũ trụ (CosmosLab) — không làm lại.
  - Siêu khối có tay cầm (I1): xong T15 — `scene/HypercubeHolo.tsx` 135°: ảnh nổi siêu khối (32 cạnh instanced, tô theo w) quay trong một mặt phẳng; F ở máy chiếu đổi xy → xz → yz → xw → yw → zw (mặt chứa w: khối trong lộn ra ngoài). `lib/world/hypercube.ts` + 2 test; máy chiếu `props/hypercube_projector.glb`.
  - Còn (danh mục "kỳ quan" trong `TESSERACT_BOOTH.md` §13): ~~phòng Thiên văn đồ (hành lang đông)~~, ~~Cầu thang Penrose (tầng lửng 270°)~~ — đã làm bản khối tạm (T23), chờ mô hình Blender; còn Góc quan sát (tầng lửng 90°).
- [x] **T3 Thư viện Babel (Borges 1941) — vùng riêng, vô hạn** (`scene/Babel.tsx`, `ui/BabelUI.tsx`, `lib/world/babel.ts`, `lib/world/babelRoom.ts`, `props/babel.glb`, `props/babel_lectern.glb`):
  - Đúng như truyện: phòng lục giác, 4 tường × 5 kệ × 32 cuốn, sách 410 trang × 40 dòng × 80 ký tự, 25 ký hiệu (= 22 chữ cái tiếng Việt không dấu + cách, phẩy, chấm), giếng thông gió có lan can rất thấp, 2 đèn cầu, hành lang hẹp với 2 buồng nhỏ, gương phản chiếu thật (Reflector, chỉ bật khi đứng gần), cầu thang xoắn xuyên tầng.
  - Vô hạn thật: 18 ô đơn vị instanced (dọc hành lang + ±4 tầng qua giếng, chìm vào sương hổ phách); đi hết một chu kỳ thì thế giới quấn người chơi về ô giống hệt (máy quay dời theo qua `CAM.shift`), số hiệu phòng là số nguyên ~2 871 chữ số cơ số 36; cầu thang xoắn: đi một vòng là lên/xuống một tầng.
  - Đọc được mọi trang: song ánh địa chỉ = (trang·K + C) mod 25^3200 (BigInt) → Mục lục: gõ câu bất kỳ (có dấu cũng được) → địa chỉ duy nhất → "Đi tới và mở trang" (câu được tô sáng giữa chữ ngẫu nhiên); bàn đọc của Thủ thư: Truyện Kiều, Lục Vân Tiên, Euclid (Heath 1908), Flatland — tìm được trang của chúng trong Thư viện.
  - NPC Thủ thư Tịnh (chân dung Codex) kể về Thư viện, số 25^1 312 000 ≈ 10^1 834 097, "thông tin nằm ở việc chọn"; mở trang Thư khố "Thư viện Babel". Lối vào: cổng hổ phách cuối hành lang Thư viện trong Bốt Siêu khối.
  - GI nướng (512 mẫu) với đơn vị lân cận + sách xem trước làm vật che/hắt sáng; 8 148 tam giác/đơn vị; 11 520 sách instanced (màu gáy tất định theo địa chỉ). Test: `tests/world/babel.test.ts`, `tests/world/babelRoom.test.ts`.
- [x] **T4 Sân Sảnh Bất Khả** — bầu trời hoàng hôn "kiến trúc bất khả" + sàn cẩm thạch hình thoi (Codex), sương tím; Sky panorama sửa lỗi bị sương che (fog: false) — trước đây bầu trời vẽ tay không hiện ở mọi vùng; tượng Tam giác Penrose (Blender): tìm đúng điểm nhìn thì 3 thanh "khép kín", viền neon ấm dần theo góc, mở trang Thư khố "Tam giác không thể"; nhãn DOM ẩn theo cây cảnh.
- [~] **T5 Mở rộng Sảnh Bất Khả — triết học / khoa học viễn tưởng**:
  - [x] Khách sạn Hilbert (`scene/HilbertHotel.tsx`, `lib/world/hilbert.ts` + test, `props/hotel.glb` GI nướng): hành lang vô hạn thành khách sạn kín chỗ, biển số phòng vẽ bằng shader 7 đoạn tăng mãi khi đi, 40 khách (quả cầu sáng) bay cùng lúc theo n→n+1 / n→2n / luỹ thừa nguyên tố; lễ tân Vô Cực (chân dung Codex) + bảng sơ đồ phòng trước/sau; trang Thư khố "Khách sạn Hilbert".
  - [x] Sổ tay Sảnh Bất Khả (`ui/GuideBook.tsx`, menu): 9 chương có minh hoạ Codex — Lớn hơn bên trong, Tam giác không thể (SVG), Khách sạn Hilbert, Thư viện Babel, Hang Platon, Monty Hall (chơi + mô phỏng 1 000 ván), Con tàu Theseus, Căn phòng Trung Hoa, Quỷ Maxwell; mỗi chương có "Thử nghĩ" + nơi trải nghiệm.
  - [x] Hang Platon (`scene/PlatoCave.tsx`, `ui/CavePanel.tsx`, `props/cave.glb` GI nướng: lửa + nắng miệng hang): bóng trên vách bằng "máy chiếu bóng" (vẽ vật thành bóng đen nhìn từ ngọn lửa vào render target 512×384, vách lấy mẫu theo phép chiếu — không đèn), lửa bập bùng; NPC "Hồi âm của Hang" kể chuyện; chế độ tù nhân góc nhìn thứ nhất (ẩn nhân vật, FOV rộng): đoán vật từ bóng tròn → quay đầu thấy hình trụ (bóng thành chữ nhật) + ánh sáng ngoài miệng hang → bóng 2D của bóng 3D của siêu khối 4D; trang Thư khố "Hang của Platon".
  - [x] Sửa lỗi nhiều người chơi: client không bỏ chính mình khỏi ảnh chụp phòng → ai cũng thấy một "bóng ma" của chính mình (nhãn "Guest") đi theo sau (`net.ts` lưu selfId từ "welcome").
  - [x] Sân khấu Ba Cánh Cửa — Monty Hall (`scene/MontyStage.tsx`, `scene/montyState.ts`, `ui/MontyPanel.tsx`, `lib/world/monty.ts` + test; `props/monty.glb` GI nướng: 3 đèn rọi + nắng + đèn hốc, `props/monty_prizes.glb` dê chibi + xe mui trần có nơ): cửa bản lề mở ra phía khán giả, bóng đèn marquee chạy đuổi bằng shader, chùm đèn rọi cộng sáng theo cửa được chọn, pháo giấy khi trúng xe, bảng điểm canvas (giữ/đổi + mô phỏng 1 000 ván đếm dần); MC Lumi (NPC + hội thoại + chân dung khớp mô hình VRM); bảng: Chơi / 100 cửa / Vì sao? (bảng 3 trường hợp + biến thể "MC mở bừa → 1/2"); trang Thư khố "Bài toán Monty Hall"; âm thanh trống dồn, kèn, tiếng dê, cửa kẽo kẹt (WebAudio).
  - [x] Sửa lỗi cũ: cỏ ở Quảng trường có đỉnh NaN (pow số âm −1e-17) → lỗi "computeBoundingSphere NaN" ở dev.
  - [x] Con tàu Theseus (`scene/TheseusDocks.tsx`, `ui/TheseusPanel.tsx`, `lib/world/theseus.ts` + test; `props/theseus.glb` thuyền chiến Hy Lạp vỏ ghép 24 tấm ván riêng, AO nướng): hai ụ khô phía bắc bốt; mỗi lần thay, ván cũ bay vòng sang ụ B, ván mới vàng óng hạ xuống tàu A; đủ 24 tấm tàu B mọc nốt sống thuyền/buồm cũ; câu hỏi "từ tấm thứ mấy?" (nghịch lý đống cát) → bỏ phiếu A/B/cả hai/không → bảng 5 học thuyết (liên tục, vật chất, chức năng, bốn chiều, hư vô); NPC Mộc (VRM riêng + chân dung Codex).
  - [x] Quỷ Maxwell (`scene/MaxwellLab.tsx`, `ui/MaxwellPanel.tsx`, `lib/world/maxwell.ts` + test; `props/maxwell.glb` phòng thí nghiệm đồng + quỷ mũ chóp): 140 phân tử khí lý tưởng va đàn hồi, màu theo tốc độ; cửa sập xoay theo quyết định; nhiệt kế/áp kế theo số liệu thật; 4 chế độ (đóng, mở, bạn làm quỷ — giữ nút/Space, quỷ tự động); sổ cái "entropy khí giảm" vs "bit phải nhớ"; xoá trí nhớ → nhiệt Landauer; giải thích Szilárd/Landauer/Bennett + thí nghiệm 2012.
  - [x] Căn phòng Trung Hoa (`scene/ChineseRoom.tsx`, `ui/ChineseRoomPanel.tsx`, `lib/world/chineseRoom.ts` + test; `props/chinese_room.glb` GI nướng): ngồi trong phòng, mẩu giấy tiếng Trung thật trượt qua khe 入, tra sách quy tắc theo hình dạng, ghép câu trả lời từ khay chữ, đẩy ra khe 出 tới tay Lan; xong 4 lượt mới hiện bản dịch ("tôi nói tiếng Trung trôi chảy"…) + phản biện hệ thống/robot/mô phỏng não + câu hỏi về mô hình ngôn ngữ ngày nay.
  - [x] Lan can đá quanh sân (`scene/CourtRail.tsx`, `props/court_rail.glb` Blender: trụ + con tiện + trụ đèn pha lê, instancing) thay bốn tường hộp; chừa khe cạnh bắc cho hành lang khách sạn. Sửa lỗi cũ: biên sân |z| > 19,5 chặn hành lang nên hành lang vô hạn không bao giờ quấn — nay trong lòng hành lang không bị chặn.
  - [x] Nhãn tên NPC chỉ hiện trong 24 m (`Label3D maxDist`) — đỡ rối, không "nhìn xuyên tường" tên NPC ở xa.
- [x] **T6 Phòng Nghịch lý** — cõi mới `paradox` (`scene/ParadoxHall.tsx`, `scene/paradoxData.ts`, `ui/ParadoxPanel.tsx`, `lib/world/paradox.ts` + 10 test; `props/paradox.glb` điện tròn 12 gian GI nướng: vòm gân + giếng trời, sàn hoa hồng la bàn, cửa sổ hoa hồng; `props/paradox_props.glb` đạo cụ toon): cổng ở bắc tâm sân Sảnh Bất Khả; 10 trạm trên bệ, mỗi trạm một vật động — Achilles (mũ đồng) đuổi rùa, vòng lịch 365 ô với 23 người rơi xuống (ngày trùng sáng đỏ), cột Simpson mọc lên, quả cầu Banach–Tarski vỡ 5 mảnh rồi thành hai, cột thợ cạo xoay, hộp Newcomb + mắt tiên tri dõi theo người chơi, bông tuyết Koch tăng mức, sa bàn Braess có xe chạy + cầu tắt bật/tắt, đèn Thomson nhấp nháy nhanh dần, tên lửa bay khứ hồi + hai đồng hồ lệch γ; giữa sảnh dải Möbius vàng có "con kiến" bò 2 vòng mới về chỗ cũ. Bảng: câu chuyện → thí nghiệm SVG (thanh trượt / mô phỏng / bật tắt) → "Xem lời giải" → "Thử nghĩ"; NPC Hồi âm Zeno (VRM riêng + chân dung Codex); trang Thư khố "Phòng Nghịch Lý"; realtime REALMS + "paradox".
- [x] **T6b Hư Không Nghịch Lý** (27/11/2026) — điện tròn thay bằng quần đảo nổi giữa vũ trụ (`props/paradox_void.glb` Blender, GI nướng: đảo tâm r 8,5 khảm sao {12/5}, 10 đảo trạm trên hai vòng 18/27 m cao thấp lệch nhau, đáy đá phân tầng + pha lê phát sáng, cầu phiến đá nổi viền sáng, đảo cổng ra hai tháp nhọn, mảnh vụn pha lê trôi); bố cục + mặt đất/vực thuần trong `lib/world/paradoxVoid.ts` (+4 test). Kỳ quan bất khả (`props/paradox_wonders.glb`, `scene/ParadoxVoidFx.tsx`): tam giác Penrose THẬT (3 dầm trong không gian) chỉ khép kín khi đứng ở **Mắt Penrose** (F → máy quay vào đúng đường chéo, bừng sáng + chuông), chai Klein thuỷ tinh + lưới tham số, kèn Gabriel, bọt biển Menger, cầu thang xoắn đi lên mãi; vista mượn từ Bốt: siêu khối 4D trên đỉnh trời, hố đen, bão Lorenz, đĩa Poincaré làm đáy vực. Bầu trời shader (tinh vân fbm uốn miền, ngân hà, thiên hà xoắn, hành tinh có vành, quỹ đạo vàng, sao). VFX (`scene/ParadoxVfx.tsx`): năng lượng chạy dọc cầu, rune lấp lánh, pha lê thở sáng, 3 dải cực quang, sao băng, ký hiệu toán trôi như đom đóm, gợn sáng dưới bước chân, máy quay bay vào lúc tới nơi. Đổi tên vùng "Hư Không Nghịch Lý"; Zeno giới thiệu thêm các kỳ quan.
- [x] **C2 Thế võ** (27/11/2026, `COMBAT_COMBOS.md`):
  - **Sửa lỗi** "ấn liên tục không có gì": chuột trái giờ đánh được cả khi chưa khoá chuột; bấm trong lúc đang vung được xếp hàng; mỗi nhát là một clip riêng.
  - **Bộ đòn:** mỗi vũ khí có chuỗi 3–5 nhát + đòn tụ lực (giữ chuột) + kỹ năng E riêng, dùng clip thật UAL1 + **UAL2** (`anim/ual2.glb`, 23 clip CC0).
  - **Khung trúng** lấy từ động học thuận của clip, kèm lao tới.
  - **Nhịp hoàn hảo:** bấm ngay khi vũ khí loé → +35% sát thương, 3 Nhịp liền → nhát kết cường hoá; bấm loạn → mất Nhịp.
  - **Né** (Shift / chuột phải / nút): bất tử, chỉ huỷ được pha thu thế. Né hoàn hảo → Khúc xạ thời gian (quái chậm 25%, nhát kế chí mạng, màn hình nhạt màu ám lam).
  - **Khác:** thể lực; bộ đếm combo; thẻ "Thế võ" (H); nút đánh trên điện thoại nhận nhấn / giữ thật (bỏ kiểu tự bấm liên tục).
  - **Code:** `lib/world/combo.ts` + 5 test.
- [x] **C3 Cảm giác ra đòn & VFX** (27/11/2026):
  - **Vệt chém** (`fx/WeaponTrail.tsx`): ruy băng nội suy Catmull-Rom, lõi trắng, mép màu vũ khí, vân năng lượng chảy; chuyển vàng khi đang giữ Nhịp. Vũ khí cầm tay lấy mép từ mốc chuôi / mũi đặt trên mô hình, vũ khí bay theo nắm tay.
  - **Chấn màn hình** (zoom blur + tách màu, trong `fx/Lensing.tsx`) cho nhát kết, tụ lực, kỹ năng, né hoàn hảo, bổ nhào, tuyệt kỹ.
  - **Hất tung quái + đánh tiếp trên không** (juggle; quái trên không không vung đòn được).
  - **Âm thanh:** vút gió khi vung, tiếng đập trầm khi trúng nặng; khựng hình nặng / nhẹ theo đòn.
  - **Máy quay:** giật vào (dolly) ở nhát kết. Tuyệt kỹ Q có màn điện ảnh: pha tụ → thế giới gần đứng hình 0,65 s → bung đúng khung trúng.
  - **Khác:** vòng tụ lực dưới chân khi giữ chuột; tín hiệu Nhịp loé ở mũi vũ khí; số sát thương nảy lên, chí mạng có ✦.
- [x] **T6c "Wow" Hư Không** (27/11/2026): cá voi sao (`props/star_whale.glb` Blender + shader: thân trong mờ fresnel có tinh vân, đỉnh lưới = sao lấp lánh, cạnh = đường chòm sao, thân uốn sóng, vệt bụi sao, tiếng hát tổng hợp) bơi vòng quanh quần đảo; **thấu kính hấp dẫn** hậu kỳ quanh hố đen (`fx/Lensing.tsx`, β = θ − θE²/θ + xoắn kéo hệ quy chiếu, chỉ uốn bầu trời); **Chòm sao Vô Cực** — mỗi trạm đã khám phá thắp một sao trên lemniscate (lưu `world.pdx.seen`), đủ 10 thì đường ∞ nối kín + sóng sáng + pháo hoa sao + cực quang rực lên + chuông; dải Möbius có ống sáng chảy dọc đường biên DUY NHẤT + vệt sáng sau con kiến (`scene/ParadoxWow.tsx`).
- [x] Chân dung 21 nhân vật cho "Gương Hoá Thân" (`portraits/avatar_*.webp`, dựng từ chính file VRM trong Blender: vật liệu không đổ bóng × màu MToon `_Color`, hạ tay khỏi tư thế chữ T); thẻ chọn nhân vật thành ảnh lớn + quầng màu riêng.
- [x] Thêm 10 nhân vật VRoid (27/11/2026, đã lọc điều kiện: cho làm avatar, thương mại, sửa, phân phối lại; bỏ nhân vật thuộc tác phẩm khác / hở hang): Phú, Kha, Bạch, Dũng, Ngân, Giáo sư Lão, Tivi (đầu tivi), Kỳ · Phi hành gia, Sa Vi · Kimono, Liên (elf — bắt buộc ghi công). Texture hạ 1024 px (`scripts/world-shrink-vrm.py`).
- [x] **T6d Phong cách lai + mở rộng vũ trụ** (27/11/2026):
  - **Hai phong cách Hư Không, đổi bằng nút trên HUD** (`scene/VoidHybrid.tsx`, lưu `world.pdxReal`):
    - "Siêu thực": PBR `MeshPhysicalMaterial` theo tên vật liệu Blender, giữ màu nướng làm AO, môi trường PMREM chụp từ chính shader tinh vân, sàn gương phản chiếu mặt phẳng ở đảo tâm, đá flat-shading, tone map AgX, bóng đổ PCF bám theo người chơi, mặt trời hố đen cho tia sáng thể tích.
    - "Hoạt hình": cel shading như cũ.
  - **3 đảo vòng ngoài** (Đài Chân Trời Sự Kiện, Quảng trường Dữ liệu với hologram phương trình, Đài Thiên Văn với nghi thiên cầu).
  - **5 vùng xa** (`scene/ParadoxCosmos.tsx`; `props/paradox_mega.glb` Blender):
    - Rạn San Hô Fractal
    - Thác Nước Chảy Ngược
    - Thành Phố Neon Ngược
    - Rừng Sứa Tinh Vân
    - Đỉnh Vô Cực, có bệ hoà âm f, 2f, 3f…
  - **Đi tới các vùng:**
    - bằng cầu nối;
    - bằng cột gió đẩy lên rồi lượn tới;
    - bằng cổng dịch chuyển: cổng ở đảo tâm mở sau khi đã tới vùng đó, lưu `world.pdx.zones`.
  - **Phông nền:** vành đai Dyson, vành tiểu hành tinh, hành tinh có vành.
  - **An toàn khi rơi:** rơi xuống vực thì hồi về chỗ đứng an toàn gần nhất.
- [x] **G1 Cài đặt đồ hoạ & hiệu ứng** (`components/world/gfx.ts`, menu → "Đồ hoạ & hiệu ứng"):
  - 4 mức có sẵn: Thấp / Vừa / Cao / Siêu.
  - Tuỳ chỉnh riêng từng mục:
    - độ phân giải render 50–100 %
    - SMAA
    - bloom HDR
    - N8AO
    - phản chiếu
    - tia sáng thể tích
    - bokeh DOF
    - bóng đổ
    - hạt phim + quang sai
    - mật độ hạt VFX
    - bộ đếm FPS
  - Đo trên máy tích hợp:
    - N8AO ở chất lượng "performance" + nửa độ phân giải vẫn đắt, nên chỉ bật ở mức Siêu.
    - God rays chỉ bật ở mức Siêu.
    - Mặc định là Vừa (máy yếu là Thấp).
- [x] **G2 Ống nhòm** (`components/world/scope.ts`, phím Z / nút trên HUD):
  - **Góc nhìn và phóng:** nhìn thứ nhất từ đầu nhân vật, phóng ×2–×16. FOV = 45°/zoom, chuyển mượt.
  - **Điều khiển:** độ nhạy xoay chia theo zoom; lăn chuột hoặc thanh trượt (điện thoại) để phóng.
  - **Khung kính và thông số:** mặt nạ hai vòng kính, thước ngắm, la bàn hướng, khoảng cách đo bằng tia.
  - **Nhãn địa danh:**
    - Nhãn ở xa hiện theo khoảng cách hiệu dụng d/zoom.
    - Mục tiêu gần tâm ngắm hiện "Đang quan sát".
  - **Khi bật ống nhòm:** ẩn bàn phím ảo, thanh máu và gợi ý tương tác.
- Sửa lỗi:
  - Fog trắng của `Lights` đè fog riêng của các cảnh (paradox / babel / expanse / impossible), tuỳ thứ tự mount. Hậu quả: vành tiểu hành tinh ở 120–160 m hiện thành mảng trắng. Nay `Lights` chỉ gắn fog ở hub / valley / siren.
  - Shader hành tinh có vành dùng `modelMatrix` trong fragment shader nên không biên dịch được.

## T7 — Thế giới Bất Khả: siêu thực + vũ trụ + bay lượn (27/11/2026 — đã làm, xem "Kết quả T7" cuối mục)
Yêu cầu: "cho mode siêu thực sang cả thế giới bất khả, mở rộng thế giới này cosmic hơn, cho phép bay lượn trong không trung".
1. **Phong cách siêu thực dùng chung** (cùng công tắc "Siêu thực | Hoạt hình" với Hư Không)
   - Vật liệu nướng GI (`fx/baked.ts`) → "lightmap + IBL": giữ ánh sáng khuếch tán nướng sẵn (GI đúng cả trong hang / hành lang), cộng phản xạ gương từ bản đồ môi trường theo Fresnel + độ nhám, che phản xạ bằng độ sáng nướng (specular occlusion). Vật liệu toon có màu đỉnh → PBR + AO như Hư Không.
   - Thông số PBR theo từ khoá tên vật liệu Blender (vàng / kim loại / gỗ / đá / vải / kính); nhân vật VRM giữ cel.
   - Sàn sân thành đá cẩm thạch bóng có phản chiếu mặt phẳng (khi bật "phản chiếu"); AgX, bóng đổ, god rays như Hư Không.
2. **Bầu trời & vũ trụ**
   - Bỏ panorama → shader "hoàng hôn vũ trụ": dải chân trời tím hồng vàng, tinh vân, thiên hà, hành tinh khí khổng lồ + vệ tinh, sao; dưới chân trời là vực sao.
   - Sân thành đảo nổi: đế đá treo (Blender, GI nướng) dưới sân.
   - Quần đảo vũ trụ quanh sân, mỗi đảo một kỳ quan toán học (Blender): nút ba lá, tháp Sierpiński, cánh bướm Lorenz, vỏ ốc / hoa hướng dương Fibonacci, sợi Hopf. Có nhãn + một câu giải thích.
   - Bố cục / mặt đất đảo thuần trong `lib/world/impCosmos.ts` + test.
3. **Bay lượn tự do** (chỉ ở sân Bất Khả, không ở trong bốt)
   - Trên không bấm nhảy → giang cánh.
   - Hướng nhìn quyết định bay lên / lao xuống: lao xuống thì nhanh dần, bay lên thì chậm lại.
   - Chạy (Shift) = tăng tốc; nhảy lần nữa = gập cánh.
   - Vượt lan can khi đủ cao. Rơi khỏi vực → về sân.
   - Vòng bay phát sáng nối các đảo: bay qua vòng thì tăng tốc + chuông; đủ cả vòng thì bắn pháo hoa.
   - Có vệt sáng đầu cánh, đường gió khi tăng tốc, HUD độ cao / tốc độ.
4. **Kiểm thử**
   - Test thuần: mặt đất đảo, khả năng tới đảo, vòng bay.
   - Thử trên trình duyệt: cả hai phong cách, 4 mức đồ hoạ, khung ngang điện thoại.

### Kết quả T7
- **Siêu thực** (`fx/realify.tsx`, dùng chung công tắc Hư Không): vật liệu nướng → lightmap + IBL (che phản xạ theo độ sáng nướng); toon → PBR + AO. Tên vật liệu giữ qua `bakedMaterial` / `toonize`; bộ uniform nướng tra qua `BAKED_U` (WeakMap — `material.clone()` chép userData bằng JSON làm hỏng `THREE.Color`).
- **Vũ trụ** (`scene/ImpossibleCosmos.tsx`, `props/imp_cosmos.glb` 5,9 MB, Blender + Cycles bake):
  - Bầu trời: shader `impSky` thay panorama; sao đôi lặn là nguồn sáng + god rays.
  - Đế đá treo dưới sân và dưới hành lang Hilbert (hành lang vươn ra vũ trụ; không quấn khi bay trên mái).
  - 9 đảo (5 kỳ quan + 4 đảo nghỉ).
  - Ốc anh vũ nở ×3 mỗi vòng, kèm nhãn bác bỏ ngộ nhận "tỉ lệ vàng".
- **Bay** (`flight.ts`, Player trong `Hub.tsx`, `fx/WingTrails.tsx`):
  - Bay bằng quán tính, nghiêng thân / cánh; máy quay lùi xa, FOV mở theo tốc độ; trần bay 130 m.
  - Vượt lan can khi cao > 1,6 m; rơi < −70 m → về chỗ đứng an toàn.
  - Đường bay 31 vòng có bấm giờ, kỷ lục lưu `world.imp.ringBest`.
  - HUD: độ cao, km/h, vòng, giờ, gợi ý điều khiển, vệt gió.
- **Kiểm thử:**
  - `tests/world/impCosmos.test.ts` (8): mặt đất đảo, khoảng cách đảo, lõi kỳ quan, vòng không đâm vào đảo / kỳ quan / sân, cắt vòng, vật lý leo / lao.
  - Trên trình duyệt:
    - Đã qua: cất cánh → leo 42 m; đáp đảo; bị chặn ở lõi tháp; rơi thì hồi về.
    - Đi đủ 31/31 vòng → về đích + kỷ lục.
    - Bốt (phòng Siêu khối) vẫn đúng; gợi ý bay ẩn trong bốt.

## T8 — Bất Khả: thoát kẹt, phòng thí nghiệm vũ trụ, màn chờ toán – lý (27/11/2026)
- **Sửa kẹt tường khi rơi** (bốt, tàu Theseus, hang…):
  - Nguyên nhân: bay / rơi từ trên cao xuống lòng vật cản. Khi vị trí hiện tại đã bị chặn thì mọi bước đi đều bị chặn.
  - Cách sửa (chung cho mọi cảnh): đang ở trong vật cản thì không chặn bước, đồng thời tự đẩy ra điểm trống gần nhất (`lib/world/collide.ts`, quét vòng đồng tâm).
  - Test hồi quy: `tests/world/collide.test.ts`.
- **Phòng thí nghiệm vũ trụ:**
  - Cơ chế: bấm F ở trạm trên 5 đảo kỳ quan. Mô phỏng chạy ngay trên kỳ quan (`scene/CosmosLab.tsx`). Thẻ điều khiển nằm bên phải, không che cảnh, vẫn đi / bay được (`ui/LabCard.tsx`, `lab.ts`).
  - Toán thuần: `lib/world/cosmosLab.ts` + 6 test.
  - Lorenz: hai hạt lệch ε; biểu đồ khoảng cách thang log.
  - Fibonacci: đĩa hologram mọc hạt theo góc α, có sẵn các góc 137,5° / 137° / 135° = ⅜ / 144° = ⅖, tô họ xoắn 8 / 13 / 21 / 34.
  - Hopf: quả cầu S² ↔ vòng tròn; một vĩ tuyến ↔ mặt xuyến; hai điểm ↔ hai vòng móc nhau.
  - Nút ba lá: tô 3 màu lan dần, đánh dấu 3 điểm giao, hạt chạy dọc nút.
  - Sierpiński: hologram tự lắp ráp bậc 0–5 + bảng số khối / thể tích / diện tích / chiều.
- **Cảm giác bay:** gió tổng hợp WebAudio (to dần và cao dần theo tốc độ).
- **Màn chờ** (`ui/LoadingScreen.tsx`, toán thuần `lib/world/loadToys.ts` + 6 test):
  - Khi nào hiện: chỉ lúc vào game / đổi thế giới / đổi nhân vật, và việc tải kéo dài > 0,3 s.
  - Nội dung: một đồ chơi chạm được — Fourier vẽ bằng vòng tròn, con lắc kép, bảng Galton, kim Buffon ước lượng π, xoắn Ulam, harmonograph.
  - Kèm "Bạn có biết?" (16 sự thật đã kiểm chứng), thanh tiến độ ghi loại đang tải.
- Sóng xung kích khi xuyên vòng bay: xong (T15). Còn có thể làm: bầy hạc giấy Boids quanh quần đảo, tư thế hạ cánh.

## T9 — Quảng trường Khởi nguyên làm lại (kế hoạch 27/11/2026)
Yêu cầu: mở rộng, làm đẹp "chuẩn Honkai: Star Rail" — rộng rãi, đa dạng, dọn chỗ thao tác; cổng dịch chuyển đặc thù; bỏ vòng ma pháp dưới chân → bóng đổ; ấn tượng đầu tiên thật mạnh; mô hình Blender + texture / shader tối ưu.

**Định hướng mỹ thuật**
- Học tinh thần HSR / Genshin, KHÔNG sao chép địa danh cụ thể.
- Màu và chất liệu: đảo học viện toán học lơ lửng trên biển mây lúc hoàng hôn — đá trắng ngà + viền vàng + điểm sáng xanh ngọc (kiến trúc sạch kiểu HSR), xen vườn cỏ hoa xanh tươi (kiểu Genshin).
- Không gian: thoáng, nhiều tầng bậc thấp.

**Bố cục** (`lib/world/hubLayout.ts` + test):
- Mặt đảo: bán kính 36 m (cũ ~15 m).
- Tâm: hồ gương tròn + tượng đài Thiên Nghi Khởi Nguyên (vòng armillary vàng khổng lồ lơ lửng, hành tinh quay).
- Mặt sân: 8 lối đá cẩm thạch toả tia như la bàn, xen bồn cỏ hoa và cây; vòng dạo ngoài sát mép đảo có lan can + đèn.
- Bắc: cổng Sảnh Bất Khả — khung tam giác Penrose.
- Tây bắc: cổng Thung lũng Hàm số — vòm sóng sin dây leo.
- Đông bắc: cổng Vùng Kỳ quan — vòm khối voxel lơ lửng.
- Nam: cổng Mê cung Hoạ âm — vòm đàn lia, dây sóng dừng.
- Tây: bảo tàng tròn mái kính. Đông: đình Gương Hoá Thân.
- Tây nam: vườn sinh vật hoang dã. Đông nam: bãi tập có vòng sàn.
- Điểm vào: phía nam, nhìn thẳng về tượng đài + cổng bắc.

**Mô hình**
- `props/hub_plaza.glb` (Blender, có UV, nướng GI vào màu đỉnh): mặt sân, hồ, tượng đài, 4 cổng, bảo tàng, đình, lan can, đèn, ghế, cây cách điệu, đế đảo + thác.
- Các bộ phận chuyển động có gốc riêng.

**Shader**
- Đá cẩm thạch: vân fbm + mạch lát + phản xạ môi trường.
- Cỏ: lá cỏ instanced có gió, chuyển màu gốc → ngọn.
- Cây: tán đung đưa theo độ cao.
- Mặt nước: fresnel + phản chiếu trời + gợn.
- Bầu trời: hoàng hôn anime + mây fbm, vẽ bằng shader.
- Cổng: mặt cổng xoáy mang màu thế giới đích.

**Nhân vật**
- Bỏ vòng ma pháp dưới chân ở mọi cảnh → bóng tiếp xúc mềm (co giãn theo độ cao).
- Bật bóng đổ thật khi chọn mức đồ hoạ có bóng.

**Giữ nguyên chức năng:** NPC Sương / Diệp, cổng, bảo tàng, gương, sinh vật thuần hoá, quái tập, cột gió + tàu lượn, nhiệm vụ.

**Kiểm thử**
- Test thuần: mặt đất, va chạm, điểm tương tác cách nhau, lối đi thông.
- Trình duyệt: 4 mức đồ hoạ, khung ngang điện thoại, FPS.

### Kết quả T9 (đợt 1, 27/11/2026)
- **Bố cục** (`lib/world/hubLayout.ts` + 7 test):
  - đảo 72 m, hồ lội được;
  - 8 lối toả tia, bồn cỏ hoa;
  - 4 cổng đặc thù: tam giác Penrose THẬT khép kín khi nhìn từ tâm sân, vòm sin dây leo, vòm voxel, đàn lia;
  - bảo tàng vòm kính, đình gương;
  - 4 đài phun nhiều tầng, vườn sinh vật, bãi tập.
- **Mô hình:** `props/hub_plaza.glb` (Blender; nướng GI chỉ khuếch tán, kim loại tạm Metallic = 0 khi nướng).
- **Shader:**
  - sàn: vẽ hoa văn theo toán bố cục, nhiễu nướng sẵn;
  - bầu trời hoàng hôn, cỏ instanced chia cụm, cây đung đưa;
  - mặt cổng xoáy, dây đàn lia sóng dừng.
- **Nước** (nghiên cứu: `RENDER_RESEARCH.md`): mô phỏng sóng GPU, mặt hồ layered, tia và màn tràn bằng mesh, lội có gợn, bọt và giọt văng, vết chân ướt, cầu vồng vật lý.
- **Texture nướng sẵn:** `scripts/world-gen-textures.ts` → `public/world/fx/tex/`. Sinh lúc chạy từng mất 12 s.
- **Sửa kẹt tường:** thoát ra điểm trống gần nhất (`lib/world/collide.ts`).
- **Vòng phép dưới chân** → bóng tiếp xúc mềm, áp dụng mọi cảnh.
- **Đo:** `window.__perf()` / `__toggle()`. Quảng trường từ 19 → 28–44 FPS (trình duyệt tự động).

### Hàng đợi (theo yêu cầu người dùng + 10 việc ưu tiên trong RENDER_RESEARCH.md)
1. Tán cây kiểu Genshin: thẻ lá + pháp tuyến theo cụm, tắt viền mực trên cây lá, nước, hạt.
2. Ánh sáng:
   - nướng chỉ ánh sáng gián tiếp, nắng thời gian thực + bóng;
   - **ngày ↔ đêm theo giờ thật**, hướng mặt trời theo giờ;
   - đèn đường tự sáng ban đêm;
   - lửa trại + khói.
3. Đá cẩm thạch: độ nhám 0,45–0,65; vát cạnh + weighted normals trong script Blender.
4. Nhân vật VRM: ramp theo vật liệu + bóng mặt SDF; viền inverted hull.
5. Thí nghiệm cơ học cổ điển + quang học Newton (lăng kính, đĩa màu…) cầm nắm, điều khiển được.
6. Bầy hạc giấy Boids; sóng xung kích khi qua vòng bay.
7. Tối ưu sâu: LOD / impostor cho cây, KTX2 + Meshopt, khối không gian, compileAsync.

### Kết quả T9 (đợt 2, 27/11/2026) — nghiên cứu Codex trước khi code (cây, ngày/đêm, kỳ dị Lovecraft / hậu hiện đại / lập thể)
- **Cây kiểu Genshin (Quảng trường):**
  - Blender `hub_build5.py`: lõi tán thu 0,86, 130/150 thẻ lá chỉ ở mặt ngoài tán (lọc BVH), pháp tuyến cầu, atlas lá/hoa thủ tục `fx/tex/leaf_atlas.png`.
  - Shader `fx/foliage.ts`: cắt alpha 0,5, ramp 3 bậc, ánh xuyên lá, gió 2 lớp.
  - Mặt nạ viền `fx/InkMask.tsx` (lưu 1/z tán ở nửa độ phân giải): Ink bỏ nét trong tán và quanh lỗ lá, nhân vật đứng trước cây vẫn có viền.
  - `glb_slim.py` giữ UV cho vật liệu `h_card_*`.
- **Chống trượt chân:** game di chuyển 4 m/s (đi) và 7 m/s (chạy), trong khi clip chỉ 0,84 / 1,84 / 2,0 m/s (đi / jog / sprint).
  - Đo tốc độ mặt đất của clip khi nạp (`lib/world/stride.ts` + test).
  - Chọn clip theo **vận tốc thật** (có trễ), tốc độ phát = vận tốc / tốc độ clip.
  - Vòng tự hiệu chỉnh theo độ trượt của chân trụ: hội tụ ~1,05 (jog) và ~0,87 (sprint).
  - Lỗi tìm ra khi đo: VRM0 quay 180° nên trục trước trong hệ cục bộ là −z; đã thêm test hồi quy.
- **Siêu thực, Thế giới Bất Khả:**
  - Bỏ bộ đèn chung (hai mặt trời lệch hướng cộng ambient lớn → khối phẳng lỳ). Còn **một mặt trời ấm ~16°** (3,2) + fill trời lạnh 0,42 + rim tím → tỉ lệ sáng:tối ~3:1.
  - Sàn xanh ngọc sẫm và ngà (tương phản giá trị).
  - Nhân vật: hạ màu gốc 22% + rim mảnh (bớt "bóng sáng" so với Endfield / WuWa).
- **Kỳ dị — Đài Phép Chiếu** (`lib/world/anamorph.ts` + test, `scene/AnamorphSculpture.tsx`):
  - 1100 mảnh tam giác lập thể (1 draw), chỉ ghép thành chân dung kiểu Picasso từ đúng một điểm nhìn (phép chiếu xuyên tâm, kiểu Felice Varini).
  - Mảnh trôi dọc tia nhìn; F tại vòng vàng → máy quay vào điểm nhìn, nhân vật tự ẩn.
  - Mẫu vật "Màu từ ngoài không gian" (màng mỏng lime ↔ lục ngọc theo góc nhìn).
- **Ngày/đêm:** mới có `lib/world/sunClock.ts` (vị trí mặt trời/trăng theo giờ thật, NOAA, Hà Nội) + test. Bảng keyframe 9 mốc giờ nằm trong nghiên cứu Codex (scratchpad), chưa nối vào cảnh.

### Hàng đợi tiếp theo
1. Thế giới Bất Khả — 10 điểm khám phá (nghiên cứu Codex):
   - portal Tesseract;
   - tàu Theseus lập thể;
   - phòng hyperbolic đĩa Poincaré;
   - đảo Sierpiński collage giấy;
   - đồng hồ mềm Lorenz kiểu Dalí;
   - kiến trúc "thở".
2. ~~Ngày ↔ đêm theo giờ thật~~ — **đã làm (đợt 3)**, xem bên dưới.
3. Tốc độ di chuyển: cân nhắc giảm (đi 4 m/s là nhịp jog), hoặc tìm clip sải dài hơn để bước chân bớt dồn ở ×2–3.

### Kết quả T9 (đợt 3, 27/11/2026) — ngày ↔ đêm theo giờ thật (Quảng trường)
- **Phương án A** theo nghiên cứu Codex (rẻ cho điện thoại): giữ GI nướng, chỉ nhuộm màu + đổi mức theo giờ.
  - Không nướng lại, không thêm shadow pass.
  - Hạn chế: bóng nướng không đổi hướng theo giờ.
- `lib/world/dayCycle.ts` (+ test): bảng 9 mốc giờ (nắng, ánh trời, trời thiên đỉnh / chân trời, sương, phơi sáng), nội suy vòng qua nửa đêm, giờ Việt Nam, đèn bật ở −6°…−2°, nhấp nháy lửa.
- `fx/dayState.ts`: uniform dùng chung (trời, cỏ, tán lá, nước, tia nước, ánh đáy hồ). `HubDayCycle` cập nhật 4 lần/giây.
  - Đèn chính / ánh trời có tên (`sunKey` / `hemi`).
  - Ánh nướng `U.uExposure` / `uTint` (đêm lam), `environmentIntensity`.
  - Kính đèn đường HDR về đêm.
- Trời: đĩa mặt trời theo giờ thật, sao lấp lánh + mặt trăng về đêm, mây tối dần.
- `scene/HubNight.tsx`:
  - 26 đèn: vệt sáng giả trên sàn + quầng sáng billboard (2 draw instanced, 0 đèn động);
  - lửa trại ở vòng dạo đông nam (`CAMPFIRE`, có va chạm): 2 tấm lửa nhiễu cuộn, 22 tia lửa, 10 tấm khói (tất cả trong shader), ánh lửa nhấp nháy; đá + củi instanced.
- Thử giờ khác (dev): `window.__hour = 20.5`.
- Hiệu năng: GPU ~17–19 ms ở góc rộng (không đổi). Khung hình đang giới hạn bởi CPU (~300 lệnh vẽ + lượt vẽ lại phản chiếu + lượt mặt nạ tán lá) → việc tối ưu CPU nằm trong mục 7 của hàng đợi.

### Kết quả T9 (đợt 4, 27/11/2026) — Sàn Poincaré (Thế giới Bất Khả)
- `lib/world/hyperbolic.ts` (+ 5 test):
  - đường trắc địa = cung vuông góc đường tròn đơn vị (|c|² = 1 + r²);
  - góc theo tiếp tuyến, khoảng cách hyperbolic;
  - đường tròn cạnh tam giác cơ bản {p, q}: d = 1/√(1 − sin²(π/p)/cos²(π/q)).
- `scene/PoincareFloor.tsx`:
  - đĩa R 3,2 m tại (−1; 6) lát thất giác {7,3} kiểu Escher "Circle Limit" (shader gấp vào tam giác cơ bản, 3 màu theo số lần nghịch đảo, viền vàng mảnh dần về mép);
  - lưới chảy chậm theo phép tịnh tiến Möbius;
  - tam giác trắc địa nối chân người chơi với 2 cột đá (dải sáng 7 cm), bảng sống: ba góc, tổng < 180°, diện tích = π − tổng.
  - Ví dụ: gần tâm 85,9°, sát mép 62,7°.
- Còn lại của 10 điểm khám phá: portal Tesseract, tàu Theseus lập thể, Sierpiński giấy, đồng hồ mềm Lorenz, kiến trúc "thở".

### Kết quả T9 (đợt 5, 27/11/2026)
- **Đồng hồ mềm kiểu Dalí** (`scene/SoftClock.tsx`) trên đảo Lorenz:
  - mặt đồng hồ vắt qua mép đảo (lưới vòng uốn một lần);
  - mặt số La Mã vẽ bằng canvas, kim vẽ trong shader;
  - kim phút quay theo x(t) của một quỹ đạo Lorenz thật → thời gian "chảy", không dự báo được.
- **Tối ưu CPU** (đo bằng cách bọc từng callback useFrame):
  - phản chiếu hồ: khi máy quay đứng yên chỉ làm mới 2 lần/giây;
  - mặt nạ tán lá: vẽ scene riêng, không duyệt cả cảnh;
  - NPC VRM cập nhật 30 / 12 / 4 Hz (gần / xa / ngoài khung nhìn);
  - `plantFeet` không cập nhật lại cả cây xương;
  - thân sinh vật dạng chuỗi gộp thành 2 InstancedMesh, bỏ `<Outlines>` thừa (Ink đã vẽ viền).
  - VrmRig của người chơi ~8 → ~4,4 ms/khung. Còn lại chủ yếu: dựng hình + hậu kỳ (~15 ms CPU), xương lò xo VRM.
- **Chống giật khi di chuyển:** tốc độ phát hoạt ảnh và vận tốc làm mượt theo thời gian (không theo khung); clip đi/chạy/chạy nước rút giữ ≥ 0,4 s mới đổi.
  - Lưu ý khi đo: máy đang chạy song song agent mê cung (thêm phiên game + Codex) nên CPU ~97% và FPS thấp bất thường.
- **Mê cung Họa âm:** giao cho một agent riêng (nghiên cứu Codex trước; nhiều tầng, cổng dọc/ngang thông nhau giữ vận tốc, vòng lặp rơi, bay; giữ nguyên trận boss co-op). Đang làm.

### Kết quả T9 (đợt 6, 27/11/2026) — phép vẽ kiểu HoYo, khiên, di chuyển, ống nhòm, mê cung
- **Nghiên cứu Codex VFX** (scratchpad codex_vfx_answer.md):
  - các lớp anticipation → cast flash → core → hit spark → shockwave → residual;
  - tỉ lệ sáng 65 / 25 / 10;
  - preset cho từng phép.
- **Khiên vẽ vòng tròn** (lỗi: trước chỉ bất tử 1,8 s + loé vòng, bong bóng chỉ hiện ở Quảng trường khi đỡ đòn):
  - `combat.ts → ward` chặn trọn đòn ~6 s × độ chính xác;
  - `fx/Ward.tsx`: bong bóng hiện suốt thời gian hiệu lực ở mọi cảnh (lưới lục giác, fresnel, dải quét, gợn tại phía bị đánh, nhấp nháy sắp hết, tan rã) + vòng chân.
- **Hạt mới** `fx/Sparks.tsx`: 1 batch instanced, tia mềm HDR kéo dài theo vận tốc trên màn hình + glint chữ thập.
  - Thay hệ `Bursts` khối sao / pha lê / lục giác.
  - `emitHit` dùng chung khi trúng đòn (mọi vũ khí).
  - Hạt riêng từng phép: glint hồi máu bạc hà, tia dọc đường sét, dòng hút lỗ đen, lõi loé + tia lửa thiên thạch, vệt sóng.
- **Hào quang niệm phép** `fx/CastAura.tsx`:
  - bật ngay khi bắt đầu vẽ: vòng phép + sao 6 cánh quay, cột sáng, tia xoắn bay lên theo tiến độ nét;
  - nhận ra phép → đổi màu phép; phát → chớp xác nhận.
  - Shader khiên / hào quang biên dịch sẵn ở 2 khung đầu (tránh khựng lần niệm đầu).
- **Di chuyển** (`Hub.tsx` Player + `Avatar.tsx`):
  - vận tốc có gia tốc (~0,12 s) / giảm tốc (~0,09 s);
  - khuếch đại sải chân (góc đùi ×1,35 khi chạy, gối ×1,2) → nhịp bước bớt dồn;
  - tốc độ phát làm mượt theo thời gian, clip giữ ≥ 0,4 s.
- **Ống nhòm lag:**
  - SVG mặt nạ blur toàn màn hình bị raster lại mỗi khung (la bàn subscribe camYaw) → tách memo + layer riêng, la bàn theo độ nguyên;
  - đo khoảng cách bằng bước dọc mặt đất + hình cầu bao thay raycast từng tam giác → bật ống nhòm + xoay: 37 FPS (không còn tụt).
- **Mê cung Hoạ âm** (agent riêng, đợt 1 xong; báo cáo trong phiên):
  - 5 tầng (Đáy −16 … Vương miện 26), 6 cặp cổng dọc / ngang giữ vận tốc, vòng lặp rơi, bay lượn (trừ vùng trời thấp của đấu trường), nhìn xuyên cổng (render target ≤ 30 Hz);
  - `lib/world/sirenMaze.ts` + 16 test.
  - Đợt 2 đang làm: thêm tầng, vùng trọng lực kỳ dị (cầu nhỏ, đi trên tường, trọng lực yếu, sàn nảy, ý tưởng Greg Egan), lỗ sâu.

### Kết quả T9 (đợt 7, 27/11/2026) — sinh vật vũ trụ khổng lồ (nghiên cứu Codex codex_beast_answer.md)
- `lib/world/beastPath.ts` (+ 4 test):
  - đường bay hoa thị khép kín;
  - 64 điểm xương bám đường bay theo độ dài cung;
  - sóng thân lan về đuôi;
  - khung vận chuyển song song (không lật).
- `fx/CosmicBeast.tsx`:
  - thân ống 96 × 14, vị trí đỉnh tính trong vertex shader từ texture xương 64 × 3 (1 lệnh vẽ);
  - vảy tròn, lưng óng ánh / bụng sáng, dải sáng dọc sống lưng, nhịp sáng lan, mắt, phối cảnh khí quyển exp(−0,003 d);
  - vây lưng gợn + cánh màng vỗ 0,14 Hz + râu rồng uốn trễ pha;
  - đuôi tinh vân (80 mảng, 6 s);
  - gầm: sóng xung kích cầu 12 → 72 m trong 0,8 s + âm trầm theo khoảng cách.
- Đặt vào cảnh:
  - Bất Khả: rồng tím – vàng 170 m, R 128, cao 48, 11 m/s;
  - Quảng trường: rồng ngọc bích 140 m, R 215, cao 88, 12 m/s;
  - Hư Không: sâu vũ trụ có đốt 140 m, 9 m/s.
  - Tốc độ chậm theo nghiên cứu (~3,8°/s) để đọc là khổng lồ.
- Agent "Study with me" đang làm: phòng học tập trung; trên tường có lời thề người dùng cung cấp + danh ngôn triết gia.

### Kết quả T9 (đợt 8, 27/11/2026)
- **Tấm Sierpiński giấy cắt dán** (đảo Sierpiński):
  - `lib/world/sierpPaper.ts` (+ 4 test) và `scene/SierpPaper.tsx`;
  - F bóc từng cấp (giấy cuộn lên, bay ra, tan), lỗ thủng nhìn ra vũ trụ;
  - bảng 3ⁿ tam giác · diện tích (3/4)ⁿ · chu vi (3/2)ⁿ; cấp 5 → dán lại.
- **Tương tác tổng quát** `components/world/actions.ts`: điểm gần nhất `{ kind: "action", id }` → `runAction(id)`; cảnh tự `registerAction` (không phải sửa WorldClient cho mỗi điểm mới).
- `Lensing` thêm vào chuỗi hậu kỳ máy yếu (thấu kính hố đen / nhoè lỗ sâu của mê cung).
- **Mê cung Hoạ âm, đợt 2** (agent; `lib/world/sirenGravity.ts` + 11 test):
  - tầng mới tới y = 53;
  - hành tinh tí hon (trọng lực hướng tâm 1/r², vận tốc thoát), Lồng Escher (đi trên tường / trần), Đảo Trăng (g × 0,27), đệm nảy (e = 1,25 / 1,12 / 0,7);
  - hành lang nón sáng (một chiều, 45°), hố đen tí hon (quỹ đạo 1/r²), lỗ sâu hai miệng cầu (cubemap + bẻ tia 1/b);
  - hướng "lên" của máy quay xoay ≤ 125°/s, không lật roll.
  - `Hub.tsx` Player thêm prop `field` (mặc định giữ nguyên hành vi).
  - Em đã kiểm lại Lồng Escher trên trình duyệt: hiển thị tốt, 50 FPS.
- Test thế giới: 187/187.

## T10 — Tên học sinh trên đầu + nút vào Game ở trang chủ (27/11/2026 — đã làm)
- Màn "Vào thế giới" có ô nhập tên (`components/world/ui/NameField.tsx`), Enter để vào; lưu localStorage `world.name`, mặc định = tên tài khoản (`/world` truyền `defaultName`).
- `lib/world/playerName.ts` `cleanName` (+ `tests/world/playerName.test.ts`): NFC, giữ chữ có dấu/số/khoảng trắng và `. _ ' -`, bỏ thẻ, ký tự điều khiển/vô hình/đảo chiều, tối đa 24 điểm mã. Server `realtime/server.mjs` chép đúng quy tắc.
- Nhãn tên trên đầu: của mình `<SelfName/>` trong nhóm nhân vật (Player, Hub.tsx) → mọi map dùng Player; của người khác đã có trong RemotePlayers.
- Mạng: `join` mang `name`; đổi tên giữa chừng `{t:"name"}` (server giới hạn 1 lần/2 s, phát lại `peer`); client cập nhật tên peer tại chỗ (không xoá snapshot).
- Trang chủ: nút "Vào Game" trong StudentHero + mục "Game Thế giới Toán" ở HomeSidebar (người đã đăng nhập).
- Còn: Siren và phòng Study chưa mount RemotePlayers (đã báo 2 agent).

## T11 — Quảng trường hết "rẻ tiền" + nghiên cứu cel/anime env (27/11/2026 — đã làm)
Nghiên cứu (Codex, có nguồn GDC Genshin/Hi-Fi Rush/Guilty Gear Xrd/Sable/Blue Protocol, Guerrilla vegetation): ưu tiên silhouette → ánh sáng + tiếp đất → biến thiên chất liệu → khí quyển → nét/bloom chọn lọc.
- Camera chui vào tán: dither mờ dần vật sát camera 0,9–2,6 m (`fx/nearFade.ts`, IGN) cho thẻ lá, khối tán, thân/gỗ (bakedPBR "leaf"/"wood") và mặt nạ.
- Tán "đống đá viền đen": khối tán h_leaf/h_blossom vào mặt nạ Ink (`canopyMaskMaterial`, cùng công thức gió) → không kẻ nét giữa các cục cầu.
- Mô hình mới (Blender, `scratchpad/hub_props6.py` + nướng `hub_props6_bake.py`, hiệu chỉnh độ sáng theo bản nướng cũ):
  `hx_fountain2` (bể 16 thùy, bụng + phào chỉ, trụ khía rãnh, bát giữa múi + mép lượn sóng nẹp vàng, bát trên vỏ sò, chóp hành, 8 vòi đầu thú),
  `hx_tree_trunk` / `hx_blossom_trunk` (thân cong S, 5 rễ bạnh, 4 cành vút + cành phụ) — bỏ vỏ h_bark cũ khi nhân bản. GLB 7,36 → 7,63 MB.
- Màn nước đài phun: rơi thành 16 / 12 dòng từ mũi mép bát (`flowMaterial({ strands })`) thay tấm "váy kính".
- Sàn: mỗi viên một sắc (ấm/lạnh/sẫm), vài viên thay mới, mảng màu lớn, mạch lõm có AO hẹp.
- Bóng lệch sắc (sàn + bakedPBR Quảng trường): vùng tối ngả lam-tím, vùng sáng ngả kem — không xám bùn.
- Hoàng hôn / bình minh (mặt trời −9°…+5°): nhuộm màu chân trời lên ánh nướng + cỏ, nâng mức sáng; bảng màu 17h/18h30 ấm hơn; vệt đèn đường đậm hơn (0,22 → 0,36).
- Tích hợp phòng Study (cửa ở Quảng trường, điểm tương tác, tên khu HUD, màu lỗ sâu) và menu: đổi tên trong game, "Giảm chuyển động" + âm lượng Mê cung Hoạ âm.
- Còn: khối tán hoa gần camera vẫn phẳng; ghế/đèn còn đơn giản; thử hub vào giờ thật để chỉnh tiếp màu chạng vạng.

## T12 — Z-fighting, nghiêng theo trọng lực qua mạng, tán cây dày (27/11/2026 — đã làm)
- Mê cung Hoạ âm: quét thấy 40 cặp mặt sàn chồng nhau CÙNG cao độ (cầu × đấu trường, cầu × sân, vành đai × sân, ki-ốt × vành đai, bậc × đài…).
  `renderLayers()` (lib/world/sirenMaze.ts, tô màu đồ thị tham lam) xếp tầng vẽ, hạ `RENDER_SINK` 2,5 cm/tầng — chỉ hình, va chạm giữ Surf.y; test hồi quy trong sirenMaze.test.ts. Đệm nảy nổi 3 cm (trước 1 mm).
- Khách sạn Hilbert: thảm / viền thảm trùng mặt sàn → polygonOffset theo lớp; xà trần thò 6 cm sang đoạn kế → kẹp z ≤ 0 (`clampSeam`).
- Mạng: s[8] = quaternion "lên" (vùng trọng lực kỳ dị) — net `setNetTilt` (cảnh tự đăng ký), server kiểm hợp lệ (4 số, gần đơn vị) và gửi ở cuối bộ ảnh chụp; RemotePlayers slerp mượt. Đổi tên dồn trong 2 s → phát tên mới nhất khi hết cửa sổ.
  `realtime/selftest.mjs` (server tạm, 8 kiểm tra) — chạy lại sau khi sửa server.
- Quảng trường: vật chắn giữa camera và nhân vật tan dither (FOCUS = đầu nhân vật); lõi tán tối hơn; thẻ lá 130 → 280 (cây xanh), 150 → 360 (cây hoa). GLB 7,68 MB.

## T14 — Âm thanh & nhạc (27/11/2026 — đã làm, chi tiết `AUDIO.md`)
- Nghiên cứu Codex (Journey, Genshin, No Man's Sky, Tetris Effect, Sky, Eno, Proteus; WebAudio hiệu năng; SFX combat lớp transient / body / tail, giới hạn giọng, ducking) → `AUDIO.md`.
- Lõi chung `components/world/audio/engine.ts`: MỘT AudioContext (hiệu ứng + nhạc + Mê cung Hoạ âm), bus Nhạc / Hiệu ứng (localStorage `world.vol.music` / `world.vol.sfx`), vang mạng trễ chung, limiter, VoicePool, ducking; chỉ mở sau thao tác người dùng; ẩn tab → suspend; công tắc chung `world.sfx` tắt cả nhạc.
- Nhạc nền tạo sinh `<ZoneMusic/>` (WorldClient) + `audio/musicDirector.ts` + `audio/instruments.ts`; logic thuần `lib/world/music.ts` (thang, Markov giai điệu + hợp âm, động cơ + 8 kiểu biến tấu, câu nghỉ / im lặng, dãy số Babel, Shepard, vòng Eno, hồ sơ 8 vùng, ngày ↔ đêm). Crossfade 3 s / 3,5 s. Siren, Study: không nhạc nền.
- SFX theo nguyên tố `audio/sfxKit.ts` + `lib/world/musicVoices.ts` (nguyên tố vũ khí / phép, công thức lớp, VoicePool, biến thiên, duck); `lib/world/sfx.ts` giữ API cũ, thêm `spell`, `explode`, `hurt`, `dash`, `whiff`, `pickup`, `chest`, `levelUp`, `sigilStart/Lock/Fail`, `element`, `elementSource`.
- Móc âm (một dòng mỗi chỗ): combat.ts (nguyên tố vũ khí, vung hụt, chuỗi sét cuộn cảm, né, bị đánh, tuyệt kỹ bung, bổ nhào), spells.ts (5 phép + lỗ đen sập), CombatScene.tsx (nhặt đồ, thiên thạch chạm đất), Sigil.tsx (bắt đầu vẽ / khoá / hụt), quest.ts (hoàn thành nhiệm vụ = thăng cấp), sirenSynth.ts (dùng chung ngữ cảnh). Menu ☰: `AudioSettings` (Nhạc nền, Hiệu ứng).
- Test: `tests/world/music.test.ts`, `tests/world/musicVoices.test.ts` (21 test). Kiểm trên trình duyệt: `window.__audio()` — đủ vùng hub (đêm) / impossible / babel / paradox / expanse đúng hồ sơ, siren = không nhạc; ≤ 8 giọng nhạc, hiệu ứng khi đánh 2–7 giọng; tắt âm → dừng nhạc; âm lượng nhạc 0 → dừng bộ lập lịch; không lỗi console.
- Lớp nhạc chiến đấu: xong T15 — `audio/combatLayer.ts` (trống + bass ostinato theo hợp âm nhạc vùng, 112 BPM, cường độ tăng theo trúng đòn / bị đánh / nổ — móc trong `lib/world/sfx.ts`, bán rã 2,8 s; mẫu nhịp + `combatDecay` trong `lib/world/musicVoices.ts` + test; `window.__audio().combat`).
- Còn: mật độ theo vị trí (Proteus), PannerNode cho đòn ở xa, ~~âm báo trước đòn quái~~ (xong T15: `sfx.telegraph(d)` một lần mỗi lần quái bắt đầu vung, nhỏ dần theo khoảng cách), ~~`sfx.chest()` cho rương Hầm Bổ đề~~ (xong T15: mở rương khi sang `done`).

## T15 — Đợt "làm hết kế hoạch" (27/11/2026, local, chưa commit)
- **Quảng trường — đạo cụ Blender** (`blender-src/hub_props.blend`, không commit; script `hub_props7.py` / `hub_props8.py` / `bake_fixed.py` trong scratchpad): ghế công viên `hx_bench2` (thanh gỗ bo cạnh, mặt ngồi "thác nước", lưng ngả 14°, khung gang vàng tay vịn cuộn, chân đá) + đèn `hx_lamp2` (đế bát giác chân cuộn, trụ khía rãnh, tay cuộn, lồng kính lục giác phát sáng, mái chóp) → `props/hub_props2.glb` (236 KB); bản cũ trong GLB sảnh luôn ẩn (`RETIRED`).
- **Rồng vũ trụ**: cánh màng kiểu rồng / dơi (dây cung hẹp + quét ngược, vỗ 2 khớp, 3 xương ngón, mép sau vỏ sò, màng võng), blend "over" tiền nhân alpha → màng sẫm óng đọc rõ trên trời ngày, gân / mép vẫn phát sáng.
- **Tàu Theseus lập thể** (`scene/TheseusCubist.tsx`, `lib/world/theseusCubist.ts` + test): collage 7 ô Voronoi / 6 góc nhìn sau hai ụ tàu; mặt phẳng cắt vuông góc khung + ép dẹt thành phù điêu (tránh thị sai phối cảnh); ván mỗi tấm một màu, tấm sắp thay nhấp nháy / đã thay hoá vàng ở MỌI mảnh. Sửa kèm (lỗi cũ): chế độ Siêu thực không hiện đổi màu ván ở ụ tàu → vật liệu `userData.live` được Realify đồng bộ mỗi khung; `copyCommon` chép `clippingPlanes`.
- **Kiến trúc "thở"** (`fx/breath.ts`): đá / đất / vỏ ốc quần đảo Bất Khả phồng – xẹp theo pháp tuyến (nhịp ~8 s, pha lan qua không gian, mặt ngang đứng yên, biên độ tăng theo khoảng cách); đứng yên ≥ 2,5 s → thở sâu.
- **W2**: Thảo nguyên Voronoi (ô bậc + rãnh nứt, màu phấn), sin/cos tất định (`dsin`, `dcos` — đa thức, khớp Math.sin < 1e-7), biển báo biome (tên + công thức) trong Expanse; `tests/world/terrain.test.ts`.
- **W4**: sét theo mô hình quả cầu lăn (`lib/world/lightning.ts` + test; cột thu lôi vàng tự xây che chở chân cột), fulgurite (cát → thuỷ tinh, khối `glass` mới thêm cuối `BLOCKS`, chỉ ở máy người chơi), `columnTop` tính cả khối tự xây.
- **W3**: Totem Đối xứng (`scene/SymmetryTotem.tsx`, `lib/world/symmetry.ts` + test: C₂ / C₄ / D₄ / Oₕ, quỹ đạo – ổn định hoá) tại (16, 4) — F đổi nhóm; bản sao chỉ ở máy người đặt (thông điệp "transform" qua mạng: còn).
- **Hiệu năng**: đo Quảng trường (dev, máy đang chạy agent): GPU ~18 ms tỉ lệ với số điểm ảnh (nghẽn tô màu: model ~2 ms, đạo cụ ~1,9, trời ~1,5, cỏ ~0,4); gộp mesh tĩnh GLB sảnh theo vật liệu + góc phần tư (`fx/mergeStatic.ts`, −19 lệnh vẽ); **độ phân giải động** (PerformanceMonitor: DPR × 1 → 0,65 theo FPS, chỉ hạ mức chất lượng khi đã chạm đáy).
- Âm thanh / nhạc vùng: T14 (agent). Hầm Bổ đề: T13 (agent). Combat còn tồn: T16 (agent).
- (T15 tiếp) **W1**: `lib/world/mesher.ts` (+ test) — đọc khối một lần vào mảng dày đặc, AO đỉnh kiểu Minecraft (lật đường chéo theo AO), hình học có chỉ mục (4 đỉnh / mặt); Expanse dùng mesher mới (màu biome + sRGB → tuyến tính như cũ). Worker + greedy meshing: chưa (AO theo đỉnh làm greedy ít gộp được; CPU dựng chunk vốn nhỏ vì `blockTop` có cache).
- **Totem Đối xứng** dùng model Blender `props/totem.glb` (đối xứng D₄: đế vuông, 4 vây, cuộn soi gương, pha lê sáng khi bật).
- **Biên dịch shader trước khi vào cảnh** (`fx/PrewarmShaders.tsx`, `gl.compileAsync` song song, key theo cảnh) — bớt khựng lần đầu thấy vật / hiệu ứng.

- **Sóng xung kích hậu kỳ** (`fx/Lensing.tsx`: `shockwave(vị trí 3D, k)`): vòng nở từ điểm va chạm chiếu ra màn hình, điểm ảnh trong dải vòng bị đẩy theo hướng toả + viền sáng + tách R/B mảnh. Gọi ở: đòn tối thượng / đáp đất (combat.ts), BREAK của Siren, xuyên vòng bay (Bất Khả), qua màn + mở rương (Hầm Bổ đề). Dev: `window.__shock(x, y, z, k, dur)`.
- **Mô hình Blender Hầm Bổ đề** (`public/world/vault/vault_props.glb`, collection VAULT trong `blender-src/hub_props.blend`): đảo nổi + ván cầu buộc dây (InstancedMesh), Đài quan sát (dải xoắn phát sáng), khung cửa tròn ở Quảng trường, điểm tựa + đòn cân + Tảng Bổ đề (khắc ∎), bệ đá nổi + cổng ra sảnh cân, ống đàn 3 mảnh (thân co giãn).
- **Server realtime nhận id khối tới `MAX_BLOCK_ID` = 16** (trước chỉ 0–9) + test `tests/world/blockIds.test.ts` giữ khớp với `lib/world/blocks.ts`.

## T16 — Gói combat còn tồn: M1 / H1 / B1 / V1 (27/11/2026, agent, local, chưa commit)
- **M1 — 3 quái "quy luật"** (spawner Expanse: 10 con, thêm `ghoul`, `warden`, `crab`). Logic thuần + test `tests/world/ruleMonsters.test.ts`; cách nhận đòn `combat/ruleHit.ts`; AI + mô hình + hiệu ứng `combat/RuleMonsters.tsx`.
  - **Ma Tham Lam** (`lib/world/greedyGhoul.ts`): đi từng ô 1 m theo greedy best-first (ô kề gần bạn nhất theo đường thẳng, không cắt góc). Sào huyệt có 3 rào chữ U (27 ô, miệng quay vào tổ). Đứng sau lưng chữ U → nó kẹt ở cực tiểu địa phương (BFS chứng minh đường vòng vẫn có), bối rối không đánh được, chịu ×2,2; đang lao tới thì "nuốt đòn" ×0,35. Mũi tên trên đầu luôn chỉ đường thẳng tới bạn (heuristic). Ra ngoài 11 m thì nó về tổ.
  - **Hộ Vệ Nguyên Tố** (`lib/world/primeWarden.ts`): khiên n (dãy 12, 7, 30, 9, 11, 20, 5, 18, 13, 8) vẽ thành lưới a × b viên gạch (nguyên tố: 1 hàng, màu vàng). Mỗi đòn chỉ đếm; ngừng tay 0,9 s thì chốt loạt c: c | n → n ← n / c (về 1 thì vỡ, hở 5 s, ×1,6); c = 1 không đổi; c ∤ n → phản đòn sóng xung kích 3,2 m (10 sát thương). Đã thử trên trình duyệt: 30 →(3) 10 →(2) 5, loạt 4 bị phản đòn, loạt 5 vỡ khiên, đòn kế gây 16 (= 10 × 1,6).
  - **Cua Chuông** (`lib/world/galtonCrab.ts`): mỗi 5,2 s báo trước 0,95 s (quạt 9 máng trên mặt đất, độ dài mỗi máng ∝ C(8, k)/2⁸ — chính là biểu đồ chuông) rồi thả 20 viên sỏi qua 8 hàng đinh; sỏi chồng thành cột ở máng của nó (còn 3 s). Máng giữa ~27 %/viên, hai máng ngang hông 0,4 %. Lúc thả cua đứng yên, mai trước ×0,3, hông ×1,5 → né ra đuôi phân phối rồi đánh vào hông.
  - Thư khố: 3 trang Ghi chép mới `greedy`, `prime`, `galton` (`lib/world/story.ts`); đồ rơi `KIND_MATS` cho 3 quái.
  - Mô hình: ghép khối cơ bản cùng phong cách `monsters2.glb` (toon 2 tông + phần `glow_*` HDR, nháy trắng + tan biến dùng chung). **Cần bản Blender** (`m_ghoul`, `m_warden`, `m_crab`; giữ tên mảnh `armL/armR/arrow`, `clawL/clawR`, vật liệu `glow_peg` cho đinh bàn Galton).
- **H1** (`lib/world/inputBuffer.ts` + `tests/world/inputBuffer.test.ts`): đệm phím 150 ms — bấm sớm khi nhát đang vung thì nhát kế ra ngay lúc `linkOpen` (chuỗi) / `cancelFrom` (tụ lực, kỹ năng), không đợi hết hoạt ảnh; bấm sớm hơn 150 ms bị bỏ. Huỷ đòn bằng lướt: bấm né lúc đang vung (kể cả pha vào đòn và bước lao của chính nhát đó) → huỷ ngay, HUD hiện "huỷ đòn". Đo trên trình duyệt: bấm sớm ~85 ms → ra đòn ở khung đầu sau linkOpen; bấm sớm ~215 ms → bỏ.
- **B1**: `CAM.focus` (Siren đặt khi đứng trên tầng đấu trường) → Player lùi xa tới ×1,6, hạ góc về ~0,02 rad, nâng điểm nhìn 0,7 m theo smoothstep 13 m → 5 m (`bossFrame` / `closeness` trong `lib/world/vfxBudget.ts`, có test); khi ngắm thì tắt. Đo: camDist 5 → 5,5 m (xa) / 6,5 m (10 m) / 8,4 m (4 m). Sóng xung kích hậu kỳ (`impact()` của `fx/Lensing.tsx`) + vòng nova: Sóng dừng đập (0,55), BREAK (1,0 + hitstop 90 ms, phát hiện theo cạnh `brokenUntil` nên chạy cả khi chơi tổ đội), boss gục (1,2).
- **V1**: `fx/Ribbons.tsx` (1 mesh, 16 dải × 16 điểm, quay mặt về máy quay, lõi trắng → màu, tắt theo tuổi; mũi tên, thiên thạch, quả lắc, đĩa xoắn), `fx/DashGhosts.tsx` (bóng mờ khi lướt / bước lao: SkinnedMesh dùng chung hình học + Skeleton đông cứng, viền fresnel màu vũ khí, 60 ms / bóng, sống 220 ms), cột sáng đồ rơi = FxMat chế độ 3 (`beam_core` + ramp theo độ hiếm, mọc từ đất outBack, thở 1,2 s), Sparks giới hạn 140 / 300 / 480 hạt sống + 40 / 70 / 100 % số hạt mỗi chùm theo `gfx.vfx`; số dải vệt 4 / 10 / 16, số bóng mờ 0 / 2 / 4.
- Rủi ro / chưa kiểm hết: bóng mờ khi lướt và dải vệt chưa chụp được ảnh rõ (máy quá tải, ~20 FPS); rào Ma Tham Lam chỉ chặn quái (người chơi đi xuyên được), trên địa hình bậc thang khối rào có thể lơ lửng / chìm một chút.
- (T15 tiếp) **Model Blender cho 3 quái quy luật** (`monsters/monsters3.glb`, `monsters3_build.py`): Ma Tham Lam (mũ trùm, mặt nạ xương, vạt áo rách, chuỗi xu, tay vuốt `armL` / `armR`, mũi tên `arrow`), Hộ Vệ Nguyên Tố (golem đá vát cạnh, đầu kim cương, khắc 2·3·5·7, rune bệ), Cua Chuông (mai có gờ, mắt cuống, càng `clawL` / `clawR`, bàn Galton + 36 đinh `glow_peg`); `useMonsterModel` ưu tiên GLB, thiếu node thì dùng bản ghép khối. `toonize` giữ tên vật liệu phát sáng (hoạt hoạ tra theo tên).

## T13 — Hầm Bổ đề (The Lemma Vaults), MVP co-op 2–4 người (27/11/2026 — đã làm, chưa commit)
Thiết kế: `COOP_PUZZLE.md`. Một lượt trọn vẹn: Sảnh Ngưỡng cửa → I. Cầu Königsberg (3 màn) → II. Cân Archimedes (3 màn, màn 3 = máy bắn đá) → V. Dàn hợp xướng Fourier (3 màn) → Cỗ máy Định lý (rút gọn) → màn chúc mừng. Chưa có phần thưởng / biên nhận ký số (đúng yêu cầu).
- **Logic thuần** `lib/world/vault/` (`geom`, `konigsberg`, `balance`, `fourier`, `threshold` (+ màn kết), `run`, `text` = chữ en/vi, chỉ client):
  - N = người + Tiếng Vọng (2–4), khoá khi bắt đầu lượt; ghế theo uid; mỗi màn đổi CẤU TRÚC theo N (Königsberg: 2N đảo lẻ → đúng N sợi chỉ; Cân: M·D chọn để cần đủ N người; Hợp xướng: N ống, ống chỉ kêu khi có người đứng).
  - Ping (ngữ cảnh: đảo / cầu / khắc / dây chuông / ống / đá), nói nhanh 12 câu + 2 câu theo phòng (chỉ gửi id), đếm ngược chung 3-2-1 (giờ server), gợi ý 3 bậc (tự mời sau 90 s kẹt / 3 lần tua; hỏi → 5 s ai cũng bấm được "Chưa cần"), làm lại màn theo đa số.
  - Tiếng Vọng chỉ làm theo ping (không biết lời giải): lượn xuống đảo, đi đúng cây cầu được chỉ, đứng khắc, đẩy đá, giữ ống + vặn theo ping +/−/0/đảo dấu, kéo chuông đúng lúc GO.
- **Server**: `realtime/vault.mjs` SINH từ các file trên bằng `scripts/gen-realtime.mjs` (gộp 1 file vì Dockerfile chỉ chép `*.mjs`); `tests/world/vaultSync.test.ts` báo lỗi nếu file cũ + chạy so kết quả TS ↔ mjs.
  `server.mjs`: phòng `vault#MÃ` ≤ 4 người, `join {realm:"vault", code:"new"|MÃ}`, `{t:"leave"}`, `{t:"va", a}` (≤ 20/s), tick 10 Hz bằng vị trí đã nhận, trạng thái ở trường `v` của ảnh chụp CHỈ khi đổi, không gửi uid; tổ đội giữ 30 phút. Bộ ảnh chụp `p` giữ nguyên thứ tự. `selftest.mjs` thêm 13 kiểm tra tổ đội (ALL PASS).
- **Client**: `components/world/vault/` — `VaultScene` (cảnh, ping X / chuột giữa / nhấn giữ 350 ms), `vaultClient` (một mình = chạy logic tại máy 10 Hz; tổ đội = hiển thị trạng thái server), `vaultFx` (trời GLSL, biển sương cel, Tiếng Vọng, cột ping), `chambers/*`, `choirVoice` (PeriodicWave = đúng tổng hoạ âm), `VaultUi` (bảng cửa, ghế, thanh giao tiếp, bảng trạm, thẻ bổ đề, màn kết), `VaultDoor` (cửa ở Quảng trường, góc 1,14 rad).
  `net.ts`: `netVaultCode`, `setNetVault`, `netVaultAct`, `netClock` (chỉ thêm). Mock preview: khách ẩn danh theo TAB (sessionStorage) để thử 2 tab.
- Test: `tests/world/vault{Konigsberg,Balance,Fourier,Run,Sync}.test.ts` (+ `vaultHelpers.ts`: tách sợi chỉ Hierholzer) — có 1 test chơi trọn lượt MỘT MÌNH chỉ bằng ping. Thế giới: 309/309.
- Đã thử trên trình duyệt: một mình trọn lượt (nhảy phòng bằng `__vaultJump` khi dev) + tổ đội 2 tab (lập mã, vào bằng mã, cả hai sẵn sàng, ấn ký, chuông đếm ngược lệch 56 ms, phiến ẩn, tải lại tab → lấy lại đúng ghế).
- Mô hình Blender (27/11): `public/world/vault/vault_props.glb` (vp_island, vp_plank, vp_door, vp_fulcrum, vp_beam, vp_lemma, vp_pipe, vp_dais, vp_overlook, vp_gate; máy bắn S3: vp_cat_court / beam / tower / weight / lever_base / lever_handle / ruler — chuông, bệ đáp, ghế giữ thủ tục vì đổi màu theo trạng thái; GI nướng vào màu đỉnh, sàn 0,3) qua `components/world/vault/vaultProps.tsx` (đảo / ván = InstancedMesh từ GLB). Nguồn: `blender-src/hub_props.blend`, collection VAULT.
- **Màn 3 Cân — Máy bắn đá** (27/11/2026, agent, local): `B_STAGES = 3`. Sân riêng phía sau đòn cân (`COURT`), bập bênh 6 m (`CAT`: bệ đáp đầu ngắn x = −2,5, ghế bắn đầu dài x = 2,5), tháp gió + cột gió 10 m trên bệ đáp, 3 ổ điểm tựa d₂/d₁ = 0,71 / 1 / 1,41 (cần gạt `LEVER`, F), chuông A 4,5 m / B 9 m treo quanh cột bay trên ghế (B niêm tới khi A kêu; chạm chuông dung sai `SW_TOL` 0,2 m), Quả cân Bổ đề (nặng 1) bay khi ghế trống.
  - Vật lý thuần `balance.ts`: `catapultV` (va chạm không đàn hồi quanh trục — bảo toàn mô-men động lượng), `fallV` = √(2·40·h_rơi) (cú lao −26 lúc bắt đầu bổ nhào KHÔNG tính; rơi kẹp `FALL_MAX` 10,8 m), `launchH` = v²/(2·22), `shotH`, `cClaim` (server kiểm: đứng trên bệ ≤ 1,2 m, ở cao trong cột gió ≤ 3 s trước, vy ≤ trần + 1, nghỉ 600 ms; trễ > 250 ms sau cú đầu hoặc < 700 ms sau cú bắn = phí), `cResolve` (gom 250 ms → v₂, người đứng trên ghế bay, không ai → Quả cân), `cSocket`, `cTrack`, `cGround`.
  - `run.ts`: động từ `plunge {vy}` / `socket {i}`; sự kiện `plunge` / `late` / `launch {s: "v|h|n"}`; Tiếng Vọng: ping bệ/tháp → bay lên đỉnh cột gió chờ, bổ nhào lúc GO + 500 ms (chạm đúng như người thật bấm ngay GO), ping ghế → ngồi ghế bắn (được bắn thì bay lên/rơi về), ping cần gạt → dời điểm tựa. N = 2: mình + Tiếng Vọng cùng rơi, Quả cân bay tới B.
  - Client: Hầm không bật chiến đấu nên `VaultScene` tự làm bổ nhào (F khi đang bay trên bệ / chuột trái), chạm bệ → gửi `plunge` với vy theo độ rơi; ghế mình được bắn → `motion.vy = v` (server quyết). `chambers/Catapult.tsx` = hình THỦ TỤC TẠM; HUD: điểm tựa d₁/d₂, hai chuông, thanh "rơi" ↔ "bay", gợi ý 3 bậc riêng màn 3 (`HINTS["balance.2"]`), thẻ Bổ đề II thêm câu bảo toàn mô-men động lượng (Noether).
  - Test: `vaultBalance.test.ts` +9 (bảo toàn L, động năng không tăng, bay < rơi với 1–2 người, hai > một, tỉ số tốt nhất 1 / √2, chuông theo N, kiểm cú chạm, gom 250 ms + trễ, cần gạt, mặt đất), `vaultRun.test.ts` chơi trọn màn 3 một mình; `selftest.mjs` +1. Thử trình duyệt (một mình): Tiếng Vọng rơi → mình bay 4,55 m (A); ổ xa + mình bổ nhào bằng F đúng GO cùng Tiếng Vọng → Quả cân bay 9,03 m (B) → qua màn.
  - Cần mô hình Blender thay hình thủ tục: `vp_cat_beam`, `vp_cat_fulcrum`, `vp_cat_tower`, `vp_cat_bell`, `vp_cat_lever`, `vp_cat_weight`, `vp_cat_court`, `vp_cat_ruler` (bảng kích thước trong báo cáo agent).
- Còn / rủi ro: ~~chưa có catapult (màn 3 Cân)~~ (xong — xem trên; rủi ro: người rơi thấp hơn đỉnh cột gió ~0,3 m là hụt B với 2 người — lề hẹp có chủ đích để ổ giữa KHÔNG tới B; bay thấy trên máy thấp hơn h server ~0,2 m do tích phân khung hình; chưa thử tổ đội thật với độ trễ mạng khi gom 250 ms), ~~chưa có lưu checkpoint khi chơi một mình~~ (xong T15: `lib/world/vault/checkpoint.ts` + test — lưu hạt giống / số ghế / phòng / màn, tải lại trang rồi vào lại một mình là tiếp tục; Rời Hầm / xong hầm thì xoá), chưa kiểm tốc độ dịch chuyển (chống teleport), chưa có Quick Join theo lớp, chưa thử 3–4 người thật.

## T17 — W5 + W6: hang động, đảo nổi, cây L-system, tàn tích WFC, Rừng Đồ thị (27/11/2026, local, chưa commit)
- **Ghép khối tự nhiên theo chunk** (`lib/world/worldgen.ts`): bản đồ độ cao → mật độ 3D → miệng hang → cây → công trình vùng. Cột thường không lưu gì; cột bị đổi lưu một đoạn đè `{ lo, ids }` → `naturalAt` là một phép tra mảng, `columnRange` chỉ mở rộng ở cột có hang / cây / đảo. Cache 320 chunk.
- **Bảng khối** tách ra `lib/world/blocks.ts` (voxels.ts re-export); khối mới ở cuối: `blossom`, `pine`, `plank`, `ruin`, `moss`, `rope` (chỉ do bộ sinh tạo).
- **Mesher**: khoảng y theo TỪNG CỘT (min của 3×3 cột lân cận − 1), ô dưới khoảng là "đặc thật", không còn ~1 000 mặt đáy thừa mỗi chunk; `columnRange` chỉ xét chính cột (hợp đồng: dưới lo đặc, trên hi rỗng).
- **Hang** (`density.ts`): value noise 3D tất định (chỉ + − × floor imul) trên lưới 4×4×4 m nội suy ba chiều; chunk không có mặt nạ hang → `shapeChunk` trả null, không tính nhiễu 3D. Pho mát `C < 0,3`, mì ống `|A−½|, |B−½| < 0,075`, phần nhô `(đỉnh − y)/2 + vùng-chết(O − ½)·12 > 0` (O dẹt theo chiều đứng → gờ đá phân lớp), bỏ mảnh vụn < 2 mặt kề. Hang tô tối 0,58 (pha lê vẫn sáng).
- **Miệng hang**: dốc 3 ô rộng, hạ 1 khối mỗi 2 ô, đầu 4 khối, bậc đỗ trước miệng, khoang ê-líp có pha lê; biển "Hang động".
- **Đảo Phyllotaxis**: quay bằng phép nhân với cos / sin góc vàng (không lượng giác), mặt đảo tô theo họ xoắn n mod 8 (hồng / xanh → thấy cánh hoa hướng dương từ trên), cột vàng ở đảo số Fibonacci (13, 21, 34, 55 gần một tia), hải đăng pha lê ở tâm, cầu thang xoắn ở mép ngoài; cố định gần điểm xuất phát tại (−98, −98).
- **Rừng Đồ thị** (120, 50): Poisson đĩa (≥ 9,5 m), cây nhị phân độ sâu 5, sàn quanh thân, cầu ván = cây khung nhỏ nhất (Kruskal), 2 cầu dây đỏ tạo chu trình, cầu thang xoắn quanh thân nút bậc thấp nhất (hướng tránh cầu). Bỏ cây sát kỳ quan / cầu xuyên kỳ quan.
- **Tàn tích WFC** (−92, 92): 16 mảnh theo cổng N/E/S/W, chọn ô ít khả năng nhất (đếm thay entropy để khỏi `Math.log`), lan ràng buộc, khởi động lại khi mâu thuẫn, mở tường để liên thông; sàn đá xám, tường gạch 3 khối (đỉnh vỡ), dốc ra lối vào, kho báu vàng ở ô xa nhất (BFS).
- **Cây L-system** (`lsystem.ts`): sồi (3 cành / mắt lăn góc vàng), thông pha lê (tầng cành ngang, ngọn pha lê), anh đào (dù hồng), nhị phân; raster gỗ liền mặt; thay `Trees` instanced trong Expanse (cây đào được, có AO).
- **Expanse**: `expanseGround` (máy quay ở trong hang lấy sàn hang, không bật lên mặt đất; mặt nước chỉ chặn cột mở ra trời), `surfaceAt` dò tới đáy cột (rơi khỏi đảo đúng chỗ), biển báo công trình cạnh BiomeSigns.
- **Test** `tests/world/worldgen.test.ts` (11) + mesher (1 mới): tất định, điểm xuất phát / Lò / Totem không đổi, hợp đồng columnRange, hang ≥ sàn + không mảnh vụn, đi bộ hết dốc hang, góc vàng + nhảy được tới đảo tâm, leo cầu thang xoắn từng bậc, cây khung, đi bộ BFS tới kho báu mê cung.
- **Hiệu năng** (Node, máy đang chạy 2 agent khác — dao động ±50 %): dựng lưới một chunk TRƯỚC 3,4–5,7 ms (~2 300–2 450 mặt) → SAU 2,2–6,0 ms (1 400–2 840 mặt); sinh khối (lần đầu) trung bình 2,5–3,5 ms / chunk, chunk vùng hang ~3–5 ms; công trình 1–5 ms (cache).


## T18 — Quần đảo Xuyến (Torus Archipelago) + Cung Vòng (Arc Bow) (27/11/2026, agent, local, chưa commit)
Nghiên cứu Codex (Asteroids, Manifold Garden — vẽ bản sao thế giới + bài GDC level design, HyperRogue không gian thương, Jeff Weeks *Torus Games* / *The Shape of Space*, quy ước "ảnh gần nhất" GROMACS, InstancedMesh / SkinnedMesh docs): trạng thái một bản + quấn ±L dời máy quay cùng lượng; 3×3 bằng instancing; nhân vật bản sao dùng chung xương; mũi tên "luyện tập" trúng lưng mình làm à há đầu tiên; công tắc sau tường + lính canh khiên theo đường ngắn nhất; cẩn thận vệt hạt vắt ngang bản đồ khi quấn.
- **Logic thuần + test** (`lib/world/torus.ts`, `lib/world/torusWorld.ts`, `tests/world/torus.test.ts` — 23 test): `wrap` / `torusDelta` / `torusDist` (ảnh gần nhất), `wrapShift`, `stepBallistic` / `simulateArrow` (cùng tích phân với CombatScene, quấn mép), `launchAngles` (2 góc cùng trúng), `segAabb` / `segSphere` / `segHitsCapsule` (va chạm từng khung, thân người sát mép), `closedLineLength` (đường hệ số góc p/q khép sau L·√(p²+q²)); bố cục đảo (bờ = hoạ âm theo góc), cầu, mặt đất / va chạm quấn mép, Hộp Chuông, Mắt Canh (khiên theo vectơ ngắn nhất, nón 60°), tiến trình localStorage. Test khẳng định cả thiết kế câu đố: bắn thẳng vào hộp chỉ trúng vách, bắn ngược về tây thì vòng qua mép vào chuông; nêm 22° trước miệng hộp không có đất; Đảo Bốn Góc không tới được (kể cả nhảy 5,5 m) khi chưa rung Chuông; quay lưng bắn thì trúng lưng Mắt Canh, bắn thẳng bị chặn; quả cầu của nó bay ngang ngực nên đứng yên là trúng (hồi quy lỗi "đứng trên cầu sáng tự thắng"), né được thì nó vòng L và trúng chủ.
- **Cảnh** `components/world/scene/torus/` — `TorusScene.tsx` (ô 48 × 48 m; quấn người chơi + `CAM.shift`; rơi biển mây → về chỗ đứng an toàn gần nhất; tắt tàu lượn ở đây vì lượn qua mây phá câu đố; 1,5 s đầu quấn lặng lẽ), `torusTerrain.ts` (hình thủ tục gộp: toon màu theo đỉnh + glow HDR; mỗi ô một Mesh chung hình học để cull; vòng ngoài 5 × 5 bản rút gọn khi chất lượng ≠ thấp), `TorusSky.tsx` (trời shader pastel, biển mây nhiễu TUẦN HOÀN chu kỳ L + lưới đường khâu mờ, chiếc xuyến trên trời có chấm vị trí bạn), `TorusHolo.tsx` (ảnh nổi ô vuông → ống → xuyến trong vertex shader, 12 s/vòng), `SelfEchoes.tsx` (8 bản sao nhân vật dùng chung skeleton, B⁻¹ = I, bỏ lượt viền MToon, cull hình cầu, kim cương vàng trên đầu), `ArcBow.tsx`, `Sentinel.tsx`, `torusGame.ts` (sự kiện + gợi ý tăng dần), `torusState.ts`, `TorusUi.tsx` (bản đồ "ô vuông dán mép" có đảo vắt mép + hướng nhìn, mục tiêu, máu Mắt Canh, cảnh báo "đường bay này trúng lưng bạn", bảng Bia Xuyến / Bia Bốn Góc), `TorusDoor.tsx` (cổng ở Quảng trường).
- **Cung Vòng**: Cung Parabol trong vùng này — mũi tên đi qua mép được THAY bằng vật thể mới ở toạ độ ô gốc (vệt Ribbons cũ tắt ở mép, không vắt ngang bản đồ), vẽ thêm ở 8 ô; giương cung hiện chấm đường bay dự đoán (cùng công thức `shootAimed`) quấn mép, vẽ ở 9 ô, vòng cuối đổi màu theo vật sẽ trúng. Vào vùng tự chọn cung; hết ô trống thì mượn ô 3 và trả lại khi rời vùng / đóng trang (`pagehide`).
- **Câu đố**: (1) đi qua mép (à há + Thư khố "Xuyến phẳng"); (2) tự bắn trúng lưng (Thư khố "Bắn trúng lưng chính mình"); (3) Hộp Chuông → cầu sáng dọc đường khâu x = ±24 (cổng tri thức); (4) Mắt Canh Xuyến 3 máu ở Đảo Bốn Góc (rơi đồ `rollDrops("warden")`).
- **Nối vào game (sửa tối thiểu)**: `store.ts` SceneId `torus`; `WorldClient.tsx` (render, điểm xuất hiện, cổng, bỏ Sky/Lights chung, `TorusUi`); `hubLayout.ts` `TORUS_DOOR` 290° + `INTERACT.torus`; `Hub.tsx` (`<TorusDoor/>` + 1 cand); `i18n.ts`, `AreaTitle.tsx`, `Hud.tsx` (tên khu), `WormholeTravel.tsx` (san hô → ngọc lam); `realtime/server.mjs` REALMS `torus`; `lib/world/music.ts` hồ sơ `torus` (lydian, kalimba, gió); `lib/world/story.ts` Thư khố `torus`, `torusbow`.
- **Đo trên trình duyệt** (máy đang chạy nhiều agent, tự hạ chất lượng xuống thấp): 34–45 FPS; nhìn ngang 149 lệnh vẽ / ~405k tam giác (trước khi cull theo ô + bỏ viền bản sao: 205 / 641k), nhìn xuống 68 / 237k. Kiểm thật: đi qua mép x (vị trí 23,74 → −23,57, à há hiện), bắn thật vòng qua mép rung Chuông (dự đoán = thực tế), bắn thật trúng lưng mình, nhìn qua ống nhòm thấy bản sao của mình cách 48 m + thấy miệng Hộp Chuông ở phía tây.
- **Mô hình Blender** (T15, `public/world/torus/torus_props.glb`, collection TORUS trong `blender-src/hub_props.blend`): cây 2 loài (tán khối hai tông), Bia Xuyến, vòm cổng, Hộp Chuông (khớp `BELL_BOX`), cột mốc mép (pha lê nhuộm màu mép), Mắt Canh từng mảnh đúng khe hoạt hoạ (`sw_core/ring0/ring1/rim/eye/rock`), khung cổng Quảng trường `hx_torus_gate` (xuyến vàng có kinh tuyến san hô + vĩ tuyến ngọc lam = hai cặp mép dán). Gộp vào lưới toon/glow theo ô bằng `setTorusProps` + `Builder.addColored` (thiếu node → hình thủ tục cũ). Đảo trôi nhỏ: `tw_floater` (pha lê nhuộm tím). Ván cầu: `tw_plank` (2 tấm + dây buộc). Còn thủ tục: thân đảo (mặt cỏ phải khớp hàm độ cao), cột lan can cầu.
- **Rủi ro / còn lại**: người chơi khác (RemotePlayers) và hiệu ứng hạt chỉ vẽ ở ô gốc (thấy "nhảy" khi họ qua mép); quái thường không dùng ở vùng này; khe hở ngắm Hộp Chuông khá hẹp (~1,4° ngang) — có đường chấm dự đoán bù lại, cần thử với học sinh; nhãn 3D chỉ ở ô gốc; bản sao nhân vật vẫn tốn tam giác (VRM) khi nhiều bản trong khung.

## T19 — Chợ Xác Suất (Chance Bazaar) (27/11/2026, agent, local, chưa commit)
Nghiên cứu Codex (Nicky Case / Explorable Explanations, Seeing Theory, Setosa, 3Blue1Brown "xét nghiệm y khoa", tần số tự nhiên của Gigerenzer, XCOM / Sid Meier GDC 2010 về cảm nhận xác suất, Slay the Spire / Balatro quyết định theo kì vọng, bộ đếm "bảo hiểm" gacha): vòng **Đoán (chốt con số) → Xem một lần chậm → chạy nghìn lần → so** mới tạo à há; hiện rõ MẪU SỐ (100 rương); **chấm QUYẾT ĐỊNH theo kì vọng, không chấm kết quả** (không phạt học sinh vì xui); cho thấy sai số mẫu nhỏ; tỉ lệ ổn định nhưng chênh lệch tuyệt đối vẫn tăng.
- **Logic thuần + test** (`lib/world/bazaar.ts`, `lib/world/bazaarWorld.ts`, `tests/world/bazaar.test.ts` — 17 test, seed cố định): bài toán ngày sinh (`birthdayP`, ngưỡng 23, kì vọng 24,62, thả vò thật → trung vị 23); Bayes (`posterior`, hệ số Bayes 4,5, bãi 100 rương có tần số tự nhiên CHÍNH XÁC 9 mimic đỏ / 27 đèn đỏ, chỉ xáo vị trí theo seed); tổng xúc xắc (`diceCounts` bằng tích chập, so sánh SỐ CÁCH nguyên — không sai số), màn slime chỉ có đúng một lời giải (2 xúc xắc: ô 7; 3 xúc xắc 2 lưới: {10, 11}); bánh xe 37 ô (`afterStreak`: sau ≥ 5 Đỏ, Đen vẫn 18/37; `llnTrace`: sai số tỉ lệ giảm ~31 lần còn chênh lệch Đỏ − Đen tăng ~31 lần từ n = 100 → 100 000); thương vụ `offerEV` / `judge` — test khẳng định mỗi bộ thương vụ có một bẫy (bỏ tỉ lệ nền / ảo tưởng con bạc / "phải gần nửa số đèn") làm trực giác sai, EV không sát 0 (trừ vò 23 = +0,01, cố ý); bố cục BFS từ điểm vào tới mọi quầy + mọi ô đường ray; đọc tiến trình hỏng an toàn.
- **Cảnh** `components/world/scene/bazaar/` — `BazaarScene.tsx` (sân tròn 26 m, dây đèn kết từ Tháp, cổng về, cột chỉ đường **sang Sân khấu Ba Cửa ở Sảnh Bất Khả** — Monty Hall không làm lại), `BazaarSky.tsx` (trời đêm GLSL: sao, Ngân Hà, trăng, đèn trời bay lên, biển mây đêm hắt ánh chợ), `WispTree.tsx` (Đèn Năm: cột + 12 dây tháng + 365 đèn InstancedMesh; đom đóm bay cung cong, trùng đèn → pháo hoa + "Trùng! con thứ N"; nghìn vò → cả cây lấp lánh), `MimicField.tsx` (100 rương InstancedMesh nắp có bản lề; Đèn Soi quét từng hàng; mở rương đỏ: mimic hoá tím nảy + mắt đỏ, rương thật toả vàng; 3 rương thương vụ trên quầy có đèn soi + biển tỉ lệ nền), `SlimeTrack.tsx` (đường ray ô 0…18 + dải số; slime nhảy từng mặt xúc xắc, rơi xong CHỒNG lên nhau → đống slime chính là biểu đồ phẳng / tam giác / chuông; lưới cắm bằng F), `StreakWheel.tsx` (bánh xe đứng 37 ô quay ease-out, bảng chuỗi 10 đèn, Thầy Chuỗi; Tháp Số Lớn ở tâm: kim tỉ lệ co về vạch 18/37, con trượt chênh lệch lang thang ra xa), `bazaarState.ts` (zustand + FX không React, vé hội riêng của Chợ — KHÔNG phải xu, hết vé được tặng 5), `BazaarUi.tsx` (thẻ 4 dấu + vé, gợi ý / à há, bảng quầy neo phải để vẫn thấy cảnh: thanh trượt dự đoán, biểu đồ SVG có vạch "bạn đoán" vs "thật", khảm 100 rương, đồ thị luật số lớn, thương vụ nhận / bỏ kèm dòng giải thích EV), `bazaarProps.tsx` (quầy / người bán / cột biển — hình TẠM), `BazaarDoor.tsx` (cổng chợ đêm ở Quảng trường, mặt shader: xúc xắc rơi dựng cột hình chuông + đom đóm).
- **Bốn quầy**: (1) Đèn Năm — đoán con thứ mấy trùng → vò thật → 1000 vò (trung vị 23, "đếm CẶP: 253 cặp") → Bà Lịch cá ngang tay "không trùng" với vò 12 / 23 / 40 (bộ khác: 30 / 15 / 25, 20 / 50 / 10). (2) Rương Mimic — đoán P(mimic | đỏ) → soi + mở bãi 100 rương (9 / 27 = 33 %) → mua / bỏ 3 rương (1 đỏ ở xe 10 % → MUA, 2 đỏ → bỏ; bộ khác: cùng 1 đỏ nhưng xe 40 % → bỏ; 2 đỏ ở xe 5 % → vẫn mua). (3) Ruộng Slime — 3 màn 1 / 2 / 3 xúc xắc, 1 / 1 / 2 lưới, chấm theo số cách ≥ 1/6, ≥ 1/6, ≥ 1/4. (4) Bánh Xe Chuỗi — đoán P(Đen | 5 Đỏ) → Thầy quay một chuỗi Đỏ thật (tìm trong dãy ngẫu nhiên) → 20 000 lần → thương vụ: cược theo chuỗi ×2 (luôn lỗ 1/37) vs Cô Hàng Bên ×2,2 (luôn lời). Đủ 4 dấu: 1 Hạt Vàng + 2 Đá Nguyên Tố (một lần), mỗi dấu mở một trang Thư khố.
- **Nối vào game (sửa tối thiểu)**: `store.ts` SceneId `bazaar`; `WorldClient.tsx` (import, điểm xuất hiện, cổng, bỏ Sky / Lights chung, render, `BazaarUi`); `hubLayout.ts` `BAZAAR_DOOR` 242° (giữa đèn 236° và thác 248°) + `INTERACT.bazaar`; `Hub.tsx` (`<BazaarDoor/>` + 1 cand); `i18n.ts` (`bazaarName`, `enterBazaar`), `AreaTitle.tsx`, `Hud.tsx`, `WormholeTravel.tsx` (cam → tím); `realtime/server.mjs` REALMS `bazaar`; `lib/world/music.ts` hồ sơ `bazaar` (ngũ cung trưởng, đàn gảy, dế đêm); `lib/world/story.ts` Thư khố `birthday`, `bayes`, `clt`, `gambler`.
- **Đã thử trên trình duyệt** (máy chạy nhiều agent, chất lượng thấp, 25–45 FPS): cổng ở Quảng trường; Đèn Năm (vò thật trùng ở con 33, nghìn vò); Bãi Rương (quét → 27 đèn đỏ → mở → khảm 9 / 27, mua đúng 3 vụ → dấu, rương bỏ qua hoá mimic nhảy); Ruộng Slime (màn 1 → 2 (ô 7) → 3: cắm {9, 10} trượt dù bắt 8 con, cắm {10, 11} qua → dấu); Bánh Xe (chuỗi 5 Đỏ, sau chuỗi Đen 50,7 % / 529 lần, thương vụ đúng nhưng vụ ×2,2 thua — vẫn được dấu); đủ 4 dấu → quà + à há; tiến trình còn sau khi tải lại trang. Không lỗi console.
- **Mô hình** (T15): `public/world/bazaar/bazaar_props.glb` (collection BAZAAR, `bazaar_build.py`): sân lát vòng `bz_plaza` (≈1 500 viên đá lệch hàng, 3 vòng khảm vàng, sao 8 cánh giữa sân, bó vỉa, thân đảo đá), 3 quầy `bz_stall_wisp/_slime/_mimic` (ván dọc, váy vải lượn sò, mái sọc, đèn lồng giấy phát sáng, thùng hàng), giá Bánh Xe `bz_wheel_stand` (chữ A + khung bảng chuỗi), Tháp Số Lớn `bz_tower` (bát giác, đai vàng, viền mặt đồng hồ, khung thanh chênh lệch); cổng `hx_bazaar_gate` ở `props/hub_gates.glb`. Người bán = nhân vật anime VRM (kimono / elf / cute-cat / rougan) qua `Keeper vrm=…`. Rương (thân ván + đai sắt + khoá, nắp vòm) và slime (giọt bẹt, chỏm tóc, mắt, má hồng) = `bazaar/bazaar_inst.glb` (một vật liệu trắng, màu đỉnh = màu × GI, instanceColor nhuộm thêm). Còn thủ tục: đèn lồng 365 + dây, đom đóm, ô đường ray, lưới, bánh xe (mặt 37 ô), bảng đèn, cột chỉ đường, dây đèn quanh sân.
- **Còn / rủi ro**: co-op mới ở mức "cùng realm, thấy nhau" — trạng thái quầy CHƯA đồng bộ (seed riêng mỗi máy); ý tưởng co-op tự nhiên để làm tiếp: mỗi người cầm một Đèn Soi độc lập (hai lần soi = hai người), thân người làm lưới slime (đã có `tileAt`, cần seed chung theo giờ server). Thương vụ vẫn có dáng "câu hỏi nhận / bỏ" — đã bọc trong lời mời của người bán + kết quả thật, cần thử với học sinh xem có thành đoán mò 2³ = 8 lần không (hiện đổi bộ khác mỗi lần sai; có thể thêm "phải đúng 2 bộ liên tiếp"). Màn slime 1 (1 xúc xắc) luôn qua — chỉ là màn làm quen. Bãi rương có số đếm cố định (9 / 27) để dạy, không ngẫu nhiên — ghi rõ trong code. Chưa có Pólya urn (đối chứng "khi nào quá khứ CÓ ảnh hưởng"), Monty 100 cửa, Buffon. Sửa nóng (HMR) trong lúc dev có lần làm nút F tạm không ăn (tải lại trang là hết). Chưa thử iPad / điện thoại (bảng quầy neo phải có thể che nút hành động).

## T20 — Bờ Sóng (Wave Coast) (27/11/2026, agent, local, chưa commit)
Nghiên cứu Codex (GPU Gems ch.1 Gerstner + pháp tuyến giải tích, Crest — giải ngược độ dời ngang để đo độ cao, Rare *Sea of Thieves* SIGGRAPH 2018 (bọt theo độ sâu, đỉnh sóng ngược sáng), PhET Wave Interference / Pendulum Lab / Bending Light, OpenStax sóng dừng / dao động cưỡng bức, dữ liệu chiết suất N-BK7): sóng gameplay phải GIẢI TÍCH để logic và hình khớp; dải nút giao thoa cần một đường viền ĐỨNG YÊN để phân biệt "lặng thật" với chỗ sóng tạm qua 0; cửa sổ đẩy xích đu quanh lúc qua đáy; tán sắc vẽ 3 dải nhưng logic dùng 1 dải.
- **Logic thuần + test** (`lib/world/waves.ts`, `lib/world/coastWorld.ts`, `tests/world/waveCoast.test.ts` — 17 test): đồng hồ chung `coastClock(Date.now())` quấn 240 s, MỌI chu kỳ chia hết 240 (không giật, float32 đủ chính xác); thuỷ triều `tideLevel` (sin 48 s, ±0,8 m), `waitBelow` / `windowBelow`; biển 6 sóng Gerstner nước sâu ω² = g·k, tổng độ dốc 0,55, `shoal(x)` nhỏ dần vào bờ, `seaHeight` giải ngược điểm bất động (sai số < 1e-4 m so với mặt đã dời); giao thoa hai nguồn `lagoonH` / `lagoonAmp` (M = |2A·cos((kΔ − φ)/2)|) / `lagoonSlam` / `nodalX`; con lắc RK4 bước 1/120 s, điểm treo lắc theo sóng lừng 3 s, lực viết đủ m (khối lượng triệt tiêu thật), `bellStrike`, `pushQuality`; Snell 2D `refract2` / `traceGlass` (phản xạ toàn phần trong khối lồi) / `prismPoly` / `deviation`.
  Test khẳng định chính các câu đố: cửa sổ Lối Triều ~18 s đủ chạy qua (≥ 2 × thời gian lội) nhưng < 45 % chu kỳ, nước lớn thì giữa doi cát bị cuốn, sóng cuốn đưa về chỗ khô không bị chặn; đi thẳng đường giữa đầm khi cùng pha bị đánh nhiều lần, đảo pha thì đường giữa M = 0; KHÔNG đảo pha vẫn qua được theo hyperbol r₁ − r₂ = λ/2 tới tận khe giữa hai nguồn (dải lặng > 0,6 m ở giữa đầm); BFS: hang Nàng Tiên Cá KHÔNG tới được nếu không lội qua đầm; chỉ dây 2,24 m để sóng tự rung chuông (≤ 25 s), 4 nấc khác 2 phút không chạm (bắt đầu ở 3 pha sóng); quả 0,3 kg và 40 kg lắc trùng tới 1e-9; đẩy đúng nhịp thì dây nào cũng tới chuông, đẩy ngược nhịp thì không; chu kỳ tự do đo được khớp 2π√(L/g) < 1 %; góc lệch nhỏ nhất của lăng kính đúng 2·asin(n/2) − 60°, tím lệch hơn đỏ; tia thẳng không trúng tinh thể, ≥ 2 nấc xoay với 2 góc tới khác nhau trúng tinh thể A, tinh thể B chỉ trúng khi có phản xạ toàn phần, nấc đầu chưa giải sẵn.
- **Cảnh** `components/world/scene/coast/` — `CoastScene.tsx` (đèn, sương, mặt đất / va chạm, lội chậm, triều cuốn + `CAM.shift`, sóng đầm đánh bạt bằng bước lướt có va chạm, tiến trình theo vị trí, tắt tàu lượn vì lượn qua đầm phá câu đố, điểm bấm F), `coastFx.tsx` (trời shader; biển: lưới dày ở vùng chơi thưa dần ra xa, đỉnh = đúng `SEA` + `shoal` + triều, pháp tuyến + định thức Jacobi tính lại từng điểm ảnh → bọt đỉnh, bọt bờ theo độ sâu giải tích (hàm mặt đất sinh từ hằng số của `coastWorld`), cel 3 bậc, fresnel Schlick, đỉnh ngược sáng; mặt đầm: đỉnh = `lagoonH`, điểm ảnh tô theo M — dải lặng ngọc + viền đứng yên, bụng có bọt chạy ra), `coastTerrain.ts` (lưới địa hình thủ tục màu theo đỉnh, chỗ bị chặn nâng thành vách để nhìn), `CoastProps.tsx` (chỗ giữ + `GlbOr`: tự thay bằng node GLB cùng tên khi có `public/world/coast/coast_props.glb`, thiếu file thì im lặng dùng chỗ giữ), `ResonanceBell.tsx`, `PrismLight.tsx` (tia vẽ từ đúng `traceGlass`, vạch pháp tuyến ở mặt vào, 3 dải tán sắc), `coastGame.ts` (sự kiện + gợi ý tăng dần), `coastState.ts`, `CoastUi.tsx` (thước triều: đồ thị sin + chấm "bây giờ" + vạch lội được + "còn / sau x s"; bảng số con lắc: L, T = 2π√(L/g), nhịp sóng 3 s, thanh biên độ, ô "đẩy đúng nhịp"; lăng kính: θ₁, θ₂, góc lệch, góc tới hạn, số lần phản xạ toàn phần; đầm: pha nguồn 2, r₁ − r₂ theo λ, biên độ chỗ đứng; 3 bia có sơ đồ), `CoastDoor.tsx` (cổng ở Quảng trường, mặt cổng = giao thoa hai nguồn).
- **Câu đố / à há**: (1) Lối Triều — mực nước là hình sin; đoán pha để lội doi cát (Thư khố `tide`); (2) Hải đăng Snell — xoay lăng kính 7,5° / lần, tia bẻ 2 lần lệch về đáy, hai góc xoay cùng trúng (gần góc lệch nhỏ nhất); thêm tinh thể B chỉ sáng nhờ phản xạ toàn phần (Thư khố `snell`, thưởng Lăng kính Snell); (3) Chuông Cộng hưởng — tời 5 nấc 0,9 / 1,4 / 2,24 / 3,4 / 4,4 m, quả nặng / nhẹ không đổi gì, chọn L = 2,24 m thì sóng tự rung chuông, hoặc đẩy tay đúng nhịp (Thư khố `resonance`, thưởng Chuỳ Con lắc); (4) Đầm Giao thoa — đi trên hyperbol nút, hoặc gạt cần đảo pha nguồn 2 để đường giữa lặng (Thư khố `interference` có sẵn) → Hang Nàng Tiên Cá = cổng sang Mê cung Hoạ âm (boss Fourier Siren B1, `lib/world/boss.ts` — dùng lại, không nhân bản). Hợp tác: một người gạt cần / quay tời, người kia lội / đẩy; sóng và triều cùng đồng hồ nên hai máy thấy giống nhau.
- **Nối vào game (sửa tối thiểu)**: `store.ts` SceneId `coast`; `WorldClient.tsx` (import, điểm xuất hiện, cổng, bỏ Sky / Lights chung, render, `CoastUi`); `hubLayout.ts` `COAST_DOOR` 157,5° (giữa bảo tàng và vườn, giữa đèn 146° và ghế 164°, xa thác 112° / 248°) + `INTERACT.coast` (test hubLayout tự kiểm điểm tương tác cách nhau ≥ 4 m); `Hub.tsx` (`<CoastDoor/>` + 1 cand); `i18n.ts` (`coastName`, `enterCoast`); `AreaTitle.tsx`; `Hud.tsx`; `WormholeTravel.tsx` (lam biển → vàng cát); `realtime/server.mjs` REALMS `coast` (đã khởi động lại server local); `lib/world/music.ts` hồ sơ `coast` (dorian, marimba, gió, 66 bpm); `lib/world/story.ts` Thư khố `tide`, `resonance`, `snell`.
- **Mô hình Blender** (T15, `public/world/coast/coast_props.glb`, collection COAST trong `blender-src/hub_props.blend`, script `coast_build.py`): cầu tàu (56 ván, cọc + dây quấn, cột buộc), cầu phao (phao đỏ đai trắng), hải đăng (5 dải đỏ–trắng, cửa / cửa sổ, ban công lan can, khung phòng đèn, mái chóp + chong chóng), gương mặt trời, bàn xoay, 2 nguồn sóng + pít-tông phát sáng, cần gạt đảo pha, 3 bia (gợn sóng khắc sáng), vòm cổng về Quảng trường, hang Nàng Tiên Cá (đá + nhũ sáng); cổng `hx_coast_gate` (cùng `hx_torus_gate`) ở `props/hub_gates.glb` 280 KB để Quảng trường không tải cả đạo cụ vùng. Giữ thủ tục (đổi vật liệu theo trạng thái câu đố): tinh thể A/B, phòng đèn sáng, lăng kính kính trong, tời (vạch nấc sáng), giá quả lắc, khung con lắc / quả / chuông.
- **Đo trên trình duyệt**: đã thử thật (máy chạy nhiều agent, 21–31 FPS ở chất lượng trung bình; Chrome dùng chung từng mất ngữ cảnh WebGL một lần, tải lại thì chạy): bãi biển + biển Gerstner có bọt bờ, nước rút lộ doi cát rồi dâng ngập lại đúng thước triều; Đầm Giao thoa thấy rõ dải lặng hyperbol, gạt pha → đường giữa thành dải lặng thẳng; đặt tời nấc 2,24 m, không đẩy tay — ~24 s sau chuông tự kêu (à há "tự nó" hiện); bấm F 9 lần ở lăng kính: qua nấc 6 sáng tinh thể B (phản xạ toàn phần), nấc 9 trúng A, hải đăng sáng, bảng số θ₁ = 37,5°, θ₂ = 23,6°, lệch 41,7°; cổng ở Quảng trường hiện đúng chỗ (mặt giao thoa). Đã hạ biên độ đầm A 0,22 → 0,16 m (SAFE_M 0,12) sau khi nhìn thấy sóng quá dựng.
- **Còn / rủi ro**: trạng thái câu đố (pha nguồn 2, nấc tời, quả lắc, nấc lăng kính, cú đẩy) chỉ ở máy mỗi người — sóng / triều đồng bộ theo đồng hồ máy (lệch giờ máy vài trăm ms là lệch pha thấy được), chưa đồng bộ qua server; Siren vẫn là cảnh riêng (cổng hang dẫn sang), chưa có trận "Fourier Siren ngoài biển"; Sine Lance / Pendulum Shield chưa làm (chỉ thưởng vũ khí có sẵn); người chơi đứng trên cầu phao không lắc theo nó (chỉ giá treo lắc 0,18 m); chưa có va chạm quả lắc ↔ người chơi; lướt liên tục có thể vượt bụng sóng ở đầm (cố ý cho phép như đòn "beat" của Siren, cần thử với học sinh); bọt bờ dùng mặt đất giải tích đã bỏ gợn nhỏ và cầu tàu (lệch vài cm); địa hình lưới 0,5 m ≈ 75k tam giác; chưa thử trên iPad.

## T22 — Giáo Sin + Khiên Con lắc (28/11/2026, agent, local, chưa commit)
Hai vũ khí của Bờ Sóng (WORLD_DESIGN: Sine Lance, Pendulum Shield). Quy luật chính là cơ chế; toán thuần có test, phần chạy từng khung nối vào combat qua điểm nối `WEAPON_EXT` (combat.ts sửa tối thiểu).
- **Logic thuần + test** (`tests/world/waveWeapons.test.ts`, 15 test):
  - `lib/world/sineLance.ts`: v = λ·f (v = 4 m/s, λ = 1,6 / 2,4 / 3,2 m); hệ số nhát đâm theo vị trí trên sóng `crestMul` (đỉnh s = (2n + 1)λ/4 ×1,5, nút s = nλ/2 ×0,7); biên độ tụ lực theo thời gian giữ (0,45 → 1,3 m); bó sóng chạy `Packet` (gốc, hướng, t₀, A, λ, số bước sóng, tầm, làn rộng A + 0,7 m); chồng chập `superpose` (tổng y, dy/dt, biên độ phasor); `classify` (tăng cường / triệt tiêu); `phaseFromDelay` Δφ = 2π·Δt/T; `crestEvent` (dy/dt đổi dấu, |y| ≥ 0,15); `crestDamage` ∝ |y|; `simulatePoint` (đúng vòng lặp trong game, dùng cho test); `standingPair` (bó đi + bó phản xạ từ vách cách 2λ → sóng dừng).
  - `lib/world/pendShield.ts`: T = 2π√(L/g) (dây 0,25 / 0,4 / 0,6 m → T/4 = 0,25 / 0,32 / 0,39 s, đều < 450 ms báo trước của quái); pha ψ, θ = θ₀·cos ψ; `parryGrade` (hoàn hảo khi cách lúc qua đáy ≤ 90 ms, tốt khi |θ| < 0,7θ₀, còn lại yếu); chặn 100 / 70 / 30 %; ½mv² = mgL(1 − cos θ₀); phản đòn ∝ động năng (chặn trên ×3 mốc); đòn đập theo tỉ lệ động năng lúc chạm; cộng hưởng `pump` / tắt dần `decay` (τ = 6 s); giải phóng năng lượng `releaseBurst`.
  - Test khẳng định: đỉnh / nút đúng chỗ, quái cách 2,4 m chỉ λ = 3,2 đặt đỉnh (hai λ kia đặt nút); một bó đi qua = 2 đỉnh / bước sóng; hai bó cách đúng T → biên độ 2A, cách T/2 → 0 (mô phỏng: không trúng lần nào trong vùng chồng); sóng dừng: nút không trúng, bụng |y| ≈ 2A; buông từ đỉnh tới đáy sau T/4 với cả 3 dây; bảo toàn cơ năng; phản đòn tăng theo L và θ₀; cộng hưởng tăng rồi tắt dần về nền.
- **Giáo Sin** (`lance`, 5★, công 14): chuỗi 4 nhát (Đâm sin, Đâm chéo, Quét pha, Đâm cộng hưởng); mỗi nhát đâm chạm ngay quái trên đường đâm với hệ số đỉnh / nút (chữ "đỉnh sóng ×1,5" / "nút sóng ×0,7") và thả một bó sóng nhỏ; GIỮ chuột = biên độ A lớn dần (sóng xem trước trước mặt, HUD hiện A), THẢ = Sóng tụ (bó 3 bước sóng, sóng xung kích hậu kỳ + chấn); E = Sóng dừng (nút / bụng hiện trên đất); X = đổi λ. Bó sóng đánh quái mỗi lần ĐỈNH của TỔNG đi qua (|y| càng lớn càng đau), chỗ hai bó cùng pha "tăng cường!" (×1,3, khựng hình), ngược pha "triệt tiêu". HUD: đồ thị y = A·sin(kx − ωt) chạy, A / λ / f = v/λ / T, đồng hồ pha Δφ (kim ở đỉnh = thả lúc này cùng pha). Chấm đỉnh (xanh) / nút (đỏ) trên đất trước mặt.
- **Khiên Con lắc** (`shield`, 5★, công 12): quả lắc treo dưới tay trái, luôn treo theo trọng lực (xoay `pend_pivot` mỗi khung, dây co giãn theo L). Chuột phải = thế đỡ: buông quả lắc từ đỉnh (ψ = 0) → tới đáy sau T/4, tích tắc mỗi lần qua đáy; đòn quái tới đúng đáy = ĐỠ HOÀN HẢO (chặn trọn, hitstop 120 ms, sóng xung kích, phản ½mv² vào quái vừa đánh, biên độ tăng — đỡ hoàn hảo liên tiếp trong 4 s là "Cộng hưởng ×n"). Chuỗi 3 nhát đập quả lắc (sát thương 0,6 → 1,5 theo động năng lúc chạm; đập đúng đáy cũng đẩy biên độ); giữ chuột trái = Giải phóng cộng hưởng (bán kính + sát thương theo E, về biên độ nền); E = Dao động cưỡng bức (3 nhịp sóng, mỗi nhịp cách đúng T — dây dài nhịp chậm); X = đổi dây L. HUD: con lắc thu nhỏ lắc đúng góc thật + cung xanh = cửa sổ hoàn hảo, L / T / T/4 / θ₀ / ½mv², thanh cộng hưởng; máy cảm ứng có nút "Đỡ".
- **Nối vào game (sửa tối thiểu)**: `combat.ts` (`WEAPON_EXT` + `weaponAlt` / `weaponTune` / `holdMs`, `fireCharged` tách ra để tụ lực khi THẢ, nhánh `default` của `execHit`, điểm nối thế đỡ trong `playerHurt`, 2 vũ khí mới tính là cận chiến cho tuyệt kỹ); `combo.ts` (5 hình đòn mới `sine` / `standing` / `bob` / `release` / `drive` + 2 thế võ; test clip thêm `Shield_OneShot`); `items.ts` (định nghĩa, `WEAPON_ORDER`, `REWARD_ONLY` — không rơi từ quái); `musicVoices.ts` (Giáo Sin = sóng, Khiên = thời gian); `sfx.ts` (`waveCrest`, `interfere`, `parry`, `pendTick`); `CombatScene.tsx` (mô hình tạm khi weapons.glb chưa có node, `userData.metric` bỏ chuẩn hoá kích thước, đăng ký khung quả lắc, cầm tay, gắn `WaveWeaponsFx`); `Hub.tsx` `HELD_W` (giáo tay phải grip 0,6 m, khiên tay trái grip 0); `WorldClient.tsx` (phím X, chuột phải); `Hud.tsx` (gắn `WaveWeaponHud`); `coastGame.ts` (thưởng: qua Đầm Giao thoa → Giáo Sin, Chuông Cộng hưởng → Khiên Con lắc thay Chuỳ Con lắc, hải đăng giữ Lăng kính Snell; hiện thẻ vũ khí mới); `PreviewClient.tsx` (dev: có sẵn trong túi, `#waves` đưa vào ô 2–3, `window.__waves`). File mới: `combat/waveWeapons.ts`, `combat/WaveWeaponsFx.tsx`, `combat/wavePlaceholders.ts`, `ui/WaveWeaponHud.tsx`.
- **Đo trên trình duyệt** (máy rất tải, 3–12 FPS): nhát đâm vào quái cách 2,4 m, công 100 → λ 1,6: 74, λ 2,4: 70 (nút), λ 3,2: 154 (đỉnh); bó A = 1 đi qua quái đứng yên: một bó 36 sát thương / 6 đỉnh, hai bó cách T 158 / 10, cách T/2 chỉ 20 / 3 (phần không chồng); giữ 1,5 s rồi thả → bó tụ lực A = 1,3; đỡ ở T/4 (dây 0,4 m, đo 318 ms) 5/5 hoàn hảo, phản đòn 35 → 76 khi cộng hưởng tăng; slime đánh thật trong lúc đỡ → "Đỡ hoàn hảo · Cộng hưởng"; Sóng dừng tạo 2 bó, Dao động cưỡng bức 3 nhịp tăng θ₀. Không lỗi console. Sửa sau khi đo: pha quả lắc chạy theo đồng hồ thật (trước theo dt đã kẹp 50 ms → máy chậm thì quả lắc chậm hơn đòn quái).
- **Cần làm bằng Blender** (thay mô hình tạm, cùng tên node): `w_lance`, `w_shield` trong `weapons/weapons.glb` — xem bảng trong báo cáo T22; icon `public/world/items/w_lance.webp`, `w_shield.webp` hiện là bản chép tạm của Trượng Fourier / Chuỳ Con lắc (cần vẽ mới).
- **Còn / rủi ro**: bó sóng / thế đỡ chỉ ở máy mình (chưa gửi qua mạng → chồng chập co-op giữa hai người chưa có, chỉ tự chồng sóng của mình; công thức đã nhận nhiều nguồn nên chỉ cần đồng bộ `Packet`); máy dưới ~8 FPS có thể lỡ một đỉnh khi f = 2,5 Hz (dò đổi dấu dy/dt mỗi khung); hoạt ảnh thế đỡ dùng `Sword_Block` (giơ tay phải) nên khiên tay trái không nâng lên — cần clip đỡ tay trái hoặc IK; quả lắc dây 0,6 m sát đất khi đứng thẳng; thế đỡ không làm chậm di chuyển; Chuỳ Con lắc giờ chỉ còn rơi từ quái (không còn là thưởng câu đố); chưa thử iPad / cảm ứng thật cho nút "Đỡ"; số cân bằng (×1,5 / ×0,7, K = 0,6 / 0,25, phản đòn) cần thử với học sinh.

- Mô hình Blender (T15): `public/world/weapons/weapons2.glb` — `w_lance` (cán tím than, tay nắm quấn xoắn, cuộn sóng phát sáng 9 vòng quanh cán, chắn tay trăng khuyết, lưỡi uốn MỘT bước sóng sin viền sáng, mũi kim cương) và `w_shield` (vòng nắm, `pend_pivot` → `chain` 20 mắt xích dài đúng 1 m + `bob` mặt đồng hồ Ø 0,44 có 12 vạch sáng, kim, núm sáng); `metric = true` trong extras; `useWeaponModel` tra weapons.glb → weapons2.glb → hình tạm.

## T23 — Phòng Thiên văn đồ + Chiếu nghỉ Escher / Cầu thang Penrose (28/11/2026, agent, local, chưa commit)
- **Chọn cách gắn**: cả hai là **phòng gắn liền trong cùng khung toạ độ của phòng điều khiển** (không tách cảnh như Babel) — đi bộ liền mạch, không đổi cảnh, không phải sửa `store.ts` / `WorldClient.tsx` / HUD (các tệp đang có agent khác sửa); va chạm / mặt đất / thể tích máy quay mở rộng ngay trong `lib/world/tessRoom.ts`. Sân ngoài bị ẩn khi ở trong bốt nên đặt phòng ngoài vòng tường không đụng gì.
- **Hành lang đông**: không hỏng — hành lang GLB có sẵn (`tess_corr_orrery`, rộng 3 m) nhưng chỉ đi được khi |z| < 1,2 (đi chếch từ giữa phòng thì va tường tròn ở x ≈ 13, đúng như phiên chính thấy). Nay `inPassage` cho hành lang 90° thông tới phòng Thiên văn đồ (x < 22,6); test đi thẳng từ x = 5 tới 23 không bị chặn, lệch trục thì tường chặn.
- **Thiên văn đồ** (`lib/world/orrery.ts`, `components/world/scene/OrreryRoom.tsx`): phòng tròn r 7 tâm x = 28,6 (tường 5 m + vòm sao 3 m), máy Ø6 sau lan can r 3,35. 6 hành tinh với số liệu thật JPL (a, e, ϖ, L₀, chu kỳ thiên văn), mỗi khung giải **M = E − e·sin E** bằng Newton (điểm đầu Danby, hội tụ cả e = 0,97); bán kính nén √a để vừa máy nhưng giữ đúng hình elip. **Cần gạt thời gian ×1 … ×10⁶ (F)**: ×1 = đúng vị trí hành tinh hôm nay, ×10⁶ ≈ 11,6 ngày/giây. **Bảng số T²/a³** (tường đông) tính từ số liệu thật: 1,000 … Sao Mộc 0,999. **Hành tinh học trò** (a = 2,5 AU) + **núm tâm sai (F)** e = 0 / 0,3 / 0,6 / 0,8 / 0,9 + 12 quạt sáng **diện tích bằng nhau** (định luật 2), quạt hiện tại sáng lên. Vòm: shader sao + lưới xích kinh/vĩ + dải hoàng đạo.
- **Cầu thang Penrose** (`lib/world/penroseStair.ts`, `components/world/scene/EscherStair.tsx`): vòm tầng lửng 270° → hành lang chiếu nghỉ (sàn y 5, x −14 → −22,4, rộng 2,4) → giếng vuông 6,7 × 6,7 (x −29,1…−22,4, z −1…5,7): 4 chiếu nghỉ 2 × 2 m + 4 đợt × 9 mặt bậc (run 0,30) × 10 cổ bậc (rise 0,16) → **một vòng = 6,4 m**, leo theo chiều kim đồng hồ. Một vòng là một hình học, vẽ 7 bản chồng nhau (InstancedMesh) + shader tối dần theo độ cao → không thấy đầu / mối nối. Lên tới y − y0 ≥ 6,15 thì dời xuống đúng 6,4 m + `CAM.shift` (biên dưới −0,4: trễ, không dao động). Bộ đếm "Số tầng đã leo: N · Độ cao tăng thêm: 0 m". **Âm Shepard** liên tục theo độ cao mở (mỗi vòng = một quãng tám, `components/world/audio/shepardStair.ts`). **Lối ra bí mật**: leo lên tới chiếu nghỉ cửa thì cửa thành tường ("lối ra ở phía DƯỚI"); chỉ mở khi đi **xuống** tới chiếu nghỉ cửa.
- **Mô hình Blender** (collection `ORRERY` / `ESCHER` trong `blender-src/hub_props.blend`; script scratchpad `orrery_build.py`, `escher_build.py`, `orrery_stage.py`, `room_bake.py` (nướng phòng kín: đèn tạm bên trong + glow_* phát sáng khi nướng, tắt mặt trời của file), `dense.py`, `cull_dark.py`, `unsplit_export.py`): `props/orrery_room.glb` 557 KB (vỏ phòng chân tường đá + 16 tấm ốp + trụ đồng + đèn tường + 12 gân vòm, bệ gỗ đỏ / mặt bàn đồng khắc 12 cung, Mặt Trời có vương miện, lan can hoàng đạo 24 trụ + 36 vạch + 12 dấu sáng, vòm kinh tuyến; hành tinh chia dải 2 tông, Sao Thổ có vành; cần gạt + núm có vạch nấc sáng khớp góc quay trong code), `props/escher_stair.glb` 352 KB (một vòng thang: bậc đá + mặt bậc sáng, dầm nghiêng dưới đợt, lan can đồng + tay vịn sáng cyan, 4 cột góc có đèn lồng, cửa sổ vòm "trời vàng" trên 4 tường, khung cửa; hành lang lát caro + vòm sườn + đèn). Nướng vòng thang cùng bản sao vòng trên / dưới (che + hắt) → bóng khớp mối nối. Code: `useRoomProps` (bakedMaterial + PROP_U); vòng thang bọc thêm mờ dần theo độ cao (onBeforeCompile, có instanceMatrix); vòm sao, quạt diện tích, quỹ đạo, màn cửa vẫn là shader. Đã bỏ khối tạm.
- Sửa phụ: `Impossible.tsx` suy `SPACE` lúc gắn lại cảnh theo độ cao thật (trước đây cố định y = 1 → gắn lại khi đang ở tầng trên có thể ném người chơi ra sân).
- Test: `tests/world/orrery.test.ts` (7), `tests/world/penroseStair.test.ts` (6), `tests/world/tessRoom.test.ts` (+2: hành lang đông / phòng Thiên văn đồ; tầng lửng 270° → giếng thang, cửa thành tường, máy quay).
- Kiểm tra trình duyệt (điều khiển thật qua input): đi hành lang đông vào phòng Thiên văn đồ, máy + bảng số chạy (×10⁶), F ở cần gạt đổi ×10⁶ → ×1; hành lang Escher + màn cửa; leo 4 đợt → bộ đếm 4, lên chiếu nghỉ L0 vòng trên được dời về y = 5 liền mạch, cửa thành tường và chặn; lên F0 rồi đi xuống lại L0 → cửa mở, bước ra hành lang. Sửa sau khi thử: cửa rộng hết chiếu nghỉ (2 m, trước 1,8 m làm kẹt khi đứng sát tường bắc) + biên quấn trên 6,15 (độ cao nhân vật bám mặt bậc tiệm cận, không bao giờ chạm đúng 6,4) — đều có test hồi quy.
- **Còn / rủi ro**: mô hình Blender cho cả hai phòng (đang là khối tạm); đài thứ hai của Thiên văn đồ (đường đoản thời / chuỗi Fourier) và sàn đường cong Hilbert ở hành lang chưa làm; bảng số là nhãn DOM (nhìn xuyên tường như mọi Label3D); đồng hồ mô phỏng + trạng thái cầu thang chỉ ở máy mỗi người (người chơi khác thấy bạn "rơi" 6,4 m mỗi vòng); nhảy giữa hai vòng hoặc lướt (dash) qua giếng chưa thử kỹ; FPS máy thử thấp do nhiều tab dùng chung GPU nên chưa đo chi phí thật (ước tính +~12 draw call mỗi phòng, chỉ vẽ khi ở gần).

## T21 — Hạ tầng: Lò rèn gửi MỘT thông điệp + texture KTX2 (28/11/2026, agent, local, chưa commit)
- **Lò rèn Ma trận qua mạng**: client gửi `{t:"forge", m, y, c}` một lần (ma trận 9 số nguyên −2…2, mặt đế y, ô nguồn `[chỉ số, id, …]` tăng dần, ≤ 441 ô = hộp 7×7×9). Áp tại chỗ bằng `setBlock(…, remote = true)` (không gửi từng khối). Vì sao gửi kèm ô nguồn: server không chạy được bộ sinh địa hình (khối tự nhiên trên đế) → op tự đủ, khai triển chỉ dùng + − × / floor nên giống hệt trên mọi máy. Server (`realtime/forge.mjs`, sinh từ `lib/world/matrixForge.ts` bằng `scripts/gen-realtime.mjs`) kiểm (realm `expanse`, không demo, đứng ≤ 16 m quanh đế, mỗi người 1 lần / 2 s dồn 2, cả server ≤ 3 lần / s), khai triển (≤ 441 xoá + ≤ 3 000 đặt, xấu nhất ~40 ms), **lưu từng khối** vào `edits-expanse.jsonl` (người vào sau nhận trong `joined`, không phải phát lại op) rồi phát op; máy nhận khai triển y hệt. Test: `tests/world/forgeOp.test.ts`, `realtime/selftest.mjs`.
- **KTX2**: `scripts/ktx2-convert.mjs` (dev dep `ktx2-encoder` — Basis Universal wasm; `sharp` có sẵn qua next) nén ảnh nhúng trong VRM tại chỗ (giữ mọi chỉ số → phần mở rộng VRM / MToon nguyên vẹn): màu → ETC1S sRGB, normal → UASTC chế độ normal, dữ liệu tuyến tính → UASTC; ảnh một màu → 4×4; thumbnail giữ PNG; luôn có mipmap. Ra `public/world/avatars/ktx2/<tên>.vrm`, bản gốc giữ nguyên. Chỉ VRM có texture — GLB đạo cụ / animation dùng màu đỉnh, ảnh trong `env/` không còn dùng, `art/` là ảnh UI.
- Kết quả 21 VRM: tệp 234,9 → 173,8 MB; ảnh 119,5 → 58,4 MB; GPU ước (RGBA8 + mip → khối nén) 3 016 → 831 MB, tức ~50–330 MB → ~16–75 MB mỗi nhân vật.
- Nạp: `components/world/fx/ktx2.ts` — một KTX2Loader chung, `detectSupport(gl)` trong onCreated của Canvas; móc `parse()` của GLTFLoader (three + three-stdlib của drei) nên mọi useGLTF / GLTFLoader đọc được KTX2; VRM tải bản `ktx2/` nếu có trong `lib/world/ktx2.ts`, lỗi → bản gốc (cả phiên). Bộ giải mã: `public/world/basis/` (chép bằng `--transcoder`; test so với bản trong three).
- **Cần tải lên kho asset nặng**: thư mục `avatars/ktx2/` (21 file, 174 MB); `world/basis/` nằm trong repo (nếu `NEXT_PUBLIC_WORLD_ASSET_BASE` trỏ CDN thì cũng phải có ở đó). Chưa tải lên thì mỗi phiên tốn một lần 404 rồi tải bản gốc.

## T24 — Hiệu ứng phép vẽ (cảm hứng Valorant) (28/11/2026, agent, local, chưa commit)
Nghiên cứu Codex (scratchpad `valorant/codex_answer.md`): lấy NGUYÊN TẮC VFX của Valorant (mép gameplay là hình học mảnh, rõ nhất; màu = nguồn, hình + chuyển động = tác dụng; báo trước → chớp niệm → lõi → va chạm giữ 35–50 ms → dư âm; báo sắp hết; ngân sách theo máy yếu, làm nóng shader), thiết kế hoàn toàn riêng (không asset / tên / hình của Valorant).
- **Logic thuần** `lib/world/spellFx.ts` (+ `tests/world/spellFx.test.ts`, 15 test):
  - bảng màu 5 phép (lõi / thân / mực / nhấn); `envelope` (lên → giữ → tắt), `revealWindow` (đầu chạy, đuôi đuổi);
  - bộ sinh hình ghi thẳng vào Float32Array có sẵn: `stepPath` (sét BẬC THANG: đi ngang rồi nhảy dọc = điểm gián đoạn), `spiralPath`, `sinePath`, `crestHeight` (chồng chập 3 sin, ghim hai mép), `parabolaPath` (đúng phương trình thiên thạch);
  - `idealGlyph` (glyph chuẩn — test: bộ nhận dạng nhận đúng phép của từng glyph, cả hai chiều), `StableMatch` (nhận dạng tạm thời ổn định ≥ 75 ms), `tierFeedback`;
  - ngân sách `SPELL_PARTICLES` (khiên / sét / xoắn / sóng 8 → 16, thiên thạch 16 → 30), `AURA_SPARKS` 4 / 6 / 8, `SHARD_CAP` 32 / 64 / 96; `projectedPx` + `lodTier` (bỏ lớp phụ < 48 px, chỉ mép chính < 24 px, trễ ±4 px).
- **`fx/SpellFx.tsx`** (gắn trong `WorldClient.tsx` cạnh CastAura): 3 pool = 3 lệnh vẽ cho MỌI phép.
  - Vòng: annulus instanced ≤ 24, chỉ tô dải vòng; mép mực pha alpha + thân / lõi cộng sáng trong cùng 1 lệnh.
  - Mảnh đặc: bipyramid tam giác instanced, ĐẶC (không overdraw, có viền mực), co lại thay vì mờ.
  - Dải: ≤ 14 × 32 điểm dựng trên CPU vào bộ đệm cố định.
  - Không texture (0 lần đọc); không cấp phát mỗi khung (mảng typed, màu bảng tính trước, tuỳ chọn hạt dựng sẵn); chỉ tải phần đang dùng lên GPU (`addUpdateRange`). Mức = `gfx.vfx`, `quality = "low"` → 0.
- **Từng phép**:
  - **Khiên** (ngọc bích `#69DBAB` / ngà / rêu sẫm): vòng KHÉP dưới chân (đường nối chạy quanh 65 ms), sau đó phần cung = thời gian khiên còn lại (báo sắp hết, nhấp nháy < 1 s); vòng vạch đứt ngoài (lớp phụ). `Ward.tsx`: fresnel 2 nấc kiểu cel, dải sáng quét vỏ 100 ms lúc mở, mảng tiếp xúc loé 90 ms khi chặn đòn, chỉ mặt trước (bớt nửa overdraw), lưới lục giác thưa hơn, hình cầu 2 562 đỉnh (trước 10 242). Chặn đòn → mảnh ngọc bắn ra phía bị đánh; hết khiên → vòng gãy bong + mảnh rời vỏ 180–220 ms.
  - **Sét Hàm Bậc thang** (nghệ `#FFE67B` / hổ phách / nâu mực): sống sét đi theo BẬC THANG (đúng nghĩa hàm bậc thang), lan từng bước nảy cách 45 ms; đầu chạy 40 ms → giữ 45 ms → đuôi xoá 100 ms; đầu nhọn vát mặt (đọc được khi lao thẳng vào máy quay); tới đích: quạt 3–5 vết gãy trong mặt phẳng trúng + tia theo ngân sách; trượt: vuốt nhọn dọc hướng đi.
  - **Chân trời Sự kiện** (dừa cạn `#AAA9FA` / cà tím): mép CỐ ĐỊNH 2,8 m = đúng vùng nổ khi sập (đường nối chạy 160 ms), 300 ms cuối nhấp nháy báo sắp sập; vạch đứt 7 m = vùng hút (lớp phụ); 2 tay xoắn bất đối xứng sát đất (1 vòng / 1,05 s), dấu phẩy trôi vào tâm; hạt bị hút chỉ TRONG mép (≈ ngân sách); sập: vòng co 120 ms → bung vòng gãy tới 3,2 m + chớp lõi + mảnh + sóng xung kích (mức ≥ vừa). Lỗ đen cũ (CombatFx) giữ nguyên.
  - **Thiên thạch Đạn đạo** (san hô `#FF7861` / mận / kem): dấu chân thật 3,2 m hiện đủ ngay khi chốt mục tiêu; 3 tab tam giác TRONG dấu chân trượt vào 300 ms rồi khép nốt trong 180 ms cuối (đếm ngược theo thời gian rơi CÒN LẠI, giải từ vị trí / vận tốc thật); đường dự báo nét đứt = phần parabol còn lại; va chạm: lõi loé 45 ms, vòng gãy nở tới đúng mép trong 110 ms (outCubic), mảnh kem + tia (16 / 22 / 30), sóng xung kích; vết cháy cũ giữ làm dư âm. `meteorImpact` (CombatScene) bỏ nova / ring / burst 70 / 16 tia trùng lặp.
  - **Sóng Chồng chập** (xanh biển `#33C8D0` / phấn / hõm sẫm): RÈM sóng 20 điểm ngang đúng 3 làn (3,6 m), cong lưỡi liềm, cao = chồng chập 3 sin, ngọn dựng 80 ms (outBack), quét đúng tầm 11 m trong 380 ms; 3 làn sin (đúng 3 tia sát thương) với vệt sau tắt 180–420 ms; giọt bọt bong ngược. Bỏ 3 cột "beam" + vòng cũ.
  - **Chớp niệm** `fxCast(id, bậc)`: vòng dấu dưới chân khép 0–45 ms theo màu phép, số vòng theo bậc (Perfect 3 · Good 2 · OK 1 · Rough vòng gãy), tia toả theo bậc × mức.
- **Màn vẽ** `ui/Sigil.tsx`:
  - nét = quầng màu + mép graphite + lõi nhạt (luôn sắc), đầu sao chổi + ngòi sáng bám con trỏ; điểm trong bộ đệm typed 2 048 điểm, vẽ theo rAF (1 lần / khung thay vì mỗi sự kiện chuột), BỎ shadowBlur;
  - nhận dạng tạm thời ~14 lần/s → khi ổn định: nét + hào quang dưới chân đổi màu phép, glyph chuẩn nhỏ cạnh ngòi, gợi ý phép đó sáng lên (các gợi ý khác mờ);
  - thả tay đúng: màu quét dọc nét 60 ms → glyph chuẩn "khớp" lên đúng hộp / chiều nét tay 150 ms + vòng loé theo bậc + tia; sai: nét tan từ đuôi 130 ms + vòng đánh dấu điểm đầu / cuối (thấy chỗ hở);
  - `hud.css`: bỏ `backdrop-filter` toàn màn hình của bảng vẽ; `CastAura`: dịu hơn, tia bay lên giới hạn 4 / 6 / 8 hạt sống, vòng đổi màu theo `CAST.color` (trước đây đứng yên một màu).
- **Hiệu năng / làm nóng**: `PrewarmShaders` sau `compileAsync` còn tải sẵn texture của vật đang ẩn lên GPU (`gl.initTexture`, 3 texture / khung); `Sparks.emitSpark` không còn tạo 3 mảng tạm mỗi hạt, chỉ tải phần hạt đang sống; vệt thiên thạch tái dùng vectơ (trước `clone()` mỗi khung). Dev: `window.__cast(id, mult)`, `window.__spellfx()` (số phần tử + CPU vòng cập nhật), `window.__sparks()` (hạt sống đỉnh), `window.__fxFreeze(ms)` (dừng đồng hồ hiệu ứng để chụp từng pha).
- **Đo** (dev, máy rất tải — 3–4 tab preview của agent khác chạy song song; vòng lặp 2·10⁷ sqrt mất 340–1 460 ms, nên chỉ so TƯƠNG ĐỐI):
  - niệm lần đầu (khựng lớn nhất trong 500 ms sau khi niệm): trước khiên 334 / **sét 2 987** / xoắn 171 / thiên thạch 287 / sóng 145 ms (khung thường ~60 ms); sau 168 / **140** / 307 / 364 / 162 ms (khung thường ~120–150 ms) — hết cú khựng 3 s của sét lần đầu;
  - bão phép (5 phép xoay vòng mỗi 350 ms, 6 s): trước +48 lệnh vẽ, GPU +0,6 ms; sau mức thấp +40 lệnh vẽ, GPU ±0; mức vừa GPU 18,8 → 20,8 ms; CPU vòng SpellFx 0,49–0,52 ms / khung (đỉnh 1,6 ms khi đủ 5 phép chồng nhau); đỉnh 8 vòng / 25 mảnh / 7 dải (vẫn 3 lệnh vẽ); hạt Sparks sống đỉnh 55 (thấp) / 118 (vừa, trần 300);
  - lúc đang vẽ (nét tổng hợp, cùng phiên): không blur 8,4–9,5 FPS, gắn lại `backdrop-filter` cũ 6,5–7,2 FPS (~30 % thời gian khung); vẽ lại nét 400 điểm: cách cũ (shadowBlur 18 + 6) 456 ms / lần vs cách mới 197 ms / lần (cùng điều kiện tải, ×2,3), và cách mới chỉ vẽ 1 lần / khung.
- **Cần làm art** (đang dùng thủ tục / shader; mục 2–4 đã làm ở đợt 2, mục 1 giao agent Blender):
  - mesh Blender "mảnh pha lê vát" 2–3 biến thể thay bipyramid (tab thiên thạch, đầu sét, mảnh khiên — giữ trục dài +Y, < 60 tam giác);
  - atlas nét cọ 256² (R phủ, G vỡ — theo nghiên cứu) cho mép vòng / dải kiểu cọ khô vẽ tay;
  - glyph rune riêng cho 5 phép (SVG / PNG nét mảnh) thay glyph toán học khi "khớp" và cho vòng dấu niệm;
  - đĩa bồi tụ + vòng photon của lỗ đen làm lại theo bảng dừa cạn / cà tím (hiện là tím cũ, lệch bảng màu mới).
- **Còn / rủi ro**: chưa đo trên điện thoại thật, chưa có số trước / sau sạch (GPU chia với nhiều tab, PerformanceMonitor tự hạ chất lượng giữa chừng); đường dự báo / 3 làn sin / vòng 7 m chỉ hiện từ mức "vừa"; vòng mép ở xa dày theo mét nên < 24 px có thể mảnh (mép chính vẫn giữ ở mọi mức); mép mực tối khó thấy trên nền đêm (thân + lõi vẫn rõ); hiệu ứng chỉ ở máy mình (phép không gửi qua mạng — như trước); bảng màu mới đổi luôn màu tên phép / gợi ý trên màn vẽ (`SPELLS.color` = thân bảng mới); sóng xung kích hậu kỳ dùng chung một khe `SHOCK` (xoắn sập và thiên thạch rơi cùng lúc thì cái sau thắng).
- **Đợt 2 — art 2D + sửa còn tồn** (28/11/2026):
  - Art do Codex sinh (brief `scratchpad/spellart/BRIEF.md`, nguồn chép vào `blender-src/fx-src/` — gitignore), xử lý bằng `scripts/spell-fx-art.py`:
    - `public/world/fx/tex/brush_atlas.png` 256² — 4 hàng × 64 px (2 dải cọ khô lặp liền mép, 2 nét vuốt nhọn), R = độ phủ, G = vân lông cọ đã cân bằng histogram (ngưỡng xói đều);
    - `public/world/fx/tex/spell_runes.png` 1280 × 256 — 5 rune riêng (vòng tròn đơn vị + 4 vạch bán kính · bậc thang có chấm tròn kín / hở như hàm bậc thang · xoắn hai tay quanh lỗ đen · parabol úp + viên kim cương rơi + 3 tab · 3 sóng sin lệch pha nối hai nút); nét gốc mảnh nên nở 7 px trước khi thu nhỏ.
  - Nối vào `fx/SpellFx.tsx` (vẫn 1 lần đọc texture / vật liệu, mức thấp không đọc):
    - vòng: mép xơ cọ khô, xói theo vân G thay vì băm đốt; vòng đứt → mỗi đốt là một nét vuốt;
    - dải: sống sét + làn sin dùng hàng dải, dấu phẩy xoắn dùng hàng nét vuốt (đầu to → đuôi xơ), đuôi bị "ăn" theo vân cọ, bọt sóng vỡ theo G;
    - pool thứ 4 (rune nằm trên đất, ≤ 6, cộng sáng): dấu niệm dưới chân (mọi mức), rune khiên trong vòng khép, rune xoắn quay ngược trong mép, rune đích ở tâm dấu chân thiên thạch (lớp phụ, mức ≥ vừa).
  - `ui/Sigil.tsx`: khi glyph "khớp", rune của phép (nhuộm màu thân một lần, vẽ cộng sáng) hiện giữa glyph, thu 1,25 → 1 trong 160 ms.
  - Lỗ đen (CombatScene): đĩa bồi tụ = nhấn / thân dừa cạn, vòng photon = lõi `#E9E1FF`, lõi = mực cà tím rất tối.
  - `fx/Lensing.tsx`: sóng xung kích 2 khe xoay vòng (`SHOCK`, `SHOCK2`: khe rảnh trước, cả hai bận → ghi đè khe cũ hơn); shader áp dịch chuyển hai khe nối tiếp, vẫn 3 lần đọc ảnh.
  - Dấu chân thiên thạch: vòng dày 0,16 m, tab 0,46 × 0,8 m — đã chụp lại: vòng san hô 3,2 m + đường parabol nét đứt + tab rõ ở ~11 m.
  - Đã sửa: tên biến GLSL `patch` (từ khoá GLSL ES 3.0) trong Ward → `hitPatch`; backtick trong chú thích shader làm hỏng template literal → bỏ.
  - **Còn**: rune trên canvas màn vẽ chưa chụp được (máy chậm, ảnh chụp đến sau 520 ms); rune dưới đất khá mảnh ở xa (nên có bản nét dày cho mip thấp); vân G của `b2_grain` có đường nối mờ (đã trộn mép 96 px).

## T24 — Mô hình Blender cho quái quy luật + mảnh pha lê phép (28/11/2026, agent, local, chưa commit)
- `public/world/monsters/rule_monsters.glb` (429 KB; collection `RULEMON`, script scratchpad `rule_build.py` + `glb_rename.py`): Ma Tham Lam (áo choàng mép rách, mặt tối trong mũ trùm, mắt vàng + nụ cười hồng, huy chương xu, túi tiền sau lưng, tay vuốt xương — armL/armR/arrow giữ nguyên gốc quay), Hộ Vệ Nguyên Tố (thân đá vát, vạch 2·3·5·7 sáng, đầu pha lê ngà + vương miện sáng, tay đưa ra cầm hai mép khiên), Cua Chuông (mai bóng có đốm, mắt anime trên cuống, 6 chân 2 đốt, càng lớn — clawL/clawR giữ gốc; bàn Galton khung đồng + 36 đinh glow_peg + phễu), `lair_post` (trụ đá rune chevron hồng + pha lê đỉnh, thay 27 hộp của rào chữ U; InstancedMesh theo vật liệu, xoay 90°·k theo ô), `warden_tile` (gạch khiên vát có chóp thoi). CombatScene đọc `rule_monsters.glb` thay `monsters3.glb` (giữ collection MONSTERS3 của phiên chính nguyên vẹn).
- `public/world/fx/shards.glb` (6 KB; collection `SHARDS`, `shards_build.py`): 3 mảnh pha lê vát 24 / 16 / 20 tam giác (khối lục giác méo = thiên thạch, kim thoi = sét, phiến 5 cạnh = khiên). SpellFx: hình học pool mảnh = 3 biến thể gộp (aVar) + thuộc tính instance iVar → vẫn 1 lệnh vẽ; nạp nền bằng GLTFLoader, trước đó dùng bipyramid cũ.
- **Còn / rủi ro**: chưa nướng AO màu đỉnh cho quái (toon chạy bằng đèn cảnh, ban đêm khá tối); cua ~9k tam giác; tên Blender trùng MONSTERS3 nên xuất có hậu tố .00x → `glb_rename.py` bỏ hậu tố (phải chạy lại khi xuất lại); mảnh pha lê chưa chụp được lúc niệm phép trên trình duyệt (chỉ kiểm tra tải + tsc).


## Phòng Lăng kính — lý thuyết màu (28/11/2026, agent, local, chưa commit)

- Chi tiết và nguồn: `docs/ai-reviews/color-theory/PLAN.md`. Phòng gắn sau vòm tầng lửng 90° của phòng Siêu khối (chỗ trước đây để dành cho "Góc quan sát"), sàn y 5, hình chữ L, không chồng Thiên văn đồ.
- 6 trạm F: sân khấu ánh sáng RGB với bóng màu của người chơi; đèn chiếu qua kính lọc CMY (nhân phổ + CIE); khối RGB / đĩa HSV đi bộ; vòng hoà sắc HSV / RYB / OKLCH; tường ảo giác (ảnh dư cờ đỏ sao vàng, tương phản đồng thời); phòng tối Newton + giản đồ CIE 1931 + kính mù màu Machado.
- Code: `lib/world/colorTheory.ts`, `components/world/scene/PrismHall.tsx`, `props/prism_hall.glb` (521 KB). 6 trang Ghi chép mới (`colorlight` … `colorcie`). Test: `tests/world/colorTheory.test.ts` (18), `tests/world/tessRoom.test.ts` (+1).
