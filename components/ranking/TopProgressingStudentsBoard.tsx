"use client";

import { Rocket, TrendingUp, Award } from "lucide-react";

export interface ProgressingStudentItem {
  id: string;
  name: string;
  initialScore: number;
  currentScore: number;
  deltaScore: number;
  completedTests: number;
}

interface TopProgressingStudentsBoardProps {
  topProgressingStudents?: ProgressingStudentItem[];
  studyClassName?: string | null;
}

export function TopProgressingStudentsBoard({
  topProgressingStudents,
  studyClassName = "10A1",
}: TopProgressingStudentsBoardProps) {
  const defaultList: ProgressingStudentItem[] = [
    { id: "p-1", name: "Nguyễn Văn A", initialScore: 6.5, currentScore: 8.8, deltaScore: 2.3, completedTests: 18 },
    { id: "p-2", name: "Trần Thị B", initialScore: 7.0, currentScore: 8.9, deltaScore: 1.9, completedTests: 16 },
    { id: "p-3", name: "Lê Văn C", initialScore: 6.8, currentScore: 8.5, deltaScore: 1.7, completedTests: 15 },
    { id: "p-4", name: "Phạm Hải D", initialScore: 7.5, currentScore: 9.0, deltaScore: 1.5, completedTests: 20 },
    { id: "p-5", name: "Vũ Minh K", initialScore: 7.2, currentScore: 8.6, deltaScore: 1.4, completedTests: 14 },
  ];

  const list = topProgressingStudents && topProgressingStudents.length > 0 ? topProgressingStudents : defaultList;

  return (
    <section className="glass-card rounded-3xl p-5 sm:p-6 space-y-4 bg-white/90 backdrop-blur-xl border border-white/80 shadow-md">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center font-extrabold text-lg shrink-0">
            🚀
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight flex items-center gap-1.5">
              Top Học Sinh Tiến Bộ Nhất ({studyClassName || "Lớp 10A1"})
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Vinh danh các bạn có mức tăng điểm ĐTB cá nhân ấn tượng nhất 4 chu kỳ qua
            </p>
          </div>
        </div>

        <span className="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full shrink-0">
          Growth Mindset
        </span>
      </div>

      <div className="space-y-2.5">
        {list.map((st, idx) => (
          <div
            key={st.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl bg-white border border-slate-200/80 hover:border-emerald-300 transition text-xs gap-3 shadow-xs"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 font-extrabold text-xs flex items-center justify-center shrink-0">
                #{idx + 1}
              </span>

              <div className="min-w-0">
                <span className="font-extrabold text-slate-900 text-sm block truncate">
                  {st.name}
                </span>
                <span className="text-[11px] text-slate-500 font-medium block truncate">
                  Điểm đầu kỳ: <strong className="text-slate-700">{st.initialScore.toFixed(1)}</strong> ➔ Điểm hiện tại: <strong className="text-slate-900">{st.currentScore.toFixed(1)}</strong>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 justify-between sm:justify-end shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
              <span className="text-xs font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                +{st.deltaScore.toFixed(1)} điểm
              </span>

              <button
                onClick={() => alert(`Ghi nhận khen thưởng tiến bộ vượt bậc cho ${st.name} (+${st.deltaScore.toFixed(1)}đ)`)}
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold rounded-xl text-[11px] transition shadow-xs"
              >
                Ghi nhận
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
