/** Tiện ích test Hầm Bổ đề: tách đồ thị thành ít sợi chỉ nhất (Hierholzer + cạnh ảo) và sinh vị trí đi bộ 10 Hz */
import { bridgeGeos, components, deckY, degrees, type Graph } from "../../lib/world/vault/konigsberg";
import type { V3 } from "../../lib/world/vault/geom";

export interface TrailPlan {
  start: number;
  edges: number[];
}

/** Phủ mọi cầu bằng max(1, lẻ/2) sợi chỉ mỗi thành phần */
export function eulerTrails(g: Graph): TrailPlan[] {
  const deg = degrees(g);
  const out: TrailPlan[] = [];
  for (const comp of components(g)) {
    const odd = comp.filter((v) => deg[v] % 2);
    const all: { a: number; b: number; i: number }[] = g.bridges.map((b, i) => ({ a: b.a, b: b.b, i })).filter((e) => comp.includes(e.a));
    for (let k = 0; k + 1 < odd.length; k += 2) all.push({ a: odd[k], b: odd[k + 1], i: -1 });
    const adj = new Map<number, number[]>();
    all.forEach((e, j) => {
      adj.set(e.a, [...(adj.get(e.a) ?? []), j]);
      adj.set(e.b, [...(adj.get(e.b) ?? []), j]);
    });
    const used = new Set<number>();
    const start = odd.length ? odd[0] : comp[0];
    const stack: { v: number; e: number }[] = [{ v: start, e: -1 }];
    const circ: { v: number; e: number }[] = [];
    while (stack.length) {
      const top = stack[stack.length - 1];
      const j = (adj.get(top.v) ?? []).find((q) => !used.has(q));
      if (j === undefined) circ.push(stack.pop()!);
      else {
        used.add(j);
        const e = all[j];
        stack.push({ v: e.a === top.v ? e.b : e.a, e: j });
      }
    }
    // thứ tự lấy ra = một chu trình Euler; cạnh nối c[j] → c[j+1] là c[j].e
    const trails: TrailPlan[] = [];
    let cur: TrailPlan = { start: circ[0].v, edges: [] };
    for (let j = 0; j + 1 < circ.length; j++) {
      const e = all[circ[j].e];
      if (e.i < 0) {
        if (cur.edges.length) trails.push(cur);
        cur = { start: circ[j + 1].v, edges: [] };
      } else cur.edges.push(e.i);
    }
    if (cur.edges.length) trails.push(cur);
    const want = Math.max(1, odd.length / 2);
    if (trails.length > want) {
      // chu trình khép kín: sợi cuối kết thúc đúng chỗ sợi đầu bắt đầu → nối lại
      const last = trails.pop()!;
      trails[0] = { start: last.start, edges: [...last.edges, ...trails[0].edges] };
    }
    out.push(...trails);
  }
  return out;
}

/** Vị trí 10 Hz khi đi bộ dọc một sợi chỉ (7 m/s, có rung nhiễu nhẹ) */
export function walkTrail(g: Graph, plan: TrailPlan, jitter = 0.15, rand: () => number = Math.random): V3[] {
  const geos = bridgeGeos(g);
  const out: V3[] = [];
  let at = plan.start;
  const I0 = g.islands[at];
  out.push([I0.x, 0, I0.z], [I0.x + 0.2, 0, I0.z]);
  for (const e of plan.edges) {
    const b = g.bridges[e];
    const fwd = b.a === at;
    const geo = geos[e];
    const n = geo.pts.length / 2 - 1;
    // đi dày: ~0,7 m mỗi mẫu
    const steps = Math.max(8, Math.ceil(geo.len / 0.7));
    for (let s = 0; s <= steps; s++) {
      const t = fwd ? s / steps : 1 - s / steps;
      const f = t * n;
      const i = Math.min(n - 1, Math.floor(f));
      const u = f - i;
      const x = geo.pts[i * 2] + (geo.pts[i * 2 + 2] - geo.pts[i * 2]) * u + (rand() - 0.5) * jitter;
      const z = geo.pts[i * 2 + 1] + (geo.pts[i * 2 + 3] - geo.pts[i * 2 + 1]) * u + (rand() - 0.5) * jitter;
      out.push([x, deckY(geo, t), z]);
    }
    at = fwd ? b.b : b.a;
    const I = g.islands[at];
    out.push([I.x, 0, I.z]);
  }
  return out;
}
