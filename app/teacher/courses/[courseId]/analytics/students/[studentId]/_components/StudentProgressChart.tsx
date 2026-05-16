"use client";

import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";

interface StudentProgressChartProps {
  data: {
    name: string;
    score: number;
  }[];
}

export const StudentProgressChart = ({ data }: StudentProgressChartProps) => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis 
          dataKey="name" 
          tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }}
          axisLine={false}
          tickLine={false}
          dy={10}
        />
        <YAxis 
          domain={[0, 10]}
          tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }}
          axisLine={false}
          tickLine={false}
          dx={-10}
        />
        <Tooltip
          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
          labelStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', color: '#64748b', marginBottom: '4px' }}
          itemStyle={{ fontSize: '14px', fontWeight: 900, color: '#4f46e5' }}
          formatter={(value: any) => [`${value} điểm`, 'Kết quả']}
        />
        <Line 
          type="monotone" 
          dataKey="score" 
          stroke="#4f46e5" 
          strokeWidth={4}
          dot={{ r: 6, fill: '#4f46e5', stroke: '#fff', strokeWidth: 2 }}
          activeDot={{ r: 8, fill: '#4f46e5', stroke: '#fff', strokeWidth: 2 }}
          animationDuration={1500}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};
