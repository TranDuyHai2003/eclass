import { auth } from "@/auth";
import { LandingPage } from "@/components/home/landing/LandingPage";
import { Dashboard } from "@/components/home/dashboard/Dashboard";
import { getDashboardData } from "@/actions/course";

export default async function Home() {
  const session = await auth();
  const { courses, lastLesson, stats } = await getDashboardData();

  // Route protection/conditional rendering at the entry point
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

