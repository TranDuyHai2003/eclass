
import Link from "next/link"
import LoginForm from "@/components/auth/LoginForm"

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-10 shadow-xl border border-gray-100">
        <div className="text-center">
          <Link href="/" className="inline-block mb-4">
             <span className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600">
              E-Class
            </span>
          </Link>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
            Chào mừng trở lại
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Đăng nhập để truy cập khóa học và tiến độ của bạn
          </p>
        </div>
        
        <LoginForm />
        
        <p className="mt-8 text-center text-xs text-gray-500">
            Bằng cách đăng nhập, bạn đồng ý với{' '}
            <Link href="#" className="font-medium text-purple-600 hover:text-purple-500">
                Điều khoản dịch vụ
            </Link>{' '}
            và{' '}
             <Link href="#" className="font-medium text-purple-600 hover:text-purple-500">
                Chính sách bảo mật
            </Link>
            của chúng tôi.
        </p>

        <p className="text-center text-sm text-gray-500">
            Chưa có tài khoản?{' '}
            <Link href="/register" className="font-medium text-purple-600 hover:text-purple-500">
                Đăng ký ngay
            </Link>
        </p>
      </div>
    </div>
  )
}
