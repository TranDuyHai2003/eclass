"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { register } from "@/actions/register"

export default function RegisterForm() {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)

  const handleSubmit = async (formData: FormData) => {
    setIsPending(true)
    try {
      const result = await register(formData)
      
      if (result.error) {
        toast.error(result.error)
      } else if (result.success) {
        toast.success("Đăng ký thành công! Vui lòng đăng nhập.")
        // Small delay to let user see toast
        setTimeout(() => {
            router.push("/login")
        }, 1500)
      }
    } catch (error) {
      toast.error("Đã có lỗi xảy ra")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <form action={handleSubmit} className="mt-8 space-y-6">
      <div className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Họ và tên
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-purple-500 focus:outline-none focus:ring-purple-500 sm:text-sm"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Địa chỉ Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-purple-500 focus:outline-none focus:ring-purple-500 sm:text-sm"
          />
        </div>
        
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Mật khẩu
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-purple-500 focus:outline-none focus:ring-purple-500 sm:text-sm"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:from-purple-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50"
      >
        {isPending ? "Đang xử lý..." : "Đăng ký"}
      </button>
    </form>
  )
}
