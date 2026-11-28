# Mê cung Hoạ âm — Giai đoạn 2: đồ thị khu + 3 khu đầu tiên

Ngày: 28/11/2026. Yêu cầu: "rộng hơn, đa chiều hơn, dị hơn, madoka và hậu hiện đại hơn, giống fever dream, kỳ lạ, các khu vực
rộng hơn". Nền: `BRAINSTORM_CODEX.md` (10 khu / 3 tầng mơ), `PLAN.md` (giai đoạn 1: HARMONIC, trời cắt dán, rối giấy, sàn,
FX boss), `WITCHES_CODEX.md` (Gối Xếp Im ↔ Sa Mạc: cùng chủ đề **nút sóng dừng**).
Nguyên tắc giữ nguyên: học phương pháp collage / vênh tỉ lệ / nghi thức lặp — mọi hình, chữ, sinh vật, nhạc là nguyên bản.

## 1. Đồ thị khu

Mỗi khu là **một không gian Euclid cục bộ** (gốc riêng, va chạm riêng, nội dung riêng). Phi Euclid nằm ở **cửa** nối khu.

| Khu (id) | Tầng mơ | Gốc thế giới | Khung cục bộ | Quy luật |
|---|---|---|---|---|
| `hub` — mê cung + đấu trường hiện có | Mặt đĩa | (0, 0, 0) | như cũ | giữ nguyên toàn bộ |
| `keys` — **Biển Phím Không Bờ** | Mặt đĩa | (0, 0, 2000) | 110 × 70 m | lớp cao độ lặp mỗi 12 phím, quãng tám = ×2 tần số |
| `wait` — **Phòng Chờ Đến Hôm Qua** | Bản nháp | (2000, 0, 0) | 65 × 50 m | lần trùng kế tiếp của hai lịch gõ = BCNN |
| `desert` — **Sa Mạc Tấm Đồng** | Mặt sau | (0, 0, −2000) | 105 × 85 m | đường nút Chladni nối hai bờ |

Cửa (hai chiều, mỗi cửa có khung nguồn / khung đích / điểm đặt chân hợp lệ — test kiểm):

```
hub ── rèm gấp (Vườn Sóng sin) ──▶ keys ── cửa phòng chờ (sau đê, khoá: quãng tám) ──▶ wait
 ▲                                                                                     │
 └── cửa đồng dưới đáy (đệm sen Tây Nam, y −16) ◀── desert ◀── lỗ vé khổng lồ (khoá: BCNN) ┘
```

"Sa mạc nằm ngay dưới quảng trường": cửa về của Sa Mạc mở ra ở tầng Đáy của hub. Lỗ bấm trên tấm vé ở Phòng Chờ cùng
đường viền với cửa đến ở Sa Mạc (match cut kiểu Satoshi Kon: giữ đường viền + hướng chuyển động, đổi nghĩa khung hình).

Toạ độ: các khu đặt ở **gốc thế giới cách nhau ≥ 2000 m** (> `camera.far` 1000) → mọi hệ hiện có dựa trên vị trí (boss,
quái, câu đố, trọng lực kỳ dị, cổng) tự tách khỏi khu khác mà không phải sửa; logic khu chạy trong toạ độ cục bộ
(`local = world − origin`). `zoneAtWorld(x, z)` suy ra khu từ vị trí (bền với hồi sinh / lệnh dev / dịch chuyển).

## 2. Cửa (door spec)

- Khung đứng: tâm đáy (x, y, z) cục bộ, `yaw` (pháp tuyến n = (sin yaw, 0, cos yaw) hướng ra phía tiếp cận), lỗ chữ nhật
  w × h hoặc tròn (tâm, r) — lỗ vé.
- Đi qua mặt cửa từ trước ra sau trong lỗ → ra ở cửa đối ngẫu theo +n_đích. Biến đổi cục bộ (lr, lu, ln) → (−lr, lu, −ln)
  (giống `sirenMaze.mapPoint`); vận tốc ngang xoay Δ = yaw_đích − yaw_nguồn + π, vận tốc đứng giữ; camYaw / playerYaw += Δ.
- **Thiết kế mọi cặp cửa có Δ = 0** (n_đích = −n_nguồn) → máy quay chỉ cần tịnh tiến (`CAM.shift`) → liền mạch tuyệt đối;
  hạ tầng vẫn hỗ trợ Δ ≠ 0 (test).
- Cùng một bước khung: đổi khu + vị trí + bộ va chạm + hướng máy quay; giữ đà ngang (`carryHorizontal`).
- **Vật che**: khung cửa (vành vé đục lỗ / nếp rèm / khung cửa phòng chờ) lớn, gần máy quay, có cùng hình ở hai đầu; thêm
  lớp phủ "giấy gấp" bám máy quay 0,35 s (giảm chuyển động: mờ 0,2 s). Lỗ cửa vẽ **trời của khu đích** theo hướng nhìn (cùng
  hàm trời) → điều thấy qua lỗ chính là điều thấy sau khi bước qua.
- Khoá: cửa có `lock` → bị đẩy lùi + lời nhắc; đích chưa sẵn sàng (tài sản đang tải) → giữ ở ngưỡng + "đang tải…".
- Rơi khỏi khu (y < killY): kéo về điểm đứng an toàn gần nhất + lớp phủ gấp giấy.

## 3. Streaming

- Chỉ khu hiện tại **chạy đầy đủ** (useFrame của khu khác trả về sớm, nhóm ẩn). Mê cung hub ẩn bằng `visible` khi ở khu khác.
- Gắn trước (prefetch) khu đích khi cửa **nằm trong tầm nhìn** (≤ 70 m, trong nón nhìn) — tải atlas/texture, `gl.compile`
  shader khi đã sẵn → qua cửa không khựng. Giữ cache ≤ 2 khu không hiện (LRU) để chạy qua lại không gắn lại.
- Khu xa = **bóng cắt giấy** trên chân trời (1 lệnh vẽ instancing, cùng atlas): ở Biển Phím thấy máy phát số + tháp quan sát.
- Hàm thuần `streamPlan` (test): khu gắn, khu tải trước, khu gỡ.

## 4. Va chạm theo khu

- Mỗi khu: mặt (hộp / đĩa có cao độ + bề dày), tường (hộp y0…y1), trụ; **lưới băm 8 m** (`buildIndex`) → truy vấn chỉ xét ô
  chứa điểm. Mặt động: phím lún (mảng `KEY_SINK`), tấm đồng lún khi đứng trên bụng sóng.
- Player nhận `ground / blocked / camClamp` bọc: hub → hàm cũ của `sirenMaze`, khu khác → chỉ mục khu.
- Không cấp phát trong truy vấn (vòng for trên mảng chỉ số).

## 5. Nhiều người chơi

- `s[9]` = id khu (chỉ gửi khi khác `hub` → server cũ vẫn nhận gói của người ở hub). Server: lọc `^[a-z][a-z0-9_-]{0,15}$`,
  thêm vào ảnh chụp ở **vị trí 11** chỉ khi có (dòng cũ giữ 11 phần tử → client cũ không đổi). Selftest mở rộng.
- Client: `PeerSnap.zone`; người khác đổi khu → xoá bộ đệm nội suy; avatar / nhãn / tương tác gần chỉ khi `sameZone`.
  Ở mỗi cửa: dấu "n bạn ở bên kia" khi có người ở khu đích.
- Boss đấu trường: đòn chỉ áp lên người ở `hub` (gác thêm `zone`).

## 6. Ba khu

### Phòng Chờ Đến Hôm Qua (`wait`)
Sảnh nhà văn hoá lát terrazzo trôi giữa trời hoàng hôn bạc hà – cam; rèm nếp gấp chạy chậm làm tường; hàng ghế gập; bảng số
gọi lượt đã qua (đếm lùi); **máy phát số lùi xa** khi người chơi lại gần (luôn giữ khoảng cách, in vé rồi cuộn về).
Luật: chuông gọi mỗi a phách, bảng dập mỗi b phách, cùng bắt đầu ở phách 0 → đứng lên ô phách dự đoán trên **dải thời gian**
(24 ô) và bấm F; con trỏ chạy theo HARMONIC (96 BPM) diễn lại → đúng thì cả chuông lẫn dấu dập cùng nổ ở ô đã đặt.
3 vòng (3, 4) → 12, (4, 6) → 12, (6, 9) → 18; xong mở **lỗ vé khổng lồ** → Sa Mạc.

### Sa Mạc Tấm Đồng (`desert`)
Tấm đồng 64 × 64 m khắc guilloche giữa hai bờ cát; **bọ gom cát** đẩy cát dọc đường nút. Cần gạt ở chân **đài quan sát** đổi
mode (m, n); cát dồn về |F| nhỏ, bụng sóng rung đỏ đồng. Đứng trên bụng sóng > 0,6 s → tấm lún, đưa về bờ gần. Đúng mode thì
hai cổng bờ sáng và có đường cát nối liền (kiểm bằng BFS trên lưới — test chọn bộ mode có **đúng một** đáp án).
Bờ xa: **sân phù thuỷ Gối Xếp Im** (gắn `siren/witches/GoiXepIm.tsx` nếu có, không thì dấu chờ) + cửa đồng về đáy hub.

### Biển Phím Không Bờ (`keys`)
Bàn phím sứ khổng lồ 3 quãng tám nổi trên biển giấy than gợn sóng; đồi phím sứ xa lặp theo chu kỳ 12; men phím theo **lớp cao
độ** (12 màu, lặp mỗi quãng). Bước lên phím kêu nốt 220·2^(k/12) Hz. **Cua Kẹp Quãng** kẹp một phím; người chơi đứng lên
phím cùng tên ở quãng kế và bấm F; bảng đo hiện f₁, f₂, f₂/f₁ (= 2 khi đúng). 3 vòng → hạ **đê sứ** mở lối tới cửa Phòng Chờ.

Mỗi khu: mốc nhìn được từ xa, nhãn song ngữ (`lib/world/i18n.ts`), âm nền khoá nhịp HARMONIC bằng `sirenSynth`, la bàn
cửa + bản đồ đồ thị khu (DOM, gọn cho điện thoại), giảm chuyển động tắt lắc / chớp.

## 7. Ngân sách (Iris Xe + điện thoại; CPU nghẽn)

- ≤ ~20 lệnh vẽ nội dung mỗi khu ở mức vừa: mọi hình cắt giấy của một khu = **1 InstancedMesh** (atlas chung, alpha-test);
  sàn / biển / tấm đồng 1 lệnh mỗi cái; trời 1; bóng xa 1; lỗ cửa 1 / cửa.
- 0 cấp phát mỗi khung; mọi chuyển động đọc HARMONIC; lò xo `springStep`; ma trận instance chỉ ghi khi đổi.
- Đo `window.__perf(ms)` (fps, cpuMs, gpuMs, calls, tris) ở từng khu.

## 8. Kiểm thử

- `tests/world/zoneGraph.test.ts`: đồ thị liên thông + hai chiều; mỗi cửa có điểm đặt chân trên mặt đất của khu đích, không
  vướng tường / lỗ cổng / lỗ sâu; biến đổi cửa (liên tục vị trí, giữ độ lớn vận tốc, Δ = 0 cho mọi cặp, Δ ≠ 0 đúng); `zoneAtWorld`;
  `streamPlan`; lọc người chơi theo khu + đếm ở cửa; chỉ mục va chạm khớp quét tuyến tính (ngẫu nhiên 5k điểm).
- `tests/world/sirenZones.test.ts`: BCNN / lịch dải thời gian; quãng tám (lớp cao độ, tần số ×2); Chladni (đúng một mode nối
  hai bờ, cát an toàn / bụng nguy hiểm khớp `chladni`), bố cục từng khu đi được từ cửa đến câu đố, đến cửa kế.
- `realtime/selftest.mjs`: id khu đi qua ảnh chụp ở vị trí 11, id bậy bị lọc, người ở hub giữ dòng 11 phần tử.

## 9. Rủi ro

- Turbopack và import có điều kiện file phù thuỷ (chưa chắc tồn tại) → dùng `import()` biểu thức + bắt lỗi; nếu bundler từ chối
  thì giữ dấu chờ và ghi rõ cách gắn tay.
- useFrame của mê cung hub vẫn chạy khi ẩn → đo cpuMs ở khu; nếu nặng, gỡ hẳn các nhóm thuần hình khi rời hub.
- Người chơi bay lượn qua đê / tấm đồng → tắt bay lượn ở khu mới (giữ ở hub).

## 10. Tiến độ (28/11 — chưa commit)

**Đã xong**
- Lib thuần + test: `lib/world/zoneGraph.ts` (khu, cửa, biến đổi cửa, `zoneAtWorld`, chỉ mục va chạm lưới băm, `streamPlan`,
  đếm người ở cửa), `lib/world/zoneId.ts` (id khu trên dây), `lib/world/zones/{types,waitHall,keySea,bronzeDesert,cutAtlas}.ts`.
  `tests/world/zoneGraph.test.ts` (9) + `tests/world/sirenZones.test.ts` (7): đều qua (BFS đi bộ thật: đê / BCNN / đúng một mode).
- Mạng: `net.ts` gửi `s[9]` = khu (chỉ khi ≠ hub), nhận vị trí 11, xoá bộ đệm nội suy khi đổi khu; `RemotePlayers` ẩn người khác
  khu; `realtime/server.mjs` lọc id + ảnh chụp tương thích ngược; `realtime/selftest.mjs` thêm 4 kiểm tra — ALL PASS.
- Cảnh: `components/world/scene/siren/zones/*` (SirenZones: driver cửa / rơi / streaming / sương; HubOnly; DoorSet; trời thủ tục;
  màn che vành vé / rèm / cửa đồng; ZoneHud bản đồ đồ thị + la bàn + tên khu + lời nhắc; ZoneWait / ZoneKeys / ZoneDesert).
  Siren.tsx: bọc hình hub trong `HubOnly`, Player dùng `worldGround / worldBlocked / worldCamFloor`, đòn boss + máy quay boss +
  thanh boss chỉ ở hub, `zoneNearby`. SirenPortals.tsx: không bay lượn / không quấn biên ngoài hub (3 dòng).
- Art Codex: 16 ảnh (`blender-src/siren-src/zones/`, BRIEF.md) → `scripts/siren-zones.py` → `public/world/siren/zones_cut.webp`
  (atlas 11 hình cắt + bóng), `terrazzo/bronze/sand/carbon/porcelain.webp`.
- Trình duyệt (dev, máy đang tải nặng): vòng hub → Biển Phím → Phòng Chờ → Sa Mạc → đáy hub chạy đúng; câu đố quãng tám (đê hạ),
  BCNN (vé mở), cần gạt mode + bị hất về bờ khi đứng trên bụng sóng; phù thuỷ Gối Xếp Im tự gắn ở bờ Đông (tải lười + ErrorBoundary).
  Một số đo: Biển Phím 57 lệnh vẽ toàn khung / 128k tam giác / GPU 5,8 ms / cpu 13 ms (fps 46, máy tải nặng). Ảnh: `shots/phase2/`.

**Còn lại**
- Đo `__perf` đủ bốn khu cùng góc + so hub (phiên bị dừng sớm); đo trên Iris Xe / điện thoại thật.
- Thử nhiều người chơi thật (hai client qua cửa lệch thời điểm, kết nối lại giữa chừng).
- Thẩm mỹ: đồi phím / khối đồng còn là hộp; cồn cát bán cầu; tháp quan sát vừa dời ra sau sàn — cần xem lại ảnh.
- Trạng thái câu đố (đê, vé) chỉ cục bộ mỗi máy (chưa đồng bộ server); mất khi rời cảnh.
- La bàn đè nhau khi cửa và mốc cùng hướng (đã tách 2 hàng — chưa chụp lại).

## 11. Giai đoạn 2b (28/11 chiều — chưa commit)

**1. Sửa các lỗi đã biết**
- (a) Hub chạy ngầm khi ở khu khác: tách `Siren.tsx` thành `HubOnly` (phần phải GIỮ gắn: trạng thái câu đố hub, quái, trọng lực,
  cổng, thân boss, kết giới — ẩn + mọi `useFrame` của chúng trả về sớm bằng `offHub()` trong `zoneRuntime.ts`) và `HubVisual`
  (phần THUẦN HÌNH: trời, đĩa than, thác ký hiệu, rối giấy, cầu khuông, sàn đấu trường, FX boss, nhãn… — rời hub > 4 s thì gỡ hẳn;
  quay về gắn lại ngay). Đo ở Biển Phím: số `useFrame` 82 → 65; vật thể trong cảnh của hub không còn; la bàn khu bỏ đọc
  `clientWidth` sau khi ghi style (ép dựng bố cục mỗi dấu) + chỉ ghi khi đổi: 0,58 → ~0,1 ms/khung. Cổng hub cũ: bỏ 4 cấp phát
  mỗi khung (`usePortalDriver`).
- (b) Gối Xếp Im: vách vải 12 m có va chạm — tường `gxiWall` (lib `WITCH_WALL`, cờ mới `need`: chỉ chặn khi vách dựng; GoiXepIm
  báo qua `onWall`, vách dựng lên trùng chỗ đứng → đẩy ra trước vách). HUD chỉ hiện khi tới gần (≤ WAKE_R + 3 m) hoặc đã giao
  chiến (`gxiHudOn`). Trình duyệt: giữ W chạy vào vách → dừng ở 0,65 m (0,3 + bán kính thân 0,35).
- (c) "Cú nhảy xa" qua cửa đồ thị khu mà `usePortalDriver` thấy ở khung sau (đoạn prev → cur dài ~2000 m: vận tốc ảo ~10⁵ m/s cho
  trọng lực kỳ dị, có thể cắt nhầm lỗ cổng / lỗ sâu): hàm thuần `zoneJump` (khác khu hoặc dời > 25 m) → chỉ đồng bộ lại. Test:
  mọi cửa, cả hai chiều; bước thường không bị nhận nhầm.
- (d) Ảnh `shots/phase2b/`: tên khu có dấu (02), la bàn 2 hàng (01, 04, 05), terrazzo + cột (06), men phím theo lớp cao độ (03 trước
  / 07 sau), vân đồng + đài quan sát + vành lỗ vé tròn (04, 05).

**2. Thẩm mỹ — hình dựng tay (Blender, `blender-src/siren-src/zone_kit_build.py` → `zone_kit.blend` → `public/world/siren/zone_kit.glb`
142 KB, chỉ hình; vật liệu do khu đặt; `zoneHooks.useKit` / `bakeParts`)**
- Biển Phím: phím trắng có mũi bo + rãnh khắc, phím đen thân vát thon; bến / đê = phím phóng to; **đồi phím** thành phím-đồi có mặt
  trên lõm dâng lên đỉnh sóng, quay lưng ra biển (416 cái, ~108 tam giác/cái). Trời: tinh vân fbm, **rèm cực quang sóng dừng**
  (8 bụng quanh chân trời, nút luôn tối, sáng theo phách), **trần phím úp ngược** rất cao (vênh tỉ lệ).
- Sa Mạc: cồn cát **lưỡi liềm (barchan)** có sống sắc + sườn trượt (lưới bám đường đỉnh ~570 tam giác/cồn); lan can đồng có cột,
  núm cầu, vòng guilloche; bậc có mũi; sàn đài tròn; cần gạt = đế máy đếm nhịp + cần có quả nặng — gộp thành 1 hình tĩnh + 1 cần.
- Phòng Chờ: cột terrazzo có bệ, thân phình, đầu cột loe.
- Chưa làm: lớp bóng xa nhiều tầng / collage chuyển động 12-8-4 Hz cho từng khu; sheet cắt dán Codex mới.

**3. Đồng bộ câu đố qua server (co-op)** — tin `zf` (phòng "siren"): `{dike, ticket}` chốt 0/1 (đã mở thì giữ), `desert` = mode 0…15;
≤ 8 khoá, ≤ 4 tin/giây; server gửi cờ hiện tại cho người vào sau; client gửi lại cờ của mình sau mỗi lần vào phòng (desert chỉ
khi chính mình đã gạt). Luật gộp `zfMerge` (lib/world/zoneId.ts) = bản trong `realtime/server.mjs`. Server cũ bỏ qua → cục bộ
như trước. **Đã sửa `realtime/server.mjs` + `selftest.mjs` → cần deploy lại server realtime.** Chưa thử hai trình duyệt thật.

**4. Phù thuỷ #4 Khoảng Trừ (giao thoa, trừu tượng)** — `lib/world/witchKhoangTru.ts` + `tests/world/witchKhoangTru.test.ts` (7 test:
R = √(A₁²+A₂²+2A₁A₂cos φ) khớp đỉnh thật; vùng hiểm VẼ (`KTR_DANGER_EXPR`, GLSL-cũng-là-JS) == LUẬT ở 57k điểm; R = 0 → cả dải an
toàn, R = ½ vẫn còn hiểm; dập 1 lần / chu kỳ ở phách 6, báo trước 5 phách, núm khoá lúc chốt; 3 vòng: đảo pha → tăng biên độ
(đã đảo mà nửa biên độ vẫn còn sóng) → dự đoán (che dải tổng); trúng / tha đúng chỗ; tất định; rời lâu → ngủ lại).
Hình `components/world/scene/siren/witches/KhoangTru.tsx`: 3 lệnh vẽ (3 dải giấy khắc uốn bằng cùng biểu thức, sàn báo đòn,
sứ giả Nêm Biên Độ / Vạch Đảo Pha), vân in lật 10 Hz, HUD riêng (2 sóng thành phần + tổng, công thức, "? ? ?" khi dự đoán),
núm = phím F ở hai đầu dải. Gắn ở góc Đông Bắc **Phòng Chờ** (tầng "Bản nháp": căn phòng in bản sao để xoá bản trước).
Thắng → Ghi chép mới `cancel` (Giao thoa triệt tiêu) + rơi đồ. Ảnh 08–11. Dev: `window.__ktr.turn("amp"|"phase")`, `__ktr.tp(lx, lz)`.

**Đo `__perf` (Iris Xe thật, DPR 1,25, 1536 × 703, bản dev; máy đang chạy song song agent khác → nhiễu ±30 %)**

| Khu | Trước (đầu phiên) | Sau |
|---|---|---|
| Hub | 32 fps · cpu 17,4 ms · gpu 6,7 · 109 lệnh · 156k tam giác | 32 fps · cpu 16–21 · gpu 6,7 · 109 · 156k (không đổi) |
| Biển Phím | 41–47 fps · cpu 15–16,5 · gpu 6,8 · 59 · 128k · 82 useFrame | 42–58 fps · cpu 10,7–16 · gpu 6,5 · 58 · 178k · 65 useFrame |
| Phòng Chờ | — | 54–60 fps · cpu 7–12 · gpu 5,4–5,9 · 58 (61 khi Khoảng Trừ thức) · 121k |
| Sa Mạc | — | 48–54 fps · cpu 11–14 · gpu 5,5–6,7 · 59–60 · 202k |

Lệnh vẽ nội dung khu (≤ 20) giữ nguyên: Sa Mạc gộp đồ đồng thành 1 hình; Khoảng Trừ +3.
Khung dài nhất lúc dịch chuyển giữa khu (dev): 90–550 ms ở cả hai chiều, có / không gắn lại hub — chủ yếu do gắn khu đích + tải
texture, không riêng việc gỡ hub; cần đo lại bản production.

**Còn lại**
- Thẩm mỹ: bóng xa nhiều tầng + collage chuyển động theo khu, sheet Codex cho Khoảng Trừ (hiện dải / sứ giả vẽ thủ tục), ghế /
  máy phát số 3D cho Phòng Chờ; xem lại ở điện thoại dọc / ngang.
- Đo production + điện thoại thật; thử co-op hai client (cờ `zf`, người vào sau, kết nối lại).
- `tests/world/assetBase.test.ts` đang đỏ (do commit d2d0927 “mọi asset /world qua CDN” — test cũ chưa cập nhật; giai đoạn này không đụng `avatars.ts`), `ktx2.test.ts` như cũ.
- Khu kế tiếp theo BRAINSTORM (Đại Sảnh Treo Ngược / Đô Thị Nếp Khuông) và phù thuỷ Thoi Lệch Phách (phách) — chưa bắt đầu.
