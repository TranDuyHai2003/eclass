import { auth } from "@/auth";
import { LandingPage } from "@/components/home/landing/LandingPage";
import { Dashboard } from "@/components/home/dashboard/Dashboard";
import { getDashboardData } from "@/actions/course";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ sort?: "desc" | "asc" | "default" }> }) {
  const session = await auth();
  const params = await searchParams;
  const sortOrder = params.sort === "asc" ? "asc" : (params.sort === "desc" ? "desc" : "default");
  const { courses, lastLesson, stats } = await getDashboardData(sortOrder);

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
