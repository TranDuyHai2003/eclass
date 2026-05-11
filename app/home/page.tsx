import { LandingPage } from "@/components/home/landing/LandingPage";
import { Dashboard } from "@/components/home/dashboard/Dashboard";
import { getDashboardData } from "@/actions/course";
import { auth } from "@/auth";

export default async function HomePage() {
  const session = await auth();
  const { courses, lastLesson, stats } = await getDashboardData();

  if (!session) {
    return <LandingPage courses={courses} />;
  }

  return (
    <Dashboard 
      user={session.user} 
      courses={courses} 
      lastLesson={lastLesson}
      stats={stats}
    />
  );
}
