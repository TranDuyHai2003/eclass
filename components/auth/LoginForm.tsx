"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { login } from "@/actions/login"
import Link from "next/link"

export default function LoginForm() {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)

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
    } catch (error) {
      toast.error("Đã có lỗi xảy ra")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="mt-8 space-y-6">
      <form action={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
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
            autoComplete="current-password"
            required
            className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-orange-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:from-blue-500 hover:to-orange-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {isPending ? "Đang xử lý..." : "Đăng nhập bằng Email"}
        </button>
      </form>
    </div>
  )
}
