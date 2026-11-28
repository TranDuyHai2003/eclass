"use client";
/**
 * Quần đảo Xuyến — sự kiện trò chơi (rung Chuông, khiên chặn, trúng lưng Mắt Canh, tự bắn trúng lưng, đi qua mép).
 * Tách khỏi khung hình để ArcBow / Sentinel / cảnh dùng chung; mọi lời gợi ý tăng dần theo số lần thử sai.
 */
import * as THREE from "three";
import { useWorld } from "../../store";
import { sfx } from "@/lib/world/sfx";
import { floatText } from "../../ui/Labels";
import { unlockNote } from "../../story/quest";
import { impact } from "../../fx/Lensing";
import { rollDrops } from "../../combat/items";
import { SENTINEL } from "@/lib/world/torusWorld";
import { markTorus, torusHint, useTorus, warden } from "./torusState";

const V = new THREE.Vector3();
const UP = new THREE.Vector3(0, 0.6, 0);

export function crossedSeam(axis: "x" | "z") {
  if (!markTorus("crossed")) return;
  unlockNote("torus");
  sfx.chime(1);
  if (axis === "x")
    torusHint(
      "Bạn vừa đi qua MÉP ĐÔNG của ô vuông — và bước vào từ MÉP TÂY. Không có tường nào cả: thế giới này là một ô vuông dán mép.",
      "You just walked off the EAST edge of the square — and in through the WEST edge. There is no wall: this world is a square with glued edges.",
      "aha",
    );
  else
    torusHint(
      "Bạn vừa đi qua mép bắc – nam: mép trên dán vào mép dưới. Hai cặp mép dán xong, ô vuông thành một chiếc bánh vòng (xem trên trời).",
      "You just crossed the north–south edge: top is glued to bottom. Glue both pairs and the square becomes a doughnut (look up at the sky).",
      "aha",
    );
}

export function selfHit(at: THREE.Vector3) {
  const w = useWorld.getState();
  const vi = w.lang === "vi";
  floatText(V.copy(at).add(UP), vi ? "Trúng lưng mình!" : "Hit your own back!", "info");
  w.addShake(0.25);
  w.act("hurt", 420);
  w.burst([at.x, at.y, at.z], "#ffd27a", 24);
  sfx.impact(0.8);
  if (!markTorus("selfHit")) return;
  unlockNote("torusbow");
  torusHint(
    "Bạn bắn thẳng ra TRƯỚC — mũi tên ra khỏi một mép, quay vào từ mép đối diện, bay hết một vòng L = 48 m… và trúng LƯNG bạn. Trên xuyến, 'phía trước' và 'phía sau' là cùng một hướng.",
    "You shot straight AHEAD — the arrow left through one edge, came back through the opposite one, flew one lap of L = 48 m… and hit your BACK. On a torus, 'ahead' and 'behind' are the same direction.",
    "aha",
  );
}

export function ringBell(at: THREE.Vector3) {
  const w = useWorld.getState();
  w.burst([at.x, at.y, at.z], "#ffe9a8", 60);
  w.addShake(0.3);
  impact(0.5);
  if (!markTorus("bell")) {
    sfx.chime(2);
    return;
  }
  useTorus.setState({ bellAt: performance.now() });
  sfx.fanfare();
  unlockNote("torusbow");
  torusHint(
    "CHUÔNG RUNG! Mũi tên bay về phía tây, vòng qua mép và chui vào miệng hộp từ phía đông. Một cây cầu sáng vừa hiện ra trên đường khâu, nối Đảo Mép Đông–Tây với Đảo Bốn Góc.",
    "THE BELL RINGS! Your arrow flew west, wrapped round the edge and entered the box from the east. A bridge of light has appeared along the seam, from the East–West Isle to the Corner Isle.",
    "aha",
  );
}

export function boxWall(at: THREE.Vector3) {
  const w = useWorld.getState();
  w.burst([at.x, at.y, at.z], "#e9e1d3", 10);
  sfx.miss();
  const n = useTorus.getState().boxMiss + 1;
  useTorus.setState({ boxMiss: n });
  if (n === 2)
    torusHint(
      "Hộp Chuông kín ba mặt, chỉ mở về phía ĐÔNG — mà phía đông của nó là biển mây, không có chỗ đứng. Phía đông của hộp còn có thể là ở đâu?",
      "The Bell Box is closed on three sides and opens only to the EAST — where there is nothing but cloud. Where else could 'east of the box' be?",
    );
  if (n === 4)
    torusHint(
      "Gợi ý: đứng phía TÂY hộp (mép tây Đảo Neo, trên đường kẻ vàng), QUAY LƯNG lại với hộp rồi bắn về phía tây. Giữ chuột phải để xem đường bay.",
      "Hint: stand WEST of the box (west rim of the Anchor Isle, on the gold line), turn your BACK to it and shoot west. Hold right-click to see the flight path.",
    );
}

export function wardenBlocked(at: THREE.Vector3) {
  const w = useWorld.getState();
  w.burst([at.x, at.y, at.z], "#bfe6ff", 14);
  warden.blockAt = performance.now();
  sfx.shield();
  floatText(V.copy(at).add(UP), w.lang === "vi" ? "khiên chặn" : "shielded", "info");
  const n = useTorus.getState().shieldMiss + 1;
  useTorus.setState({ shieldMiss: n });
  if (n === 2)
    torusHint(
      "Mắt Canh luôn xoay khiên về phía bạn — theo đường thẳng NGẮN NHẤT. Nhưng trên xuyến, từ bạn tới nó còn những đường thẳng khác…",
      "The Warden always turns its shield towards you — along the SHORTEST straight line. But on a torus there are other straight lines from you to it…",
    );
  if (n === 4)
    torusHint(
      "Gợi ý: QUAY LƯNG lại với Mắt Canh rồi bắn đi. Mũi tên đi đường dài quanh xuyến và cắm vào LƯNG nó. Né quả cầu của nó cũng được — quả cầu bay hết một vòng rồi trúng chính nó.",
      "Hint: turn your BACK on the Warden and shoot away. The arrow takes the long way round and strikes its BACK. Dodging its orb works too — the orb laps the world and hits its owner.",
    );
}

export function wardenDamaged(at: THREE.Vector3, byOrb: boolean) {
  const w = useWorld.getState();
  const vi = w.lang === "vi";
  const hp = Math.max(0, useTorus.getState().wardenHp - 1);
  useTorus.setState({ wardenHp: hp });
  warden.hitAt = performance.now();
  w.burst([at.x, at.y, at.z], "#ff9ecb", 30);
  w.addShake(0.2);
  w.hitstop(70);
  sfx.impact(1.1);
  floatText(V.copy(at).add(UP), byOrb ? (vi ? "trúng lưng — bởi chính quả cầu của nó!" : "hit in the back — by its own orb!") : vi ? "trúng lưng!" : "back hit!", "crit");
  if (hp > 0) return;
  warden.deadAt = performance.now();
  impact(1.0);
  sfx.fanfare();
  rollDrops("warden", new THREE.Vector3(SENTINEL.x, at.y - 1.2, SENTINEL.z));
  if (!markTorus("warden")) return;
  unlockNote("torusbow");
  torusHint(
    "Mắt Canh Xuyến đã vỡ. Khiên của nó chỉ che đường ngắn nhất — còn bạn đã chọn đường vòng quanh thế giới. Bia Bốn Góc ở đây kể nốt câu chuyện.",
    "The Torus Warden shatters. Its shield only covered the shortest path — you chose the way round the world. The Corner Stone here tells the rest.",
    "aha",
  );
}
