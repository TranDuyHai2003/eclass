"use client";

import { Code2, Braces, Rocket, ShieldCheck, Trophy } from "lucide-react";

const steps = [
  { icon: Code2, title: "Tân Binh", desc: "Nắm vững cú pháp cơ bản", position: "left" },
  { icon: Braces, title: "Chiến Binh", desc: "Xử lý thuật toán phức tạp", position: "right" },
  { icon: ShieldCheck, title: "Hộ Vệ", desc: "Bảo mật & Tối ưu hệ thống", position: "left" },
  { icon: Rocket, title: "Huyền Thoại", desc: "Triển khai sản phẩm thực tế", position: "right" },
];

export function SkillTree() {
  return (
    <section className="space-y-16 py-10">
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-black uppercase tracking-tighter">Cây Kỹ Năng (Skill Tree)</h2>
        <p className="text-gray-400 max-w-xl mx-auto">Vẽ ra lộ trình của bạn, từ số 0 đến khi trở thành chuyên gia.</p>
      </div>

      <div className="relative max-w-4xl mx-auto">
        {/* Connection Line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-gradient-to-b from-red-600 to-transparent -translate-x-1/2 hidden md:block" />

        <div className="space-y-24">
          {steps.map((step, i) => (
            <div 
              key={i} 
              className={`relative flex items-center justify-center md:justify-between w-full ${
                step.position === "left" ? "md:flex-row" : "md:flex-row-reverse"
              }`}
            >
              {/* Content Card */}
              <div className="w-full md:w-[45%] bg-white/5 border border-white/10 p-8 rounded-[2rem] hover:border-red-500/50 transition-all hover:bg-white/10 group cursor-default">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 rounded-2xl bg-red-600 flex items-center justify-center shadow-[0_0_20px_rgba(220,38,38,0.4)] group-hover:scale-110 transition-transform">
                    <step.icon className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black uppercase text-white mb-2">{step.title}</h3>
                    <p className="text-gray-400 font-medium">{step.desc}</p>
                  </div>
                </div>
              </div>

              {/* Node on the line */}
              <div className="absolute left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-red-600 border-4 border-[#0F172A] hidden md:block shadow-[0_0_15px_rgba(220,38,38,0.8)]" />
              
              {/* Empty space for alignment */}
              <div className="hidden md:block w-[45%]" />
            </div>
          ))}
          
          <div className="flex flex-col items-center pt-20">
             <div className="w-24 h-24 rounded-full bg-yellow-500 flex items-center justify-center animate-bounce shadow-[0_0_30px_rgba(234,179,8,0.4)]">
                <Trophy className="w-12 h-12 text-black" />
             </div>
             <p className="mt-6 text-2xl font-black uppercase text-yellow-500">Chinh phục thành công!</p>
          </div>
        </div>
      </div>
    </section>
  );
}
