"use client";

interface RoleSwitcherNavbarProps {
  currentView: "student" | "teacher";
  onViewChange: (view: "student" | "teacher") => void;
  userRole?: string;
}

export function RoleSwitcherNavbar({
  currentView,
  onViewChange,
  userRole = "STUDENT",
}: RoleSwitcherNavbarProps) {
  const isTeacherOrAdmin = userRole === "TEACHER" || userRole === "ADMIN";

  // Hide the role switcher navbar completely for student accounts
  if (!isTeacherOrAdmin) {
    return null;
  }

  return (
    <div className="p-2.5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 border border-slate-700/80 bg-[#0D121D]/90 backdrop-blur-xl shadow-lg">
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
        <span className="text-xs font-bold text-slate-300">Chế độ quản trị</span>
      </div>

      {/* Role Selector Switch (2 Tabs ONLY visible for Teacher/Admin) */}
      <div className="flex items-center bg-slate-950/80 border border-slate-800 p-1 rounded-xl text-xs font-extrabold w-full sm:w-auto">
        <button
          onClick={() => onViewChange("student")}
          className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg transition flex items-center justify-center gap-1.5 ${
            currentView === "student"
              ? "bg-cyan-500 text-slate-950 shadow-sm"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <span>🎓 Góc nhìn Học sinh</span>
        </button>
        <button
          onClick={() => onViewChange("teacher")}
          className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg transition flex items-center justify-center gap-1.5 ${
            currentView === "teacher"
              ? "bg-cyan-500 text-slate-950 shadow-sm"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <span>👨‍🏫 Góc nhìn Giáo viên</span>
        </button>
      </div>
    </div>
  );
}
