"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { WorldLoading } from "../WorldPage";
import type { WorldApi } from "../api";
import type { WorldState } from "@/lib/world/service";

const WorldClient = dynamic(() => import("../WorldClient").then((m) => m.WorldClient), { ssr: false, loading: () => <WorldLoading /> });

/** /world/preview#fresh → bắt đầu từ đầu; mặc định: đã có 1 phát hiện + 2 sinh vật hoang dã */
export function PreviewClient() {
  const [ready, setReady] = useState<{ api: WorldApi; initial: WorldState } | null>(null);
  useEffect(() => {
    // DEV: mở store cho script kiểm thử trình duyệt
    import("../store").then(({ useWorld }) => ((window as unknown as { __world: unknown }).__world = useWorld));
    import("../combat/combat").then((c) => ((window as unknown as { __combat: unknown }).__combat = c));
    import("../combat/items").then((m) => {
      (window as unknown as { __items: unknown }).__items = m;
      // DEV: Giáo Sin + Khiên Con lắc có sẵn trong túi để thử (ngoài game chỉ nhận qua câu đố Bờ Sóng);
      // /world/preview#waves → đưa luôn vào ô 2 và 3 của bộ trang bị
      m.initBag();
      m.grantWeapon("lance");
      m.grantWeapon("shield");
      if (location.hash.includes("waves")) {
        m.equip(1, "lance");
        m.equip(2, "shield");
      }
    });
    import("../combat/waveWeapons").then((m) => ((window as unknown as { __waves: unknown }).__waves = m));
    import("../gfx").then((m) => ((window as unknown as { __gfx: unknown }).__gfx = m));
    import("./mockApi").then(({ createMockApi }) => setReady(createMockApi(location.hash === "#fresh" ? "fresh" : "demo")));
  }, []);
  if (!ready) return <WorldLoading />;
  return <WorldClient initialState={ready.initial} api={ready.api} />;
}
