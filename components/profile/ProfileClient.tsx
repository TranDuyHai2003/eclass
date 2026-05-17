"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { updateProfile } from "@/actions/user";
import { Camera, Check, User, Mail, Sparkles, Loader2, RefreshCw, Upload, X } from "lucide-react";
import { signOut } from "next-auth/react";
import axios from "axios";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface ProfileClientProps {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

export default function ProfileClient({ user }: ProfileClientProps) {
  const router = useRouter();
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
      const res = await axios.put<{ publicUrl: string }>(
        `/api/upload/proxy?fileName=avatar_${user.id}_${Date.now()}_${encodeURIComponent(file.name)}`,
        file,
        { headers: { "Content-Type": file.type } }
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

  return (
    <div className="card-surface bg-white rounded-[2.5rem] p-8 sm:p-10 space-y-8 shadow-md border border-slate-100/60">
      {/* Header */}
      <div className="space-y-2 border-b border-red-50 pb-6">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-red-50 text-red-600 text-[9px] font-black uppercase tracking-widest border border-red-100">
          <Sparkles className="w-2.5 h-2.5 animate-pulse" />
          Cá nhân
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none">
          Hồ sơ của bạn
        </h1>
        <p className="text-slate-500 font-medium uppercase text-xs tracking-widest">
          Quản lý thông tin tài khoản, ảnh đại diện và tùy chọn cá nhân hóa của bạn.
        </p>
      </div>

      {/* Profile Form Content */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        
        {/* Left Side: Interactive Avatar Editor */}
        <div className="md:col-span-4 flex flex-col items-center space-y-4">
          <div className="relative group/avatar">
            <div className="w-32 h-32 rounded-[2.5rem] overflow-hidden bg-slate-50 ring-4 ring-white shadow-xl flex items-center justify-center border border-red-100/50">
              <Avatar className="w-full h-full rounded-none">
                <AvatarImage src={image} className="object-cover" />
                <AvatarFallback className="bg-gradient-to-br from-red-600 to-orange-500 text-white text-3xl font-black rounded-none">
                  {name?.[0]?.toUpperCase() || "T"}
                </AvatarFallback>
              </Avatar>
            </div>
            
            {/* Hover overlay camera click */}
            <button
              onClick={() => setShowAvatarSelector(!showAvatarSelector)}
              className="absolute inset-0 bg-slate-900/60 rounded-[2.5rem] opacity-0 group-hover/avatar:opacity-100 transition-opacity flex flex-col items-center justify-center text-white space-y-1"
            >
              <Camera className="w-6 h-6 animate-bounce" />
              <span className="text-[9px] font-black uppercase tracking-widest">Đổi ảnh</span>
            </button>
          </div>

          <button
            onClick={() => setShowAvatarSelector(!showAvatarSelector)}
            className="px-4 py-2 bg-slate-50 border border-slate-100 hover:border-red-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-[#A01D24] transition-all flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Thay đổi ảnh đại diện
          </button>
        </div>

        {/* Right Side: Account Form */}
        <div className="md:col-span-8 space-y-6">
          {/* Avatar Selector Panel (Slide down inline) */}
          {showAvatarSelector && (
            <div className="p-5 bg-slate-50 rounded-[2rem] border border-slate-200/50 space-y-4 animate-in slide-in-from-top-4 duration-300">
              <div className="flex justify-between items-center">
                <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Thay đổi ảnh đại diện</h4>
                <button 
                  onClick={() => setShowAvatarSelector(false)}
                  className="text-[9px] font-black uppercase tracking-widest text-[#A01D24] hover:underline"
                >
                  Đóng lại
                </button>
              </div>

              {/* Upload from Device Section */}
              <div className="space-y-2">
                <label className="block w-full cursor-pointer">
                  <div className={cn(
                    "flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-200 rounded-2xl bg-white hover:border-[#A01D24] hover:bg-red-50/30 transition-all group",
                    isUploadingAvatar && "opacity-50 cursor-not-allowed"
                  )}>
                    {isUploadingAvatar ? (
                      <Loader2 className="w-4 h-4 text-[#A01D24] animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 text-slate-400 group-hover:text-[#A01D24] transition-colors" />
                    )}
                    <span className="text-xs font-bold text-slate-500 group-hover:text-[#A01D24] transition-colors">
                      {isUploadingAvatar ? "Đang tải lên..." : "Chọn ảnh từ máy tính"}
                    </span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                    disabled={isUploadingAvatar}
                  />
                </label>
              </div>
            </div>
          )}

          {/* Form Fields */}
          <div className="grid grid-cols-1 gap-5">
            {/* Full Name */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#A01D24]" />
                Họ và tên học sinh
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 focus:bg-white focus:border-red-100 rounded-2xl text-sm font-black text-slate-900 tracking-tight transition-all focus:outline-none uppercase"
                placeholder="Nhập họ và tên của bạn..."
              />
            </div>

            {/* Email (Read Only) */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                Địa chỉ Email (Không thể thay đổi)
              </label>
              <div className="w-full px-5 py-4 bg-slate-50/50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-500 tracking-tight select-none">
                {user.email}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {statusMsg && (
        <div className={`p-4 rounded-2xl text-xs font-black uppercase tracking-wider text-center border animate-in fade-in duration-300 ${statusMsg.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-red-50 border-red-100 text-[#A01D24]'}`}>
          {statusMsg.text}
        </div>
      )}

      {/* Footer / Buttons Area */}
      <div className="pt-6 border-t border-red-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-6">
        <div className="flex items-center gap-3.5 max-w-md">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center shrink-0 border border-amber-100 text-lg shadow-sm">
            💡
          </div>
          <p className="text-[9px] font-black text-slate-400 leading-relaxed uppercase tracking-wider">
            Bạn có thể tự do thay đổi tên đại diện và ảnh cá nhân. Mọi thắc mắc về cấp quyền vui lòng liên hệ giáo viên.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 shrink-0">
          {/* Save Changes Button */}
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="group relative inline-flex items-center justify-center px-8 py-4 rounded-2xl bg-[#A01D24] text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-75 disabled:pointer-events-none"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Đang lưu dữ liệu...
              </span>
            ) : (
              <>
                <span className="relative z-10 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  Lưu thay đổi
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
              </>
            )}
          </button>

          {/* Log Out Button */}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="px-6 py-4 bg-slate-950 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
          >
            Đăng xuất hệ thống
          </button>
        </div>
      </div>
    </div>
  );
}
