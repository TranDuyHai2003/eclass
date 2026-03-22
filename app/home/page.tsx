import { LandingPage } from "@/components/home/landing/LandingPage";
import { getCourses } from "@/actions/course";

export default async function HomePage() {
  const courses = await getCourses();

  return <LandingPage courses={courses} />;
}
