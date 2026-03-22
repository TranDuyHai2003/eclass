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
    <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100 space-y-8">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          Đấu Trường
        </h3>
        <span className="text-[10px] font-black text-red-600 uppercase tracking-widest bg-red-50 px-3 py-1 rounded-full">Tuần này</span>
      </div>

      <div className="space-y-4">
        {topUsers.map((user) => (
          <div key={user.rank} className="flex items-center justify-between p-3 rounded-2xl hover:bg-gray-50 transition-colors group">
            <div className="flex items-center gap-4">
              <span className={`w-8 text-sm font-black ${user.rank === 1 ? 'text-yellow-500' : 'text-gray-400'}`}>
                {user.rank === 1 ? <Medal className="w-5 h-5" /> : `#${user.rank}`}
              </span>
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600 font-black text-xs group-hover:bg-red-600 group-hover:text-white transition-colors">
                {user.avatar}
              </div>
              <p className="font-bold text-gray-700 text-sm">{user.name}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-black text-gray-900 leading-none">{user.exp}</p>
              <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">EXP</p>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-6 border-t border-gray-100">
        <div className="bg-red-50 rounded-2xl p-4 border border-red-100 space-y-3">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-red-600">#6</span>
                    <p className="text-xs font-bold text-gray-700">Bạn đang ở đây</p>
                </div>
                <div className="flex items-center gap-1 text-red-600">
                    <TrendingUp className="w-3 h-3" />
                    <span className="text-[10px] font-black uppercase tracking-tighter">Gần Top 5</span>
                </div>
            </div>
            <p className="text-[10px] text-gray-500 italic">
                Chỉ cần hoàn thành <span className="text-red-600 font-black">1 bài tập nữa</span> để vượt mặt Top 5!
            </p>
        </div>
      </div>
    </div>
  );
}
