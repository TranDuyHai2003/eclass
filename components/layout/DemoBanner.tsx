import { Eye } from "lucide-react";
import { auth } from "@/auth";

export default async function DemoBanner() {
  const session = await auth();
  if (!session?.user?.isDemo) return null;

  return (
    <div className="w-full bg-amber-500 text-white text-xs sm:text-sm font-medium">
      <div className="flex items-center justify-center gap-2 px-4 py-1.5 text-center">
        <Eye className="w-4 h-4 shrink-0" />
        <span>Demo Mode — tài khoản chỉ xem, mọi thao tác thay đổi dữ liệu đều bị vô hiệu hóa.</span>
      </div>
    </div>
  );
}
