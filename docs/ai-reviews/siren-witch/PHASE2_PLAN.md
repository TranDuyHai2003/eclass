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
