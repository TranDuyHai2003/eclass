"use client";

import { Trophy, TrendingUp, Medal } from "lucide-react";

const topUsers = [
  { rank: 1, name: "Minh Quân", exp: "15,200", avatar: "MQ" },
  { rank: 2, name: "Thanh Hằng", exp: "14,850", avatar: "TH" },
  { rank: 3, name: "Hoàng Long", exp: "13,100", avatar: "HL" },
  { rank: 4, name: "Bảo Anh", exp: "12,900", avatar: "BA" },
  { rank: 5, name: "Đức Trọng", exp: "12,400", avatar: "DT" },
];

export function Leaderboard() {
  return (
    <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 space-y-8 relative overflow-hidden transition-all hover:shadow-xl hover:shadow-red-500/5">
      <div className="absolute top-0 right-0 w-32 h-32 bg-red-50/50 blur-3xl rounded-full" />
      
      <div className="flex items-center justify-between relative z-10">
        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-yellow-400 flex items-center justify-center text-white shadow-lg shadow-yellow-200">
             <Trophy className="w-4 h-4" />
          </div>
          Đấu Trường
        </h3>
        <span className="text-[9px] font-black text-red-600 uppercase tracking-[0.2em] bg-red-50 px-4 py-1.5 rounded-full border border-red-100">Tuần này</span>
      </div>

      <div className="space-y-4 relative z-10">
        {topUsers.map((user) => (
          <div key={user.rank} className="flex items-center justify-between p-3.5 rounded-2xl hover:bg-slate-50 transition-all group cursor-default">
            <div className="flex items-center gap-4">
              <div className="w-6 text-center">
                {user.rank === 1 ? (
                   <Medal className="w-5 h-5 text-yellow-500 drop-shadow-sm" />
                ) : user.rank === 2 ? (
                   <Medal className="w-5 h-5 text-slate-400 drop-shadow-sm" />
                ) : user.rank === 3 ? (
                   <Medal className="w-5 h-5 text-orange-400 drop-shadow-sm" />
                ) : (
                   <span className="text-xs font-black text-slate-300">#{user.rank}</span>
                )}
              </div>
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white font-black text-xs group-hover:bg-red-600 transition-colors shadow-sm">
                  {user.avatar}
                </div>
                {user.rank <= 3 && (
                   <div className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow-sm">
                      <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                   </div>
                )}
              </div>
              <p className="font-black text-slate-700 text-sm tracking-tight">{user.name}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-black text-slate-900 leading-none">{user.exp}</p>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">EXP</p>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-2 relative z-10">
        <div className="bg-slate-900 rounded-[2rem] p-6 text-white space-y-4 shadow-xl shadow-slate-200">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center font-black text-xs border border-white/10">#6</div>
                    <p className="text-xs font-black uppercase tracking-widest text-white/80">Bạn đang ở đây</p>
                </div>
                <div className="flex items-center gap-1.5 text-orange-400">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Sắp lên Top 5</span>
                </div>
            </div>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
               <div className="h-full bg-orange-400 w-[85%] rounded-full shadow-[0_0_8px_rgba(251,146,60,0.4)]" />
            </div>
            <p className="text-[10px] text-white/60 font-medium leading-relaxed italic">
                Cố lên! Chỉ cần <span className="text-white font-black">1 bài tập nữa</span> để vượt qua Hoàng Long!
            </p>
        </div>
      </div>
    </div>
  );
}
