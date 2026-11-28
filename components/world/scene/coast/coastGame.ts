"use client";
/**
 * Bờ Sóng — sự kiện trò chơi: tới đảo bằng Lối Triều, bị triều cuốn, bị sóng đầm đánh, đảo pha, qua đầm, đẩy con lắc,
 * chuông kêu, xoay lăng kính, thắp hải đăng. Lời gợi ý tăng dần theo số lần thử sai. Phần thưởng: Giáo Sin (qua Đầm Giao thoa),
 * Khiên Con lắc (Chuông Cộng hưởng), Lăng kính Snell (hải đăng) + trang Thư khố.
 */
import * as THREE from "three";
import { useWorld } from "../../store";
import { sfx } from "@/lib/world/sfx";
import { floatText } from "../../ui/Labels";
import { unlockNote } from "../../story/quest";
import { impact } from "../../fx/Lensing";
import { grantWeapon, usePickups, type WeaponId } from "../../combat/items";
import { motion, playerHurt } from "../../combat/combat";
import { LENGTHS, PUSH_GAP, PUSH_J, RESONANT_L, natPeriod, pushQuality } from "@/lib/world/waves";
import { prismTarget } from "@/lib/world/coastWorld";
import { coastHint, curLength, markCoast, pend, useCoast } from "./coastState";

const V = new THREE.Vector3();
const UP = new THREE.Vector3(0, 2.1, 0);
const fmt = (n: number, d = 2) => n.toFixed(d).replace(".", ",");

function weaponGift(id: WeaponId, vi: string, en: string) {
  if (!grantWeapon(id)) return;
  usePickups.setState({ reveal: id });
  const w = useWorld.getState();
  floatText(V.copy(w.player).add(UP), w.lang === "vi" ? vi : en, "crit");
}

export function reachedIslet() {
  if (!markCoast("islet")) return;
  unlockNote("tide");
  sfx.chime(1);
  coastHint(
    "Bạn qua Lối Triều đúng lúc nước ròng! Mực nước ở đây lên xuống theo một hình sin chậm (chu kỳ 48 s) — biết pha của nó là đoán được lúc doi cát nổi lên.",
    "You crossed the Tide Path at low water! The sea level here rises and falls as a slow sine (period 48 s) — know its phase and you can predict when the sandbar appears.",
    "aha",
  );
}

export function swept() {
  const w = useWorld.getState();
  w.addShake(0.25);
  sfx.whiff();
  const n = useCoast.getState().sweeps + 1;
  useCoast.setState({ sweeps: n });
  if (n === 1)
    coastHint("Nước lên! Sóng triều cuốn bạn về bờ.", "The tide is coming in! The water carries you back to shore.", "warn");
  else if (n === 2)
    coastHint(
      "Xem thước triều ở góc màn hình (hoặc Bia Thuỷ triều): mực nước là một hình sin. Đợi lúc đường cong đang ĐI XUỐNG gần đáy rồi hãy chạy.",
      "Watch the tide gauge (or the Tide Stone): the water level is a sine. Wait until the curve is heading DOWN near its bottom, then run.",
    );
  else if (n >= 4 && n % 2 === 0)
    coastHint(
      "Gợi ý: doi cát cao −0,9 m, bạn lội được khi nước sâu dưới 0,62 m — tức mực nước dưới −0,28 m, khoảng 18 s mỗi chu kỳ 48 s. Bắt đầu chạy (giữ Shift) ngay khi thước báo \"qua được\".",
      "Hint: the sandbar is at −0.9 m and you can wade while the water is under 0.62 m deep — sea level below −0.28 m, about 18 s of every 48 s. Start running (hold Shift) as soon as the gauge says \"passable\".",
    );
}

export function lagoonSlammed(push: THREE.Vector3) {
  const w = useWorld.getState();
  playerHurt(6, V.copy(w.player).add(push));
  // đánh bạt ra xa hai nguồn (dùng bước lướt có va chạm của Player)
  motion.dashDir.copy(push).setY(0).normalize();
  motion.dashSpeed = 9;
  motion.dashUntil = performance.now() + 160;
  w.burst([w.player.x, w.player.y + 0.4, w.player.z], "#e8fbff", 18);
  sfx.impact(0.5);
  const n = useCoast.getState().slams + 1;
  useCoast.setState({ slams: n });
  const phi = useCoast.getState().phi;
  if (n === 2)
    coastHint(
      "Hai nguồn sóng chồng lên nhau: chỗ sóng to gấp đôi, chỗ lại phẳng lặng. Nhìn kỹ — những dải nước LẶNG (sáng xanh, không bọt) là đường an toàn.",
      "The two sources add up: in some places the waves are doubled, in others the water is flat. Look closely — the CALM bands (glassy teal, no foam) are safe paths.",
    );
  if (n === 4)
    coastHint(
      phi
        ? "Đường giữa hai nguồn giờ là đường nút (hai sóng ngược pha triệt tiêu). Đi thẳng theo đường giữa!"
        : "Dải lặng là nơi hai sóng tới lệch nhau nửa bước sóng (r₁ − r₂ = λ/2) — chúng có dạng hyperbol cong. Hoặc… thử gạt cần ĐẢO PHA ở bờ nam.",
      phi
        ? "The middle line between the sources is now a nodal line (the two waves cancel). Walk straight down the middle!"
        : "Calm bands are where the two waves arrive half a wavelength apart (r₁ − r₂ = λ/2) — they curve like hyperbolas. Or… try the PHASE lever on the south bank.",
    );
}

export function togglePhase() {
  const s = useCoast.getState();
  const phi = s.phi ? 0 : Math.PI;
  useCoast.setState({ phi });
  sfx.creak();
  const w = useWorld.getState();
  floatText(V.copy(w.player).add(UP), w.lang === "vi" ? (phi ? "nguồn 2 lệch nửa chu kỳ" : "hai nguồn cùng pha") : phi ? "source 2 half a cycle behind" : "sources in phase", "info");
  if (phi)
    coastHint(
      "Nguồn 2 giờ chậm nửa chu kỳ. Trên đường giữa (cách đều hai nguồn) hai con sóng tới cùng lúc nhưng một đỉnh gặp một đáy — triệt tiêu: đường giữa thành đường LẶNG.",
      "Source 2 is now half a cycle behind. On the middle line (equidistant from both) the waves arrive together, but crest meets trough — they cancel: the middle line goes CALM.",
      "aha",
    );
}

export function crossedLagoon() {
  if (!markCoast("lagoon")) return;
  unlockNote("interference");
  sfx.fanfare();
  impact(0.6);
  weaponGift("lance", "Nhận Giáo Sin! (sóng chồng chập trong tay bạn)", "Got the Sine Lance! (superposition in your hands)");
  const phi = useCoast.getState().phi;
  coastHint(
    phi
      ? "Qua đầm! Đảo pha một nguồn biến bụng sóng thành nút — chống ồn chủ động trong tai nghe cũng làm đúng như vậy. Hang Nàng Tiên Cá ở phía trước."
      : "Qua đầm theo đường nút hyperbol — nơi hiệu đường đi tới hai nguồn đúng bằng nửa bước sóng! Hang Nàng Tiên Cá ở phía trước.",
    phi
      ? "Across! Flipping one source's phase turned the antinode into a node — noise-cancelling headphones do exactly this. The Siren's Grotto lies ahead."
      : "Across, along a hyperbolic nodal line — where the path difference to the two sources is exactly half a wavelength! The Siren's Grotto lies ahead.",
    "aha",
  );
}

// ── Con lắc
export function cycleLength() {
  const s = useCoast.getState();
  const old = curLength();
  const lenIdx = (s.lenIdx + 1) % LENGTHS.length;
  const L = LENGTHS[lenIdx];
  // kéo / thả dây giữ mô-men động lượng: L²·ω không đổi
  pend.om *= (old / L) ** 2;
  useCoast.setState({ lenIdx });
  sfx.creak();
  const w = useWorld.getState();
  floatText(V.copy(w.player).add(UP), `L = ${fmt(L)} m · T = ${fmt(natPeriod(L))} s`, "info");
}

export function toggleWeight() {
  const heavy = !useCoast.getState().heavy;
  useCoast.setState({ heavy });
  sfx.knock();
  const w = useWorld.getState();
  floatText(V.copy(w.player).add(UP), w.lang === "vi" ? (heavy ? "quả neo đá 40 kg" : "quả vỏ ốc 0,3 kg") : heavy ? "40 kg anchor stone" : "0.3 kg shell bob", "info");
  if (useCoast.getState().goodPush + useCoast.getState().badPush > 2)
    coastHint(
      "Đổi quả nặng hay nhẹ — nhịp lắc vẫn y nguyên. Trọng lực kéo mạnh hơn vật nặng nhưng vật nặng cũng khó tăng tốc hơn đúng bấy nhiêu: khối lượng triệt tiêu.",
      "Heavy or light — the rhythm is exactly the same. Gravity pulls harder on a heavy bob, but it is harder to speed up by exactly as much: mass cancels.",
    );
}

export function pushPendulum(simNow: number) {
  if (simNow - pend.pushAt < PUSH_GAP) return;
  pend.pushAt = simNow;
  const L = curLength();
  const q = pushQuality(pend, L);
  pend.om += PUSH_J;
  const w = useWorld.getState();
  const vi = w.lang === "vi";
  w.act("cast", 380);
  if (q > 0.6) {
    sfx.hit(1);
    useCoast.setState({ goodPush: useCoast.getState().goodPush + 1 });
    floatText(V.copy(w.player).add(UP), vi ? "đúng nhịp!" : "in rhythm!", "crit");
  } else {
    sfx.miss();
    const n = useCoast.getState().badPush + 1;
    useCoast.setState({ badPush: n });
    floatText(V.copy(w.player).add(UP), q < 0 ? (vi ? "ngược nhịp — hãm lại" : "against the swing — it slows") : vi ? "lệch nhịp" : "off the beat", "info");
    if (n === 3)
      coastHint(
        "Đẩy xích đu thì đẩy lúc nào? Đúng lúc quả lắc vừa đi qua điểm thấp nhất và đang chạy RA XA bạn. Đẩy lúc nó lao về phía bạn là hãm nó lại.",
        "When do you push a swing? Just as it passes the lowest point moving AWAY from you. Pushing while it rushes towards you slows it down.",
      );
  }
  if (useCoast.getState().goodPush === 6 && !useCoast.getState().bell && Math.abs(L - RESONANT_L) > 0.05)
    coastHint(
      "Đẩy tay mỏi lắm. Cầu phao vốn đã lắc theo sóng lừng mỗi 3 s… nếu chu kỳ riêng của con lắc T = 2π√(L/g) cũng đúng 3 s thì sao? Thử đổi chiều dài ở tời.",
      "Pushing by hand is tiring. The pontoon already rocks with the swell every 3 s… what if the pendulum's own period T = 2π√(L/g) were 3 s too? Try another length at the winch.",
    );
}

export function bellRang(at: THREE.Vector3, byHand: boolean) {
  const w = useWorld.getState();
  w.burst([at.x, at.y, at.z], "#ffe9a8", 40);
  sfx.chime(2);
  useCoast.setState({ bellAt: performance.now() });
  if (!markCoast("bell")) return;
  impact(0.5);
  sfx.fanfare();
  unlockNote("resonance");
  weaponGift("shield", "Nhận Khiên Con lắc!", "Got the Pendulum Shield!");
  const L = curLength();
  const res = Math.abs(L - RESONANT_L) < 0.05;
  coastHint(
    res && !byHand
      ? "CHUÔNG KÊU — tự nó! Dây 2,24 m có chu kỳ riêng 2π√(2,24/9,8) ≈ 3,0 s, đúng nhịp sóng lừng. Mỗi con sóng đẩy thêm một chút đúng lúc: đó là CỘNG HƯỞNG."
      : "CHUÔNG KÊU! Những cú đẩy nhỏ đúng nhịp cộng dồn năng lượng qua từng chu kỳ. Thử tìm chiều dài dây để chính SÓNG BIỂN đẩy hộ bạn.",
    res && !byHand
      ? "THE BELL RINGS — all by itself! A 2.24 m rope has a natural period 2π√(2.24/9.8) ≈ 3.0 s, the same beat as the swell. Every wave pushes a little at the right moment: that is RESONANCE."
      : "THE BELL RINGS! Small pushes in rhythm pile up energy cycle after cycle. Now find the rope length that lets the SEA do the pushing for you.",
    "aha",
  );
}

// ── Lăng kính / hải đăng
export function rotatePrism(dir = 1) {
  const s = useCoast.getState();
  const prismStep = s.prismStep + dir;
  const hit = prismTarget(prismStep);
  useCoast.setState({ prismStep, beamHit: hit });
  sfx.click();
  if (hit === "A") {
    if (markCoast("lit")) {
      unlockNote("snell");
      sfx.fanfare();
      impact(0.7);
      weaponGift("prism", "Nhận Lăng kính Snell!", "Got the Snell Prism!");
      coastHint(
        "HẢI ĐĂNG SÁNG! Tia sáng bẻ cong hai lần (vào kính rồi ra kính), lệch về phía đáy lăng kính. Để ý: có HAI góc xoay cùng trúng tinh thể — gần góc lệch nhỏ nhất, xoay một chút tia hầu như không đổi.",
        "THE LIGHTHOUSE IS LIT! The ray bent twice (into the glass and out again), towards the prism's base. Notice: TWO different turns hit the crystal — near minimum deviation, turning a little barely moves the beam.",
        "aha",
      );
    }
  } else if (hit === "B") {
    if (markCoast("tir")) {
      sfx.chime(2);
      coastHint(
        "Tinh thể thứ hai sáng — tia sáng chạm mặt trong lăng kính quá góc tới hạn (≈ 41°) nên không ra được, phản xạ TOÀN PHẦN như gương. Cáp quang dẫn ánh sáng nhờ đúng hiện tượng này.",
        "The second crystal glows — inside the prism the ray met a face beyond the critical angle (≈ 41°) and could not get out: TOTAL internal reflection, a perfect mirror. Optical fibres guide light this way.",
        "aha",
      );
    }
  } else if (!useCoast.getState().lit && s.prismStep % 6 === 5)
    coastHint(
      "Đi thẳng thì tia không tới tinh thể. Mỗi lần ánh sáng đổi môi trường nó bẻ hướng (Snell: n₁·sin θ₁ = n₂·sin θ₂) — và luôn lệch về phía ĐÁY lăng kính. Xoay tiếp, xem tia ra quay về đâu.",
      "Straight on, the beam misses the crystal. Each time light changes medium it bends (Snell: n₁·sin θ₁ = n₂·sin θ₂) — always towards the prism's BASE. Keep turning and watch where the outgoing ray points.",
    );
}
