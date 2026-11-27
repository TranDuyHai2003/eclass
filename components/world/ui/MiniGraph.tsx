"use client";
import { useMemo } from "react";
import { f, fp } from "@/lib/world/cubic";
import type { GraphSpec } from "@/lib/world/generators";

/** Đồ thị nhỏ (SVG) của f hoặc f′ cho đề bài */
export function MiniGraph({ graph, height = 170 }: { graph: GraphSpec; height?: number }) {
  const W = 320;
  const H = height;
  const { path, xs, ys, toX, toY } = useMemo(() => {
    const fn = (x: number) => (graph.kind === "f" ? f(graph.cubic, x) : fp(graph.cubic, x));
    const N = 160;
    const pts: [number, number][] = [];
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i <= N; i++) {
      const x = graph.xMin + ((graph.xMax - graph.xMin) * i) / N;
      const y = fn(x);
      pts.push([x, y]);
      lo = Math.min(lo, y);
      hi = Math.max(hi, y);
    }
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
    const pad = (hi - lo) * 0.12 || 1;
    lo -= pad;
    hi += pad;
    const toX = (x: number) => ((x - graph.xMin) / (graph.xMax - graph.xMin)) * W;
    const toY = (y: number) => H - ((y - lo) / (hi - lo)) * H;
    const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${toX(x).toFixed(1)},${toY(y).toFixed(1)}`).join(" ");
    const xs: number[] = [];
    for (let x = Math.ceil(graph.xMin); x <= Math.floor(graph.xMax); x++) xs.push(x);
    return { path: d, xs, ys: [lo, hi], toX, toY };
  }, [graph, H]);
  void ys;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl bg-slate-950/60 ring-1 ring-white/10">
      {xs.map((x) => (
        <g key={x}>
          <line x1={toX(x)} x2={toX(x)} y1={0} y2={H} stroke="white" strokeOpacity={x === 0 ? 0.5 : 0.08} />
          <text x={toX(x) + 2} y={toY(0) + 12} fontSize={10} fill="white" fillOpacity={0.6}>
            {x}
          </text>
        </g>
      ))}
      <line x1={0} x2={W} y1={toY(0)} y2={toY(0)} stroke="white" strokeOpacity={0.5} />
      <path d={path} fill="none" stroke={graph.kind === "f" ? "#ffd27a" : "#8be0ff"} strokeWidth={2.5} />
      <text x={6} y={14} fontSize={12} fontWeight={700} fill={graph.kind === "f" ? "#ffd27a" : "#8be0ff"}>
        {graph.kind === "f" ? "y = f(x)" : "y = f′(x)"}
      </text>
    </svg>
  );
}
