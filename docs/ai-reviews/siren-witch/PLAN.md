# Mê cung Hoạ âm — kỳ quái hơn (cảm hứng "mê cung phù thuỷ"), chuyển động mượt

Ngày: 28/11/2026. Yêu cầu: "nâng cấp màn hoạ âm kì quái hơn như Madoka, animation mượt mà".
Nguyên tắc bản quyền: học **phương pháp** (cắt dán mixed-media, vênh tỉ lệ / chất liệu / nhịp thời gian, nghi thức lặp) — KHÔNG
dùng nhân vật, phù thuỷ, biểu tượng, chữ viết hay hình ảnh của Madoka / Gekidan Inu Curry. Mọi thiết kế nguyên bản, chủ đề
âm nhạc – chuỗi Fourier – hoạ âm.

## Nghiên cứu (ChatGPT web, 28/11 — tóm tắt)
- Inu Curry (guidebook Madoka / Rebellion): nhiều phương thức sản xuất trộn nhau — ảnh chụp làm chất liệu, tô tay từng tấm,
  rotoscope, đất sét, stop-motion, image board trước bố cục. Nguồn cảm hứng độc lập nên học thêm: Oskar Fischinger (visual
  music), Norman McLaren (Synchromy — âm thanh hữu hình), Švankmajer (đồ vật tự vận hành), Norstein (multiplane), Lenica /
  Borowczyk (collage cơ khí), Escher.
- 6 "vênh" chuyển thành luật thế giới: chất liệu (phím sứ, nốt giấy, sinh vật dây thép, trời ảnh chụp), tỉ lệ (kim máy hát
  to hơn toà nhà), **thời gian** (thực thể sống ở nhiều tốc độ hoạt hình), không gian (2D trong 3D không theo phối cảnh),
  ngữ nghĩa (khuông nhạc = nhà tù, dấu lặng = lỗ thủng), nghi thức lặp.
- **Hoạt hình nhiều nhịp**: máy quay / nhân vật / kiến trúc 60 Hz; con rối giấy đổi dáng 12 Hz, stop-motion 8 Hz, tranh cắt
  dán 4 Hz — vừa mượt điều khiển vừa có chất thủ công. Chuyển động phân lớp: gốc theo quỹ đạo → thân nghiêng theo vận tốc →
  khớp lệch pha → dây treo rung sau gia tốc → mặt flipbook → bóng chuyển động riêng.
- **Lò xo giảm chấn** (không phụ thuộc FPS) thay lerp mỗi khung; stagger cho chuỗi vật.
- **Fourier epicycles**: cổng / boss tự "vẽ" mình bằng tổng vectơ quay (hệ số DFT tính offline từ đường viền); sinh vật chết =
  mất dần hoạ âm bậc cao. **Lissajous** cho quỹ đạo tay / đòn. **Chladni** F = cos(mπx)cos(nπy) − cos(nπx)cos(mπy): cùng
  công thức CPU (luật) + GLSL (hình), đường nút = an toàn.
- Pha boss: Thuận → Bất hoà (lệch pha, detune) → Phân rã — **cao trào bằng sự biến mất** (bớt màu / chi tiết / hoạ âm).
- Multiplane collage sky (3–5 lớp parallax, chu kỳ riêng). Vật liệu riêng: khắc (cross-hatch theo UV), mép giấy SDF, lệch
  lớp mực in (cục bộ, không toàn màn hình).
- Hiệu năng điện thoại: nguy cơ lớn nhất là **vẽ chồng alpha** (ưu tiên mặt đặc / alpha-test, contour mesh từ mask),
  pass portal, độ phân giải, đổi vật liệu. Ngân sách: điện thoại 50–100 lệnh vẽ, 80–150k tam giác, hoạ âm vertex 3–4.
  Âm thanh: đồng hồ nhạc cho HÌNH, không dùng FFT để quyết định sát thương.

## Đã có (không làm lại)
Bầu trời shader (đồi giấy răng cưa, mây vỏ sò, chấm bán sắc), mê cung 1 lưới vật liệu giấy, tấm cắt dán instancing, hoa hồng
r = cos kθ, cổng Portal (render target), trọng lực kỳ dị (hành tinh, hố đen, lỗ sâu), điểm chơi toán – nhạc, quái hoạ âm,
boss Fourier Siren 4 đòn (server có thẩm quyền), bộ tổng hợp âm WebAudio.

## Lõi dùng chung (xong)
- `lib/world/harmonicState.ts` + test: đồng hồ nhạc 96 BPM, puppetTime / stopTime / collageTime, decomposition theo máu
  boss, dissonance theo pha, `springStep`, `chladni` (+ GLSL), `squareSeries`.
- `components/world/scene/siren/SirenDirector.tsx`: chỗ duy nhất cập nhật `HARMONIC` mỗi khung (gắn trước SirenSky).

## Giai đoạn (3 nhánh song song, file tách biệt)
| # | Nhánh | Việc | File |
|---|---|---|---|
| W | Thế giới / trời | Trời cắt dán nhiều lớp (multiplane, parallax + chu kỳ riêng, thay tranh 4 Hz); mặt trời = đĩa than khổng lồ có kim máy hát cào (Blender); "thác ký hiệu" rơi rồi bay ngược; vùng **Dấu lặng** (mất màu / âm / hoạ tiết); **màn chuyển "kết giới"** khi vào màn (giấy gấp mở, khuông nhạc kéo căng); phân rã thế giới theo `HARMONIC.decomposition` | SirenSky.tsx, mới SirenCollage.tsx, SirenBarrier.tsx |
| P | Con rối + sàn | **Con rối giấy** nguyên bản (búa đàn, kẹp giấy, dây cót, metronome…) — khung phân cấp, gốc 60 Hz, dáng 12 Hz, mặt flipbook 8 Hz, nghi thức lặp (đoàn diễu hành theo nhịp); **phím sàn** nhô lên bằng lò xo trước khi sóng tới; đài nổi quay tỉ số 2 : 3 : 5; **cầu khuông nhạc** biến dạng chuỗi Fourier ở vertex (cùng hàm chiều cao CPU cho va chạm) | mới SirenPuppets.tsx, SirenMaze.tsx (phần sàn / đài), lib mới |
| B | Boss + cổng | Boss **tự dựng / phân rã bằng epicycle** (xuất hiện, BREAK, gục); cổng mở = epicycle vẽ viền; tay Lissajous để lại dải ruy băng; báo trước "Sóng dừng" thể hiện thành hình Chladni trên sàn (chỉ HÌNH — vùng sát thương giữ nguyên luật server); pha boss đổi màu / lệch lớp mực theo `dissonance` | Siren.tsx (phần boss), mới SirenBossFx.tsx, SirenPortals.tsx (mặt cổng) |

## Quy tắc
- Mọi chuyển động đọc `HARMONIC` (không đồng hồ riêng); lò xo `springStep`; không cấp phát trong useFrame.
- Art: tranh 2D cắt dán / con rối / thác ký hiệu sinh bằng Codex (nguồn ở `blender-src/siren-src/`, script xử lý trong
  `scripts/`); mô hình 3D bằng Blender MCP (chỉ nhánh W dùng Blender trong đợt này). Ưu tiên alpha-test / mesh theo đường
  viền thay vì alpha blend.
- Không đổi luật / đồng bộ boss (realtime/boss.mjs) — chỉ hình.
- "Giảm chuyển động" (reduceMotion trong SirenGravity) phải tắt nhấp nháy / rung mạnh.
- Kiểm: tsc, eslint, test world, trình duyệt (ảnh trước / sau), `__perf` (lệnh vẽ, tam giác, GPU ms) trước / sau.

## Tiến độ
- 28/11: nghiên cứu + lõi dùng chung xong; giao 3 nhánh W / P / B.
- 28/11 — nhánh W xong (chưa commit):
  - `lib/world/sirenWorld.ts` + `tests/world/sirenWorld.test.ts` (8 test): bố cục trời 4 lớp (thị sai theo `follow`, trôi
    2 : 3 : 5 : 7 theo beat), `pieceAlive` (phân rã: mảnh bậc cao rụng trước, cuối cùng chỉ còn lớp xa), `fallLoop` (thác rơi →
    bay ngược lật gương), `REST_ZONE` / `restAmount` (đảo góc Đông Bắc dưới Lồng Escher, không đè cổng / cổng động / sân Hoà âm),
    `recordAngle` (1 vòng / ô nhịp), `needleTarget` (cào theo stop-motion 8 Hz khi bất hoà), `barrierProgress`.
  - `siren/SirenCollage.tsx`: `CollageSky` (62 mảnh, 1 lệnh vẽ, alpha-test, đổi khung A/B + giật tay 4 Hz theo collageTime,
    lệch lớp mực theo dissonance) + `NotationFalls` (3 thác, 184 ký hiệu + Dấu lặng khổng lồ, 1 lệnh vẽ).
    Atlas Codex: nguồn `blender-src/siren-src/` (BRIEF.md, collage_a/b, notes_atlas), xử lý `scripts/siren-collage.py`
    → `public/world/siren/collage.webp` (591 KB) + `notes.webp` (115 KB).
  - `siren/SirenVinyl.tsx`: đĩa than mặt trời (Blender, collection SIREN_W, `blender-src/siren-src/vinyl_build.py` →
    `public/world/siren/vinyl_sun.glb` 74 KB): rãnh + vệt bóng dị hướng + nhãn in sóng vuông Fourier theo số hoạ âm (shader),
    quay khoá nhịp, cần kim lò xo, loa kèn thở theo phách; 4 lệnh vẽ (vật liệu gộp thành màu đỉnh lúc tải).
  - `siren/SirenRest.tsx`: vùng Dấu lặng (lọc CSS xám trên canvas chỉ khi > 0, trời / cắt dán / thác thành giấy phẳng,
    hạ master âm thanh; lò xo ζ = 1; trả lại khi rời / gỡ cảnh).
  - `siren/SirenBarrier.tsx`: kết giới 1,5 s (khuông kéo căng → giấy gấp xếp từ giữa ra), chờ màn tải tắt, chạm / phím = ×5,
    giảm chuyển động = mờ 0,45 s; ghi độ sâu phẳng để viền mực không xuyên giấy; xong thì gỡ (0 lệnh vẽ).
  - `SirenSky.tsx`: đọc HARMONIC (bỏ đồng hồ riêng), dải sóng = sóng vuông theo số hoạ âm, phân rã bớt răng đồi / chấm / sao
    / màu, bất hoà lệch lớp đồi, Dấu lặng → giấy. `SirenWorld.tsx` gom tất cả; Siren.tsx chỉ thêm 1 import + 1 dòng gắn.
  - `__perf` (máy dev đang tải nặng, cùng góc nhìn, tắt / bật nhóm W): 152 → 157 lệnh vẽ, 268,6k → 271,3k tam giác,
    GPU 11,9 → 12,6 ms (trong nhiễu đo).
- 28/11 — nhánh P xong (chưa commit):
  - `lib/world/sirenFloor.ts` + `tests/world/sirenFloor.test.ts` (6 test): đài nổi `platBob` / `platYaw` (tần số 2 : 3 : 5, đài
    thứ tư 4 → hợp âm 2 : 3 : 4 : 5, chu kỳ 8 beat, biên độ 0,22 m; quay chỉ là hình vì đài tròn); cầu khuông nhạc
    `staffHeight` h = E(s)·A·Σ sin(n k s − n ω t + φₙ)/n, H = `HARMONIC.harmonics`, ghim hai đầu, `STAFF_GLSL` sinh từ CÙNG hằng
    số; phím sàn `keyTarget` / `stepKeys` (sóng âm chân → đỉnh mỗi ô nhịp, phím nhô TRƯỚC 0,5 beat, bị gõ lún khi sóng qua,
    `springStep` ω 26 ζ 0,3 → vượt đích ~37 %, ≤ 0,22 m nên bậc vẫn ≤ STEP_UP). Trạng thái lò xo ở `KEYS` (một nguồn).
  - `lib/world/sirenMaze.ts`: `Surf.dyn` / `di` (đài `plat0..3`, cầu `brS`, ~150 bậc thang thành phím) + `surfTop(s, x, z)`;
    `mazeGround` / `surfAt` / `mazeBlocked` dùng cao độ động (hợp đồng giữ nguyên: mặt tĩnh như cũ; `surfAt` cho mặt động
    dung sai 0,3 m vì chân bám theo bằng lerp). Test đồ thị đi bộ so với `surfTop` thay vì `t.y`.
  - `siren/SirenFloor.tsx`: `HarmonicPlatforms` (thay `Platforms` trong Siren.tsx) + `StaffBridge` (5 dòng kẻ nổi + vạch nhịp
    + mặt giấy dệt, uốn ở vertex shader, 1 lệnh vẽ, ~4,6k tam giác). `SirenMaze.tsx`: thuộc tính `aKey` + `uKeys[48]` (vec4) —
    cả khối bậc nhô / lún; cầu Nam bỏ khỏi lưới gộp; MazeGeometry là chỗ duy nhất `stepKeys` mỗi khung.
  - Con rối giấy: `lib/world/sirenPuppets.ts` + `tests/world/sirenPuppets.test.ts` (5 test): khung xương 2D phân cấp
    (`compose`, dây treo `world` luôn rủ theo trọng lực), 4 loài nguyên bản — búa đàn diễu hành (10, "lao tới rồi khựng" mỗi
    beat quanh NGOÀI mép đấu trường r 16,6, đầu búa gõ đúng phách), kẹp gỗ hợp xướng (7, canon lệch π/7, nhấp nhô trên vực
    cung Đông Bắc), đầu máy đếm nhịp (4, Lissajous 2 : 3 trong bốn sân khu, có bóng), chim âm thoa (6, Lissajous a : b trên
    đấu trường). Dáng 12 Hz (`puppetBeat`), mặt flipbook 8 Hz (`faceFrame`: mở / chớp / mắt xoáy, xoáy nhiều hơn khi bất hoà),
    gốc 60 Hz. `siren/SirenPuppets.tsx`: 198 quad, 1 lệnh vẽ, alpha-test; mặt phẳng rối quay về máy quay; lò xo nghiêng theo
    vận tốc, lật giấy khi đổi hướng (lò xo vượt đích), dây rung sau gia tốc; bất hoà → lệch lớp mực đỏ son; phân rã → rã vụn
    giấy; giảm chuyển động → mặt đứng yên, rung nhỏ, tắt lệch mực.
    Atlas Codex (14 bộ phận khắc đồng + giấy cắt, nền trắng): nguồn `blender-src/siren-src/puppets/` (BRIEF.md), xử lý
    `scripts/siren-puppets.py` → `public/world/siren/puppets.webp` (1536², 346 KB) + `lib/world/sirenPuppetAtlas.ts` (sinh).
  - Trình duyệt: đứng trên cầu Nam, y người chơi dao động −0,32…+0,18 m theo sóng (va chạm CPU = hình); `uKeys` −0,10…+0,17 m.
    `__perf` (máy tải nặng, cùng góc, tắt / bật con rối + cầu): ≈ +2 lệnh vẽ, +3…5k tam giác, GPU +0,2…0,4 ms (trong nhiễu đo).
- 28/11 — nhánh B xong (chưa commit):
  - Đường viền boss OFFLINE: `scripts/siren-epicycles.mjs` (đọc `public/world/boss/siren.glb` không thư viện → raster tam giác
    lên XY 256², đóng hình thái học, dò viền Moore, 512 mẫu theo độ dài cung, DFT, giữ 64 hệ số lớn nhất) → sinh
    `lib/world/sirenOutline.ts` (RMS tái dựng 1,35 cm / chu vi 15,4 m).
  - `lib/world/epicycle.ts` + `tests/world/epicycle.test.ts` (5 test): `epicycleJoints` / `epicycleTip` (không cấp phát),
    "mất bậc cao trước" w = clamp(kMax + 1 − |k|), `harmonicKMax` theo số hoạ âm, lịch hình `bossLook` (xuất hiện 2 s vẽ +
    0,7 s hiện thân từ đầu xuống; BREAK vỡ về bậc 3 trong 0,45 s, dựng lại 1,2 s cuối; gục: bậc → 1 trong 2,6 s rồi co về tâm
    0,9 s). Sóng dừng: `STANDING_DANGER_EXPR` viết MỘT lần, hợp lệ GLSL lẫn JS — test so `standingDanger` ở > 30k điểm.
  - `siren/SirenBossFx.tsx`: `BossBody` (thay `BossModel` trong Siren.tsx) — lò xo `springStep` cho nhấc / co duỗi giữ thể tích /
    ngả / nghiêng / xoay / độ sáng: dồn lực (30 % đầu báo trước: co + ngả sau) → vươn → tung đòn (giãn + đổ trước, lò xo thiếu
    giảm chấn vượt đích; Sóng dừng đập xuống) → giữ (Nhịp: nhói theo từng vòng) → hồi; thời gian = luật cũ. Lớp mực in lệch
    trên vật liệu toon (viền đỏ / lam theo hướng đổi 8 Hz + rung kép lệch tần 7,0 / 7,6 rad/s) theo `dissonance` (+0,45 khi
    BREAK); rút màu + dồn bậc sáng theo `decomposition`. `BossEpicycles`: chuỗi vectơ (36 vòng + mũi tên, 1 lệnh vẽ instancing,
    shader khoảng cách) + dải đường viền giấy cắt (viền giấy trắng, lõi mực, lớp đỏ / lam lệch khuôn, ngọn bút vàng; 1 lệnh
    vẽ), quay mặt về máy quay; chiến đấu thường dưới 60 % máu còn "bóng ma" đường viền theo số hoạ âm (chỉ dựng lại khi bậc đổi).
    `CometRibbons`: 2 vệt ruy băng theo ĐÚNG quỹ đạo (lấy mẫu quá khứ bằng chính `lissajous()` của luật, 56 điểm × 24 ms;
    hướng mặt máy quay ở vertex shader; 1 lệnh vẽ). `createStandingMat`: tấm Chladni — vùng nguy hiểm đỏ rung (hạt cát nhảy
    12 Hz, gân Chladni (m, n) đổi theo lần đòn, đơn giản dần khi mất hoạ âm), vùng an toàn = cát vàng tụ + vạch nút lam; chớp
    lúc đập (tắt khi giảm chuyển động); lệch mực chỉ là viền màu, không dời vùng.
  - `SirenPortals.tsx` (chỉ mặt cổng): `PORTAL_OPEN` + thuộc tính `aOpen`; người chơi trong 30 m → chuỗi 3 vectơ quay
    (R·e^{iθ} ∓ (A/2)i·e^{i(15θ+φ) / −i(13θ+φ)} = đúng vành răng sò) vẽ vành 1,3 s (răng sâu hơn khi đang vẽ), rồi mặt xoáy nở như
    mống mắt 0,6 s; cổng chưa mở xong không render-to-texture (tiết kiệm). Dịch chuyển không đổi.
  - Trình duyệt (ảnh từ máy quay gỡ lỗi): bút epicycle vẽ dáng boss; thân hiện từ đầu xuống với mép tan vàng; BREAK = hình chuông
    bậc 3 lệch mực đỏ / lam, thân rã nửa dưới; gục = dáng trơn dần → elip → co mất; sàn Chladni đọc rõ dải an toàn; 2 vệt sao chổi
    hồng / lam; cổng tự vẽ vành rồi nở. `__perf` (máy tải nặng): 109 lệnh vẽ / 156–162k tam giác / GPU ≈ 13 ms; thêm tối đa
    +2 (BREAK / xuất hiện / gục) hoặc +1 (Lissajous, bóng ma) lệnh vẽ, Chladni thay đĩa cũ (0); lúc xuất hiện thân ẩn nên còn
    −6. Dev: `window.__sirenBossFx` (mountAt / dbgBreakUntil / dbgDeadAt) để xem lại hình, không đụng BossSim.
