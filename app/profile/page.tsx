import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { HomeSidebar } from "@/components/home/HomeSidebar";
import ProfileClient from "@/components/profile/ProfileClient";

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { user } = session;

  return (
    <div className="page-shell bg-[#EBF3FF] min-h-screen">
      <main className="container mx-auto py-8 sm:py-10 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar - PC Only */}
          <aside className="hidden lg:block w-[280px] shrink-0">
            <div className="sticky top-24 h-fit">
              <HomeSidebar user={user} />
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1">
            <ProfileClient user={{
              id: user.id || "",
              name: user.name || null,
              email: user.email || null,
              image: user.image || null,
            }} />
          </div>
        </div>
      </main>
    </div>
  );
}
