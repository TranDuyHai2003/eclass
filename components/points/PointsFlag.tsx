"use client";

import { createContext, useContext } from "react";

/** Bật/tắt tính năng Điểm thưởng (đọc POINTS_ENABLED ở server, truyền xuống client qua Providers) */
const PointsFlagContext = createContext(false);

export function PointsFlagProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  return <PointsFlagContext.Provider value={enabled}>{children}</PointsFlagContext.Provider>;
}

export function usePointsEnabled() {
  return useContext(PointsFlagContext);
}
