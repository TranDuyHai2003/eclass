import type { Rarity } from "@/lib/points/rarity";

/** Bảng màu độ hiếm theo artifact thiết kế GĐ9 (chip pastel + nền ô ảnh) */
export const RAR_STYLE: Record<Rarity, { label: string; tag: string; tile: string; dot: string }> = {
  common: { label: "Phổ thông", tag: "bg-[#DDF3E4] text-[#17603A]", tile: "bg-[#F0FAF3]", dot: "#22A05A" },
  rare: { label: "Hiếm", tag: "bg-[#DCE8FD] text-[#1D4ED8]", tile: "bg-[#EFF5FF]", dot: "#3B82F6" },
  epic: { label: "Sử thi", tag: "bg-[#EDE4FD] text-[#5B21B6]", tile: "bg-[#F6F1FF]", dot: "#8B5CF6" },
  legendary: { label: "Huyền thoại", tag: "bg-[#FCE7B8] text-[#7A4300]", tile: "bg-[#FFF7E3]", dot: "#E0A21B" },
};
