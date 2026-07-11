import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function polyfillURLParse() {
  if (typeof URL !== "undefined" && !URL.parse) {
    URL.parse = function (url: string | URL, base?: string | URL) {
      try {
        return new URL(url, base)
      } catch {
        return null
      }
    } as typeof URL.parse
  }
}

export function compareVietnameseName(a: string | null | undefined, b: string | null | undefined) {
  const nameA = (a || "").replace(/\(.*?\)/g, "").trim();
  const nameB = (b || "").replace(/\(.*?\)/g, "").trim();
  
  const partsA = nameA.split(" ");
  const partsB = nameB.split(" ");
  
  const firstNameA = partsA.pop() || "";
  const firstNameB = partsB.pop() || "";
  
  const cmp = firstNameA.localeCompare(firstNameB, 'vi');
  if (cmp !== 0) return cmp;
  
  const restA = partsA.join(" ");
  const restB = partsB.join(" ");
  return restA.localeCompare(restB, 'vi');
}
