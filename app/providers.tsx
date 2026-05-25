"use client";

import { SessionProvider } from "next-auth/react";
import { GlobalDiscordModal } from "@/components/modals/GlobalDiscordModal";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <GlobalDiscordModal />
    </SessionProvider>
  );
}
