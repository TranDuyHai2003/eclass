
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
    redirect("/login");
  }

  return (
    <div className="page-shell min-h-screen">
      <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8 max-w-7xl">
        <div className="flex flex-col lg:flex-row gap-8">
          <DashboardSidebar />
          <main className="flex-1 w-full overflow-hidden">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
