"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ScoreDistributionChartProps {
  distribution: {
    excellent: number;
    good: number;
    average: number;
    weak: number;
  };
}

export function ScoreDistributionChart({ distribution }: ScoreDistributionChartProps) {
  const data = [
    { name: "Giỏi (8-10)", value: distribution.excellent, color: "#10b981" },
    { name: "Khá (6.5-8)", value: distribution.good, color: "#3b82f6" },
    { name: "Trung bình (5-6.5)", value: distribution.average, color: "#f59e0b" },
    { name: "Yếu (<5)", value: distribution.weak, color: "#ef4444" },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="rounded-[2.5rem] border-slate-100 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500">
            Phân bổ điểm số (Cột)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }}
                />
                <Tooltip 
                  cursor={{ fill: "#f8fafc" }}
                  contentStyle={{ 
                    borderRadius: "16px", 
                    border: "none", 
                    boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                    fontSize: "12px",
                    fontWeight: 900
                  }}
                />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={40}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[2.5rem] border-slate-100 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500">
            Tỷ lệ phần trăm (Tròn)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                   contentStyle={{ 
                    borderRadius: "16px", 
                    border: "none", 
                    boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                    fontSize: "12px",
                    fontWeight: 900
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
