import Link from "next/link"
import Image from "next/image"
import { unstable_cache } from "next/cache"
import LoginForm from "@/components/auth/LoginForm"
import { prismaBase } from "@/lib/prisma"
import { beVietnam } from "@/lib/fonts/be-vietnam";
import { isPointsEnabled } from "@/lib/points/config"
import { cn } from "@/lib/utils"

export const metadata = { title: "Đăng nhập" }

/** Số khoá / bài học cho khối thương hiệu (cùng cách đếm với trang chủ khách), cache 5 phút */
const getSiteStats = unstable_cache(
  async () => {
    const [courses, lessons] = await Promise.all([prismaBase.course.count(), prismaBase.lesson.count()])
    return { courses, lessons }
  },
  ["login-site-stats"],
  { revalidate: 300 },
)

export default async function LoginPage() {
  const stats = await getSiteStats().catch(() => null)
  const bullets = [
    { text: "Video bài giảng theo lộ trình từng chương", dot: "bg-[#A78BFA]" },
    { text: "Đề kiểm tra chấm tự động, lời giải chi tiết từng câu", dot: "bg-[#A78BFA]" },
    ...(isPointsEnabled() ? [{ text: "Học chăm tích xu, đổi quà tại lớp", dot: "bg-[#F5B82E]" }] : []),
  ]

  return (
    <div className={cn(beVietnam.variable, "flex min-h-[calc(100vh-3.5rem)] sm:min-h-[calc(100vh-4rem)] bg-white font-[family-name:var(--font-bvp)] text-[15px] text-[#1E1B2E]")}>
      {/* Form */}
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-10">
        <div className="flex w-full max-w-[400px] flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h1 className="text-[28px] font-extrabold tracking-[-0.01em] sm:text-[32px]">Chào mừng trở lại</h1>
            <p className="text-[#5F5B73]">Đăng nhập để tiếp tục khóa học và xem tiến độ của bạn.</p>
          </div>

          <LoginForm />

          <p className="text-center text-xs leading-relaxed text-[#6B6680]">
            Khi đăng nhập, bạn đồng ý với{" "}
            <Link href="#" className="font-semibold text-[#5B2BD6] hover:text-[#4319A8]">
              Điều khoản dịch vụ
            </Link>{" "}
            và{" "}
            <Link href="#" className="font-semibold text-[#5B2BD6] hover:text-[#4319A8]">
              Chính sách bảo mật
            </Link>
            .
          </p>
          <div aria-hidden className="h-px bg-[#ECE9F5]" />
          <p className="text-center text-[#3B3650]">
            Chưa có tài khoản?{" "}
            <Link href="/register" className="font-bold text-[#5B2BD6] hover:text-[#4319A8]">
              Đăng ký ngay
            </Link>
          </p>
        </div>
      </div>

      {/* Khối thương hiệu — chỉ màn rộng */}
      <div className="hidden flex-1 p-4 min-[960px]:flex" data-testid="login-brand">
        <div className="flex flex-1 flex-col justify-between gap-8 overflow-hidden rounded-[28px] bg-[#1E1745] p-10 text-white xl:p-12">
          <div className="relative aspect-[229/108] w-full overflow-hidden rounded-[20px]">
            <Image src="/landing/hero.webp" alt="Nhân vật học sinh và mèo tinh linh trong thư viện đêm sao" fill sizes="(min-width: 960px) 45vw, 1px" className="object-cover" />
          </div>
          <div className="flex flex-col gap-[18px]">
            <h2 className="text-[26px] font-extrabold leading-tight xl:text-[30px]">Học toán THPT dễ hiểu, có lộ trình</h2>
            <ul className="flex flex-col gap-3 text-[#D9D3F5]">
              {bullets.map((b) => (
                <li key={b.text} className="flex items-center gap-2.5">
                  <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", b.dot)} />
                  {b.text}
                </li>
              ))}
            </ul>
          </div>
          <dl className="flex flex-wrap gap-7 border-t border-white/14 pt-5">
            {stats && (
              <>
                <div className="flex flex-col-reverse">
                  <dt className="text-[13px] text-[#D9D3F5]">khóa học</dt>
                  <dd className="text-[26px] font-extrabold">{stats.courses}</dd>
                </div>
                <div className="flex flex-col-reverse">
                  <dt className="text-[13px] text-[#D9D3F5]">bài học</dt>
                  <dd className="text-[26px] font-extrabold">{stats.lessons}</dd>
                </div>
              </>
            )}
            <div className="flex flex-col-reverse">
              <dt className="text-[13px] text-[#D9D3F5]">Kỳ thi THPT</dt>
              <dd className="text-[26px] font-extrabold">11/06/2027</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  )
}
