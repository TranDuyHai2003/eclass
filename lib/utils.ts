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
