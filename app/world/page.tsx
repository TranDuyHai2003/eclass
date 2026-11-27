import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getWorldState } from "@/lib/world/service";
import { WorldPage } from "@/components/world/WorldPage";

export const viewport = { viewportFit: "cover" as const };
export const dynamic = "force-dynamic";
export const metadata = { title: "Math World — Function Valley" };

/** Math World 3D (MVP: Function Valley). PLAN: docs/ai-reviews/game-3d/PLAN.md */
export default async function Page() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const state = await getWorldState(session.user.id);
  return <WorldPage initialState={state} readOnly={!!session.user.isDemo} defaultName={session.user.name ?? ""} heavyAssetBase={process.env.WORLD_HEAVY_ASSET_BASE || null} />;
}
