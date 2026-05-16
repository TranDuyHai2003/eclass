import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import { getStudentCourseProgress } from "@/actions/analytics";
import { BackButton } from "@/components/ui/back-button";
import { StudentProgressChart } from "./_components/StudentProgressChart";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { CheckCircle2, XCircle, Clock, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default async function StudentAnalyticsPage({
  params,
}: {
  params: Promise<{ courseId: string; studentId: string }>;
}) {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
    return redirect("/");
  }

  const { courseId, studentId } = await params;

  try {
    const data = await getStudentCourseProgress(courseId, studentId);
    
    // Prepare chart data (only completed tests)
    const chartData = data.progress
      .filter((p: any) => p.status === "COMPLETED")
      .map((p: any) => ({
        name: p.title,
        score: p.score,
      }));

    return (
      <div className="p-6 space-y-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center gap-6 bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
          <BackButton fallbackUrl={`/teacher/courses/${courseId}/analytics`} />
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
              <img 
                src={data.student.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.student.name || "Student")}`} 
                alt={data.student.name || "Student"} 
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">{data.student.name}</h1>
              <p className="text-xs font-black uppercase text-slate-400 tracking-widest mt-1">
                {data.student.email}
              </p>
            </div>
          </div>
        </div>

        {/* Chart */}
        {chartData.length > 0 && (
          <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
            <h2 className="text-sm font-black uppercase text-slate-900 tracking-tight mb-6">Phong độ học tập</h2>
            <div className="h-[300px]">
              <StudentProgressChart data={chartData} />
            </div>
          </div>
        )}

        {/* Timeline/List */}
        <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
           <div className="p-6 border-b border-slate-50 bg-slate-50/50">
             <h2 className="text-sm font-black uppercase text-slate-900 tracking-tight">Chi tiết bài làm</h2>
           </div>
           <div className="divide-y divide-slate-50">
             {data.progress.map((item: any, index: number) => (
               <div key={index} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors group">
                 <div className="flex items-start gap-4">
                   <div className={cn(
                     "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
                     item.status === "COMPLETED" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
                   )}>
                     {item.status === "COMPLETED" ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                   </div>
                   <div>
                     <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{item.title}</h3>
                     {item.completedAt ? (
                       <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1 font-medium">
                         <Clock className="w-3.5 h-3.5" />
                         Nộp bài lúc: {format(new Date(item.completedAt), "HH:mm, dd/MM/yyyy", { locale: vi })}
                       </div>
                     ) : (
                       <span className="text-[10px] font-black uppercase tracking-widest text-red-400 mt-1 block">Chưa làm</span>
                     )}
                   </div>
                 </div>
                 
                 <div className="flex items-center gap-4 sm:ml-auto">
                   <div className="text-right">
                     {item.score !== null ? (
                       <span className={cn(
                         "text-xl font-black",
                         item.score >= 8 ? "text-emerald-600" : item.score >= 5 ? "text-blue-600" : "text-orange-600"
                       )}>
                         {item.score}đ
                       </span>
                     ) : (
                       <span className="text-xl font-black text-slate-300">--</span>
                     )}
                   </div>
                   
                   {item.attemptId && item.lessonId && (
                     <Link 
                       href={`/watch/${item.lessonId}/results/${item.attemptId}`}
                       className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                     >
                       <ChevronRight className="w-5 h-5" />
                     </Link>
                   )}
                   {item.attemptId && !item.lessonId && (
                     <Link 
                       href={`/courses/${courseId}/final-test/results/${item.attemptId}`}
                       className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                     >
                       <ChevronRight className="w-5 h-5" />
                     </Link>
                   )}
                 </div>
               </div>
             ))}
           </div>
        </div>
      </div>
    );
  } catch (error) {
    return notFound();
  }
}
