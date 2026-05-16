import Link from "next/link";
import { Sparkles, ArrowRight, PlayCircle, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Recommendation {
  id: string;
  title: string;
  type: string;
}

interface RecommendationListProps {
  recommendations: Recommendation[];
}

export const RecommendationList = ({ recommendations }: RecommendationListProps) => {
  if (recommendations.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-indigo-50/50 to-blue-50/50 rounded-[32px] p-8 border border-blue-100/50 space-y-6 mt-10">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-black text-slate-900 uppercase tracking-tight">
            Gợi ý học tập dành riêng cho bạn
          </h3>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            Dựa trên các phần bạn làm chưa tốt
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {recommendations.map((item) => (
          <Link key={item.id} href={`/watch/${item.id}`}>
            <Card className="rounded-2xl border-white bg-white/60 hover:bg-white transition-all group cursor-pointer shadow-sm hover:shadow-md">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                    {item.type === "VIDEO" ? <PlayCircle className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors">
                      {item.title}
                    </h4>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                      {item.type === "VIDEO" ? "Bài giảng Video" : "Tài liệu ôn tập"}
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};
