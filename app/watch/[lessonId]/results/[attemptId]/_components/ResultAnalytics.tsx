"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ResultAnalyticsProps {
  data: {
    category: string;
    total: number;
    correct: number;
    wrong: number;
    accuracy: number;
  }[];
}

const COLORS = ["#10b981", "#ef4444", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899"];

export const ResultAnalytics = ({ data }: ResultAnalyticsProps) => {
  if (data.length === 0) return null;

  // Prepare data for the pie chart (Total accuracy by category)
  const chartData = data.map((item) => ({
    name: item.category,
    value: item.correct,
    total: item.total,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
      <Card className="rounded-[32px] border-slate-100 shadow-sm overflow-hidden bg-white/50 backdrop-blur-sm">
        <CardHeader className="bg-slate-50/50 border-b p-6">
          <CardTitle className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            Phân bổ câu đúng theo chủ đề
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 h-[250px] md:h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={window.innerWidth < 768 ? 50 : 70}
                outerRadius={window.innerWidth < 768 ? 70 : 90}
                paddingAngle={8}
                dataKey="value"
                stroke="none"
                animationBegin={0}
                animationDuration={1500}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[index % COLORS.length]} 
                    className="hover:opacity-80 transition-opacity cursor-pointer outline-none"
                  />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                formatter={(value: any, name: any, props: any) => [
                   <span className="font-bold text-slate-900">{value}/{props.payload.total} câu</span>, 
                   <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{name}</span>
                ]}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36} 
                iconType="circle"
                wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="rounded-[32px] border-slate-100 shadow-sm overflow-hidden bg-white/50 backdrop-blur-sm">
        <CardHeader className="bg-slate-50/50 border-b p-6">
          <CardTitle className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            Tỉ lệ chính xác (%)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 overflow-y-auto max-h-[320px] custom-scrollbar">
          <div className="space-y-8">
            {data.map((item, index) => (
              <div key={item.category} className="space-y-3 group">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-indigo-500 transition-colors">
                      {item.category}
                    </span>
                    <p className="text-[10px] text-slate-400 font-bold">
                      Đúng {item.correct} / {item.total} câu
                    </p>
                  </div>
                  <span className={cn(
                    "text-lg font-black tracking-tight",
                    item.accuracy < 50 ? "text-red-500" : "text-emerald-600"
                  )}>
                    {item.accuracy}%
                  </span>
                </div>
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                  <div 
                    className="h-full rounded-full transition-all duration-[1500ms] ease-out shadow-sm"
                    style={{ 
                      width: `${item.accuracy}%`,
                      backgroundColor: COLORS[index % COLORS.length]
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
