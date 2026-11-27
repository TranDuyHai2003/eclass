"use client";
/**
 * Client entry for /world: lazy-loads the 3D client (no SSR) and wires the server actions as the API.
 */
import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { WorldState } from "@/lib/world/service";
import type { WorldApi } from "./api";
import { worldExplain, worldPredict, worldRealtimeToken, worldRequestChallenge, worldState, worldSubmit } from "@/actions/world";

const WorldClient = dynamic(() => import("./WorldClient").then((m) => m.WorldClient), {
  ssr: false,
  loading: () => <WorldLoading />,
});

export function WorldLoading() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-gradient-to-b from-indigo-950 via-indigo-900 to-sky-900">
      <div className="h-16 w-16 animate-spin rounded-full border-4 border-amber-200/30 border-t-amber-200" />
      <div className="bg-gradient-to-r from-amber-200 via-pink-200 to-sky-200 bg-clip-text text-xl font-black text-transparent">Math World</div>
    </div>
  );
}

export function WorldPage({ initialState, readOnly, defaultName }: { initialState: WorldState; readOnly: boolean; defaultName?: string }) {
  const api = useMemo<WorldApi>(
    () => ({ state: worldState, request: worldRequestChallenge, submit: worldSubmit, predict: worldPredict, explain: worldExplain, realtime: worldRealtimeToken }),
    [],
  );
  return <WorldClient initialState={initialState} api={api} readOnly={readOnly} defaultName={defaultName} />;
}
