
import Link from "next/link"
import RegisterForm from "@/components/auth/RegisterForm"

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-10 shadow-xl border border-gray-100">
        <div className="text-center">
          <Link href="/" className="inline-block mb-4">
             <span className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-orange-600">
              E-Class
            </span>
          </Link>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
            Tạo tài khoản mới
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Tham gia cùng chúng tôi và bắt đầu học ngay hôm nay
          </p>
        </div>
        
        <RegisterForm />

        <p className="mt-8 text-center text-sm text-gray-500">
            Đã có tài khoản?{' '}
            <Link href="/login" className="font-medium text-red-600 hover:text-red-500">
                Đăng nhập ngay
            </Link>
        </p>
      </div>
    </div>
  )
}
