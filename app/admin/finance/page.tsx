import { getPendingEnrollments } from "@/actions/enrollment";
import { EnrollmentTable } from "@/components/admin/finance/EnrollmentTable";

export default async function AdminFinancePage() {
  const pendingEnrollments = await getPendingEnrollments();

  return (
    <div className="page-shell space-y-6">
      <div>
        <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tight">Quản lý Ghi danh</h1>
        <p className="text-gray-600 mt-2 text-sm font-medium">Quản lý các yêu cầu ghi danh khóa học của học viên.</p>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold mb-6 text-gray-900 border-b pb-4">Yêu cầu chờ duyệt ({pendingEnrollments.length})</h2>
        <EnrollmentTable initialEnrollments={pendingEnrollments} />
      </div>
    </div>
  );
}
