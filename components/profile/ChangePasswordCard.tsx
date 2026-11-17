"use client";

import { useState } from "react";
import { changePassword } from "@/actions/user";
import { Eye, EyeOff, KeyRound, Loader2, Lock } from "lucide-react";

interface ChangePasswordCardProps {
  /** false với tài khoản đăng nhập bằng Google/Facebook chưa từng đặt mật khẩu */
  hasPassword: boolean;
}

export default function ChangePasswordCard({ hasPassword: initialHasPassword }: ChangePasswordCardProps) {
  const [hasPassword, setHasPassword] = useState(initialHasPassword);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    if (newPassword !== confirmPassword) {
      setStatusMsg({ type: "error", text: "Mật khẩu xác nhận không khớp" });
      return;
    }

    setIsLoading(true);
    try {
      const res = await changePassword(currentPassword, newPassword);
      if (res.success) {
        setStatusMsg({ type: "success", text: hasPassword ? "Đã đổi mật khẩu thành công!" : "Đã tạo mật khẩu thành công!" });
        setHasPassword(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setStatusMsg({ type: "error", text: res.error || "Không thể đổi mật khẩu" });
      }
    } catch {
      setStatusMsg({ type: "error", text: "Lỗi kết nối, vui lòng thử lại" });
    } finally {
      setIsLoading(false);
    }
  };

  const inputType = showPasswords ? "text" : "password";
  const inputClass =
    "w-full px-5 py-4 bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-100 rounded-2xl text-sm font-bold text-slate-900 tracking-tight transition-all focus:outline-none";
  const labelClass = "text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5";

  return (
    <form
      onSubmit={handleSubmit}
      className="card-surface bg-white rounded-[2.5rem] p-8 sm:p-10 space-y-6 shadow-md border border-slate-100/60 mt-6"
    >
      <div className="space-y-2 border-b border-blue-50 pb-6">
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <KeyRound className="w-6 h-6 text-[#2563EB]" />
          {hasPassword ? "Đổi mật khẩu" : "Tạo mật khẩu"}
        </h2>
        <p className="text-xs font-bold text-slate-400">
          {hasPassword
            ? "Nhập mật khẩu hiện tại và mật khẩu mới. Nếu bạn vừa được giáo viên cấp mật khẩu tạm, hãy đổi ngay tại đây."
            : "Tài khoản của bạn đang đăng nhập bằng Google/Facebook. Tạo mật khẩu để có thể đăng nhập bằng email."}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {hasPassword && (
          <div className="space-y-2">
            <label htmlFor="currentPassword" className={labelClass}>
              <Lock className="w-3.5 h-3.5 text-[#2563EB]" />
              Mật khẩu hiện tại
            </label>
            <input
              id="currentPassword"
              type={inputType}
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputClass}
            />
          </div>
        )}
        <div className="space-y-2">
          <label htmlFor="newPassword" className={labelClass}>
            <Lock className="w-3.5 h-3.5 text-[#2563EB]" />
            Mật khẩu mới
          </label>
          <input
            id="newPassword"
            type={inputType}
            autoComplete="new-password"
            required
            minLength={6}
            maxLength={72}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={inputClass}
            placeholder="Ít nhất 6 ký tự"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="confirmPassword" className={labelClass}>
            <Lock className="w-3.5 h-3.5 text-[#2563EB]" />
            Xác nhận mật khẩu mới
          </label>
          <input
            id="confirmPassword"
            type={inputType}
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {statusMsg && (
        <div
          className={`p-4 rounded-2xl text-xs font-black uppercase tracking-wider text-center border ${
            statusMsg.type === "success"
              ? "bg-emerald-50 border-emerald-100 text-emerald-600"
              : "bg-red-50 border-red-100 text-red-600"
          }`}
        >
          {statusMsg.text}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => setShowPasswords((v) => !v)}
          className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#2563EB] transition-colors"
        >
          {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {showPasswords ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        </button>

        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-[#2563EB] text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-lg active:scale-95 disabled:opacity-75 disabled:pointer-events-none"
        >
          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
          {hasPassword ? "Đổi mật khẩu" : "Tạo mật khẩu"}
        </button>
      </div>
    </form>
  );
}
