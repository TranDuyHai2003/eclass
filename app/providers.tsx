"use client";

import { SessionProvider } from "next-auth/react";
import { GlobalDiscordModal } from "@/components/modals/GlobalDiscordModal";
import "@/app/polyfills";
import { polyfillURLParse } from "@/lib/utils";
import { PointsFlagProvider } from "@/components/points/PointsFlag";

polyfillURLParse();

export function Providers({ children, pointsEnabled = false }: { children: React.ReactNode; pointsEnabled?: boolean }) {
  return (
    <SessionProvider>
      <PointsFlagProvider enabled={pointsEnabled}>{children}</PointsFlagProvider>
      <GlobalDiscordModal />
    </SessionProvider>
  );
}
