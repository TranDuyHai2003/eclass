/** Đài Phép Chiếu: đặt người chơi lên vòng vàng + máy quay vào đúng điểm nhìn (khớp lib/world/anamorph.ts) */
import { ANAM } from "@/lib/world/anamorph";
import { useWorld } from "../store";

export function anamorphView() {
  const s = useWorld.getState();
  s.player.set(ANAM.x, 0, ANAM.z);
  useWorld.setState({ playerYaw: ANAM.playerYaw, camYaw: ANAM.camYaw, camPitch: ANAM.camPitch, camDist: ANAM.camDist });
}
