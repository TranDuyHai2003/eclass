"use client";
/**
 * Đo hiệu năng (chỉ bản dev): window.__perf(ms) → FPS, thời gian khung (CPU), thời gian GPU thật (EXT_disjoint_timer_query_webgl2),
 * số lệnh vẽ / tam giác / chương trình shader mỗi khung; window.__toggle(tên) bật / tắt nhóm có tên "perf:<tên>" để đo phần đóng góp.
 * frameMs = thời gian trôi qua / số khung (gồm cả chờ vsync, trình duyệt) — KHÔNG phải thời gian CPU. Thời gian JS thật của khung
 * (từ useFrame đầu tới useFrame cuối, gồm mọi callback + lệnh vẽ của EffectComposer): cpuMs / cpuP95; khoảng cách khung p95: gapP95;
 * renders = số lần gl.render mỗi khung (cảnh chính + hậu kỳ + lượt phụ: cổng, phản chiếu, mô phỏng nước…).
 */
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";

type Q = { q: WebGLQuery; used: boolean };
export function PerfProbe() {
  const { gl, scene } = useThree();
  const st = useRef({ on: false, frames: 0, calls: 0, tris: 0, gpu: [] as number[], t0: 0, pending: [] as Q[], ext: null as unknown, cpu: [] as number[], gap: [] as number[], fs: 0, last: 0, renders: 0 });
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const ctx = gl.getContext() as WebGL2RenderingContext;
    st.current.ext = ctx.getExtension("EXT_disjoint_timer_query_webgl2");
    const w = window as unknown as Record<string, unknown>;
    w.__perf = (ms = 3000) =>
      new Promise((res) => {
        const S = st.current;
        Object.assign(S, { on: true, frames: 0, calls: 0, tris: 0, gpu: [], t0: performance.now(), cpu: [], gap: [], last: 0, renders: 0 });
        gl.info.autoReset = false;
        // đếm gl.render (mọi lượt vẽ cảnh) trong lúc đo
        const render = gl.render;
        gl.render = (...a: Parameters<typeof render>) => {
          S.renders++;
          return render.apply(gl, a);
        };
        setTimeout(() => {
          S.on = false;
          gl.info.autoReset = true;
          gl.render = render;
          const dt = performance.now() - S.t0;
          const g = S.gpu.slice().sort((a, b) => a - b);
          const q = (a: number[], k: number) => (a.length ? +a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * k))].toFixed(2) : null);
          res({
            fps: +((S.frames * 1000) / dt).toFixed(1),
            frameMs: +(dt / Math.max(1, S.frames)).toFixed(2),
            gpuMs: g.length ? +g[Math.floor(g.length / 2)].toFixed(2) : null,
            cpuMs: q(S.cpu, 0.5),
            cpuP95: q(S.cpu, 0.95),
            gapP95: q(S.gap, 0.95),
            renders: +(S.renders / Math.max(1, S.frames)).toFixed(2),
            calls: Math.round(S.calls / Math.max(1, S.frames)),
            tris: Math.round(S.tris / Math.max(1, S.frames)),
            programs: gl.info.programs?.length ?? 0,
            geometries: gl.info.memory.geometries,
            textures: gl.info.memory.textures,
          });
        }, ms);
      });
    w.__scene3 = scene;
    w.__gl = gl;
    w.__toggle = (name: string, on?: boolean) => {
      let n = 0;
      scene.traverse((o) => {
        if (o.name === `perf:${name}`) {
          o.visible = on ?? !o.visible;
          n++;
        }
      });
      return n;
    };
  }, [gl, scene]);
  // đầu khung: xoá bộ đếm + mở truy vấn thời gian GPU
  useFrame(() => {
    const S = st.current;
    if (!S.on) return;
    const now = performance.now();
    if (S.last) S.gap.push(now - S.last);
    S.last = now;
    S.fs = now;
    gl.info.reset();
    const ext = S.ext as { TIME_ELAPSED_EXT: number } | null;
    if (!ext) return;
    const ctx = gl.getContext() as WebGL2RenderingContext;
    const q = ctx.createQuery();
    if (!q) return;
    ctx.beginQuery(ext.TIME_ELAPSED_EXT, q);
    S.pending.push({ q, used: false });
  }, -1000);
  // cuối khung (sau EffectComposer): đóng truy vấn, cộng dồn số liệu, đọc kết quả truy vấn cũ
  useFrame(() => {
    const S = st.current;
    if (!S.on) return;
    S.frames++;
    if (S.fs) S.cpu.push(performance.now() - S.fs);
    S.calls += gl.info.render.calls;
    S.tris += gl.info.render.triangles;
    const ext = S.ext as { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;
    if (!ext) return;
    const ctx = gl.getContext() as WebGL2RenderingContext;
    const last = S.pending[S.pending.length - 1];
    if (last && !last.used) {
      ctx.endQuery(ext.TIME_ELAPSED_EXT);
      last.used = true;
    }
    S.pending = S.pending.filter((p) => {
      if (!p.used) return true;
      if (!ctx.getQueryParameter(p.q, ctx.QUERY_RESULT_AVAILABLE)) return true;
      if (!ctx.getParameter(ext.GPU_DISJOINT_EXT)) S.gpu.push(ctx.getQueryParameter(p.q, ctx.QUERY_RESULT) / 1e6);
      ctx.deleteQuery(p.q);
      return false;
    });
  }, 1000);
  return null;
}
