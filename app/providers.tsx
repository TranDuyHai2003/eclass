"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import { GlobalDiscordModal } from "@/components/modals/GlobalDiscordModal";
import "@/app/polyfills";
import { polyfillURLParse } from "@/lib/utils";
import { PointsFlagProvider } from "@/components/points/PointsFlag";

polyfillURLParse();

export function Providers({ children, pointsEnabled = false, session }: { children: React.ReactNode; pointsEnabled?: boolean; session?: Session | null }) {
  return (
    // 28/11: có session từ server → không gọi /api/auth/session lúc mở trang (trước gọi 2 lần mỗi trang); không gọi lại mỗi lần đổi tab
    <SessionProvider session={session} refetchOnWindowFocus={false}>
      <PointsFlagProvider enabled={pointsEnabled}>{children}</PointsFlagProvider>
      <GlobalDiscordModal />
    </SessionProvider>
  );
}
