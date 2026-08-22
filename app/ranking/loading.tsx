export default function RankingLoading() {
  return (
    <div className="page-shell min-h-screen bg-[#EBF3FF] pb-24 md:pb-12">
      <div className="flex w-full min-h-[calc(100vh-5rem)]">
        {/* Left Sidebar Skeleton - Flush Left */}
        <aside className="hidden lg:block w-[250px] shrink-0 border-r border-slate-200/70 bg-white/70 backdrop-blur-xl p-3">
          <div className="sticky top-24 h-[400px] bg-white rounded-3xl animate-pulse p-4" />
        </aside>

        {/* Right Main Content Skeleton */}
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 space-y-6 sm:space-y-8 max-w-[1600px]">
            {/* Header Banner Skeleton */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 animate-pulse space-y-3">
              <div className="w-32 h-6 bg-slate-200 rounded-full" />
              <div className="w-64 h-8 bg-slate-200 rounded-2xl" />
              <div className="w-48 h-4 bg-slate-200 rounded-xl" />
            </div>

            {/* Personal Card Skeleton */}
            <div className="bg-blue-600/30 rounded-3xl p-6 shadow-sm border border-blue-200/50 animate-pulse flex flex-col md:flex-row justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/40" />
                <div className="space-y-2">
                  <div className="w-24 h-4 bg-white/40 rounded-full" />
                  <div className="w-40 h-6 bg-white/40 rounded-xl" />
                </div>
              </div>
              <div className="w-48 h-10 bg-white/40 rounded-2xl" />
            </div>

            {/* Near Me Skeleton */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm animate-pulse space-y-3">
              <div className="w-40 h-5 bg-slate-200 rounded-xl" />
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-14 bg-slate-100 rounded-2xl" />
                ))}
              </div>
            </div>

            {/* Leaderboard Table Skeleton */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm animate-pulse space-y-4">
              <div className="w-48 h-6 bg-slate-200 rounded-xl" />
              <div className="space-y-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-16 bg-slate-100 rounded-2xl" />
                ))}
              </div>
            </div>
        </main>
      </div>
    </div>
  );
}
