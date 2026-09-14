"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function WatchRouteTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        if (!pathname || !pathname.startsWith("/watch")) {
          // Whenever user is on ANY page that is NOT /watch, reset open chapters state!
          sessionStorage.setItem("eclass_last_visited_path", pathname || "");
          Object.keys(sessionStorage).forEach((key) => {
            if (key.startsWith("eclass_open_chapters_")) {
              sessionStorage.removeItem(key);
            }
          });
        } else {
          sessionStorage.setItem("eclass_last_visited_path", pathname);
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, [pathname]);

  return null;
}
