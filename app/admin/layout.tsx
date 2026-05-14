import { HomeSidebar } from "@/components/home/HomeSidebar";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  const user = session.user;

  return (
    <div className="page-shell bg-[#F8FAFC] min-h-screen">
      <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Mobile Title - Simple Header for Context */}
        <div className="lg:hidden mb-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-red-600 rounded-xl flex items-center justify-center text-white font-black text-xs">
            {user.name?.[0]?.toUpperCase() || "A"}
          </div>
          <h1 className="font-black text-slate-900 text-lg uppercase tracking-tight">Admin Panel</h1>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          <aside className="hidden lg:block w-[280px] shrink-0 space-y-5 sticky top-24 h-fit">
            <div className="card-surface bg-white rounded-[2rem] p-6 flex flex-col items-center text-center shadow-sm border border-slate-100">
              <div className="w-20 h-20 rounded-full bg-red-100 ring-4 ring-white shadow-xl flex items-center justify-center mb-4 relative group overflow-hidden">
                {user.image ? (
                  <img
                    src={user.image}
                    alt={user.name || ""}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center text-white text-2xl font-black">
                    {user.name?.[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-black text-red-600 uppercase tracking-[0.2em]">
                  Quản trị viên
                </p>
                <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">
                  {user.name}
                </h3>
              </div>
            </div>

            <HomeSidebar />
          </aside>
          
          <main className="flex-1 w-full min-w-0">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
