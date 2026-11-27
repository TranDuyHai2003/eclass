import { notFound } from "next/navigation";
import { PreviewClient } from "@/components/world/preview/PreviewClient";

export const metadata = { title: "Math World — dev preview" };

/** DEV ONLY: chạy Thế giới Toán với dữ liệu giả lập trên trình duyệt (không DB, không đăng nhập). Production → 404. */
export const viewport = { viewportFit: "cover" as const };

export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <PreviewClient />;
}
