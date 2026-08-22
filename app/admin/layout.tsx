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
    <div className="page-shell bg-[#EBF3FF] min-h-screen">
      <div className="flex w-full min-h-[calc(100vh-5rem)]">
        {/* Left Sidebar - Fixed 250px Width, Anchored Flush Left */}
        <aside className="hidden lg:block w-[250px] shrink-0 border-r border-slate-200/70 bg-white/70 backdrop-blur-xl p-3">
          <div className="sticky top-24 h-[calc(100vh-7rem)]">
            <HomeSidebar user={user} />
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 max-w-[1600px]">
          {/* Mobile Title - Simple Header for Context */}
          <div className="lg:hidden mb-6 flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xs">
              {user.name?.[0]?.toUpperCase() || "A"}
            </div>
            <h1 className="font-black text-slate-900 text-lg uppercase tracking-tight">Admin Panel</h1>
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}
