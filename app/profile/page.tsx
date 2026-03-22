import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { user } = session;

  return (
    <div className="page-shell">
      <main className="container mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="card-surface rounded-3xl p-6 sm:p-8 space-y-8">
          <header className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center text-white text-3xl font-black">
              {user.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="text-center sm:text-left space-y-1">
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900">
                {user.name || "Hồ sơ của bạn"}
              </h1>
              <p className="text-sm text-gray-500">{user.email}</p>
              <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-red-600 bg-red-50 px-3 py-1 rounded-full mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                {user.role === "ADMIN"
                  ? "Quản trị viên"
                  : user.role === "TEACHER"
                  ? "Giáo viên"
                  : "Học viên"}
              </p>
            </div>
          </header>

          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 text-sm">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Họ và tên
              </p>
              <p className="font-medium text-gray-900">{user.name || "Chưa cập nhật"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Email
              </p>
              <p className="font-medium text-gray-900 break-all">{user.email}</p>
            </div>
          </section>

          <section className="pt-4 border-t border-border/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <p className="text-xs text-gray-500">
              Nếu bạn muốn thay đổi thông tin tài khoản hoặc cấp quyền khoá học, vui lòng liên hệ trực tiếp với giáo viên/admin.
            </p>
            <form
              action={async () => {
                "use server";
                await signOut();
              }}
            >
              <button
                type="submit"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-2xl border border-red-200 bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100 transition-colors"
              >
                Đăng xuất
              </button>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}

