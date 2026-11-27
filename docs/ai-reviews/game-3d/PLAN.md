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
- [~] **V1 Hệ VFX dùng chung** — đã có: `fx/fxmat.ts` (mặt nạ/xói mòn/ramp/alpha bậc/hybrid blend), bộ texture `public/world/fx/tex` (noise, ramps 16 hàng, ring, streak, beam, + slash/star/burst/arc/debris/crater vẽ bằng Codex), vệt chém + vòng sóng + tia trúng đòn + sét dải + hố thiên thạch dùng FxMat, quái tan biến mép cháy, hạt sao/mảnh/chip Blender. Còn: trail ribbon (tên, quả lắc, đĩa xoắn), dash afterimage, cột sáng đồ rơi bằng FxMat, ShockWave hậu kỳ, giới hạn hạt theo mức đồ hoạ. (VFX_PIPELINE F1–F9): 1 vật liệu chung (mặt nạ + nhiễu xói mòn + ramp màu + alpha bậc + polar), 3 lô instanced (sprite, mesh Blender, dải trail), gói trúng đòn, chém 3 đòn, tan biến khi chết, cột sáng đồ rơi, trail, vòng sóng, sét, thiên thạch, lỗ đen; bộ texture 14 tấm (noise thủ tục, glyph SVG, phần còn lại vẽ bằng Codex).
- [~] **W1 Kho voxel nhanh** — đã có: khoá số 53-bit (hết cấp phát chuỗi mỗi lần tra), chỉ mục theo cột cho columnRange, lưu trễ 1 s (giữ định dạng cũ), test `tests/world/voxels.test.ts`. Còn: worker + greedy meshing + AO đỉnh, mảng 32³. (VOXEL_WORLD rec 1–2): khoá số + mảng 32³, lưu IndexedDB trễ, worker sinh + greedy meshing, AO đỉnh.
- [~] **W2 Biome toán học** — đã có (`lib/world/terrain.ts` mathBiome, ~20–25% đất, cách điểm xuất phát ≥ 60 m): Đồng bằng Hàm số (mặt đất = đồ thị 6·sin(x/12)·cos(z/15), nền giấy kẻ ô vạch mỗi 8 khối), Cao nguyên Sierpiński (bậc khi (i&j)=0), Cao nguyên Fractal (Mandelbrot), Hồ Yên ngựa (x²−z²). Ví dụ toạ độ: function (−32, −328), fractal (−13, −129), saddle (0, −130), sierpiński (−30, −152). Còn: Voronoi Steppe, nhiễu tất định (bỏ Math.sin cho bản server), biển báo/biểu tượng biome. (Function Plains, Saddle/Bowl lakes, Sierpiński Badlands, Fractal Highlands, Voronoi Steppe) + nhiễu tất định.
- [x] **W4 Sét + lồng Faraday** (`scene/Storm.tsx`: bão theo đồng hồ chung mỗi 100 s, trời tối + mưa, sét đánh điểm cao nhất / khối vàng, trong lồng vàng ≥ 14 khối thì an toàn → mở trang Thư khố). Còn: cột thu lôi (rolling sphere), cát hoá thuỷ tinh.
- [~] **W3 Matrix Forge** — `lib/world/matrixForge.ts` (biến đổi khối bằng ma trận 3×3, ánh xạ ngược khi det ≠ 0, ép dẹt khi det = 0, test), `scene/Forge.tsx`: đế vàng 7×7 ở (−10, 9) trong Vùng Kỳ quan, bảng 6 thẻ ma trận (quay, gương, trượt, kéo, phóng ×2, chiếu) hiện det + số khối trước → sau + lịch sử để thấy AB ≠ BA. Còn: Symmetry Totem, gửi 1 thông điệp "transform" qua mạng (hiện gửi từng khối, bị giới hạn 6/s)., W5 hang động 3D + đảo nổi, W6 cấu trúc (L-system, WFC, Graph Forest).
- [x] **B1 Boss tổ đội "Fourier Siren"** — xong bản đầu: `lib/world/boss.ts` (logic thuần, test được) + `realtime/boss.mjs` (bản JS tự sinh cho server, server là nguồn sự thật trong phòng "siren", nhận đòn đánh giới hạn 12/s, ≤150), `scene/Siren.tsx` (đấu trường Mê cung Hoạ âm: nền cắt giấy Codex, sàn phím đàn, cắt giấy lơ lửng), boss Blender `public/world/boss/siren.glb`, 4 đòn: Sóng dừng / Nhịp phách / Sao chổi Lissajous / Nút giao thoa (phải phá cả 2 trong 1 s), thanh Coherence → BREAK 6 s ×1,5, thanh máu boss kiểu Genshin. Đã test 2 người trên server realtime local: máu boss đồng bộ chính xác giữa 2 tab (server là nguồn sự thật). Thưởng + chương II đã có. Còn: lensing/ShockWave, camera tự lùi xa khi đứng sát boss. + phó bản kiểu Madoka Exedra: server giữ trạng thái boss, báo trước đòn ≥ 600 ms, break bar "Coherence", phản ứng toán học giữa vũ khí.
- [x] **H1 Vũ khí cận chiến cầm trên tay + hoạt ảnh mượt** — kiếm/đòn bẩy/trượng tay phải, cung tay trái (trục tính từ xương ngón, không phụ thuộc model), blend 0,06 s, mỗi nhát chuỗi chém đổi điểm bắt đầu/tốc độ, nhảy 3 pha, thế cầm kiếm sau khi đánh. Còn: đệm phím, huỷ đòn bằng lướt. (gắn mô hình vào xương tay VRM, blend 0,06 s vào đòn, chuỗi chém đổi tốc/điểm bắt đầu, Jump_Start→Loop→Land, tư thế cầm kiếm Sword_Idle, huỷ đòn bằng lướt, đệm phím 150 ms)
- [x] **G1 Bay lượn + bổ nhào + cột gió** — bấm nhảy trên không mở tàu lượn origami (Blender), rơi ≤ 1,8 m/s, cột gió nâng lên; đánh trên không = bổ nhào, chạm đất nổ sóng theo độ cao rơi (thế năng). Cột gió ở sảnh + 4 cột trong phó bản.
- [x] **B2 Phó bản nhiều tầng** — 4 đài nổi (3,4 m / 5 m) + 4 cột gió quanh Siren; sóng dừng / nhịp phách chỉ trúng người dưới đất, sao chổi Lissajous thứ hai bay ở tầm đài cao.
- [x] **G2 Chế độ ngắm (cung) + VFX cung/pháp khí** — chuột phải / nút ngắm: camera qua vai + FOV hẹp, tâm ngắm có vòng tích lực, tên theo tia camera (bù trọng lực), tích lực 1 s ×2,2 xuyên thấu; vòng phép đứng khi niệm trượng / cuộn / lăng kính. — giữ chuột phải / nút ngắm: camera qua vai, tâm ngắm, tên bay theo tia camera, bắn tích lực (giữ 1 s), vệt tên ribbon, vòng phép khi niệm (học Genshin).
- [~] **M1 Quái cần phối hợp** — đã có (mô hình Blender `monsters2.glb`): Quỷ Mã Cờ (nhảy nước mã, chỉ đánh 8 ô mã → đứng sát cạnh an toàn), Rùa Zeno (đòn thứ k chỉ ½ᵏ, nghỉ 1,2 s để chuỗi lại), Song Sinh Giao Thoa (chỉ chịu đòn khi cả hai bị đánh trong 0,2 s; vân sáng cos²(πΔr/λ) gây sát thương) + Ghi chép thực địa mở trang Thư khố khi khám phá quy luật. Đã vẽ vân giao thoa trên mặt đất (vân sáng đỏ nhấp nháy theo nhịp 1,6 s, vân tối an toàn). Chương II: vào Mê cung + hạ Siren (thưởng rơi đồ + trang Thư khố Chuỗi Fourier). Còn: Greedy Ghoul, Prime Warden, Bell Crab.: Interference Twins (phải đánh cùng lúc), Knight Imp, Zeno Tortoise, Greedy Ghoul, Prime Warden; Field Notes ghi quy luật đã khám phá.
- [ ] **C1 Hầm Bổ đề (The Lemma Vaults) — giải đố co-op 3–4 người** — thiết kế đầy đủ trong `COOP_PUZZLE.md` (9 phòng; MVP: Cầu Königsberg, Cân Archimedes, Dàn hợp xướng Fourier; ping + nói nhanh + đếm ngược "Ba-hai-một", bạn đồng hành linh hồn cho ghế trống, phòng party theo mã). Đã sửa P0.1: kết nối lại xin token mới (trước đây hết hạn sau 10 phút là mất kết nối vĩnh viễn).
- [ ] **A1 SFX** đồng bộ với VFX (lớp âm theo nguyên tố), nhạc nền theo vùng.
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
  - Còn (danh mục "kỳ quan" trong `TESSERACT_BOOTH.md` §13): Thư viện Babel vô hạn, phòng Thiên văn đồ, Cầu thang Penrose, con lắc sóng, bảng Galton, khe Young, cổng Mandelbrot, siêu khối có tay cầm.
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
- Còn có thể làm: bầy hạc giấy Boids quanh quần đảo, sóng xung kích khi qua vòng, tư thế hạ cánh.

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
