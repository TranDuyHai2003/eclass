"use client";

import { useEffect, useState } from "react";
import { Users, Timer, Star } from "lucide-react";

export function SocialProof() {
  const [counts, setCounts] = useState({ users: 0, hours: 0, rating: 0 });

  useEffect(() => {
    const duration = 2000;
    const targets = { users: 1200, hours: 150, rating: 99 };
    const startTime = performance.now();

    const update = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      setCounts({
        users: Math.floor(progress * targets.users),
        hours: Math.floor(progress * targets.hours),
        rating: Math.floor(progress * targets.rating)
      });

      if (progress < 1) requestAnimationFrame(update);
    };

    requestAnimationFrame(update);
  }, []);

  const stats = [
    { icon: Users, value: `${counts.users}+`, label: "Học viên tham gia", color: "text-blue-500" },
    { icon: Timer, value: `${counts.hours}+`, label: "Giờ giải mã code", color: "text-orange-500" },
    { icon: Star, value: `${counts.rating}%`, label: "Đánh giá 5 sao", color: "text-yellow-500" },
  ];

  return (
    <div className="w-full bg-[#1e293b]/50 border-y border-white/5 backdrop-blur-md">
      <div className="container mx-auto py-12 px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {stats.map((stat, i) => (
            <div key={i} className="flex items-center justify-center md:justify-start gap-6 group">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 group-hover:bg-white/10 transition-colors">
                <stat.icon className={`w-8 h-8 ${stat.color}`} />
              </div>
              <div className="space-y-1">
                <p className="text-4xl font-black tracking-tighter">{stat.value}</p>
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
