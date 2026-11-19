import { auth } from "@/auth";
import { Dashboard } from "@/components/home/dashboard/Dashboard";
import { getDashboardData } from "@/actions/course";
import { isPointsEnabled } from "@/lib/points/config";
import { getPointsCard } from "@/lib/points/queries";

export default async function Home() {
  const session = await auth();
  const { courses, lastLesson, stats } = await getDashboardData();
  const points =
    isPointsEnabled() && session?.user?.role === "STUDENT" && session.user.id
      ? await getPointsCard(session.user.id).catch(() => null)
      : null;

  return (
    <Dashboard 
      user={session?.user || null} 
      courses={courses} 
      lastLesson={lastLesson}
      stats={stats}
      points={points}
    />
  );
}
