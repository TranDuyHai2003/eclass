"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Eye, EyeOff, Lock, Mail } from "lucide-react"
import { login } from "@/actions/login"

/** Ô nhập có icon, viền tím khi focus (artifact thiết kế trang Đăng nhập) */
const field =
  "flex h-[52px] items-center gap-2.5 rounded-[14px] border-[1.5px] border-[#E4E0F0] bg-white px-4 transition-[border-color,box-shadow] focus-within:border-[#5B2BD6] focus-within:shadow-[0_0_0_4px_rgba(91,43,214,0.14)]"

export default function LoginForm() {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [showPw, setShowPw] = useState(false)

  const handleSubmit = async (formData: FormData) => {
    setIsPending(true)
    try {
      const result = await login(formData)

      if (result.error) {
        toast.error(result.error)
      } else if (result.success) {
        toast.success("Đăng nhập thành công!")
        router.push("/")
        router.refresh()
      }
    } catch {
      toast.error("Đã có lỗi xảy ra")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-sm font-bold">
          Email
        </label>
        <div className={field}>
          <Mail className="h-[18px] w-[18px] shrink-0 text-[#6B6680]" aria-hidden />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="ban@email.com"
            className="min-w-0 flex-1 bg-transparent text-[#1E1B2E] outline-none placeholder:text-[#8A85A0]"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="text-sm font-bold">
          Mật khẩu
        </label>
        <div className={`${field} pr-1.5`}>
          <Lock className="h-[18px] w-[18px] shrink-0 text-[#6B6680]" aria-hidden />
          <input
            id="password"
            name="password"
            type={showPw ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="Nhập mật khẩu"
            className="min-w-0 flex-1 bg-transparent text-[#1E1B2E] outline-none placeholder:text-[#8A85A0]"
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            aria-pressed={showPw}
            aria-label={showPw ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            data-testid="toggle-password"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-[#5F5B73] hover:bg-[#F6F5FB] hover:text-[#2A1F5C] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#A78BFA]"
          >
            {showPw ? <EyeOff className="h-[18px] w-[18px]" aria-hidden /> : <Eye className="h-[18px] w-[18px]" aria-hidden />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="h-[54px] rounded-[14px] bg-[#5B2BD6] text-base font-extrabold text-white shadow-[0_10px_24px_rgba(91,43,214,0.25)] transition-colors hover:bg-[#4319A8] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#A78BFA] disabled:opacity-60"
      >
        {isPending ? "Đang đăng nhập..." : "Đăng nhập"}
      </button>
    </form>
  )
}
