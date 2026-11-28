# VFX-AAA — Kiểm toán + nâng cấp hiệu ứng thời gian thực (28/11/2026, agent, local, chưa commit)

Theo skill `threejs-aaa-vfx-builder` (6 luật + bảng ngân sách) và `threejs-debug-profiler` (đo). Máy mục tiêu: i5-1135G7 +
Iris Xe (không GPU rời) + điện thoại → **mặc định lấy cột MOBILE**, phần desktop chỉ sau mức đồ hoạ (`gfx.vfx` / `quality`).
Không dùng skill trả phí (Tripo / Gemini / ElevenLabs), không Blender.

## 1. Kế hoạch (đã làm theo thứ tự ưu tiên)

1. Vá NaN / HDR (luật 5) — rủi ro "đen cả màn hình" của bloom HalfFloat: rẻ, tác động lớn.
2. Pha DƯ ÂM còn thiếu (luật 2) + dáng riêng thay "vòng tròn tô màu" cho sự kiện hay gặp (luật 3): pool khói / bụi cel
   dùng chung (1 lệnh vẽ) + atlas thủ tục nướng một lần.
3. Tiếp xúc mềm với sàn (luật 4) theo nhánh `uHasDepth = 0` (không depth pre-pass — GPU tích hợp): mặt sàn giải tích.
4. Tất định (luật 5): RNG có hạt giống cho quỹ đạo, đồng hồ hiệu ứng chung (đóng băng đồng bộ), bỏ cấp phát mỗi khung.
5. Giảm chuyển động (skill §5): tắt khung chấn / tách màu, dịu sóng xung kích + rung máy quay.
6. Bloom chọn lọc: ngưỡng ≥ 1,05.

Không đổi luật chơi / thời gian đòn; `realtime/*` không đụng (selftest ALL PASS).

## 2. Kiểm kê hiệu ứng

| Hiệu ứng (file) | Hình học (topology) | Bảng màu | Nhịp | Lệnh vẽ | Texture | Đèn | Overdraw |
|---|---|---|---|---|---|---|---|
| Phép vẽ — vòng / mảnh / dải / rune (`fx/SpellFx.tsx`) | vòng khép (khiên), sét **bậc thang**, xoắn 2 tay bất đối xứng (singularity), **parabol + dấu chân** (thiên thạch), **rèm sóng** chồng chập | 5 bảng lõi / thân / mực / nhấn (`lib/world/spellFx.ts`) | đủ báo trước → chớp → lõi → va chạm; dư âm yếu (trước khi sửa) | 4 (pool cố định) | brush 256², runes 1280×256 | 0 | vòng: chỉ dải, mảnh: ĐẶC |
| Tia / glint (`fx/Sparks.tsx`) | billboard kéo theo vận tốc màn hình + chữ thập 4 cánh giải tích | màu phép ×2,6 HDR | loé 8 % → tắt | 1 | 0 | 0 | kẹp cỡ màn hình |
| Khiên (`fx/Ward.tsx`) | vỏ cầu fresnel 2 nấc + lưới lục giác (curved dome) | ngọc bích / ngà | mở nảy 0,35 s, quét 100 ms, chạm 90 ms, nhấp nháy < 1 s, tan 220 ms | 1 | 0 | 0 | 1 lớp cộng (mặt trước) |
| Hào quang niệm (`fx/CastAura.tsx`) | sigil SDF dưới chân + cột mềm | theo `CAST.color` | lên 120 ms theo nét vẽ | 2 | noise 512² (dùng chung) | 0 | cột 2,2 m mờ |
| Bóng lướt (`fx/DashGhosts.tsx`) | SkinnedMesh dùng chung hình học, xương đông cứng | màu vũ khí | 60 ms / bóng, 220 ms | ≤ 4 × số mảnh | 0 | 0 | cộng |
| Dải vệt (`fx/Ribbons.tsx`) | ribbon hướng camera | màu vũ khí | theo tuổi | 1 | 0 | 0 | — |
| Hiệu ứng đánh (`combat/CombatScene.tsx` CombatFx) | slash (mesh Blender), **ring / nova / vring (fxmat polar)**, arc sét theo khung, hit sprite, crater decal, meteor GLB, lỗ đen (lõi đen + đĩa + 2 vòng photon) | ramps.png 16 hàng | slash 0–70 ms quét / giữ / xói; ring bung outExpo | ≤ 1 / hiệu ứng sống (pool 8) | noise_pack, ramps, ring_wave, mask | 0 | sprite hit `depthTest=false` |
| Vũ khí sóng (`combat/WaveWeaponsFx.tsx`) | dải tổng sóng Σ A sin, chấm đỉnh / nút | xanh / hồng / vàng | theo ω | 1 + chấm | 0 | 0 | — |
| Boss Siren (`scene/siren/SirenBossFx.tsx`) | epicycle (chuỗi vectơ), dải giấy cắt, ruy băng sao chổi Lissajous, sàn Chladni | đỏ / lam lệch khuôn | lò xo dồn lực → vươn → tung → giữ → hồi | +1…2 | 0 | 0 | — |
| Báo trước boss (`bosses/floorCue.ts`) | 1 lưới ô theo địa hình, hình nguy hiểm giải tích (lộ trình, gập, thanh) | san hô / ngà / mực | gạch chéo → đổ đầy → đòn thật | 1 | 0 | 0 | sàn |
| Hậu kỳ (`fx/Lensing.tsx`) | sóng xung kích 2 khe + khung chấn (zoom blur + tách màu) + thấu kính hố đen (chỉ trời) | — | 0,7 s | 0 (gộp EffectPass) | — | — | toàn màn hình, thoát sớm |

## 3. Chấm theo 6 luật + ngân sách (TRƯỚC khi sửa)

| Luật | Kết quả | Ghi chú |
|---|---|---|
| 1. Hình + giá trị trước bloom; HalfFloat; ngưỡng ≥ 1,05 | **Một phần** | Composer HalfFloat đúng (mặc định `frameBufferType = HalfFloatType`, `node_modules/@react-three/postprocessing/dist/index.js:365`). Ngưỡng hoạt hình = **1,0** (`WorldClient.tsx:434` cũ) — mặt LDR sáng dưới nắng sát ngưỡng. Phép có mép mực tối (alpha pha trộn) → đọc được khi tắt bloom ✔ |
| 2. Nhịp 5 pha | **Một phần** | Phép T24 có báo trước / chớp / va chạm. Thiếu: nhịp nín thở trước va chạm thiên thạch; **dư âm "nguội"** gần như không có (khói / bụi / than lắng) ở thiên thạch, xoắn sập, sét, sóng; quái gục = 40 tia toả cầu đều |
| 3. Đa dạng hình học | **Một phần** | Phép: tốt (5 dáng riêng). Nhưng `addFx("ring" / "nova" / "vring")` là hiệu ứng mặc định ở **~30 chỗ gọi** (`combat/combat.ts:102, 777–778, 809, 897, 903, 950, 1006–1037, 1102–1111, 1133, 1177–1178`, `combat/RuleMonsters.tsx:70–92`, `combat/waveWeapons.ts:94–291`, `CombatScene.tsx:102, 225` cũ) = đúng anti-pattern "vòng tròn đổi màu" |
| 4. Tiếp xúc mềm theo depth | **Không** | Không có depth pre-pass (và composer đọc depth của chính nó → không được lấy mẫu trong cảnh). Khiên cắt thẳng ở sàn; mảnh / tia rơi xuyên đất |
| 5. Zero-alloc, NaN-safe, tất định | **Một phần** | SpellFx / Sparks zero-alloc ✔. NaN: xem F1–F6. `Math.random()` trong quỹ đạo: SpellFx 28, Sparks 9, CastAura 4, Effects 10, CombatScene 3. Đóng băng `__fxFreeze` chỉ dừng SpellFx (tia, sóng xung kích vẫn chạy) |
| 6. Gắn nhân vật / camera / âm thanh | **Có** | Hitstop / shake / impact / sfx có sẵn; reduced-motion chỉ áp ở Siren, hậu kỳ + rung máy quay bỏ qua |

| Ngân sách (đỉnh combat) | Mục tiêu mobile | Đo (Iris Xe, bão 5 phép / 350 ms) |
|---|---|---|
| Lệnh vẽ VFX thêm | ≤ 20 | **+7 … +10** (cả trước và sau) ✔ |
| Texture VFX thủ tục | 4 × ≤ 256² | sau sửa: 2 tấm (64² + 128²) + brush / rune PNG có sẵn ✔ |
| PointLight VFX | 0–1 | 0 ✔ |
| Lớp phủ toàn màn hình chồng nhau | ≤ 1–2 | 0 lớp lưới; Lensing là 1 lần lấy mẫu trong EffectPass ✔ |
| Depth pre-pass | tuỳ chọn (`uHasDepth = 0`) | không — dùng mặt sàn giải tích (mục 5.3) |

## 4. Phát hiện cụ thể (đã đối chiếu code thật)

| # | Phát hiện | Vị trí (trước sửa) | Mức | Xử lý |
|---|---|---|---|---|
| F1 | `pow((r − 1,7 uRE) / (0,08 uRE), 2.0)` — cơ số ÂM (bên trong vành Einstein) → không xác định trong GLSL ES → NaN → loang khắp mip bloom | `fx/Lensing.tsx:115` | cao | `rx * rx`, chia `max(…, 1e-4)`; `d / r`, `uRE² / r` dùng `max(r, 1e-4)` (`Lensing.tsx:108–119`) |
| F2 | 3 × `pow(x, 2.0)` cơ số âm + `normalize(uHitDir)` không bảo vệ | `fx/Ward.tsx:47, 48, 50–51` | cao (khiên hiện suốt) | bình phương tay + `normalize(uHitDir + 1e-5)` (`Ward.tsx:49–56`) |
| F3 | `pow(cos(…), 2.0)` — cos âm một nửa mặt sàn | `combat/CombatScene.tsx:635` (InterferenceField) | cao | `cI * cI`, `max(uLam, 1e-3)` (`CombatScene.tsx:643–644`) |
| F4 | `pow((u−0,13)·22, 2.0)`, `pow(vBelly+1, 2.0)`, `pow((vUT.x−0,045)·90, 2.0)`, `pow((abs(vBelly)−0,05)·9, 2.0)` | `fx/CosmicBeast.tsx:42, 78, 84` | cao (rồng / sâu vũ trụ ở cảnh vũ trụ) | bình phương tay |
| F5 | `normalize(cross(normalize(t), vd))` = normalize(0) khi dải sao chổi chĩa thẳng vào camera | `scene/siren/SirenBossFx.tsx:495` | cao (boss) | kiểm `length > 1e-5`, dự phòng `(0,1,0)` (`SirenBossFx.tsx:496–498`) |
| F6 | Lệch mực CỘNG màu âm `vec3(1.1, −0.25, −0.2)` → điểm ảnh âm vào bloom / tone map (AgX dùng log2) | `SirenBossFx.tsx:90` | trung bình | kẹp `max(rgb, 0)` cuối khối (`SirenBossFx.tsx:99`) |
| F7 | `precision mediump float` + `uTime = now/1000` (hàng nghìn giây) → trên GPU điện thoại fp16 vân nhiễu đứng / giật sau vài phút | `fx/fxmat.ts:59` | trung bình (điện thoại) | bỏ dòng, dùng highp mặc định của three |
| F8 | `pow(1 − age, 1.25)` không kẹp (nội suy có thể > 1) | `fx/WeaponTrail.tsx:57` | thấp | `pow(max(1e-4, 1 − age), 1.25)` |
| F9 | `smoothstep(e0, e1, x)` với e0 > e1 (không xác định theo spec) — **133 chỗ** trong `components/world` | ví dụ `SpellFx.tsx:148, 392, 401, 412`, `CastAura.tsx:52` | thấp (ANGLE / phần lớn GPU tính theo công thức) | sửa trong file VFX đã chạm (SpellFx, CastAura) → `1 − smoothstep(e1, e0, x)`; phần còn lại (nước, trời, cảnh) để nguyên — khuyến nghị dọn dần |
| F10 | Sóng xung kích: điểm va chạm SAU camera → `project()` lật dấu → vòng méo hiện ở phía đối diện màn hình | `fx/Lensing.tsx:164–170` | trung bình | tắt khi `|z| > 1`, mờ dần khi ra khỏi khung (`Lensing.tsx:174–179`) |
| F11 | Reduced-motion không áp cho khung chấn (zoom blur + tách màu toàn màn hình), sóng xung kích, rung máy quay | `Lensing.tsx:138–141`, `fx/Effects.tsx:239–240` | trung bình (a11y) | `fx/fxClock.ts` `fxReducedMotion()`; khung chấn = 0, sóng ×0,35, rung ×0,25 |
| F12 | Bloom hoạt hình `luminanceThreshold = 1` | `WorldClient.tsx:428` (cũ) | thấp | 1,05 (siêu thực giữ 1,2) |
| F13 | Không có pha dư âm / khói: thiên thạch, xoắn sập, sét, sóng chỉ có tia + vòng | `SpellFx.tsx` drawMeteors / drawVortices / drawBolts / drawWaves | cao (luật 2) | pool khói cel `fx/Puffs.tsx` (mục 5.2) |
| F14 | Thiên thạch không có "nhịp nín thở" trước va chạm (dấu chân sáng đều tới lúc chạm) | `SpellFx.tsx:848–866` | trung bình | `impactDip(trem)` (`lib/world/vfxBeats.ts`) — 90 ms cuối tối về 30 %, bán kính mép KHÔNG đổi |
| F15 | Đập đất (quái bị hất rơi) = `addFx("ring")` — vòng tròn dùng chung; quái gục = 40 tia toả cầu đều | `CombatScene.tsx:102`, `combat/combat.ts:390` | trung bình (luật 3) | vành bụi thấp (`CombatScene.tsx:110`); gục = vành bụi + làn hơi màu quái + 28 tia (`combat.ts:390–393`) |
| F16 | Mảnh pha lê / tàn lửa rơi XUYÊN đất (trọng lực, không va chạm) | `SpellFx.tsx simShards`, `Sparks.tsx` | trung bình | tham số độ cao sàn: nảy thấp + ma sát (`SpellFx.tsx:961`, `Sparks.tsx:234`) |
| F17 | Khiên bị sàn cắt thẳng ở chân | `Ward.tsx` | trung bình | mặt sàn giải tích: mờ 0,22 m sát đất + đường may sáng 7 cm (`Ward.tsx:60–66`) |
| F18 | `Math.random()` trong quỹ đạo (không lặp lại được ảnh / so sánh) | SpellFx 28, Sparks 9, CastAura 4, Effects (CameraShake) 2, CombatScene 1 | thấp | `lib/world/vfxRng.ts` `vfxRand()` + `window.__vfxSeed(n)` |
| F19 | `__fxFreeze` chỉ dừng SpellFx — tia, khiên, sóng xung kích vẫn chạy → ảnh từng pha lệch nhau | `SpellFx.tsx:992–994` | thấp (công cụ) | `fx/fxClock.ts` (`fxNow` / `fxFrozen`) dùng ở SpellFx, Sparks, Puffs, Ward, CastAura, Lensing |
| F20 | Cấp phát mỗi khung: closure `feed` + `slots.forEach` + phân tích chuỗi màu `color.set(str)` mỗi slot mỗi khung | `fx/Ribbons.tsx:73–109` | thấp | hàm cấp module, vòng for, chỉ phân tích màu khi đổi |
| F21 | Còn lại (chưa sửa): `vortices.find(…)` + `pr.trail.forEach(…)` closure mỗi khung (`CombatScene.tsx` CombatFx); `addFx` clone + spread object mỗi sự kiện (`combat.ts:250–255`); `emitBurst` / `emitHit` tạo object tuỳ chọn mỗi tia (`Sparks.tsx:87–104`); `Bursts` trong `fx/Effects.tsx` là code chết (không gắn ở đâu) nhưng còn `new Vector3/Color` mỗi hạt | — | thấp | khuyến nghị |
| F22 | Lỗ đen: 2 vòng photon + đĩa quay (`rotation.set(0.35, now/260, …)`) — đúng họ "singularity" nên chấp nhận được, nhưng thấu kính hậu kỳ chỉ bật ở Hư Không (LENS.on) | `CombatScene.tsx` (hole) | thấp | khuyến nghị: bật LENS ngắn khi xoắn sống (chỉ trời → rẻ) |
| F23 | PerformanceMonitor hạ chất lượng xuống "low" ngay lúc vào cảnh trên chính máy Iris Xe (4/6 lần chạy đo, do khựng biên dịch lúc tải) → người chơi thường mất bloom / brush atlas | `WorldClient.tsx` PerformanceMonitor onFallback | trung bình | khuyến nghị: bỏ qua onFallback trong 8–10 s đầu như onDecline |

## 5. Đã làm

### 5.1 Hạ tầng dùng chung
- `lib/world/vfxRng.ts`: `mulberry32`, `hash32`, dòng chung `vfxRand / vfxRange / vfxSigned`, `vfxSeed`.
- `lib/world/vfxAtlas.ts`: nhiễu giá trị / fBm **tuần hoàn** (chu kỳ nhân đôi mỗi tầng → lặp liền ô), `bakeNoiseFlow`
  (R fBm uốn miền · GB curl không phân kỳ (dψ/dy, −dψ/dx) · A gân Voronoi F2−F1), `bakePuff` (HỢP 6 khối cầu → viền "súp lơ"
  khói anime, R tô sáng từng bướu, G cuộn, B xói mịn, A dáng; alpha = 0 ở mép ô).
- `lib/world/vfxBeats.ts`: `impactDip` (nín thở), `climaxPulse` (đỉnh 1–3 khung, tắt mũ bất đối xứng), `puffAt` (nở
  outExpo → chậm, nhiệt than hồng → muội, xói từ 45 % đời), `PUFF_CAP` 8 / 18 / 28, `puffCount`.
- `components/world/fx/vfxTextures.ts`: DataTexture 64² (noiseFlow, lặp) + 128² (puff, kẹp), nướng bằng `requestIdleCallback`
  (đo node trên máy này: ~25 ms + ~40 ms, không chặn khung lúc vào cảnh), giữ chỗ bằng texture 1×1.
- `components/world/fx/fxClock.ts`: `fxNow / fxFrozen` (đóng băng MỌI hiệu ứng), `reduceMotion` (chuyển từ SirenGravity —
  SirenGravity re-export, không vòng import), `fxReducedMotion` (đọc lại ≤ 1 lần / s); dev `__fxFreeze(ms)`, `__vfxSeed(n)`.

### 5.2 Khói / bụi cel — `components/world/fx/Puffs.tsx` (1 lệnh vẽ, gắn ở `WorldClient.tsx:398`)
- Instanced ≤ 32, CPU sim zero-alloc, ngân sách sống 8 / 18 / 28 theo mức; kẹp cỡ ≤ 38 % chiều cao màn hình.
- Shader: flowmap **2 pha** (trộn tam giác, không giật khi đặt lại) → tô cel 2 nấc → lõi nóng HDR (bloom bắt khi mới nổ) →
  mép cháy khi xói → muội; premultiplied: muội CHE (đọc được khi tắt bloom), lõi nóng cộng sáng.
- Tiếp xúc sàn: `vH` = độ cao trên mặt sàn lúc phát (chuẩn hoá theo cỡ) → mờ 30 % cỡ dưới cùng; tâm không chui xuống đất.
- Dùng ở: thiên thạch (vành bụi than 12 + 3 cột khói; `SpellFx.tsx:833–836`), xoắn sập (vành khói mực cà tím 7; `:800`),
  sét trúng (1 làn muội; `:725`), sóng dừng (4 cụm sương; `:921`), quái đập đất (`CombatScene.tsx:110`), quái gục
  (`emitCollapse`, `combat.ts:393`). Mọi số đếm qua `puffCount(n, lv, min)`.

### 5.3 Sửa từng hiệu ứng
- Lensing: F1, F10, F11; đồng hồ `fxNow`.
- Ward: F2, F17 (`uFloorY` = chân người chơi), đồng hồ chung.
- SpellFx: RNG có hạt giống (28 chỗ), smoothstep đảo (5), nhịp nín thở thiên thạch, mảnh nảy trên sàn, 4 nguồn khói.
- Sparks: RNG, đóng băng, tham số `floorY` (tàn lửa thiên thạch lắng xuống thay vì chìm).
- CastAura: RNG, đồng hồ chung, `mark³` thay `pow`, smoothstep đúng chiều.
- CombatScene: F3, vành bụi đập đất, RNG crater; dev `window.__clearEnemies()` (chụp / đo phép ở chỗ trống).
- fxmat F7 · CosmicBeast F4 · SirenBossFx F5 + F6 · WeaponTrail F8 · Ribbons F20 · Effects (CameraShake) F11 + RNG.
- WorldClient: `<Puffs />`, bloom hoạt hình 1,05.
- (Theo yêu cầu điều phối) `fx/breath.ts`: hiệu ứng "thở" dùng thuộc tính `normal` thay `objectNormal` — MeshBasicMaterial
  (nhánh Hoạt hình) không có `beginnormal_vertex` → lỗi "objectNormal: undeclared identifier". Kiểm trên trình duyệt:
  Thế giới Bất Khả, 37 vật liệu thở (MeshPhysical ở Siêu thực / MeshBasic ở Hoạt hình), 0 lỗi shader ở cả hai chế độ.

### 5.4 Test
`tests/world/vfxAtlas.test.ts` (11): RNG tất định / phân bố / băm; fBm tuần hoàn f(0,y) = f(1,y); `bakeNoiseFlow` tất định,
mọi kênh lặp liền ô (đường nối không gắt hơn bên trong), curl trung bình 0,5 và dùng hết dải; `bakePuff` alpha = 0 cả 4 mép,
đặc ở tâm, trên sáng hơn dưới; `impactDip`, `climaxPulse`, `puffAt` đơn điệu / về 0; `PUFF_CAP`, `puffCount`.

## 6. Bằng chứng

Đo bằng Chrome headless **trên GPU thật** (ANGLE D3D11, Intel Iris Xe 0x9A49), 1280×720, Quảng trường, `window.__perf`.
**Lưu ý:** cùng lúc có agent khác sửa cảnh Hub / màn tải / PerfProbe (số lệnh vẽ nền đổi 423 → 462–478 giữa các lần chạy),
nên so TUYỆT ĐỐI giữa hai lần chạy không sạch; số tin được là **A/B trong cùng phiên** (bật / tắt nhóm `perf:puffs`).

| Lần đo | fps | GPU ms (trung vị) | lệnh vẽ | tam giác |
|---|---|---|---|---|
| TRƯỚC, mức vừa — nghỉ | 31,4 | 16,41 | 423 | 978k |
| TRƯỚC, mức vừa — bão phép | 27,7 | 16,54 | 433 | 982k |
| TRƯỚC, mức thấp — nghỉ / bão | 56,1 / 46,7 | 9,42 / 9,45 | 149 / 157 | 807k / 810k |
| SAU, mức vừa — nghỉ | 28,1 | 9,26 | 462 | 873k |
| SAU, mức vừa — bão, khói TẮT (3 lượt) | 24,5 · 27,5 · 26,2 | 9,20 · 9,96 · 9,56 (tb 9,57) | 470–471 | 876k |
| SAU, mức vừa — bão, khói BẬT (3 lượt) | 26,0 · 26,8 · 25,2 | 9,44 · 9,43 · 9,79 (tb 9,55) | 471–472 | 876k |
| SAU, mức thấp — bão, khói TẮT / BẬT (tb 3 lượt) | 33,2 / 36,3 | 8,87 / 9,09 | 211–212 / 212–213 | 705k |
| SAU, mức thấp — nghỉ | 47,0 | 7,58 | 205 | 702k |

- Khói: **+1 lệnh vẽ, GPU ±0,2 ms (trong nhiễu)**; đỉnh 8 cụm sống trong bão (mức vừa / thấp). CPU SpellFx 0,15–0,37 ms
  / khung (trước 0,25–0,41). Máy nghẽn CPU (cpuMs 19–31 ms của cả cảnh), không phải VFX.
- Ảnh (đóng băng đồng hồ hiệu ứng bằng `__fxFreeze`, hạt giống `__vfxSeed`), trong `docs/ai-reviews/vfx-aaa/shots/`:
  - `after-meteor-1-anticipation.jpg` → `-2-impact.jpg` (cụm khói than hồng cel + mảnh + vòng gãy) → `-3-aftermath.jpg`
    (vành bụi muội nguội dần) so với `-3-aftermath-NO-puffs.jpg` (cùng pha, tắt khói: chỉ còn sàn trống);
  - `before-vortex-3-aftermath.jpg` (trống) ↔ `after-vortex-3-aftermath.jpg` (khói mực cà tím);
  - `before-after-vortex-shield.png`, `after-meteor-vortex-shield-sheet.png` (bảng ghép), `atlas-puff-preview.png`.
  - Bộ "trước" của thiên thạch nằm ngoài khung (thiên thạch nhắm quái đi lạc); bộ "sau" dọn quái bằng `__clearEnemies`.
  - Script đo / chụp: scratchpad `vfx/drive.mjs` (CDP, không cần thư viện).

## 7. Còn lại / khuyến nghị
1. ~~Luật 3 cho `addFx("ring" | "nova" | "vring")`~~ — ĐÃ LÀM HẾT 41 / 41 chỗ (người dùng duyệt), xem §8.
2. F23: chặn PerformanceMonitor `onFallback` trong 8–10 s đầu (người dùng Iris Xe hay bị tụt xuống "low" vì khựng biên dịch).
3. Depth pre-pass thật (skill §3) chỉ đáng ở mức Cao / Siêu: cần tách nhóm opaque / VFX và render depth riêng (+1 lượt cảnh
   ≈ +30–40 % CPU lệnh vẽ trên máy này) — chưa làm; mặt sàn giải tích đủ cho sàn phẳng / bậc voxel.
4. Dọn F9 (smoothstep đảo, 133 chỗ) và F21 (closure / object mỗi sự kiện) dần khi chạm file.
5. Lỗ đen: bật `LENS` ngắn khi xoắn sống; thử `climaxPulse` cho cú loé va chạm thiên thạch / xoắn sập (đã có hàm + test).
6. Đo trên điện thoại thật (mức thấp: khói 8 cụm, noise 64²).

## 8. Luật 3 — hình riêng thay "vòng tròn đổi màu" (đợt 2, người dùng duyệt khuyến nghị #1)

**Hạ tầng:** `lib/world/strikeShapes.ts` (nhịp 5 pha `STRIKE_BEATS` / `beatAt` theo từng hình; `zigzagCrack`, `catenary`,
`tendril`, `KNIGHT_CELLS` / `isKnightCell`, `lodCount`; test `tests/world/strikeShapes.test.ts` 9) +
`components/world/fx/StrikeFx.tsx` — API `strike(shape, x, yGround, z, { r, yaw, color, n, arc })`, 3 pool instanced dùng chung:
DECAL (SDF phẳng sát đất) · DẢI (CPU, bộ đệm cố định 24 × 24 điểm) · KHỐI ĐẶC (hộp instanced ≤ 64, ghi depth → có viền Ink) =
**+3 lệnh vẽ tối đa** (pool rỗng thì ẩn). Gắn trong `CombatFx` (`CombatScene.tsx`) — cùng chỗ vẽ vòng cũ nên phủ đúng các cảnh có
chiến đấu. Bảng màu 3 giá trị: mực (thân × 0,25 ngả tím than) · thân (≤ 1, không loé) · lõi (thân ngả trắng 45 %, chỉ lõi + mép
vượt ngưỡng bloom theo nhịp). Zero-alloc mỗi khung (16 bản ghi sự kiện tái dùng), `vfxRand` có hạt giống, giảm chuyển động: đỉnh
cao trào 1,3 thay 2,6. Khói / bụi / tia dùng lại `Puffs` / `Sparks` (vào đúng pha cao trào hoặc nguội).

**Nhịp:** đòn tức thời (sát thương đã tính lúc gọi) → báo trước chỉ là mép vẽ vòng 25–60 ms + nín thở 30–50 ms rồi cao trào
(dồn lực thật nằm ở động tác / pha tụ — hình `sigil` co vào 260 ms). Vùng sát thương / thời gian / luật KHÔNG đổi: mép hình đặt
đúng bán kính, góc (nêm mô-men = ±1 rad = đúng `hitArc` của torque), ô (bàn cờ Mã = đúng `knightSq`).

| Chỗ gọi cũ | Sự kiện | Cũ | Hình mới (họ topology) |
|---|---|---|---|
| `combat/combat.ts:103` | bắn tụ lực (nòng) | ring 0,9 | `muzzle` — 3 chevron dọc trục bắn (đường ray) |
| `combat.ts:780–781` | né hoàn hảo · khúc xạ thời gian | ring 4 + nova 3 | `dial` — mặt đồng hồ 4 m, 12 vạch, 2 kim quay NGƯỢC |
| `combat.ts:812` | bắt đầu đòn tụ lực | ring 1,6 | `sigil` 6 cạnh co 1,7 R → R + tia bị hút vào (dồn lực) |
| `combat.ts:900` | đòn hình tròn (bán kính sh.r) | ring sh.r | `rupture` — vết nứt zigzag toả tới ĐÚNG sh.r + phiến trồi + bụi |
| `combat.ts:906` | mô-men (đòn bẩy) | ring 1,2 | `wedge` — nêm ±1 rad, tầm sh.range (đúng vùng trúng) + cung chém ngang |
| `combat.ts:953` | mưa tên (vùng rơi sh.r) | ring sh.r | `grid` — lưới trực giao 90° quét theo hướng, giữ ~1 s (đúng lúc tên rơi) |
| `combat.ts:1009, 1012` | sóng (vòng đứng ngực + n vòng đồng tâm) | vring + ring × n | `crest` — vương miện rèm sóng nở tới sh.r, ngọn nhọn, sương khi sụp |
| `combat.ts:1029` | hút (pull) | vring | `tendril` — tua xoắn mọc từ mép sh.r cuộn vào tâm |
| `combat.ts:1040` | hiệu ứng nova của chiêu | nova | `star` — sao 6 cánh tới đúng bán kính + gai pha lê ở mũi |
| `combat.ts:1105–1106` | tuyệt kỹ — pha tụ | vring + ring 2,2 | `converge` — 8 gai pha lê trượt từ 2,2 R vào vây quanh, nghiêng vào tâm (dồn lực 300 ms) |
| `combat.ts:1113–1114` | tuyệt kỹ — bung 7 m | nova 7 + ring 7,5 | `drop` — cột đá RƠI thẳng quanh vùng 7 m, nứt + bụi ở chân cột, thụt khi nguội |
| `combat.ts:1136` | đổi vũ khí | ring 1,4 | `helix` — dải xoắn 1,5 vòng bốc từ chân lên đầu |
| `combat.ts:1180–1181` | bổ nhào chạm đất (bán kính r) | ring r + nova | `crater` — miệng hố: vương miện phiến nghiêng ra ngoài + nứt dày + muội |
| `CombatScene.tsx:233` | quân Mã vung đòn | ring 2,7 | `knight` — bàn cờ 5×5 ô 1,2 m, sáng + trồi đúng 8 ô nước Mã |
| `RuleMonsters.tsx:70` | Hộ vệ: chia cho ước | vring 1,6 | `cage` — lồng trực giao, số thanh = số chia (2–8) + dầm nối |
| `RuleMonsters.tsx:75` | Hộ vệ: vỡ (÷ → 1) | nova 2,6 | `star` 5 cánh (vỡ khiên) |
| `RuleMonsters.tsx:88` | Hộ vệ phản đòn (gây sát thương ≤ 3,2 m) | ring 3,2 | `hex` — trường lục giác + 3 vách cong ĐÚNG 3,2 m |
| `RuleMonsters.tsx:92` | Hộ vệ dựng lại khiên | ring 2 | `shell` — 6 tấm vỏ cong khép từ ngoài vào (không vẽ sàn) |
| `combat/waveWeapons.ts:94` | Giáo Sin tụ lực — mũi | vring | `muzzle` ở mũi giáo |
| `waveWeapons.ts:116–117` | sóng dừng — vách phản xạ | vring + ring | `wall` — tấm kính đứng vuông góc hướng sóng, giữ suốt sóng dừng |
| `waveWeapons.ts:245–246` | khiên con lắc — xả (bán kính r) | nova + ring | `chain` — xích catenary căng tới mép r rồi ĐỨT (2 nửa võng rơi) |
| `waveWeapons.ts:291–292` | nhịp trống con lắc (bán kính r) | ring + nova | `piston` — 8 cột nhịp thụt lên quanh mép r |
| `waveWeapons.ts:355` | khiên đập (một mục tiêu) | ring 2,2 | `wedge` hẹp ±0,55 rad hướng đập |
| `scene/Storm.tsx:105` | sét đánh đất | ring 2,2 | `scorch` — vết cháy phân nhánh Lichtenberg (nhánh con, điện xanh trắng → muội, tia lấp lánh, KHÔNG phiến đá) |
| `scene/Hub.tsx:520` | tiếp đất mạnh | ring 0,9 | `land` — 6 vệt trượt ngắn nằm đất toả ra + bụi thấp |
| `scene/siren/SirenPortals.tsx:619` | tới cổng đích | ring 1,6 | `iris` — 6 lá cong (quay mặt máy quay) xoay vào rồi mở như mống mắt, màu cặp cổng |
| `SirenPortals.tsx:653` | bước qua mép sân khấu (ra phía đối tâm) | ring 2 | `gate` — khung cổng trực giao 2 cột + xà, vuông góc hướng đi |
| `scene/Siren.tsx:143–144` | boss Siren BREAK | nova 7 + ring 10 | `rupture` cỡ đấu trường (12 nhánh, 9 m) + phiến trồi |
| `Siren.tsx:158` | boss đập Sóng dừng | nova 5 | `crest` hồng 5 m |
| `scene/siren/SirenGravity.tsx:205` | bật lên trăng | nova 3 | `tendril` xoắn xanh chanh |
| `SirenGravity.tsx:248` | đệm nảy | ring 1,4 | `spring` — 3 chevron đứng chồng nhau vút lên + bụi |
| `SirenGravity.tsx:284` | ra khỏi lỗ sâu | nova 2,4 | `spokes` — chùm tia toả quay mặt máy quay ở miệng ra |

Tổng: **41 / 41 dòng gọi cũ → 32 lời gọi `strike` (26 hình)**; không còn chỗ nào gọi ring / nova / vring (kiểu fx vẫn giữ trong
`addFx` cho dev `window.__addFx(kind, size, color)` để so sánh). Đợt 3: tách `sigil` (giờ chỉ còn tụ lực đòn) → `converge` / `helix` /
`shell`; tách `rupture` (đòn tròn / BREAK) ↔ `scorch` (sét); nét decal tối thiểu ~1,3 px (`fwidth`) + mực đậm hơn (0,88), dải nở theo
khoảng cách máy quay (×1 … ×2,2 từ 13 m) để đọc được ở laptop 1080p khi máy quay xa.

**Bằng chứng** (Iris Xe, mức vừa, cùng phiên, đồng hồ hiệu ứng đóng băng theo pha):
- trước: `shots/strike-BEFORE-old-ring-nova-vring.jpg` — mọi sự kiện cùng một vòng gợn nở ra (ring 40 / 200 / 420 ms, nova, vring);
- sau: `shots/strike-AFTER-wedge-rupture-drop-phases.jpg` (báo trước → cao trào → duy trì → nguội),
  `shots/strike-AFTER-drop-chain-knight-phases.jpg`, `shots/strike-AFTER-all-shapes-sustain.jpg` (14 hình còn lại).
- `__perf` bão sự kiện (1 sự kiện / 150 ms, 5 s, 2 lượt) — MỚI: 418 lệnh vẽ, GPU 9,66 / 11,62 ms; CŨ (vòng / nova / vring): 418,
  9,95 / 11,14 ms; nghỉ 414, 10,85 / 9,98 ms → **+4 lệnh vẽ lúc đỉnh (3 pool + khói), GPU trong nhiễu**; đỉnh 8 sự kiện sống,
  13 dải, 15 khối, 4 decal.
- Kiểm tra: tsc, eslint (file đã sửa) sạch; test world 635 / 635; `realtime/selftest.mjs` ALL PASS.

- Đợt 3 ảnh: `shots/strike-AFTER-round3-new-shapes.jpg` (12 hình, 1080p), `shots/strike-AFTER-far-camera-1080p.jpg` (máy quay
  15 m: nứt / nêm / bàn cờ / lưới vẫn rõ nét). Trước: `shots/strike-BEFORE-old-ring-nova-vring.jpg`.

**Còn:** `rupture` dùng cho đòn tròn và BREAK của boss (khác cỡ 3 m ↔ 9 m, màu, số nhánh); `star` cho nova và Hộ vệ vỡ; chưa chụp
trên điện thoại thật.
