"use client";
/**
 * Đo hiệu năng (chỉ bản dev): window.__perf(ms) → FPS, thời gian khung (CPU), thời gian GPU thật (EXT_disjoint_timer_query_webgl2),
 * số lệnh vẽ / tam giác / chương trình shader mỗi khung; window.__toggle(tên) bật / tắt nhóm có tên "perf:<tên>" để đo phần đóng góp.
 */
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";

type Q = { q: WebGLQuery; used: boolean };
export function PerfProbe() {
  const { gl, scene } = useThree();
  const st = useRef({ on: false, frames: 0, calls: 0, tris: 0, gpu: [] as number[], t0: 0, pending: [] as Q[], ext: null as unknown });
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const ctx = gl.getContext() as WebGL2RenderingContext;
    st.current.ext = ctx.getExtension("EXT_disjoint_timer_query_webgl2");
    const w = window as unknown as Record<string, unknown>;
    w.__perf = (ms = 3000) =>
      new Promise((res) => {
        const S = st.current;
        Object.assign(S, { on: true, frames: 0, calls: 0, tris: 0, gpu: [], t0: performance.now() });
        gl.info.autoReset = false;
        setTimeout(() => {
          S.on = false;
          gl.info.autoReset = true;
          const dt = performance.now() - S.t0;
          const g = S.gpu.slice().sort((a, b) => a - b);
          res({
            fps: +((S.frames * 1000) / dt).toFixed(1),
            frameMs: +(dt / Math.max(1, S.frames)).toFixed(2),
            gpuMs: g.length ? +g[Math.floor(g.length / 2)].toFixed(2) : null,
            calls: Math.round(S.calls / Math.max(1, S.frames)),
            tris: Math.round(S.tris / Math.max(1, S.frames)),
            programs: gl.info.programs?.length ?? 0,
            geometries: gl.info.memory.geometries,
            textures: gl.info.memory.textures,
          });
        }, ms);
      });
    w.__scene3 = scene;
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
