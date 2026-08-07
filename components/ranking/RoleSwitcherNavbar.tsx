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
    <div className="glass-card p-3 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 border border-blue-100/80 shadow-sm bg-white/90 backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
        <span className="text-xs font-bold text-slate-600">
          Hệ thống Quản lý Học tập eClass • Chế độ Quản trị
        </span>
      </div>

      {/* Role Selector Switch (2 Tabs ONLY visible for Teacher/Admin) */}
      <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-extrabold w-full sm:w-auto">
        <button
          onClick={() => onViewChange("student")}
          className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg transition flex items-center justify-center gap-1.5 ${
            currentView === "student"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>🎓 Góc nhìn Học sinh</span>
        </button>
        <button
          onClick={() => onViewChange("teacher")}
          className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg transition flex items-center justify-center gap-1.5 ${
            currentView === "teacher"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>👨‍🏫 Góc nhìn Giáo viên</span>
        </button>
      </div>
    </div>
  );
}
