"use client";
import katex from "katex";
import "katex/dist/katex.min.css";
import { useMemo } from "react";

/** Văn bản có công thức trong $…$ → KaTeX */
export function MathText({ text, className }: { text: string; className?: string }) {
  const html = useMemo(() => {
    const parts = String(text ?? "").split(/(\$[^$]+\$)/g);
    return parts
      .map((p) => {
        if (p.startsWith("$") && p.endsWith("$") && p.length > 2) {
          try {
            return katex.renderToString(p.slice(1, -1), { throwOnError: false, output: "html" });
          } catch {
            return escapeHtml(p);
          }
        }
        return escapeHtml(p);
      })
      .join("");
  }, [text]);
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
