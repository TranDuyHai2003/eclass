"use client";

import { useEffect, useState } from "react";
import { 
  AlertCircle, 
  CheckCircle2, 
  Lock, 
  ArrowRight, 
  Zap, 
  BarChart3,
  Dna,
  Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from "recharts";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface CategoryStat {
  category: string;
  wrong_count: number;
  total_attempted: number;
  error_rate: number;
}

interface AnalyticsData {
  is_eligible: boolean;
  total_tests_completed: number;
  total_questions_done: number;
  weaknesses: CategoryStat[];
  strengths: CategoryStat[];
}

export function PersonalAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetch("/api/student/statistics/weaknesses")
      .then((res) => res.json())
      .then((json) => {
        if (json.status === "success") {
          setData(json.data);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await fetch("/api/student/statistics/export");
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Thong_ke_nang_luc_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Export failed", err);
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-[3rem] p-12 shadow-sm border border-slate-100 animate-pulse">
        <div className="h-8 w-48 bg-slate-100 rounded-full mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-7 h-[300px] bg-slate-50 rounded-3xl" />
          <div className="lg:col-span-5 space-y-4">
             <div className="h-20 bg-slate-50 rounded-3xl" />
             <div className="h-20 bg-slate-50 rounded-3xl" />
          </div>
        </div>
      </div>
    );
  }

  // If not eligible or no data, show locked state
  if (!data || !data.is_eligible) {
    const testsLeft = Math.max(0, 2 - (data?.total_tests_completed ?? 0));
    
    return (
      <div className="bg-white rounded-[3rem] p-8 sm:p-12 shadow-sm border border-slate-100 relative overflow-hidden group">
        <div className="absolute inset-0 bg-slate-50/50 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center text-center p-6">
           <div className="w-16 h-16 bg-white rounded-2xl shadow-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Lock className="w-8 h-8 text-slate-400" />
           </div>
           <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Radar Năng Lực Đang Khóa</h3>
           <p className="text-slate-500 text-sm font-medium max-w-md leading-relaxed">
             Hãy hoàn thành ít nhất <span className="text-red-600 font-bold">2 bài kiểm tra</span> (hoặc 20 câu hỏi) để hệ thống có đủ dữ liệu phân tích điểm mạnh, điểm yếu của bạn.
           </p>
           {testsLeft > 0 && (
             <div className="mt-6 px-6 py-2 bg-red-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest">
               Cần thêm {testsLeft} bài kiểm tra nữa
             </div>
           )}
        </div>

        <div className="opacity-20 blur-[4px] pointer-events-none grayscale">
          <div className="flex justify-between items-end mb-10">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                 <div className="w-1.5 h-6 bg-slate-300 rounded-full" />
                 <h3 className="text-2xl font-black text-slate-400 uppercase tracking-tighter">Radar Năng Lực</h3>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-7 h-[300px] bg-slate-100 rounded-3xl" />
            <div className="lg:col-span-5 space-y-4">
               <div className="h-20 bg-slate-100 rounded-3xl" />
               <div className="h-20 bg-slate-100 rounded-3xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const chartData = [...(data?.weaknesses ?? []), ...(data?.strengths ?? [])].map(s => ({
    name: s.category,
    val: Math.round(100 - s.error_rate),
    original: s
  })).sort((a, b) => a.val - b.val);

  return (
    <div className="bg-white rounded-[3rem] p-8 sm:p-12 shadow-sm border border-slate-100 space-y-10 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-red-50/30 blur-[100px] rounded-full pointer-events-none" />
      
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 relative z-10">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
                <div className="w-1.5 h-6 bg-red-600 rounded-full" />
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Radar Năng Lực</h3>
             </div>
             <Button
               variant="outline"
               size="sm"
               onClick={handleExport}
               disabled={isExporting}
               className="h-8 rounded-xl border-slate-200 text-[10px] font-black uppercase tracking-widest px-4 hover:bg-slate-50 transition-all"
             >
               <Download className={cn("w-3 h-3 mr-2", isExporting && "animate-bounce")} />
               {isExporting ? "Đang xuất..." : "Xuất báo cáo"}
             </Button>
          </div>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-widest ml-4">Khám bệnh kiến thức 30 ngày qua</p>
        </div>
        <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100">
           <Zap className="w-4 h-4 fill-current" />
           <span className="text-[10px] font-black uppercase tracking-widest">Dữ liệu tối ưu</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 relative z-10">
        {/* Chart Column */}
        <div className="lg:col-span-7 h-[400px]">
           <ResponsiveContainer width="100%" height="100%">
             <BarChart
               data={chartData}
               layout="vertical"
               margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
             >
               <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
               <XAxis type="number" hide />
               <YAxis 
                type="category" 
                dataKey="name" 
                width={120} 
                tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
               />
               <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload.original;
                    return (
                      <div className="bg-slate-900 p-4 rounded-2xl shadow-xl border border-white/10 text-white space-y-1">
                        <p className="font-black text-xs uppercase tracking-tight">{d.category}</p>
                        <div className="flex justify-between gap-8 text-[10px] opacity-70">
                           <span>Đã làm:</span>
                           <span className="font-bold">{d.total_attempted} câu</span>
                        </div>
                        <div className="flex justify-between gap-8 text-[10px] opacity-70">
                           <span>Tỷ lệ đúng:</span>
                           <span className={cn("font-bold", (100-d.error_rate) > 70 ? "text-emerald-400" : "text-red-400")}>
                              {Math.round(100 - d.error_rate)}%
                           </span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
               />
               <Bar dataKey="val" radius={[0, 8, 8, 0]} barSize={24}>
                 {chartData.map((entry, index) => (
                   <Cell key={`cell-${index}`} fill={entry.val < 50 ? '#ef4444' : '#10b981'} fillOpacity={0.8} />
                 ))}
               </Bar>
             </BarChart>
           </ResponsiveContainer>
        </div>

        {/* Diagnosis Column */}
        <div className="lg:col-span-5 space-y-6">
           <div className="space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Cảnh báo hổng kiến thức</p>
              
              {data.weaknesses.length > 0 ? (
                <div className="space-y-3">
                   {data.weaknesses.map((w, i) => (
                      <div key={w.category} className="group p-5 bg-white border border-slate-100 rounded-3xl shadow-sm hover:border-red-200 hover:shadow-lg transition-all">
                         <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center text-red-600 shrink-0 group-hover:bg-red-600 group-hover:text-white transition-colors shadow-sm">
                               {i === 0 ? <AlertCircle className="w-5 h-5" /> : <BarChart3 className="w-5 h-5" />}
                            </div>
                            <div className="flex-1 min-w-0">
                               <p className="text-sm font-black text-slate-900 uppercase tracking-tight truncate mb-1">{w.category}</p>
                               <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">
                                     Tỷ lệ sai: {Math.round(w.error_rate)}%
                                  </span>
                                  <Link 
                                    href={`/courses?query=${encodeURIComponent(w.category)}`}
                                    className="inline-flex items-center gap-1 text-[10px] font-black text-slate-400 hover:text-red-600 transition-colors"
                                  >
                                     ÔN TẬP NGAY
                                     <ArrowRight className="w-3 h-3" />
                                  </Link>
                               </div>
                            </div>
                         </div>
                      </div>
                   ))}
                </div>
              ) : (
                <div className="p-8 bg-emerald-50 rounded-[2.5rem] border border-emerald-100 flex flex-col items-center text-center space-y-4">
                   <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                   </div>
                   <div className="space-y-1">
                      <p className="font-black text-emerald-900 text-base uppercase">Vô đối!</p>
                      <p className="text-xs text-emerald-700 font-medium leading-relaxed">
                         Tuyệt vời! Hệ thống không tìm thấy điểm yếu đáng kể nào. Hãy giữ vững phong độ nhé!
                      </p>
                   </div>
                </div>
              )}
           </div>

           <div className="p-6 bg-slate-900 rounded-[2.5rem] text-white relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform">
                 <Dna className="w-16 h-16" />
              </div>
              <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Đề xuất lộ trình</p>
              <p className="text-sm font-bold leading-relaxed mb-4">
                Dựa trên dữ liệu, bạn nên dành <span className="text-red-400">15 phút/ngày</span> để làm lại các câu sai thuộc dạng <span className="text-white underline underline-offset-4">{data.weaknesses[0]?.category || "mới"}</span>.
              </p>
              <Button asChild variant="outline" className="w-full rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 text-white font-black text-xs uppercase tracking-tight h-11">
                 <Link href="/practice">Bắt đầu luyện tập</Link>
              </Button>
           </div>
        </div>
      </div>
    </div>
  );
}
