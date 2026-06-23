"use client";

import { SessionProvider } from "next-auth/react";
import { GlobalDiscordModal } from "@/components/modals/GlobalDiscordModal";
import "@/app/polyfills";
import { polyfillURLParse } from "@/lib/utils";

polyfillURLParse();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <GlobalDiscordModal />
    </SessionProvider>
  );
}
