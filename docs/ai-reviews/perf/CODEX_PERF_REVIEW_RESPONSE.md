# Phản hồi rà soát hiệu năng (Codex) — Claude kiểm chứng

Ngày 28/11/2026. Kiểm chứng từng phát hiện trong `CODEX_PERF_REVIEW.md` bằng mã thật và đo trên máy đích (i5-1135G7 + Iris Xe, Chrome, dev server `localhost:3123`, `/world/preview`). Chỉ làm ở máy local, không commit.

## Cách đo

- Đã mở rộng `window.__perf(ms)` trong `components/world/fx/PerfProbe.tsx` (chỉ bản dev). Ngoài `frameMs` (thời gian thực trôi qua chia số khung), hàm này giờ trả thêm:
  - **`cpuMs` / `cpuP95`**: thời gian JS thật của mỗi khung, tính từ `useFrame` đầu đến `useFrame` cuối, gồm cả lệnh vẽ của EffectComposer.
  - **`gapP95`**: khoảng cách giữa hai khung ở phân vị 95.
  - **`renders`**: số lần `gl.render` mỗi khung. Con số này gồm lượt vẽ chính, các lượt hậu kỳ và các lượt phụ như cổng, phản chiếu, mô phỏng nước.
  - `window.__gl` được mở cho bản dev.
- Mỗi cặp A/B dùng DPR 1 cố định (`__gl.setPixelRatio(1)`), cùng mức chất lượng, cùng tư thế người chơi và máy quay (`player`, `camYaw`, `camPitch`).
- Khi cần đo lúc máy quay chuyển động, máy quay được lia theo hình sin ±0,6 rad.
- Máy có nhiều agent chạy song song nên nhiễu lớn: `cpuMs` dao động ±30% giữa các lần đo. Vì vậy ưu tiên các chỉ số đếm được (`renders`, `calls`, số ô kẹt, số geometry). Chi phí mỗi lượt vẽ phụ được đo trực tiếp bằng cách bọc `gl.render` và lọc theo render target.
- Các số trong báo cáo Codex là ước tính. Bảng dưới chỉ ghi số đo thật.

## Claude kiểm chứng

| # | Finding | Kết luận | Đã làm | A/B số đo |
|---|---|---|---|---|
| P0 | `frameMs` là wall time, không phải CPU time | **đúng** | Thêm `cpuMs`, `cpuP95`, `gapP95`, `renders` vào `__perf` | Hub (mức vừa): `frameMs` 52 ms nhưng `cpuMs` 22,8 ms. Hai số lệch nhau xa nên không lấy `frameMs − gpuMs` làm CPU được |
| 2 | Siren: 2 ô cổng có thể cùng vẽ lại cảnh trong một khung, 30 Hz | **đúng** | `lib/world/perfGate.ts` thêm `portalSlots`, `portalPeriodMs`, `portalPassOrder`. Mỗi khung chỉ vẽ tối đa **một** lượt cổng: ô đến hạn lâu nhất được vẽ trước, ô không vẽ được thì nhường ô kế. Mức cao 30 Hz/ô; mức vừa (laptop/điện thoại) 12 Hz; mức thấp chỉ còn mặt xoáy (như cũ). Ma trận cổng tĩnh được cache, bỏ `clone()` mỗi khung | Một lượt vẽ cổng tốn **5,9 ms CPU** (mức cao, 512²) và 11 ms (mức vừa, 320², đo nhiễu). Mức cao: `renders` 3,79–3,95 → **3,00** (lượt cổng mỗi khung 1,8–1,95 → 1,0), tức bớt **~5 ms CPU/khung**. Mức vừa: lượt cổng mỗi khung 0,65 → **0,38–0,40**, bớt ~3 ms/khung ở ~20 FPS. Test: luân phiên đều, một lượt mỗi khung, ô hỏng không chặn ô kia |
| 3a | Hub: Reflector vẽ lại layer 0 tới 20 Hz, dưới 20 FPS gần như mọi khung | **đúng** (nặng nhất trong các mục đã đo) | `reflectionPlan`: tắt ở mức thấp (dùng nhánh Fresnel + trời có sẵn); mức vừa 10 Hz; mức cao 20 Hz. Kèm mục 9: tự hạ chất lượng sẽ tắt luôn phản chiếu | Lia máy quay, mức vừa: **bật** `cpuMs` 41,8 / p95 57,4 / 788 lệnh vẽ; **tắt** 22,8 / 33,8 / 469. Phản chiếu tốn **+19 ms CPU, +319 lệnh vẽ mỗi khung**. Cấu hình đang lưu của máy này (`custom`, phản chiếu bật, máy tự hạ xuống thấp) trước đây vẫn bật phản chiếu; giờ đã tắt. Lưu ý: dưới 10 FPS thì nhịp 10 Hz không còn tác dụng, chỉ việc tắt mới giúp |
| 3b | Sóng 128² và bọt 256², tối đa 2 bước mỗi khung ở mọi mức | **đúng, chi phí nhỏ** | `waterMaxSteps`: mức thấp chỉ 1 bước/khung (khi tụt FPS thì không bù bước). Thêm tham số `maxSteps` cho `RippleSim.step` / `FoamSim.step` | Mức thấp ở <60 FPS bớt tối đa 2 quad pass/khung. Không đo riêng được vì nhỏ hơn nhiễu |
| 3c | Vết chân Hub vẫn decompose/upload sau khi tan | **đúng** | Dấu mới nhất tan hẳn thì đặt `prints.count = 0`; bỏ 4 lần cấp phát object mỗi khung | Hết 40 lần decompose/compose và upload mỗi khung sau 9 s |
| 4a | Expanse: cache miss thì `blockAt` sinh chunk đồng bộ trên luồng chính | **một phần** | `columnReady(x, z)` trong `voxels.ts` hỏi xem dữ liệu đã có chưa mà không sinh chunk. Tia nhắm khối dò mỗi khung trong `BlockInteractor` coi chunk chưa có dữ liệu là trống (chunk đó cũng chưa hiện). **Va chạm người chơi giữ nguyên**: vẫn sinh đồng bộ để không rơi xuyên đất ở mép chưa tải | Sinh một chunk trên luồng chính (node, cùng máy): p50 **6,5 ms**, p90 14 ms, lần lạnh 76 ms. Chạy 12 m/s trong 8 s và bay 30 m/s trong 6 s: **0** chunk sinh trên luồng chính (worker theo kịp). Chỉ lúc vào cảnh có 4 chunk sinh đồng bộ (~210 ms, bị màn chờ che). FIFO 320 chunk không làm rơi chunk đang dùng (chunk quanh người chơi luôn mới hơn), nên không đổi sang LRU. Test `voxelReady.test.ts` |
| 4b | FarTerrain: `want.length = 0` làm mất ô đang chờ; kết quả cũ xoá ô LOD mới | **đúng — lỗi hiển thị nghiêm trọng** | `farReplan`: mỗi lần đổi tâm xếp lại **mọi** ô cần mà chưa có lưới và không đang dựng; bỏ ô không còn cần; ô cũ khác bậc giữ tới khi ô thay thế về. `farAccept`: kết quả cũ (bậc chi tiết đã đổi) bị bỏ, không xoá ô mới cùng chỗ. Bỏ `[...keep]` trong vòng lặp | Sau khi chạy ~190 m: **trước 2/76 ô có lưới, 74 ô kẹt vĩnh viễn** (chân trời gần như trống). **Sau: 32/32 và 36/36 ô có lưới, 0 ô kẹt** (đã chạy cùng quãng và thêm một chặng bay 30 m/s). Test: đổi tâm liên tục, đổi bậc chi tiết, kết quả cũ |
| 5a | VRM `frustumCulled = false` cả cây | **đúng** | SkinnedMesh dùng khối bao tư thế gốc nới thêm (bán kính ≥ 0,9 m + 0,6 m) và bật frustum culling. Culling tính theo từng máy quay (chính, phản chiếu, cổng, bóng) nên không mất nhân vật ở máy quay phụ | Hub, 20 SkinnedMesh, NPC ngoài khung: bớt ~6–17 lệnh vẽ. Lợi ích lớn hơn khi nhiều người chơi khác ở ngoài khung |
| 5b | `fitOutline` chạy trước cổng tần số | **đúng, chi phí rất nhỏ** | Chuyển xuống sau cổng tần số và chỉ chạy khi viền đang bật | không đo được (vài µs) |
| 5c | Group viền MToon cho avatar xa / mức thấp | **đúng** | `outlineOn`: NPC và người chơi khác tắt viền MToon khi xa hơn 30 m (bật lại dưới 26 m) hoặc ở mức thấp. Viền hậu kỳ Ink vẫn vẽ bóng dáng. Nhân vật của mình luôn có viền | Mỗi mesh da của avatar xa bớt một lệnh vẽ và một lượt skinning. Test có trễ |
| 6 | Impossible: nhánh sân/sảnh ẩn vẫn cập nhật (Maxwell, Poincaré, Hypercore, cửa stencil) | **đúng về hành vi; ước tính 1–4 ms là quá cao**. Riêng cửa stencil có lợi rõ | Thêm `scene/shown.ts` (kiểm visible của cả chuỗi tổ tiên). Maxwell: khi ẩn thì không mô phỏng; chỉ upload 140 phân tử khi khí đổi. Poincaré: chỉ dựng lại 3 cung khi đỉnh A di chuyển. Hypercore: bỏ qua khi ẩn. Cửa stencil: khi cửa đóng thì ẩn luôn nội dung phòng thu nhỏ. Trạng thái bài toán không đổi | Benchmark node cùng máy: Maxwell khi ẩn **0,041 ms/khung** (+~11 KB upload), Poincaré **0,032 ms**. **Cửa bốt đóng, nhìn vào bốt: 615 → 542 lệnh vẽ, 803k → 664k tam giác** (nội dung 72 mesh không còn bị gửi vẽ) |
| 7a | Label3D chiếu và ghi DOM mỗi khung, kể cả nhãn ẩn | **đúng** | Nhãn quá tầm (khi không ngắm ống nhòm) thì bỏ qua phép chiếu. Cache giá trị opacity/transform đã ghi (làm tròn 0,1 px) và chỉ ghi DOM khi đổi | Nhãn ẩn: hết ghi `opacity = "0"` mỗi khung. Đứng yên: 0 lần ghi DOM. Không có logic thuần đáng test |
| 7b | Crosshair dùng rAF + setState suốt lúc ngắm | **đúng** | Dừng rAF khi vòng tích lực đã đầy | — |
| 7c | `floatText` tạo 2 node DOM mỗi sự kiện | **đúng nhưng không sửa** | Chi phí theo sự kiện và đã giới hạn 40 mục; chưa thấy trong số đo | — |
| 8a | HubProps tắt culling | **đúng, lợi ích thấp** | Thêm `boundInstances`: tính bounding sphere của lô instance (+1,5 m cho gió) và bật culling, cho cả bản sao mặt nạ Ink. Không chia lô theo vùng (sẽ tăng số lệnh vẽ) | Mỗi lô trải khắp quảng trường nên chỉ được cắt khi nhìn trời, nhìn ra biển mây, hoặc ở máy quay phản chiếu / mặt nạ |
| 8b | Cỏ 22–36 m chỉ thu nhỏ trong shader, chưa có LOD mật độ | **đúng về số tam giác, không sửa** | Mục 9 đã hạ mật độ cỏ khi tự hạ chất lượng (vfx ≤ 1 ở mức vừa, 0 ở mức thấp) | Tắt hẳn cỏ ở vfx 1: −224k tam giác, GPU 12,9 → 13,1 ms (không đổi). Ở vfx 2: ~+1,2 ms GPU (nhiễu). Máy này nghẽn CPU nên chưa đáng tăng số lệnh vẽ để làm LOD |
| 9 | Tự hạ chất lượng không hạ các cờ đắt; DPR khó đoán | **đúng** | **(a)** `capGfx` + `gfx.autoDowngrade`. Khi PerformanceMonitor hạ chất lượng thì hạ luôn AO, tia thể tích, DOF, bóng đổ và VFX (≤ 1 ở mức vừa); xuống mức thấp thì tắt thêm phản chiếu, bloom, VFX = 0. Áp cho mọi chỗ đọc `useGfx`, kể cả file VFX, mà không phải sửa các file đó. Chỉ áp trong phiên: localStorage vẫn giữ lựa chọn người dùng (đã kiểm). Chọn preset thì bỏ trần. **(b)** `renderDpr`. Trước đây khoảng DPR bị nhân `scale·drs` **trước** khi kẹp, nên ở DPR 1,25 độ phân giải động **không có tác dụng** khi drs từ 0,72 đến 1, còn màn DPR 1 ở mức vừa lại vẽ 1,25× (thừa 56% điểm ảnh). Giờ kẹp DPR thiết bị, không vượt DPR màn hình (trừ mức cao), rồi mới nhân `scale·drs` | Máy thật: DPR 1,25 → 0,875 → 0,8125 khi drs giảm (trước đây đứng ở 1,25). Test DPR / capGfx |
| 9+ | (Người dùng duyệt thêm) Không hạ chất lượng trong 8–10 s đầu sau khi vào cảnh | **đúng: lỗi gốc là `onFallback` của drei** | `onFallback` của drei đếm **mọi** lần decline/incline (`flipped`). Với `flipflops = 2`, nó hạ thẳng xuống thấp ~7,5 s sau khi gắn Canvas mà không có ân hạn, rồi tắt luôn bộ theo dõi (mất cả độ phân giải động) cho đến hết phiên. Đã bỏ `onFallback` và thêm `qualityStep` (thuần, có test). Ân hạn **9 s tính từ lúc màn chờ / lỗ sâu tắt** (`useTransit.load === "idle"` và không `travelTo`; đặt lại 0 khi đổi cảnh). Chỉ hạ khi chậm **liên tục ≥ 5 s** và độ phân giải động đã xuống đáy; nếu có khoảng lặng > 4 s hoặc một lần incline thì chuỗi bị đứt. **Tự nâng lại** một bậc khi nhanh liên tục ≥ 15 s (`gfx.autoRaise`, không vượt mức người dùng chọn) | Vào Hub ở mức vừa: 5–15 s vẫn ở mức vừa; hạ xuống thấp ở giây ~20, sau khi độ phân giải động đã xuống đáy (0,8125) với FPS ~10–15 kéo dài, tức hạ đúng. Test: ân hạn, chậm liên tục, đứt chuỗi, nâng lại có trễ |
| 10a | Cache VRM giữ instance của người chơi đã rời; promise lỗi nằm mãi trong cache | **đúng** | Đếm số chỗ dùng mỗi bản VRM. Bản `peer:<id>` không còn ai dùng sau 15 s thì bỏ khỏi cache và `VRMUtils.deepDispose` (mỗi bản được nạp riêng, không dùng chung tài nguyên). Promise lỗi bị xoá khỏi cache. Dev: `window.__vrmCache()` | Chưa đo được vì cần nhiều người chơi thật. Đã kiểm StrictMode (gỡ rồi gắn lại trong cùng tick thì không huỷ) |
| 10b | Hub: `LAMP_MATS` chỉ `push`, merged geometry và InstancedMesh không được dispose | **đúng** | Kính đèn đăng ký trong effect (không còn push lúc render) và gỡ khi rời. Vật liệu tự tạo của `useHubMats` được dispose. Geometry `merged:*` của `mergeStatic` được dispose (geometry gốc của GLB giữ nguyên). HubProps dispose bộ đệm instance và các vật liệu lá / mặt nạ / bản sao có gió | Vòng Hub → Valley → Hub: **trước +20 geometry/lượt** (804 → 823 → 843); **sau +5/lượt** (340 → 345, valley 288 → 293). Texture vẫn +3/lượt: phần còn lại chưa truy (xem mục chờ) |
| GC-1 | Telegraph Lissajous tạo 322 Vector3 mỗi khung | **đúng** | Đường bay cố định (chỉ phụ thuộc k và t) nên chỉ dựng **một lần** | Chỉ 1–4 khung mỗi đòn đánh, nhỏ |
| GC-2 | CosmicBeast tạo 192 mảng mỗi khung | **đúng** | Ghi thẳng vào Float32Array của texture xương | 192 mảng tạm/khung/con → 0 |
| GC-3 | Vết chân Hub | **đúng** | xem 3c | — |

## Chờ (chưa làm, theo phân công)

- **Impact blur / Lensing**: 24 mẫu, thiếu `CONVOLUTION`, gắn DEPTH ở mọi cảnh. Agent VFX đang sửa `Lensing.tsx`.
- **Prewarm / đổi cảnh**: `PrewarmShaders` và `gl.compile` + `render` 4×4 trong layout effect của Impossible. Agent màn chuyển cảnh đang làm.
- Ink / InkMask ở mức thấp, sky Impossible tô trước opaque, Poincaré/Mandelbrot tốn theo diện tích màn hình, shadow 2048², overdraw kính/hồ: thuộc phần GPU (máy này nghẽn CPU), chưa đo.
- Expanse #7 (gộp solid/glow, cụm terrain xa 2×2, bỏ quét scheduler khi rảnh) và Siren #9 (chia mê cung, lọc ứng viên va chạm): chưa làm.
- #10 CPU nhỏ (`findNearby`, `samplePeer`, Zustand boss 100 ms): chưa làm.
- KTX2 `broken` toàn phiên, preload atlas Siren: chưa làm.
- Hub còn rò ~+5 geometry / +3 texture mỗi lượt (có thể từ HubWater, GatePortals hoặc CosmicBeast): cần truy tiếp.

## Rủi ro

- **Khối bao VRM**: avatar có phụ kiện vươn xa (cánh, đuôi dài) hơn ~0,6 m ngoài khối bao tư thế chữ T có thể bị cắt sớm ở mép khung nhìn. Nếu thấy nháy thì tăng biên trong `Avatar.tsx`.
- **Huỷ VRM peer**: nếu sau này nhiều người chơi dùng chung một bản (khác khoá `peer:id`), cần xem lại.
- **Cửa stencil**: nội dung bị ẩn khi mặt nạ ẩn. Nếu sau này có nhiều StencilPortal cùng `stencilRef` 1 nhìn xuyên lẫn nhau thì phải xét lại.
- **Tự hạ / nâng chất lượng**: settings UI giờ hiển thị giá trị đã bị hạ (đúng với thứ đang vẽ). Nếu người dùng đổi một mục lúc đang bị hạ thì lựa chọn gốc + mục vừa đổi được lưu, không lưu giá trị bị hạ.
- **DPR**: mức vừa / thấp trên màn DPR 1 không còn siêu lấy mẫu 1,25×. Hình mềm hơn một chút, SMAA vẫn bật ở mức vừa.
- **Nhiễu đo**: các số `cpuMs` đo khi nhiều agent cùng chạy nên dao động mạnh. Kết luận dựa trên số đếm (`renders`, lượt cổng × ms/lượt, `calls`, ô kẹt, geometry) là chắc chắn hơn.

## File đã sửa / thêm

- Mới: `lib/world/perfGate.ts`, `tests/world/perfGate.test.ts`, `tests/world/voxelReady.test.ts`, `components/world/scene/shown.ts`
- Sửa:
  - `components/world/fx/PerfProbe.tsx`, `scene/siren/SirenPortals.tsx`, `scene/HubWater.tsx`, `fx/water.ts`
  - `lib/world/voxels.ts`, `craft/BlockInteractor.tsx`, `voxel/farTerrain.ts`
  - `player/Avatar.tsx`, `scene/Impossible.tsx` (StencilPortal), `scene/MaxwellLab.tsx`, `scene/PoincareFloor.tsx`, `scene/TessRoom.tsx` (Hypercore)
  - `ui/Labels.tsx`, `ui/Hud.tsx` (Crosshair), `scene/HubPlaza.tsx`
  - `WorldClient.tsx` (dpr, PerformanceMonitor), `gfx.ts`
  - `scene/Siren.tsx` (telegraph), `fx/CosmicBeast.tsx` (ghi texture xương), `scene/Expanse.tsx` (dev: `__voxGen`, `__farMgr`)
