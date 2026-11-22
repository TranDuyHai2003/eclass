import { redirect } from "next/navigation";

/** Trình tuỳ chỉnh nhân vật đã gộp vào /profile (tab "Hồ sơ & Trang trí") — giữ đường dẫn cũ cho liên kết đã lưu */
export default function AvatarEditorPage() {
  redirect("/profile");
}
