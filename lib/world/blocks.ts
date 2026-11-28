/**
 * Bảng khối voxel (tách khỏi voxels.ts để bộ sinh thế giới dùng được mà không vòng import).
 * Khối mới LUÔN thêm ở CUỐI: server lưu theo chỉ số (nhận id tới MAX_BLOCK_ID trong realtime/server.mjs — thêm khối thì tăng số đó).
 * Từ "glass" trở đi là khối tự nhiên do bộ sinh tạo (mỗi máy tự sinh như nhau, không gửi mạng).
 */
export const BLOCKS = [
  "air", "grass", "dirt", "stone", "sand", "snow", "crystal", "gold", "wood", "leaf",
  "glass", // fulgurite (sét nung cát)
  "blossom", // tán anh đào (biome hoàng hôn)
  "pine", // lá kim (biome pha lê)
  "plank", // ván cầu / sàn (Rừng Đồ thị)
  "ruin", // gạch tàn tích (mê cung WFC)
  "moss", // gạch rêu
  "rope", // cầu dây (cạnh ngoài cây khung)
  "intcrystal", // quặng Tinh thể Số nguyên (G4: mặt đất + vách hang, đào tay được)
  "copper", // quặng Đồng Tỉ lệ (G4: vách hang / đồi đá, cần Cuốc Trục)
  "torch", // đuốc (nguồn sáng khối)
  "bench", // Bàn Dã chiến (trạm chế tạo)
  "water", // nguồn nước (G3: dòng chảy tính tất định trong mesher, không lưu / không gửi mạng)
] as const;
export type BlockId = number; // chỉ số trong BLOCKS
export const B = Object.fromEntries(BLOCKS.map((b, i) => [b, i])) as Record<(typeof BLOCKS)[number], number>;
/** khối có va chạm (đứng lên / chặn thân / đồ rơi nằm trên): không khí, đuốc, nước thì đi xuyên */
export const isSolidBlock = (id: number) => id !== B.air && id !== B.torch && id !== B.water;
/** khối nhắm / đào được bằng tia (nước không nhắm được — như Minecraft) */
export const isTargetBlock = (id: number) => id !== B.air && id !== B.water;
