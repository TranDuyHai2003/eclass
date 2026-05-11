import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { StudentSidebar } from "@/components/layout/StudentSidebar";

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { user } = session;

  return (
    <div className="page-shell bg-[#F8FAFC] min-h-screen">
      <main className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar - PC Only */}
          <div className="hidden lg:block w-[280px] shrink-0 sticky top-24 h-fit">
            <StudentSidebar user={user} />
          </div>

          {/* Main Content */}
          <div className="flex-1">
            <div className="card-surface bg-white rounded-[2.5rem] p-8 sm:p-10 space-y-10 shadow-sm border border-slate-100">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-red-50 text-red-600 text-[9px] font-black uppercase tracking-widest border border-red-100">
                  <div className="w-1 h-1 bg-red-600 rounded-full animate-pulse" />
                  Cá nhân
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none">
                   Hồ sơ của bạn
                </h1>
                <p className="text-slate-500 font-medium uppercase text-xs tracking-widest">Quản lý thông tin tài khoản và quyền truy cập của bạn.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5 p-6 bg-slate-50 rounded-3xl border border-slate-100 group hover:bg-white hover:border-red-100 hover:shadow-xl hover:shadow-red-500/5 transition-all duration-300">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-red-600 transition-colors">
                    Họ và tên
                  </p>
                  <p className="text-lg font-black text-slate-900 uppercase tracking-tight">{user.name || "Chưa cập nhật"}</p>
                </div>
                <div className="space-y-1.5 p-6 bg-slate-50 rounded-3xl border border-slate-100 group hover:bg-white hover:border-red-100 hover:shadow-xl hover:shadow-red-500/5 transition-all duration-300">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-red-600 transition-colors">
                    Email đăng ký
                  </p>
                  <p className="text-lg font-black text-slate-900 break-all uppercase tracking-tight">{user.email}</p>
                </div>
              </div>

              <div className="pt-10 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-6">
                <div className="flex items-center gap-4 max-w-md">
                   <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center shrink-0 border border-amber-100 text-2xl shadow-sm">
                      💡
                   </div>
                   <p className="text-[10px] font-black text-slate-400 leading-relaxed uppercase tracking-wider">
                    Muốn thay đổi thông tin tài khoản hoặc cấp quyền khoá học? Vui lòng liên hệ trực tiếp với giáo viên.
                   </p>
                </div>
                
                <form
                  action={async () => {
                    "use server";
                    await signOut();
                  }}
                >
                  <button
                    type="submit"
                    className="group relative inline-flex items-center justify-center px-10 py-4 rounded-2xl bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest hover:bg-red-600 transition-all shadow-xl shadow-slate-200 overflow-hidden"
                  >
                    <span className="relative z-10">Đăng xuất hệ thống</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
