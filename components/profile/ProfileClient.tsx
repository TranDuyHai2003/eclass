"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { updateProfile } from "@/actions/user";
import { Camera, Check, User, Mail, Loader2, Upload, X, Lock, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import axios from "axios";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { resizeImageFile } from "@/lib/resize-image";
import Link from "next/link";
import type { AvatarConfig } from "@/lib/game/avatar";
import { Chibi } from "@/components/avatar/Chibi";
import type { DecorStudioProps } from "./DecorStudio";

// Tải lười: thầy/admin hoặc khi tắt Xu không tải JS trang trí (review Gemini GĐ8)
const DecorStudio = dynamic(() => import("./DecorStudio"), {
  loading: () => <div className="h-[520px] animate-pulse rounded-3xl bg-white/70" aria-busy="true" />,
});

interface ProfileClientProps {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  /** Số liệu học tập (học sinh): bài đã học, điểm thưởng & cấp độ (null khi tắt Điểm thưởng) */
  stats?: {
    completedLessons: number;
    points?: number | null;
    level?: { icon: string; level: number; name: string } | null;
    /** Nhân vật chibi (học sinh, khi bật Xu) */
    avatar?: AvatarConfig | null;
  };
  /** Khối thêm ở cột phải (vd thẻ đổi mật khẩu) */
  children?: React.ReactNode;
  /** "Hồ sơ & Trang trí" (học sinh khi bật Xu); không có → chỉ hiện phần cài đặt tài khoản như cũ */
  decor?: Omit<DecorStudioProps, "user">;
}

export default function ProfileClient({ user, stats, children, decor }: ProfileClientProps) {
  const router = useRouter();
  const [tab, setTab] = useState<"decor" | "settings">(decor ? "decor" : "settings");
  // Mở thẳng tab cài đặt bằng /profile#settings (đọc trong effect để HTML server/client khớp)
  useEffect(() => {
    if (decor && window.location.hash === "#settings") setTab("settings");
  }, [decor]);
  const [name, setName] = useState(user.name || "");
  const [image, setImage] = useState(user.image || "");
  const [showAvatarSelector, setShowAvatarSelector] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setStatusMsg({ type: "error", text: "Vui lòng chọn tệp hình ảnh" });
      return;
    }

    setIsUploadingAvatar(true);
    setStatusMsg(null);

    try {
      // Thu nhỏ trước khi tải lên: ảnh điện thoại 2–5MB → ~30–60KB (512px), tải nhanh và nhẹ cho mọi trang
      const upload = await resizeImageFile(file, 512);
      const res = await axios.put<{ publicUrl: string }>(
        `/api/upload/proxy?fileName=avatar_${user.id}_${Date.now()}_${encodeURIComponent(upload.name)}`,
        upload,
        { headers: { "Content-Type": upload.type } }
      );
      
      setImage(res.data.publicUrl);
      setStatusMsg({ type: "success", text: "Đã tải ảnh lên thành công!" });
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (error) {
      console.error("[Avatar Upload Error]", error);
      setStatusMsg({ type: "error", text: "Lỗi khi tải ảnh lên" });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setStatusMsg({ type: "error", text: "Họ và tên không được để trống" });
      return;
    }

    setIsLoading(true);
    setStatusMsg(null);

    try {
      const res = await updateProfile({ name, image });
      if (res.success) {
        setStatusMsg({ type: "success", text: "Cập nhật hồ sơ thành công!" });
        router.refresh();
        setTimeout(() => setStatusMsg(null), 3000);
      } else {
        setStatusMsg({ type: "error", text: res.error || "Có lỗi xảy ra" });
      }
    } catch (err) {
      setStatusMsg({ type: "error", text: "Không thể kết nối đến máy chủ" });
    } finally {
      setIsLoading(false);
    }
  };

  const card = "bg-white rounded-3xl border-2 border-blue-100/80 shadow-[0_4px_0_0_#e3ecff]";
  const labelClass = "text-xs font-bold text-slate-600 flex items-center gap-1.5";
  const dirty = name.trim() !== (user.name || "").trim() || image !== (user.image || "");

  const pickTab = (t: "decor" | "settings") => {
    setTab(t);
    history.replaceState(null, "", t === "settings" ? "#settings" : window.location.pathname);
  };

  return (
    <div className={cn("mx-auto space-y-5", decor ? "studio max-w-[1160px]" : "max-w-[1100px]")}>
      {decor ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-[13px] text-[#6B6680]">Tài khoản / Hồ sơ</p>
          <h1 className="text-[28px] font-extrabold tracking-tight text-[#1E1B2E]">Hồ sơ của tôi</h1>
          <p className="text-[#5F5B73]">Tuỳ chỉnh nhân vật, thú cưng và danh hiệu hiển thị với bạn bè trên bảng xếp hạng.</p>
        </div>
      ) : (
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <span className="w-2 h-8 bg-blue-600 rounded-full" />
            Hồ sơ của bạn
          </h1>
          <p className="text-slate-500 font-medium text-sm">Quản lý tên hiển thị, ảnh đại diện và mật khẩu.</p>
        </div>
      )}

      {decor && (
        <div className="flex gap-7 border-b border-[#E4E0F0]" role="tablist" aria-label="Mục hồ sơ">
          {([["decor", "Hồ sơ & Trang trí"], ["settings", "Cài đặt tài khoản"]] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              data-testid={`tab-${k}`}
              onClick={() => pickTab(k)}
              className={cn("-mb-px border-b-[3px] px-1 py-3 text-[15px] transition-colors", tab === k ? "border-[#5B2BD6] font-bold text-[#5B2BD6]" : "border-transparent font-semibold text-[#5F5B73] hover:text-[#2A1F5C]")}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {decor && tab === "decor" && <DecorStudio {...decor} user={user} />}

      <div className={cn("grid grid-cols-1 lg:grid-cols-12 gap-5 items-start", tab !== "settings" && "hidden")}>
        {/* Cột trái: thẻ tóm tắt tài khoản */}
        <aside data-testid="profile-summary" className={cn(card, "lg:col-span-4 p-5 sm:p-6 flex flex-col items-center text-center")}>
          <div className="relative">
            <div className="w-28 h-28 rounded-[2rem] overflow-hidden bg-slate-50 ring-4 ring-white shadow-lg border-2 border-blue-100">
              <Avatar className="w-full h-full rounded-none">
                <AvatarImage src={image} className="object-cover" />
                <AvatarFallback className="bg-gradient-to-br from-blue-600 to-indigo-500 text-white text-4xl font-black rounded-none">
                  {name?.[0]?.toUpperCase() || "T"}
                </AvatarFallback>
              </Avatar>
            </div>
            <button
              type="button"
              onClick={() => setShowAvatarSelector(!showAvatarSelector)}
              aria-label="Đổi ảnh đại diện"
              className="absolute -bottom-1 -right-1 w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center border-4 border-white shadow-[0_3px_0_0_#1e3a8a] hover:bg-blue-500 transition-colors"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          <p className="mt-4 text-lg font-black text-slate-900 break-words max-w-full">{name || "Học sinh"}</p>
          {stats?.level && (
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-800 ring-1 ring-amber-200">
              <span aria-hidden>{stats.level.icon}</span> {stats.level.name}
            </span>
          )}
          <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500 max-w-full min-w-0">
            <Mail className="w-4 h-4 shrink-0" />
            <span className="truncate">{user.email || "Chưa có email"}</span>
          </p>

          {stats && (
            <div className={cn("mt-5 grid w-full gap-2", stats.points !== undefined && stats.points !== null ? "grid-cols-2" : "grid-cols-1")}>
              <div className="rounded-2xl bg-blue-50 px-3 py-2.5">
                <p className="text-xl font-black text-blue-700 tabular-nums">{stats.completedLessons}</p>
                <p className="text-xs font-bold text-blue-500">bài đã học</p>
              </div>
              {stats.points !== undefined && stats.points !== null && (
                <a href="/rewards" className="rounded-2xl bg-amber-50 px-3 py-2.5 hover:bg-amber-100 transition-colors">
                  <p className="text-xl font-black text-amber-700 tabular-nums">💰 {stats.points.toLocaleString("vi-VN")}</p>
                  <p className="text-xs font-bold text-amber-600">xu</p>
                </a>
              )}
            </div>
          )}

          {stats?.avatar && (
            <div data-testid="profile-chibi" className="mt-4 flex w-full items-center gap-3 rounded-2xl border-2 border-violet-100 bg-gradient-to-br from-violet-50 to-blue-50 p-3 text-left">
              <Chibi config={stats.avatar} size={64} className="shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-slate-800">Nhân vật của bạn</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => pickTab("decor")} className="btn-3d btn-3d-blue px-2.5 py-1 text-[11px]">🎨 Tuỳ chỉnh</button>
                  <Link href={`/profile/${user.id}`} className="btn-3d btn-3d-white px-2.5 py-1 text-[11px]">Xem hồ sơ</Link>
                </div>
              </div>
            </div>
          )}

          <div className="mt-5 w-full border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={async () => {
                await signOut({ redirect: false });
                window.location.href = "/login";
              }}
              className="inline-flex items-center justify-center gap-2 w-full h-10 rounded-2xl border-2 border-red-100 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Đăng xuất
            </button>
          </div>
        </aside>

        {/* Cột phải: thông tin + mật khẩu */}
        <div className="lg:col-span-8 space-y-5 min-w-0">
          <section className={cn(card, "p-5 sm:p-7 space-y-5")}>
            <div className="space-y-1.5 border-b border-blue-50 pb-4">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <User className="w-5 h-5 text-[#2563EB]" />
                Thông tin cá nhân
              </h2>
              <p className="text-sm font-medium text-slate-500">
                Bạn có thể tự đổi tên hiển thị và ảnh đại diện. Cần hỗ trợ tài khoản, hãy liên hệ giáo viên.
              </p>
            </div>

            {showAvatarSelector && (
              <div className="p-4 bg-slate-50 rounded-2xl border-2 border-slate-100 space-y-3 animate-in slide-in-from-top-4 duration-300">
                <div className="flex justify-between items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900">Thay ảnh đại diện</h4>
                  <button
                    type="button"
                    onClick={() => setShowAvatarSelector(false)}
                    className="inline-flex items-center gap-1 text-sm font-bold text-[#2563EB] hover:underline"
                  >
                    <X className="w-4 h-4" /> Đóng
                  </button>
                </div>
                <label className="block w-full cursor-pointer">
                  <div
                    className={cn(
                      "flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-200 rounded-2xl bg-white hover:border-[#2563EB] hover:bg-blue-50/30 transition-all group",
                      isUploadingAvatar && "opacity-50 cursor-not-allowed",
                    )}
                  >
                    {isUploadingAvatar ? (
                      <Loader2 className="w-4 h-4 text-[#2563EB] animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 text-slate-400 group-hover:text-[#2563EB] transition-colors" />
                    )}
                    <span className="text-sm font-bold text-slate-500 group-hover:text-[#2563EB] transition-colors">
                      {isUploadingAvatar ? "Đang tải lên..." : "Chọn ảnh từ máy"}
                    </span>
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={isUploadingAvatar} />
                </label>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="profile-name" className={labelClass}>
                  <User className="w-3.5 h-3.5 text-[#2563EB]" />
                  Họ và tên
                </label>
                <input
                  id="profile-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 focus:bg-white focus:border-blue-300 rounded-2xl text-sm font-bold text-slate-900 transition-all focus:outline-none"
                  placeholder="Nhập họ và tên của bạn..."
                />
              </div>
              <div className="space-y-2">
                <span className={labelClass}>
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  Email (không đổi được)
                </span>
                <div className="w-full px-4 py-3 bg-slate-100/70 border-2 border-slate-100 rounded-2xl text-sm font-semibold text-slate-500 truncate select-none">
                  {user.email || "Chưa cập nhật email"}
                </div>
              </div>
            </div>

            {statusMsg && (
              <div
                role="status"
                className={`p-3 rounded-2xl text-sm font-bold text-center border animate-in fade-in duration-300 ${statusMsg.type === "success" ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-red-50 border-red-100 text-red-600"}`}
              >
                {statusMsg.text}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSave}
                disabled={isLoading || !dirty}
                className={cn("btn-3d h-11 px-6 text-sm", dirty ? "btn-3d-blue" : "btn-3d-muted")}
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {isLoading ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </section>

          {children}
        </div>
      </div>
    </div>
  );
}
