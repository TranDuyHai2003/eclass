import Link from "next/link";

/** Trang Tiệm quà khi tài khoản chưa được mở tiệm (tạm thời chỉ học sinh offline) */
export function ShopClosed({ balance }: { balance?: number | null }) {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-10" data-testid="shop-closed">
      <div className="w-full max-w-md rounded-3xl border-2 border-amber-200 bg-white p-6 text-center shadow-[0_6px_0_0_#fde68a]">
        <div aria-hidden className="text-5xl">🎁</div>
        <h1 className="mt-3 text-xl font-black text-slate-900">Tiệm quà đang mở thử cho lớp offline</h1>
        <p className="mt-2 text-sm text-slate-600">
          Bạn vẫn được cộng xu mỗi khi nộp bài. Xu được giữ nguyên trong ví, khi tiệm mở cho mọi bạn là dùng được ngay.
        </p>
        {typeof balance === "number" && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-sm font-black text-amber-700">
            🪙 {balance.toLocaleString("vi-VN")} xu đang có
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/" className="btn-3d btn-3d-blue h-10 px-4 text-sm">Về trang chủ</Link>
          <Link href="/profile" className="btn-3d btn-3d-white h-10 px-4 text-sm">Hồ sơ của tôi</Link>
        </div>
      </div>
    </main>
  );
}
