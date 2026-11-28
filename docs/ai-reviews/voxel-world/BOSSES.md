# Boss + sự kiện Vùng Kỳ quan (kiểu Terraria)

Ngày: 28/11/2026. Nghiên cứu: scratchpad `terraria/codex_answer.md` (boss, sự kiện, ngân sách), `valorant/codex_answer.md`
(độ rõ của báo trước). Chưa commit.

## Nguyên tắc chung
- Mọi đòn: **nguồn thấy được + vùng nguy hiểm vẽ đúng hình va chạm + hồi chiêu sạch**. Báo trước ≥ 1 s (pha 1: 1,3 s; test kiểm
  "đứng chỗ tệ nhất vẫn kịp bước ra" ở tốc độ đi bộ 4 m/s, dùng < 50 % thời gian báo trước).
- Báo trước kiểu Valorant: viền mực đặc + gạch chéo chạy theo chiều đòn (cảnh báo) → lõi sáng đặc (đang gây sát thương) → vùng đã
  qua tắt nhanh. Tất cả vẽ trên **một lưới sàn + một ShaderMaterial** (`components/world/bosses/floorCue.ts`): mỗi ô khối một tứ
  giác phẳng đặt đúng mặt trên khối (lấy mẫu `ENV.ground`, làm mới từng hàng mỗi khung → bám khối người chơi xây / phá),
  không phá địa hình.
- Logic thuần (`lib/world/*.ts`, test ở `tests/world/bosses.test.ts`), lớp vẽ chỉ đọc trạng thái + đẩy uniform / instance
  (không cấp phát mỗi khung, HUD ≤ 8 lần / s).
- Cắm vào combat có sẵn: `Enemy.ext` (mới, `combat.ts`) — `ext.boss` nhận sát thương thực (máu ở mô phỏng riêng, như
  `bossHandler` của Siren), `ext.mul` hệ số theo quy luật (âm = nuốt đòn). CombatScene bỏ qua AI của quái có `ext`.
- Nhạc: `bumpCombat` mỗi 1,5 s khi đang đánh (pha sau mạnh hơn) + `sfx.telegraph / impact / fold / fanfare`.
- Rút lui: rời đấu trường > 26–30 m quá 6 s, hoặc gục 3 lần → boss rút, vật phẩm triệu hồi **không mất** (thử lại được).

## Boss 1 — Kẻ Khảo sát Gấp (Foldback Surveyor) · `lib/world/foldbackSurveyor.ts`, `components/world/bosses/Surveyor.tsx`
- **Triệu hồi**: cầm Chìa Khảo sát, chuột phải (nút Đặt trên điện thoại) **ban đêm**, hoặc chuột phải lên **Bàn Dã chiến** bất cứ lúc
  nào. Đấu trường 24 × 24 khối quanh người chơi, lưới phấn 1 m, trục x / z, nhãn toạ độ.
- **Hình**: đoàn 12 toa gốm đi theo VẾT của toa đầu (bộ đệm vòng theo độ dài cung → toa sau đi lại đúng lộ trình chậm một nhịp).
- **Đòn**: Quét Làn (dải 3 m qua chỗ em, 8 hướng) · Gập Ngược (A → T rồi chặng 2 = ảnh đối xứng của chặng 1 qua đường gấp qua T,
  quay ngoắt 110–130°; góc T bị đi qua hai lần) · Thả Thước (2 thước song song có vạch chia, thanh 1 phủ chỗ em, khe 3 m an
  toàn; sau đó toa đầu hạ thấp 3 s = điểm yếu ×1,3). Pha 3: "tiếng vọng" — 4 toa cuối cách khoảng trống 5 m.
- **Toán = phép đối xứng trục (điều kiện thắng)**: ở 2/3 và 1/3 máu boss dựng Khiên Đối xứng (miễn nhiễm, máu không tụt qua
  ngưỡng trong một đòn), vạch ℓ và cắm cọc ở một phía. Phải đứng 0,6 s lên **ảnh** của từng cọc qua ℓ.
  - Khiên 1: ℓ song song trục (x = k / z = k), 2 cọc, có **bóng gương** của chính em (ảnh của em qua ℓ) — đưa bóng chạm cọc là
    đang đứng ở ảnh của cọc (phép đối xứng tự nghịch).
  - Khiên 2: ℓ chéo (z = x + k / z = −x + k), 3 cọc, **không có bóng** — tính bằng toạ độ (HUD hiện toạ độ cọc + của em).
  - Ghim xong → đoạn nối cọc–ảnh vuông góc ℓ hiện lên, đoàn toa gập thành vòm, toa đầu ngã (choáng 6,5 s, ×1,6).
  - Hết 32 s: hồi 6 % máu, cọc mới, bật bóng + hiện quy tắc, vd. "(x; z) → (z − 2; x + 2)". Đứng nhầm lên cọc → nhắc.
- **Phần thưởng**: Mảnh Gương Gấp ×4–6 + Thấu kính Khảo sát (đồ rơi khối, nam châm hút); ghi tiến trình (mở Đêm Đèn lồng).
- Hệ số: giáp ×0,35 · hồi chiêu sau Quét / Gập ×1 · toa đầu hạ ×1,3 · choáng ×1,6. Máu 1500 (một người).

## Boss 2 — Sổ Mưa (Rain Ledger) · `lib/world/rainLedger.ts`, `components/world/bosses/RainLedger.tsx`
**Vì sao chọn**: khác Kẻ Khảo sát nhất ở cả ba mặt — mảng toán (xác suất / kỳ vọng thay vì hình học), dạng đe doạ (mưa rơi
theo làn thay vì đoàn toa chạy trên sàn) và quyết định của người chơi (chọn chỗ đứng TRƯỚC khi biết kết quả). Đấu trường làn
thẳng cũng hợp địa hình voxel và rẻ khi vẽ (mưa = 96 vệt instanced). Fold Choir (tỉ lệ diện tích ¼) vẫn là hình học, nên để sau.
- **Triệu hồi**: Thẻ Rút (chế ở Máy Ép), chuột phải ngoài trời. Bến 4 làn (4 m × 22 m) dọc theo hướng nhìn, làn A bên trái.
- **Cơ chế**: túi hạt (vd. 1, 1, 2, 4 → p = w / Σw), rút có hoàn lại → mưa ở làn bị rút (lộ làn 1,2 s trước khi mưa).
  **Lúc chốt**, làn em đứng là CƯỢC; làn cược không bị rút → Sổ cộng điểm. Trống bị niêm (×0,12) tới khi Sổ đầy → Xả lũ (sóng chạy
  dọc 2 làn có mũi tên) → trống hạ xuống 7 s (×1,8).
- **Toán**: pha 1 mọi làn 1 điểm → chọn p nhỏ nhất (P(an toàn) = 1 − p). Pha 2 (≤ 50 % máu): rút 2 lần, mỗi làn một mức điểm v,
  **E = v·(1 − p)²**. Cùng túi (4, 2, 1, 1) / (4, 2, 1, 1): rút 1 lần thì làn A (E = 2) tốt nhất, rút 2 lần thì làn B — test
  khẳng định. HUD: p từng làn, điểm, nhật ký tần suất quan sát vs kỳ vọng, phản hồi "E(C) = 0,75 · tốt nhất A = 0,88".
- **Phần thưởng**: Hổ phách May rủi ×4–6, Ấn Đài Quan sát (lần đầu chắc chắn, sau đó 35 %).

## Sự kiện — Đêm Đèn lồng · `lib/world/lanternNight.ts`, `components/world/bosses/LanternNight.tsx`
- **Kích hoạt**: đêm (`DAY.night ≥ 0,5`) + đã hạ Kẻ Khảo sát ≥ 1 lần + đêm nay chưa có (khoá "ngày của buổi tối", trước 12 h
  tính đêm hôm trước) + không đang đánh boss + không ở trong hang. Kiểm 2 s / lần.
- 40 đèn lồng bay lên (một draw, chuyển động trong vertex shader, lắc theo chu kỳ 4 s). 3 đợt Bướm Chu kỳ 4 / 6 / 8 con.
- **Toán**: bướm nhấp nhô h(t) = h₀ + A·(1 − cos 2πt/T)/2, chỉ cận chiến được khi sà thấp (h ≤ 1,9 m; tên bay ngang tầm vẫn
  trúng). Đèn của bướm sáng rực + vòng sà đậm dần khi gần đáy; chạm đáy gần em thì cắn (7). Đợt 3: đàn T = 2 s và T = 3 s → cùng
  sà mỗi **BCNN = 6 s** (HUD đếm ngược) — lúc vàng cho Q.
- **Phần thưởng**: Lụa Pha 2 / 2 / 3 + 2 khi xong. Rời xa > 40 m quá 8 s hoặc trời sáng → tan.

## Tiến trình (itemDefs / recipes — mã ổn định, chỉ thêm)
| Nguồn | Vật phẩm | Dùng ở |
|---|---|---|
| Kẻ Khảo sát | `mirror_shard`, `survey_lens` | Bàn: **Máy Ép Hoa văn** (`pattern_press` = 3 mảnh gương + 1 đồng) |
| Đêm Đèn lồng | `phase_silk` | Máy Ép: `draw_token` (2 lụa + 1 gương + 1 tinh thể), `lantern_torch` (1 lụa + 1 ván → 6 đuốc) |
| Sổ Mưa | `chance_amber`, `observatory_seal` | Máy Ép: `amber_pick` (3 hổ phách + Cuốc Tỉ lệ → cấp 3, đá ×9); ấn = bậc 4 (sắp có) |
| — | — | Máy Ép: `mirror_glass` (4 cát + 1 gương → 8 kính) |

Trạm "press" không phải khối mới: **Máy Ép trong túi + đứng ở Bàn Dã chiến** (`openCraft` tự nâng trạm; `recipeAvailable` xếp
hạng hand < bench < press). Rẻ, không đụng bảng khối / hoạ tiết / mesher.

## Ngân sách (nghiên cứu: ≤ 24 diễn viên, 64 đạn, 160 hạt, ~150 draw)
| | Diễn viên chiến đấu | Draw call thêm | Hạt / khung |
|---|---|---|---|
| Kẻ Khảo sát | 1 (toa đầu; 11 toa là hình) | ~13 (sàn 1, toa 2, đầu 5, khiên 1, cọc 2) | nổ khi ghim / chết ≤ 60 (Sparks có trần riêng) |
| Sổ Mưa | 1 (trống) | ~8 (sàn 1, mưa 1, hạt 1, trống 4, niêm 1) | 96 vệt mưa trong shader (không tính hạt CPU) |
| Đêm Đèn lồng | ≤ 8 bướm, cắt theo `waveSize` để tổng ≤ 24 (10 quái vòng + 2 song sinh có sẵn) | 5 | 16 / con chết |
Một trận / sự kiện một lúc. Không đèn động, không bóng đổ thêm.

## Bảng model Blender (chờ làm — hiện là hình tạm thủ tục)
Quy ước: mét, gốc ở đáy, trục +Z Blender → +Y three; vật liệu `toon_*` (cel 2–3 dải) / `glow_*` (phát sáng, bloom).

**Kẻ Khảo sát Gấp** (`boss/surveyor.glb`)
| Node | Kích thước (m) | Vật liệu | Hoạt hoạ |
|---|---|---|---|
| `sv_head` | 1,4 × 1,0 × 1,9 (rộng × cao × dài) | `toon_ceramic` ngà #F4EAD2, viền mực | gốc; chúi mũi 0,5 rad khi hạ thấp |
| `sv_head/roof_arch` | nửa xuyến R 0,62, ống 0,1 | `toon_plum` #2E2340 + `glow_violet` | — |
| `sv_head/lens` | đĩa Ø 0,84, dày 0,16, mặt trước | `glow_lens` (lam khi giáp → vàng khi lộ) | mống mắt co / mở (shape key `iris`) |
| `sv_head/ruler_pivot/ruler` | 0,22 × 0,06 × 6 | `toon_ruler` (ngà + vạch 0,5 m đen, có số 0–6) | xoay x (giơ / đập), co giãn trục dài 0,25–2 |
| `sv_cart` (×1, instance 11) | 1,0 × 0,72 × 1,25, bánh Ø 0,3 ×4 | `toon_ceramic`, `toon_plum` | bánh quay theo quãng đường |
| `sv_cart/arch` | nửa xuyến R 0,38 | `glow_violet` | — |
| `sv_shield` | cầu Ø 4,2 (icosphere 2) | `glow_shield` fresnel | — |
| `sv_stake` | trụ Ø 0,2 × 1,6 + cờ tam giác 0,3 | `toon_gold` + `glow_gold` | cờ phấp phới |

**Sổ Mưa** (`boss/ledger.glb`)
| Node | Kích thước (m) | Vật liệu | Hoạt hoạ |
|---|---|---|---|
| `rl_drum` | trụ Ø 2,6 × 1,4 | `toon_drum` #DFE9FF, mặt trống vẽ bảng kẻ ô (sổ) | lắc khi rút, lật trang |
| `rl_drum/rim_top`, `rim_bottom` | xuyến R 1,33, ống 0,1 | `toon_gold` | — |
| `rl_drum/spout` ×4 | ống Ø 0,25, dài 0,6 | `toon_drum` | phun khi mưa ở làn tương ứng |
| `rl_bead` | cầu Ø 0,44 | `toon_bead` (tô theo làn) | — |
| `rl_seal` | cầu Ø 4 + 4 xích + ổ khoá | `glow_seal` + `toon_iron` | xích rơi khi lộ |
| `rl_sluice` | cửa xả 4 × 1,5 × 0,3 đặt cuối bến | `toon_wood` | nâng lên khi Xả lũ |

**Bướm Chu kỳ** (`monsters/moth.glb`)
| Node | Kích thước (m) | Vật liệu | Hoạt hoạ |
|---|---|---|---|
| `mo_body` | elip 0,45 × 0,45 × 0,85 | `toon_moth` tím than | — |
| `mo_wing_L/R` | 0,95 × 0,62, gốc ở thân | `toon_wing` + vân sin `glow_wing` | vỗ ±0,7 rad, 14 rad/s |
| `mo_lantern` | cầu Ø 0,32 treo dây 0,3 | `glow_lantern` (mint T = 2, hổ phách T = 3) | sáng theo pha |

## Kiểm tra
- `tests/world/bosses.test.ts` (24 test): đối xứng tự nghịch / trung trực / ô nguyên; công thức + quy tắc toạ độ; sinh cọc hợp lệ
  + tất định; ghim chỉ ở ảnh; lộ trình theo cung; Quét Làn phủ đúng + thoát kịp; Gập Ngược = ảnh đối xứng; Thả Thước có khe; máy
  trạng thái (ngưỡng khiên, miễn nhiễm, choáng, pha 3, chết, thất bại → hồi máu + gợi ý); rút theo trọng số hội tụ; kỳ vọng đổi
  lựa chọn khi rút 2 lần; Sổ đầy → xả lũ → lộ; pha 2; khoá đêm; ngân sách 24; hàm tuần hoàn + BCNN; 3 đợt; chuỗi chế tạo.
- Trình duyệt (28/11, tab riêng, `__hour = 22`): Chìa → Kẻ Khảo sát (đoàn toa, dải báo trước gạch chéo, HUD) → khiên 1 (ℓ: z = 2,
  bóng gương) → ghim 2 ảnh → choáng, pha 2 → đánh bằng nút Tấn công (máu giảm) → khiên 2 (z = −x + 2, không bóng) → ghim → pha 3
  → hạ → rơi Mảnh Gương + Thấu kính, tiến trình lưu → Đêm Đèn lồng tự mở → bướm chỉ trúng khi sà thấp → hết đợt 1 thưởng Lụa Pha →
  Thẻ Rút → Sổ Mưa (bến, mưa, phản hồi kỳ vọng, xả lũ, lộ ×1,8) → hạ. Mô phỏng điện thoại ngang (u = 0,72, 472 px): khối HUD cao
  120 px.
- Gỡ lỗi (dev): `window.__boss.summon("surveyor" | "ledger")`, `.lantern()`, `.end()`, `__surveyor`, `__ledger`, `__lantern`.

## Nhiều người (mô hình "chủ trận")
- **Chủ trận** = người triệu hồi: chạy mô phỏng có thẩm quyền y như khi chơi một mình, thêm vị trí người khác trong trận (lấy từ ảnh
  chụp 10 Hz có sẵn của net.ts, ≤ 30 m quanh tâm): **ai cũng ghim được ảnh cọc** (mỗi người một ảnh cũng được), đòn của Kẻ Khảo sát
  **nhắm lần lượt từng người**, Sổ Mưa nhận **cược của mọi người** (Sổ cộng **trung bình** điểm các cược — một người = như cũ).
- **Server không mô phỏng boss** (`realtime/server.mjs` + `realtime/bossrelay.mjs` SINH từ `lib/world/bossRelay.ts` bằng
  `scripts/gen-realtime.mjs`): giữ CHỖ TRẬN theo phòng (≤ 4, cách nhau ≥ 80 m — triệu hồi gần trận đang có thì vào trận đó),
  chuyển tiếp:
  - `bfight {kind, cx, cz, y, seed, rot}` → kiểm (loại, số hữu hạn, đứng ≤ 24 m quanh tâm, ≤ 1 lần / 3 s) → phát `bfight {fid, host, t0}`;
  - `bstate` (chủ, ≤ 12 / s, ≤ 4 KB) → lưu (người vào sau nhận ngay) + phát kèm giờ server;
  - `bhit {k: "b" | "m0".."m7", d}` (khách, ≤ 12 / s, kẹp 150, đứng ≤ 45 m) → chỉ chủ nhận;
  - `bend` (chỉ chủ) → cả phòng; chủ rời / mất kết nối → `bhost` cho người gần tâm nhất ≤ 60 m, không ai → `bend lost`;
    chủ im lặng 30 s → huỷ. Client cũ bỏ qua các tin mới.
- **Khách** (`components/world/bosses/encounterNet.ts`): trận mở trong 60 m quanh mình → vào ngay; đi vào đấu trường (≤ 22 m) sau đó
  cũng vào. Áp gói 8 Hz (`lib/world/bossNet.ts`: mốc thời gian đổi sang đồng hồ server bằng `netClock`), vẽ giống hệt, **tự tính
  sát thương lên mình**, đòn của mình gửi cho chủ (số hiện ngay là dự đoán), tự suy sự kiện để phát âm / thông báo / **phần
  thưởng riêng** (mỗi máy rơi đồ của chính mình — không tranh nhau). Cược Sổ Mưa của khách chốt cục bộ khi chủ báo đã chốt.
- Rút lui khi nhiều người: chủ chỉ rút khi không còn ai trong đấu trường; "gục 3 lần" chỉ áp khi đánh một mình; khách đi xa thì
  chỉ mình rời (12 s không tự vào lại).
- Kiểm tra: `tests/world/bossNet.test.ts` (12 test: quy tắc server + bản .mjs cùng kết quả, đồng hồ, gói / áp 3 loại, ghim chia
  nhau, đòn lần lượt, cược trung bình, suy sự kiện); `realtime/selftest.mjs` thêm 10 ca (triệu hồi rác / xa, chủ, chuyển trạng thái,
  đòn kẹp, trận gần, người vào sau, chọn chủ mới, chỉ chủ kết thúc). Trình duyệt 2 tab (server tạm :2568 chạy mã mới, tab chuyển
  hướng WebSocket — server chung :2567 vẫn là bản cũ, cần khởi động lại): khách tự vào trận, cùng đòn / cùng mốc (±1 ms), đòn khách
  trừ máu ở chủ, **khách đứng lên ảnh còn chủ ở góc xa → khiên vỡ**, đóng tab chủ → khách thành chủ, đánh tiếp và hạ được; Sổ Mưa
  cược của khách được tính, khách có phản hồi riêng; Đêm Đèn lồng chung bướm, khách hạ cả đợt → sang đợt, khách nhận Lụa Pha.

## Còn / rủi ro
- ~~Model Blender (bảng trên)~~ — đã làm (28/11): `boss/surveyor.glb` 225 KB, `boss/ledger.glb` 432 KB, `monsters/moth.glb` 128 KB (collection BOSS_SV / BOSS_RL / MOTH, script scratchpad `boss_build.py` + `flatten_ao.py`): mỗi node MỘT lưới, màu ở màu đỉnh (albedo × AO nướng), nạp nền qua `bosses/bossGlb.ts` (hình tạm khi chưa nạp); cánh bướm cong có gân + vân cos, cánh trái = gương cánh phải. `rl_sluice` đã nối (28/11): 4 cửa / InstancedMesh đầu bến (v = HALF_LEN + 0,7), nâng 1,2 m khi Xả lũ, chìm khi trống hạ xuống lộ. Còn: khiên `sv_shield` giữ cầu fresnel (khiên phép = hiệu ứng); bánh toa chưa quay.
- Nhiều người: chủ trận có thể gian lận trạng thái (server chỉ kiểm kích thước / tốc độ) — chấp nhận được vì boss không cho xu / XP;
  nhạc / hiệu ứng ở khách trễ ~100–200 ms; tab chạy nền không chạy khung hình (chủ ở tab nền thì trận đứng — nên chuyển chủ khi
  chủ ẩn tab: chưa làm); Fast Refresh (dev) làm rơi trận đang đánh.
- Tiến trình boss lưu localStorage (theo máy, như túi đồ G4).
- Đấu trường không san phẳng — ĐÃ GIẢM (28/11): khi triệu hồi, tâm dời sang chỗ phẳng nhất trong 16 m (`lib/world/arenaSite.ts` `flattestSite`: chênh cao trong khung + phạt dời xa + phạt ngập nước; test `arenaSite.test.ts`), độ cao tham chiếu lấy tại tâm mới; không phá địa hình. Còn: vùng toàn đồi núi vẫn có thể không có chỗ đủ phẳng → cân nhắc "dọn đấu trường" (setBlock có trần).
- Bị đánh trong lúc Khiên 2 (Quét Làn 6 s / lần) — cần đo trên học sinh thật; thời gian 32 s có thể cần chỉnh.
- Survey Lens chưa có chức năng riêng (chỉ là nguyên liệu); Ấn Đài Quan sát chờ bậc 4.
- Đã sửa kèm: `rollDrops` vỡ với loại quái thiếu trong `KIND_MATS` (bể mặc định chỉ 1 phần tử).
