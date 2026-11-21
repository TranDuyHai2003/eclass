import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { HomeSidebar } from "@/components/home/HomeSidebar";
import { PublicProfileView } from "@/components/profile/PublicProfile";
import { getPublicProfile } from "@/lib/game/profile";
import { maskUsersForDemo } from "@/lib/demo-privacy";
import { prismaBase } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  return { title: userId === "avatar" ? "Tuỳ chỉnh nhân vật" : "Hồ sơ học sinh" };
}

/** Hồ sơ cá nhân của một học sinh (xem được khi đã đăng nhập; chỉ học sinh đã duyệt, không demo — trừ chính chủ) */
export default async function StudentProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const raw = await getPublicProfile(session.user.id, userId);
  if (!raw) notFound();
  // Người xem là tài khoản demo → che tên/ảnh như bảng xếp hạng
  const [masked] = await maskUsersForDemo([{ id: raw.id, name: raw.name, image: raw.image }], prismaBase);
  const profile = { ...raw, name: masked.name, image: masked.image };

  return (
    <div className="page-shell min-h-screen bg-[#EBF3FF]">
      <div className="flex w-full min-h-[calc(100vh-4rem)]">
        <aside className="hidden lg:block w-[250px] shrink-0 border-r border-slate-200/70 bg-white/70 backdrop-blur-xl p-3">
          <div className="sticky top-24 h-[calc(100vh-7rem)]">
            <HomeSidebar user={session.user} />
          </div>
        </aside>
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-5 sm:py-6 max-w-[1600px]">
          <PublicProfileView p={profile} />
        </main>
      </div>
    </div>
  );
}
