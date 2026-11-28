"use client";
/**
 * HUD của đồ thị khu (DOM, gọn cho điện thoại): bản đồ giấc mơ (đồ thị khu đã tới / chưa tới + khu hiện tại), la bàn cửa
 * và mốc ở đỉnh màn hình (chỉ ở khu mới — ở hub đã có minimap), tên khu khi vào, lời nhắc ngắn (khoá, rơi, câu đố).
 * La bàn cập nhật bằng style trực tiếp trong useFrame (không qua React mỗi khung).
 */
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { createRoot, type Root } from "react-dom/client";
import { LAYER_NAME, ZONE_DEFS, ZONE_DOORS, DOOR_BY_ID, zoneEdges, type ZoneId } from "@/lib/world/zoneGraph";
import { t as tt } from "@/lib/world/i18n";
import { useWorld } from "../../../store";
import { ZONE_RT, useZones } from "./zoneRuntime";

const CSS = `
.zn-map{position:absolute;left:max(10px,env(safe-area-inset-left));top:34%;width:178px;pointer-events:none;z-index:5;
  padding:8px 10px !important;border-radius:12px !important;background:rgba(32,23,44,.62);border:1px solid rgba(243,230,207,.28) !important;
  color:#f3e6cf;font:600 11px/1.3 system-ui,sans-serif;backdrop-filter:blur(3px)}
.zn-map b{display:block;font-size:12.5px;color:#fff;margin:0 0 1px !important}
.zn-map i{font-style:normal;opacity:.75}
.zn-map svg{display:block;margin-top:4px !important}
.zn-compass{position:absolute;left:50%;top:calc(env(safe-area-inset-top) + 64px);transform:translateX(-50%);width:min(380px,72vw);height:52px;
  pointer-events:none;z-index:5;border-radius:99px !important;background:linear-gradient(90deg,rgba(32,23,44,0),rgba(32,23,44,.6) 15%,rgba(32,23,44,.6) 85%,rgba(32,23,44,0));overflow:hidden}
.zn-compass:after{content:"";position:absolute;left:50%;top:3px;bottom:3px;width:2px;background:#ffd27a;transform:translateX(-1px)}
.zn-mk{position:absolute;left:50%;top:4px;white-space:nowrap;font:700 11px/22px system-ui,sans-serif;color:#f3e6cf;transform:translateX(-50%);
  padding:0 7px !important;border-radius:99px !important;background:rgba(200,61,100,.75)}
.zn-mk.lm{top:27px;background:rgba(47,143,138,.85)}
.zn-title{position:absolute;left:50%;top:24%;transform:translateX(-50%);text-align:center;pointer-events:none;z-index:6;color:#fff;
  text-shadow:0 2px 0 #20172c,0 0 18px rgba(200,61,100,.7);transition:opacity .8s}
.zn-title b{display:block;font:900 clamp(20px,4.4vw,38px)/1.15 "Segoe UI","Be Vietnam Pro",system-ui,sans-serif;letter-spacing:.01em}
.zn-title i{display:block;font:italic 600 clamp(12px,2vw,16px)/1.4 "Segoe UI",system-ui,sans-serif;opacity:.85}
.zn-hint{position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom) + 132px);transform:translateX(-50%);max-width:min(560px,86vw);text-align:center;
  pointer-events:none;z-index:6;padding:7px 14px !important;border-radius:10px !important;background:rgba(243,230,207,.94);color:#20172c;
  font:700 13px/1.35 system-ui,sans-serif;box-shadow:0 3px 0 #20172c;transition:opacity .5s}
@media (max-height:480px){.zn-map{top:auto;bottom:calc(env(safe-area-inset-bottom) + 92px);width:150px}.zn-compass{height:48px}.zn-compass{top:calc(env(safe-area-inset-top) + 48px)}.zn-hint{bottom:calc(env(safe-area-inset-bottom) + 96px)}}
`;

const NODE: Record<ZoneId, [number, number]> = { hub: [28, 52], keys: [89, 16], wait: [150, 52], desert: [89, 88] };
const LAYER_COL = { disc: "#ff9ecb", back: "#e0a92e", draft: "#9fe3c9" } as const;
const SHORT: Record<ZoneId, { vi: string; en: string }> = {
  hub: { vi: "Mê cung", en: "Labyrinth" },
  keys: { vi: "Biển Phím", en: "Key Sea" },
  wait: { vi: "Phòng Chờ", en: "Waiting Rm" },
  desert: { vi: "Sa Mạc", en: "Desert" },
};

/** phần tử la bàn đang hiện (khu hiện tại) → useFrame đặt vị trí */
const MARKS: { el: HTMLElement; x: number; z: number }[] = [];

function HudView() {
  const zone = useZones((s) => s.zone);
  const visited = useZones((s) => s.visited);
  const hint = useZones((s) => s.hint);
  const lang = useWorld((s) => (s.lang === "vi" ? "vi" : "en"));
  const title = useRef<HTMLDivElement>(null);
  const hintEl = useRef<HTMLDivElement>(null);
  const def = ZONE_DEFS[zone];
  useEffect(() => {
    const el = title.current;
    if (!el) return;
    el.style.transition = "none";
    el.style.opacity = "1";
    const id = setTimeout(() => {
      el.style.transition = "opacity .8s";
      el.style.opacity = "0";
    }, 2600);
    return () => clearTimeout(id);
  }, [zone]);
  useEffect(() => {
    const el = hintEl.current;
    if (!el || !hint) return;
    el.style.opacity = "1";
    const id = setTimeout(() => (el.style.opacity = "0"), 4200);
    return () => clearTimeout(id);
  }, [hint]);
  const marks = zone === "hub" ? [] : [...ZONE_DOORS[zone].map((d) => ({ key: d.id, x: d.x, z: d.z, text: `⟶ ${d.name[lang]}`, lm: false })), { key: "lm", x: def.landmark.at[0], z: def.landmark.at[2], text: `◆ ${def.landmark.name[lang]}`, lm: true }];
  return (
    <>
      <style>{CSS}</style>
      <div className="zn-map">
        <b>{def.name[lang]}</b>
        <i>{tt(lang, "znLayer", { l: LAYER_NAME[def.layer][lang] })}</i>
        <svg width="158" height="104" viewBox="0 0 178 104" aria-label={tt(lang, "znMap")}>
          {zoneEdges().map(([a, b, id]) => {
            const lock = DOOR_BY_ID[id].lock ?? DOOR_BY_ID[DOOR_BY_ID[id].to].lock;
            return <line key={id} x1={NODE[a][0]} y1={NODE[a][1]} x2={NODE[b][0]} y2={NODE[b][1]} stroke="#f3e6cf" strokeOpacity={0.55} strokeWidth={2} strokeDasharray={lock ? "4 4" : undefined} />;
          })}
          {(Object.keys(NODE) as ZoneId[]).map((z) => {
            const seen = visited.includes(z);
            const [x, y] = NODE[z];
            return (
              <g key={z}>
                {z === zone && <circle cx={x} cy={y} r={15} fill="none" stroke="#ffd27a" strokeWidth={2.5} />}
                <circle cx={x} cy={y} r={10} fill={seen ? LAYER_COL[ZONE_DEFS[z].layer] : "#4a3a5a"} stroke="#20172c" strokeWidth={2} />
                <text x={x} y={y + 24} textAnchor="middle" fontSize={10} fontWeight={700} fill="#f3e6cf">
                  {seen ? SHORT[z][lang] : "???"}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {marks.length > 0 && (
        <div className="zn-compass">
          {marks.map((m) => (
            <span
              key={`${zone}:${m.key}`}
              className={m.lm ? "zn-mk lm" : "zn-mk"}
              ref={(el) => {
                const i = MARKS.findIndex((k) => k.el === el);
                if (el && i < 0) MARKS.push({ el, x: m.x, z: m.z });
              }}
            >
              {m.text}
            </span>
          ))}
        </div>
      )}
      <div className="zn-title" ref={title} style={{ opacity: 0 }}>
        <b>{def.name[lang]}</b>
        <i>{LAYER_NAME[def.layer][lang]}</i>
      </div>
      <div className="zn-hint" ref={hintEl} style={{ opacity: 0 }}>
        {hint?.text ?? ""}
      </div>
    </>
  );
}

export function ZoneHud() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const host = gl.domElement.parentElement ?? document.body;
    const div = document.createElement("div");
    div.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:5";
    host.appendChild(div);
    const root: Root = createRoot(div);
    root.render(<HudView />);
    return () => {
      MARKS.length = 0;
      setTimeout(() => {
        root.unmount();
        div.remove();
      }, 0);
    };
  }, [gl]);
  useFrame(() => {
    if (!MARKS.length) return;
    const w = useWorld.getState();
    const o = ZONE_DEFS[ZONE_RT.id].origin;
    const px = w.player.x - o[0];
    const pz = w.player.z - o[2];
    // hướng nhìn của máy quay góc ba: (−sin camYaw, −cos camYaw)
    const fx = -Math.sin(w.camYaw);
    const fz = -Math.cos(w.camYaw);
    for (let i = MARKS.length - 1; i >= 0; i--) {
      const m = MARKS[i];
      if (!m.el.isConnected) {
        MARKS.splice(i, 1);
        continue;
      }
      const dx = m.x - px;
      const dz = m.z - pz;
      const rel = Math.atan2(fx * dz - fz * dx, fx * dx + fz * dz);
      const half = (m.el.parentElement?.clientWidth ?? 300) / 2;
      const k = Math.max(-1, Math.min(1, rel / (Math.PI / 2)));
      m.el.style.transform = `translateX(calc(-50% + ${(k * (half - 40)).toFixed(1)}px))`;
      m.el.style.opacity = Math.abs(rel) > Math.PI / 2 ? "0.35" : "1";
    }
  });
  return null;
}
