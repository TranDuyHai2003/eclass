/**
 * Danh mục nhân vật VRM (VRoid Hub). Nguồn + điều kiện sử dụng: public/world/CREDITS.md
 * npcOnly: điều kiện của model KHÔNG cho phép cảnh bạo lực → chỉ dùng làm NPC (không vào trận thuần hoá).
 */
export interface AvatarDef {
  id: string;
  name: string;
  file: string;
  /** Màu chủ đạo cho UI chọn nhân vật */
  color: string;
  tagline: string;
  npcOnly?: boolean;
}

/** Gốc tải asset: dev dùng /world, production có thể trỏ CDN (NEXT_PUBLIC_WORLD_ASSET_BASE) */
export const WORLD_ASSET_BASE = (process.env.NEXT_PUBLIC_WORLD_ASSET_BASE || "/world").replace(/\/$/, "");
export const worldAsset = (path: string) => `${WORLD_ASSET_BASE}/${path.replace(/^\//, "")}`;

export const AVATARS: AvatarDef[] = [
  { id: "adventurer", name: "Lữ Khách", file: "avatars/adventurer.vrm", color: "#c89b6d", tagline: "Nhà thám hiểm áo choàng xanh" },
  { id: "ki", name: "Kỳ", file: "avatars/ki.vrm", color: "#d14b4b", tagline: "Pháp sư váy đỏ cổ điển" },
  { id: "savi", name: "Sa Vi", file: "avatars/savi.vrm", color: "#3b4a7a", tagline: "Hiệp sĩ lễ phục bóng đêm" },
  { id: "jitome", name: "Tử Lan", file: "avatars/jitome.vrm", color: "#b85cd6", tagline: "Pháp sư tóc tím ánh trăng" },
  { id: "sample-a", name: "An", file: "avatars/sample-a.vrm", color: "#8a5a44", tagline: "Bạn học năng động" },
  { id: "sample-b", name: "Bình", file: "avatars/sample-b.vrm", color: "#4a4a6a", tagline: "Lớp trưởng điềm tĩnh" },
  { id: "sample-c", name: "Chi", file: "avatars/sample-c.vrm", color: "#2f3b52", tagline: "Người săn sao đêm đông" },
  { id: "school-girl", name: "Mai", file: "avatars/school-girl.vrm", color: "#5a3fa0", tagline: "Nữ sinh nơ xanh" },
  { id: "cute-cat", name: "Miu", file: "avatars/cute-cat.vrm", color: "#6b4f8f", tagline: "Cô mèo hai bím" },
  { id: "fumiriya", name: "Phú", file: "avatars/fumiriya.vrm", color: "#e08a4a", tagline: "Cậu bạn gile cà vạt cam" },
  { id: "kokia", name: "Kha", file: "avatars/kokia.vrm", color: "#d8483a", tagline: "Thiếu niên tóc lửa" },
  { id: "mono", name: "Bạch", file: "avatars/mono.vrm", color: "#3a4560", tagline: "Học sinh áo gakuran tóc bạch kim" },
  { id: "hoodie", name: "Dũng", file: "avatars/hoodie.vrm", color: "#5a6f9a", tagline: "Chàng trai hoodie trắng" },
  { id: "boy02", name: "Ngân", file: "avatars/boy02.vrm", color: "#8c8fa0", tagline: "Thư sinh tóc bạc" },
  { id: "rougan", name: "Giáo sư Lão", file: "avatars/rougan.vrm", color: "#6f9a4a", tagline: "Giáo sư kính lão, vest xanh rêu" },
  { id: "tvhead", name: "Tivi", file: "avatars/tvhead.vrm", color: "#4ac8d8", tagline: "Người máy đầu tivi" },
  { id: "spacesuit", name: "Kỳ · Phi hành gia", file: "avatars/spacesuit.vrm", color: "#9ad8ff", tagline: "Đồ vũ trụ tai mèo" },
  { id: "kimono", name: "Sa Vi · Kimono", file: "avatars/kimono.vrm", color: "#6a6a78", tagline: "Kimono xám tro" },
  { id: "elf", name: "Liên", file: "avatars/elf.vrm", color: "#b8323a", tagline: "Tiểu thư elf áo đỏ" },
  { id: "virdira", name: "Diệp", file: "avatars/virdira.vrm", color: "#7fd18b", tagline: "Người giữ Bảo tàng", npcOnly: true },
  { id: "cute-girl", name: "Sương", file: "avatars/cute-girl.vrm", color: "#7ab8ff", tagline: "Hướng dẫn viên sảnh", npcOnly: true },
];

export const PLAYABLE = AVATARS.filter((a) => !a.npcOnly);
export const AVATAR_BY_ID: Record<string, AvatarDef> = Object.fromEntries(AVATARS.map((a) => [a.id, a]));
export const DEFAULT_AVATAR = "adventurer";
