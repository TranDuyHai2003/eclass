import { LandingHero } from "./LandingHero";
import { SocialProof } from "./SocialProof";
import { SkillTree } from "./SkillTree";
import CourseCard from "@/components/course/CourseCard";
import Link from "next/link";

type LandingCourse = {
  id: string;
  title: string;
  thumbnail: string | null;
  user?: {
    name: string | null;
    image: string | null;
  } | null;
  chapters?: {
    lessons: { id: string }[];
  }[];
  category?: {
    name: string;
  } | null;
};

export function LandingPage({ courses }: { courses: LandingCourse[] }) {
  return (
    <div className="min-h-screen bg-[#0F172A] text-white selection:bg-red-500/30">
      {/* Hero Section with Typewriter & Glow */}
      <LandingHero />

      {/* Social Proof (Bức Tường Thành Tựu) */}
      <SocialProof />

      <main className="container mx-auto py-12 md:py-20 px-4 sm:px-8 space-y-16 md:space-y-32">
        {/* Exhibition Zone (Trưng Bày Vũ Khí) */}
        <section className="space-y-8 md:space-y-12">
          <div className="text-center space-y-3 sm:space-y-4">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-tighter">Kho Vũ Khí Tri Thức</h2>
            <p className="text-gray-400 text-sm sm:text-base max-w-xl mx-auto px-4">Chọn lộ trình của bạn và bắt đầu chinh phục những đỉnh cao mới.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} isLocked={true} />
            ))}
          </div>
          
          <div className="flex justify-center mt-12">
             <Link href="/login" className="px-8 py-4 bg-red-600 hover:bg-red-700 rounded-full font-bold text-lg transition-all shadow-[0_0_20px_rgba(220,38,38,0.4)]">
                Đăng nhập để Mở khóa tất cả
             </Link>
          </div>
        </section>

        {/* Skill Tree (Lộ Trình Zíc-Zắc) */}
        <SkillTree />
      </main>
    </div>
  );
}
