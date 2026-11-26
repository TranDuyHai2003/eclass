import { redirect } from "next/navigation";

/**
 * Trang "Quà & Xu" cũ của thầy — 26/11/2026 gom hết vào khu "Quản lý tiệm" ngay trong Tiệm quà (/rewards?manage=…).
 * Giữ đường dẫn cũ (dấu trang, link trong thông báo) và chuyển thẳng sang mục tương ứng.
 */
const TAB: Record<string, string> = { requests: "requests", rewards: "rewards", grant: "grant", codes: "codes", stats: "stats" };

export default async function TeacherRewardsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const tab = TAB[(await searchParams).tab ?? ""] ?? "1";
  redirect(`/rewards?manage=${tab}`);
}
