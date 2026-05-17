import { auth } from "@/auth";
import { Dashboard } from "@/components/home/dashboard/Dashboard";
import { getDashboardData } from "@/actions/course";

export default async function Home() {
  const session = await auth();
  const { courses, lastLesson, stats } = await getDashboardData();

  return (
    <Dashboard 
      user={session?.user || null} 
      courses={courses} 
      lastLesson={lastLesson}
      stats={stats}
    />
  );
}
