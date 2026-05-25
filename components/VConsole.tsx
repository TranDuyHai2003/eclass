"use client";

import { useEffect } from "react";

export default function VConsole() {
  useEffect(() => {
    // Import vconsole dynamically to avoid SSR issues
    import("vconsole").then((VConsole) => {
      const vConsole = new VConsole.default();
      return () => vConsole.destroy();
    });
  }, []);

  return null;
}
