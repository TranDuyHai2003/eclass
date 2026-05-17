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
      <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Mobile Title - Simple Header for Context */}
        <div className="lg:hidden mb-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-red-600 rounded-xl flex items-center justify-center text-white font-black text-xs">
            {user.name?.[0]?.toUpperCase() || "A"}
          </div>
          <h1 className="font-black text-slate-900 text-lg uppercase tracking-tight">Admin Panel</h1>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          <aside className="hidden lg:block w-[280px] shrink-0">
            <div className="sticky top-24 h-fit">
              <HomeSidebar />
            </div>
          </aside>
          
          <main className="flex-1 w-full min-w-0">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
