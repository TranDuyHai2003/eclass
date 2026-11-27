"use client";
/**
 * Math World 3D — main shell: Canvas (three.js / R3F) + HUD + controls + overlays.
 * English by default (i18n EN/VI), adaptive quality for mobile, fullscreen on start.
 * PLAN: docs/ai-reviews/game-3d/PLAN.md
 */
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { EffectComposer, Bloom, BrightnessContrast, ChromaticAberration, DepthOfField, GodRays, HueSaturation, N8AO, Noise, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { useGodSun, usePdxStyle } from "./scene/VoidHybrid";
import { useGfx } from "./gfx";
import { toggleScope } from "./scope";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import { useWorld, useT, detectQuality, type Quality, type SceneId } from "./store";
import { WorldApiContext, type WorldApi } from "./api";
import { Sky, Lights } from "./scene/Environment";
import { Hub } from "./scene/Hub";
import { Valley } from "./scene/Valley";
import { Expanse } from "./scene/Expanse";
import { Impossible } from "./scene/Impossible";
import { Babel } from "./scene/Babel";
import { BabelUI } from "./ui/BabelUI";
import { HilbertPanel } from "./ui/HilbertPanel";
import { GuideBook } from "./ui/GuideBook";
import { CavePanel } from "./ui/CavePanel";
import { MontyPanel } from "./ui/MontyPanel";
import { TheseusPanel } from "./ui/TheseusPanel";
import { MaxwellPanel } from "./ui/MaxwellPanel";
import { ChineseRoomPanel } from "./ui/ChineseRoomPanel";
import { ParadoxPanel } from "./ui/ParadoxPanel";
import { ParadoxHall } from "./scene/ParadoxHall";
import { Study } from "./scene/study/StudyRoom";
import { studyInteract } from "./scene/study/studyState";
import { StudyPanel } from "./ui/StudyPanel";
import { usePdx } from "./scene/paradoxData";
import { penroseEye } from "./scene/ParadoxVoidFx";
import { anamorphView } from "./scene/anamorphView";
import { runAction } from "./actions";
import { paradoxTeleport } from "./scene/ParadoxCosmos";
import { toggleLab } from "./lab";
import type { LabId } from "@/lib/world/impCosmos";
import { Lensing } from "./fx/Lensing";
import { openBabelUi } from "./scene/babelState";
import { Siren } from "./scene/Siren";
import { ForgeOverlay } from "./scene/Forge";
import { HoloConsole } from "./ui/HoloConsole";
import { WormholeTravel } from "./ui/WormholeTravel";
import { LoadingScreen } from "./ui/LoadingScreen";
import { PerfProbe } from "./fx/PerfProbe";
import { HUB_SUN } from "./scene/HubPlaza";
import { SPAWN as HUB_SPAWN } from "@/lib/world/hubLayout";
import { STUDY_SPAWN } from "@/lib/world/studyRoom";
const HUB_SUN_POS = HUB_SUN.clone().multiplyScalar(40).toArray() as [number, number, number];
import { AreaTitle } from "./ui/AreaTitle";
import { CameraShake, MagicCircle, Shield } from "./fx/Effects";
import { BattleOverlay, CharacterOverlay, EmoteOverlay, MuseumOverlay, WonderOverlay } from "./ui/Overlays";
import { ValleyPanel } from "./ui/ValleyPanel";
import { DEFAULT_AVATAR, AVATAR_BY_ID, worldAsset } from "@/lib/world/avatars";
import { DEFAULT_LANG, isLang, type Lang } from "@/lib/world/i18n";
import type { WorldState } from "@/lib/world/service";
import type { KcId } from "@/lib/world/kcs";
import { sfx } from "@/lib/world/sfx";
import { Sparkles } from "lucide-react";
import { BLOCK_RGB, PLACEABLE } from "@/lib/world/voxels";
import { SceneWipe, motion } from "./ui/kit";
import { Ink } from "./fx/Ink";
import { HeightFog } from "./fx/HeightFog";
import { InkMask } from "./fx/InkMask";
import { Ward } from "./fx/Ward";
import { Sparks } from "./fx/Sparks";
import { CastAura } from "./fx/CastAura";
import { RENDER_STYLE } from "./fx/renderStyle";
import { Hud } from "./ui/Hud";
import { attackDown, attackUp, burst, curWeapon, cycleWeapon, dodge, endAim, jump, skill, startAim } from "./combat/combat";
import { LabelLayer, LabelProjector } from "./ui/Labels";
import { netConnect, netDisconnect, netEdit, netJoin } from "./net";
import { NameField } from "./ui/NameField";
import { Credit } from "./ui/Credit";
import { cleanName } from "@/lib/world/playerName";
import { onLocalEdit } from "@/lib/world/voxels";
import { beVietnam, chakra, mplus, nunito } from "@/lib/fonts";
import { DialogueOverlay, QuestDone } from "./ui/Story";
import { questEvent, talkTo } from "./story/quest";
import type { NpcId } from "@/lib/world/story";

// Không dùng shadow map (bóng mờ vẽ trong shader mặt đất) — tiết kiệm nhiều nhất trên điện thoại
const QUALITY: Record<Quality, { dpr: [number, number]; post: boolean }> = {
  // Điện thoại có DPR 2–3: render tối thiểu 1,5× để không nhoè; bù lại bằng cảnh nhẹ (không hậu kỳ)
  low: { dpr: [1, 1.5], post: false }, // post=false: chỉ một lượt Ink (viền mực) — không bloom/SMAA
  mid: { dpr: [1.25, 1.75], post: true },
  high: { dpr: [1.5, 2], post: true },
};

export function WorldClient({ initialState, api: rawApi, readOnly = false, defaultName = "" }: { initialState: WorldState; api: WorldApi; readOnly?: boolean; defaultName?: string }) {
  const scene = useWorld((s) => s.scene);
  const avatarId = useWorld((s) => s.avatar);
  const overlay = useWorld((s) => s.overlay);
  const battleKc = useWorld((s) => s.battleKc);
  const lang = useWorld((s) => s.lang);
  const quality = useWorld((s) => s.quality);
  // phong cách siêu thực (lai PBR) dùng cho Hư Không Nghịch Lý + Thế giới Bất Khả
  const pdxReal = usePdxStyle((s) => s.real) && (scene === "paradox" || scene === "impossible");
  RENDER_STYLE.real = pdxReal;
  const gfx = useGfx();
  const godSun = useGodSun((s) => s.sun);
  const camDist = useWorld((s) => Math.round(s.camDist * 2) / 2);
  const t = useT();
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [fade, setFade] = useState(false);
  const [travel, setTravel] = useState<{ from: string; to: string } | null>(null);
  const [title, setTitle] = useState<{ id: string; at: number } | null>(null);
  const [wipeKind, setWipeKind] = useState<"stripes" | "wormhole">("stripes");
  const [started, setStarted] = useState(false);
  const sceneSince = useRef(0);
  useEffect(() => {
    sceneSince.current = performance.now();
  }, [scene, started]);
  const root = useRef<HTMLDivElement>(null);

  // Gắn ngôn ngữ hiện tại vào mọi lời gọi server
  const api = useMemo<WorldApi>(
    () => ({
      state: (l) => rawApi.state(l ?? useWorld.getState().lang),
      request: (req, l) => rawApi.request(req, l ?? useWorld.getState().lang),
      submit: (input) => rawApi.submit(input),
      predict: (id, p, l) => rawApi.predict(id, p, l ?? useWorld.getState().lang),
      explain: (id, text, l) => rawApi.explain(id, text, l ?? useWorld.getState().lang),
    }),
    [rawApi],
  );

  useEffect(() => {
    let avatar = DEFAULT_AVATAR;
    let l: Lang = DEFAULT_LANG;
    let name = cleanName(defaultName);
    try {
      const saved = localStorage.getItem("world.avatar");
      if (saved && AVATAR_BY_ID[saved] && !AVATAR_BY_ID[saved].npcOnly) avatar = saved;
      const sl = localStorage.getItem("world.lang");
      if (isLang(sl)) l = sl;
      name = cleanName(localStorage.getItem("world.name")) || name;
    } catch {}
    useWorld.setState({ state: initialState, avatar, lang: l, quality: detectQuality(), playerName: name });
    try {
      const c = document.createElement("canvas");
      setWebgl(!!(c.getContext("webgl2") || c.getContext("webgl")));
    } catch {
      setWebgl(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tên mặc định chỉ dùng lúc vào
  }, [initialState]);

  // Đổi ngôn ngữ → tải lại tên sinh vật / phát hiện theo ngôn ngữ mới
  const firstLang = useRef(true);
  useEffect(() => {
    if (firstLang.current) {
      firstLang.current = false;
      if (lang === DEFAULT_LANG) return;
    }
    api.state(lang).then((r) => r.success && useWorld.setState({ state: r.data }));
  }, [lang, api]);

  useKeyboard();

  function go(next: "hub" | "valley" | "expanse" | "impossible" | "siren" | "babel" | "paradox" | "study") {
    if (travel) return;
    sfx.circle();
    setTravel({ from: useWorld.getState().scene, to: next });
  }
  // DEV: móc kiểm thử chuyến đi lỗ sâu
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") (window as unknown as { __go: unknown }).__go = go;
  });
  /** Giữa đường hầm: đổi thế giới + chỗ xuất hiện + góc máy nhìn ra khoảng trống đẹp */
  function arrive(next: SceneId) {
    const spawn = next === "expanse" ? new THREE.Vector3(0, 0, 0) : next === "impossible" ? new THREE.Vector3(0, 0, 7) : next === "siren" ? new THREE.Vector3(0, 0, 10) : next === "babel" ? new THREE.Vector3(1.2, 0, 2.7) : next === "paradox" ? new THREE.Vector3(0, 0, 6.5) : next === "study" ? new THREE.Vector3(STUDY_SPAWN.x, 0, STUDY_SPAWN.z) : new THREE.Vector3(HUB_SPAWN.x, 0, HUB_SPAWN.z);
    // Babel: quay về phía Thủ thư (tây) — máy quay phía sau thấy cả lan can giếng và giá sách
    const yaw = next === "expanse" ? Math.atan2(6, -10) : next === "babel" ? -Math.PI / 2 - 0.35 : Math.PI;
    useWorld.setState({ scene: next, overlay: null, challengeCubic: null, anchors: [], input: { x: 0, y: 0, run: false }, player: spawn, playerYaw: yaw, camYaw: yaw + Math.PI, camPitch: next === "babel" ? 0.18 : 0.28, camDist: next === "babel" ? 3.4 : next === "study" ? 3.6 : 4.6 });
  }

  function interact() {
    const n = useWorld.getState().nearby;
    if (!n || useWorld.getState().overlay) return;
    sfx.click();
    if (n.kind === "portal") go(n.id === "expanse" ? "expanse" : n.id === "impossible" ? "impossible" : n.id === "siren" ? "siren" : n.id === "babel" ? "babel" : n.id === "paradox" ? "paradox" : n.id === "study" ? "study" : n.id === "hub" ? "hub" : "valley");
    else if (n.kind === "shelf") openBabelUi(n.id === "desk" ? { mode: "desk" } : { mode: "shelf", wall: Number(n.id) || 0 });
    else if (n.kind === "stair") openBabelUi({ mode: "stair" });
    else if (n.kind === "study") studyInteract(n.id);
    else if (n.kind === "paradox" && n.id === "eye") penroseEye();
    else if (n.kind === "paradox" && n.id === "anamorph") anamorphView();
    else if (n.kind === "action" && n.id) runAction(n.id);
    else if (n.kind === "paradox" && n.id?.startsWith("tp:")) paradoxTeleport(n.id);
    else if (n.kind === "paradox" && n.id === "locked") return;
    else if (n.kind === "lab" && n.id) toggleLab(n.id as LabId);
    else if (n.kind === "paradox") {
      usePdx.setState({ id: Number(n.id) || 0 });
      useWorld.setState({ overlay: "paradox" });
    }
    else if (n.kind === "npc" && n.id) talkTo(n.id as NpcId);
    else if (n.kind === "forge") useWorld.setState({ overlay: "forge" });
    else if (n.kind === "console") useWorld.setState({ overlay: "console" });
    else if (n.kind === "museum") useWorld.setState({ overlay: "museum" });
    else if (n.kind === "characters") useWorld.setState({ overlay: "characters" });
    else if (n.kind === "wonder" && n.id) useWorld.setState({ overlay: "wonder", wonderId: n.id });
    else if (n.kind === "creature" && n.id && !readOnly) useWorld.setState({ overlay: "battle", battleKc: n.id });
  }
  // Cổng do giao diện phát ra (vd. "Rời Thư viện" trên bàn đọc Babel)
  useEffect(() => {
    const h = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (id === "impossible" || id === "hub" || id === "study") go(id);
    };
    window.addEventListener("world:portal", h);
    return () => window.removeEventListener("world:portal", h);
  });
  const interactRef = useRef(interact);
  useEffect(() => {
    interactRef.current = interact;
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      const k = e.key.toLowerCase();
      if (k === "f" || (e.key === "Enter" && useWorld.getState().scene === "hub")) interactRef.current();
      if (k === "e") skill();
      if (k === "q") burst();
      if (k === "r" && !e.repeat) cycleWeapon(1);
      // Z: ống nhòm (bật / tắt)
      if (k === "z" && !e.repeat) toggleScope();
      if (e.key === "Escape") toggleScope(false);
      // Shift: nhấn = né (bất tử ngắn), giữ = chạy
      if (e.key === "Shift" && !e.repeat) dodge();
      if (e.code === "Space" && !useWorld.getState().challengeCubic) {
        e.preventDefault();
        jump();
      }
      if (e.key === "Escape") useWorld.setState({ overlay: null });
      if ((e.key === "g" || e.key === "G") && useWorld.getState().scene !== "valley")
        useWorld.setState((st) => ({ overlay: st.overlay === "emotes" ? null : st.overlay ?? "emotes" }));
      if (e.code === "Space" && useWorld.getState().challengeCubic) {
        e.preventDefault();
        const w = useWorld.getState();
        useWorld.setState({ anchors: [...w.anchors, Math.round(w.valleyX * 20) / 20] });
        sfx.circle();
      }
    };
    // Chuột trái = đánh (nhấn: chuỗi đòn, giữ: tụ lực); chuột phải = né (cung: ngắm).
    // Đánh được cả khi CHƯA khoá chuột (bấm thẳng lên màn chơi) — trước đây chưa khoá / vừa Esc thì mọi cú bấm bị bỏ.
    // (Thế giới khối tự xử lý: đánh quái trước mặt, không thì phá khối.)
    const click = (e: MouseEvent) => {
      if (useWorld.getState().scene === "expanse") return;
      if (!document.pointerLockElement && !(e.target instanceof HTMLCanvasElement)) return;
      if (e.button === 2) {
        if (curWeapon().id === "bow") startAim();
        else dodge();
      }
      if (e.button === 0) attackDown();
    };
    const release = (e: MouseEvent) => {
      if (e.button === 2) endAim(true);
      if (e.button === 0) attackUp();
    };
    const noMenu = (e: MouseEvent) => {
      if (document.pointerLockElement) e.preventDefault();
    };
    window.addEventListener("mouseup", release);
    window.addEventListener("contextmenu", noMenu);
    window.addEventListener("keydown", h);
    window.addEventListener("mousedown", click);
    return () => {
      window.removeEventListener("keydown", h);
      window.removeEventListener("mousedown", click);
      window.removeEventListener("mouseup", release);
      window.removeEventListener("contextmenu", noMenu);
    };
  }, []);

  // Nhiều người chơi: kết nối sau khi vào game, đổi phòng theo map
  useEffect(() => {
    if (!started || !rawApi.realtime) return;
    let alive = true;
    const getFresh = async () => {
      const r = await rawApi.realtime!();
      return r.success && r.data ? r.data : null;
    };
    rawApi.realtime().then((r) => alive && r.success && r.data && netConnect(r.data, getFresh));
    const off = onLocalEdit((x, y, z, id) => netEdit(x, y, z, id));
    return () => {
      alive = false;
      off();
      netDisconnect();
    };
  }, [started, rawApi]);
  useEffect(() => {
    if (started) netJoin(scene);
    if (started) questEvent({ type: "enter", scene });
  }, [scene, started]);

  async function start() {
    sfx.chime(0);
    setStarted(true);
    await enterFullscreen(root.current);
  }

  if (webgl === false) {
    return (
      <div className="flex h-dvh items-center justify-center bg-indigo-950 p-6 text-center text-white">
        <div>
          <p className="text-lg font-black">{t("noWebgl")}</p>
          <p className="mt-2 text-sm text-white/70">{t("noWebglHint")}</p>
          <Link href="/home" className="mt-4 inline-block rounded-full bg-white px-4 py-1.5 font-bold text-indigo-950">
            {t("backHome")}
          </Link>
        </div>
      </div>
    );
  }

  const q = QUALITY[quality];
  return (
    <WorldApiContext.Provider value={api}>
      <div ref={root} className={`w-root relative h-dvh w-full touch-none select-none overflow-hidden bg-sky-200 ${nunito.variable} ${beVietnam.variable} ${chakra.variable} ${mplus.variable}`}>
        <Canvas
          dpr={[q.dpr[0] * gfx.scale, q.dpr[1] * gfx.scale]}
          camera={{ fov: 45, near: 0.1, far: 1000, position: [0, 4, 14] }}
          gl={{ antialias: false, powerPreference: "high-performance", stencil: true }}
          onCreated={({ gl }) => {
            // Tone map do hiệu ứng ToneMapping (Neutral) đảm nhận ở cuối chuỗi hậu kỳ
          }}
        >
          <PerformanceMonitor
            flipflops={2}
            onDecline={() => {
              // Bỏ qua khựng lúc vừa tải / đổi cảnh; chỉ HẠ chất lượng (không tự nâng → tránh lật qua lật lại)
              if (performance.now() - sceneSince.current < 8000) return;
              const cur = useWorld.getState().quality;
              if (cur !== "low") useWorld.setState({ quality: cur === "high" ? "mid" : "low" });
            }}
            onFallback={() => useWorld.getState().quality !== "low" && useWorld.setState({ quality: "low" })}
          />
          <Suspense fallback={null}>
            {scene !== "babel" && scene !== "paradox" && scene !== "impossible" && scene !== "hub" && scene !== "siren" && scene !== "study" && <Sky panorama={worldAsset("art/sky_panorama.webp")} />}
            {process.env.NODE_ENV !== "production" && <PerfProbe />}
            {/* tán lá kiểu Genshin ở Quảng trường: mặt nạ để viền mực không vẽ bên trong tán */}
            {scene === "hub" && <InkMask />}
            {/* Bất Khả siêu thực tự đặt đèn (một mặt trời) — đèn chung thêm mặt trời thứ hai lệch hướng làm khối phẳng lỳ */}
            {!(scene === "impossible" && pdxReal) && scene !== "study" && <Lights fog={scene === "valley" || scene === "siren"} sun={scene === "hub" ? HUB_SUN_POS : undefined} warm={scene === "hub"} />}
            {scene === "hub" ? <Hub /> : scene === "valley" ? <Valley /> : scene === "expanse" ? <Expanse /> : scene === "siren" ? <Siren /> : scene === "babel" ? <Babel /> : scene === "paradox" ? <ParadoxHall /> : scene === "study" ? <Study /> : <Impossible />}
            {scene === "hub" && overlay === "battle" && <BattleCircle />}
            <PlayerShield />
            {/* khiên phép (vẽ vòng tròn): bong bóng hiện suốt thời gian hiệu lực, mọi cảnh */}
            <Ward />
            {/* hạt kiểu HoYo: tia mềm kéo dài theo vận tốc + glint (thay khối sao / pha lê / lục giác) */}
            <Sparks />
            {/* hào quang khi đang vẽ phép */}
            <CastAura />
            <CameraShake />
            <LabelProjector />
          </Suspense>
          {!q.post && (
            <EffectComposer multisampling={0} stencilBuffer>
              {/* thấu kính hố đen / nhoè khi qua lỗ sâu (tự thoát sớm khi không dùng) */}
              <Lensing />
              {/* máy yếu: hoạt hình = 1 lượt viền mực; siêu thực = không viền, chỉ sương độ cao (1 lần đọc depth) */}
              {pdxReal ? scene === "impossible" ? <HeightFog /> : <></> : <Ink width={1.6} far={55} />}
              <ToneMapping mode={pdxReal ? ToneMappingMode.AGX : ToneMappingMode.NEUTRAL} />
              {/* AgX làm nhạt màu → bù bão hoà / tương phản SAU tone mapping (trên ảnh LDR: đèn HDR không bị đẩy âm → NaN ô đen) */}
              {pdxReal ? <HueSaturation saturation={0.16} /> : <></>}
              {pdxReal ? <BrightnessContrast brightness={0.01} contrast={0.1} /> : <></>}
            </EffectComposer>
          )}
          {q.post && (
            <EffectComposer multisampling={0} stencilBuffer>
              {/* che khuất môi trường thời gian thực (N8AO: SSAO bán cầu + khử nhiễu) — trước mọi hiệu ứng màu */}
              {/* siêu thực (Endfield): AO chỉ cho tiếp xúc gần (0,5 m) — không quầng tối quanh mép đảo */}
              {gfx.ao ? <N8AO aoRadius={pdxReal ? 0.5 : 1.4} intensity={pdxReal ? 1.4 : 1.6} distanceFalloff={1} quality="performance" halfRes depthAwareUpsampling /> : <></>}
              {/* thấu kính hấp dẫn + chấn màn hình phải đứng đầu chuỗi hiệu ứng (đọc thẳng ảnh cảnh) */}
              <Lensing />
              {/* hoạt hình: viền mực; siêu thực (kiểu Endfield): KHÔNG viền, thay bằng sương theo độ cao (tách sân / đảo / trời) */}
              {pdxReal ? scene === "impossible" ? <HeightFog /> : <></> : <Ink width={quality === "high" ? 2.4 : 2} far={quality === "high" ? 95 : 75} />}
              {/* tia sáng thể tích từ hố đen (god rays, tán xạ hướng tâm) */}
              {gfx.godrays && pdxReal && godSun ? <GodRays sun={godSun} samples={36} density={0.86} decay={0.9} weight={0.22} exposure={0.16} clampMax={0.6} blur /> : <></>}
              {/* Chỉ vật phát sáng HDR (vòng phép, pha lê) mới loé — không làm chói cả cảnh */}
              {gfx.bloom ? <Bloom intensity={pdxReal ? 0.55 : 0.6} luminanceThreshold={pdxReal ? 1.2 : 1} luminanceSmoothing={0.15} mipmapBlur /> : <></>}
              {/* bokeh: nhân vật nét, nền nhoà theo khoảng cách thật (đơn vị thế giới) */}
              {gfx.dof ? <DepthOfField worldFocusDistance={camDist + 0.4} worldFocusRange={Math.max(6, camDist * 2.2)} bokehScale={pdxReal ? 3.2 : 2.2} /> : <></>}
              {/* siêu thực sạch kiểu Endfield: bỏ tách màu, hạt phim rất nhẹ */}
              {pdxReal && gfx.grain ? <Noise opacity={0.02} premultiply /> : <></>}
              {gfx.aa ? <SMAA /> : <></>}
              {/* Chỉnh màu kiểu anime: rực hơn một chút, tương phản mềm */}
              {!pdxReal ? <HueSaturation saturation={0.04} /> : <></>}
              {!pdxReal ? <BrightnessContrast brightness={0.01} contrast={0.03} /> : <></>}
              <Vignette eskil={false} offset={0.3} darkness={pdxReal ? 0.38 : 0.22} />
              {/* siêu thực: AgX (tông phim, giữ màu ở vùng rất sáng); hoạt hình: Neutral */}
              <ToneMapping mode={pdxReal ? ToneMappingMode.AGX : ToneMappingMode.NEUTRAL} />
              {/* siêu thực: chỉnh màu sau AgX (xem nhánh máy yếu) */}
              {pdxReal ? <HueSaturation saturation={0.16} /> : <></>}
              {pdxReal ? <BrightnessContrast brightness={0.01} contrast={0.1} /> : <></>}
            </EffectComposer>
          )}
        </Canvas>

        <LabelLayer />
        <Hud onInteract={interact} readOnly={readOnly} rootRef={root} onFullscreen={() => (document.fullscreenElement ? document.exitFullscreen().catch(() => {}) : enterFullscreen(root.current))} />
        {scene === "valley" && <ValleyPanel onExit={() => go("hub")} />}
        {scene === "study" && <StudyPanel />}
        {overlay === "museum" && <MuseumOverlay onClose={() => useWorld.setState({ overlay: null })} />}
        {overlay === "characters" && <CharacterOverlay onClose={() => useWorld.setState({ overlay: null })} />}
        {overlay === "wonder" && <WonderOverlay onClose={() => useWorld.setState({ overlay: null })} />}
        {overlay === "emotes" && <EmoteOverlay onClose={() => useWorld.setState({ overlay: null })} />}
        {overlay === "forge" && <ForgeOverlay onClose={() => useWorld.setState({ overlay: null })} />}
        {overlay === "console" && <HoloConsole onClose={() => useWorld.setState({ overlay: null })} />}
        {overlay === "babel" && <BabelUI />}
        {overlay === "hilbert" && <HilbertPanel onClose={() => useWorld.setState({ overlay: null })} />}
        {overlay === "guide" && <GuideBook onClose={() => useWorld.setState({ overlay: null })} />}
        {overlay === "cave" && <CavePanel onClose={() => useWorld.setState({ overlay: null })} />}
        {overlay === "monty" && <MontyPanel onClose={() => useWorld.setState({ overlay: null })} />}
        {overlay === "theseus" && <TheseusPanel onClose={() => useWorld.setState({ overlay: null })} />}
        {overlay === "maxwell" && <MaxwellPanel onClose={() => useWorld.setState({ overlay: null })} />}
        {overlay === "croom" && <ChineseRoomPanel onClose={() => useWorld.setState({ overlay: null })} />}
        {overlay === "paradox" && <ParadoxPanel onClose={() => useWorld.setState({ overlay: null })} />}
        {overlay === "battle" && battleKc && <BattleOverlay kc={battleKc as KcId} onClose={() => useWorld.setState({ overlay: null, battleKc: null })} />}
        <QuestDone />
        <DialogueOverlay />
        <SceneWipe show={fade} kind={wipeKind} />
        {travel && (
          <WormholeTravel
            from={travel.from}
            to={travel.to}
            onSwap={() => arrive(travel.to as SceneId)}
            onDone={() => {
              setTitle({ id: travel.to, at: performance.now() });
              setTravel(null);
            }}
          />
        )}
        {started && <LoadingScreen armKey={`${scene}|${avatarId}`} scene={scene} />}
        <AreaTitle title={title} />
        <Joystick />
        {scene === "expanse" && !overlay && <BlockHud />}
        {!started && <StartScreen onStart={start} />}
      </div>
    </WorldApiContext.Provider>
  );
}

// ───────────── Thanh khối (Vùng Kỳ quan voxel) ─────────────

function BlockHud() {
  const t = useT();
  const hotbar = useWorld((s) => s.hotbar);
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    setTouch(window.matchMedia("(pointer: coarse)").matches);
    const key = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= PLACEABLE.length) useWorld.setState({ hotbar: n - 1 });
    };
    const wheel = (e: WheelEvent) => {
      if (!e.shiftKey) return;
      useWorld.setState((s) => ({ hotbar: (s.hotbar + (e.deltaY > 0 ? 1 : PLACEABLE.length - 1)) % PLACEABLE.length }));
    };
    window.addEventListener("keydown", key);
    window.addEventListener("wheel", wheel, { passive: true });
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("wheel", wheel);
    };
  }, []);
  const rgb = (id: number) => `rgb(${BLOCK_RGB[id][0].map((v) => Math.round(v * 255)).join(",")})`;
  return (
    <>
      {/* Tâm ngắm */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-5 w-5 -translate-x-1/2 -translate-y-1/2">
        <div className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 bg-white/90 shadow" />
        <div className="absolute left-0 top-1/2 h-[2px] w-full -translate-y-1/2 bg-white/90 shadow" />
      </div>
      <div className="w-hotbar pointer-events-auto absolute left-1/2 z-20 flex -translate-x-1/2 gap-1.5 rounded-xl bg-[#12162b]/70 p-1.5 ring-1 ring-[#ecd7a9]/50 backdrop-blur">
        {PLACEABLE.map((id, i) => (
          <button
            key={id}
            type="button"
            onClick={() => useWorld.setState({ hotbar: i })}
            className={`relative h-[calc(var(--u,1)*42px)] w-[calc(var(--u,1)*42px)] rounded-lg transition ${i === hotbar ? "scale-110 ring-2 ring-[#ecd7a9]" : "ring-1 ring-white/20"}`}
            style={{ background: `linear-gradient(160deg, ${rgb(id)}, rgba(0,0,0,.35))` }}
            aria-label={t("blockSlot", { n: i + 1 })}
          >
            <span className="absolute bottom-0.5 right-1 text-[10px] font-black text-white drop-shadow">{i + 1}</span>
          </button>
        ))}
      </div>
      {!touch && (
        <div className="pointer-events-none absolute bottom-[calc(var(--u,1)*104px)] left-1/2 z-10 -translate-x-1/2 rounded-full bg-[#12162b]/55 px-3 py-0.5 text-[11px] text-white/85">{t("blockHint")}</div>
      )}
    </>
  );
}

// ───────────── Fullscreen ─────────────

async function enterFullscreen(el: HTMLElement | null) {
  if (!el || document.fullscreenElement) return;
  try {
    await el.requestFullscreen?.({ navigationUI: "hide" });
    // Điện thoại: khoá ngang nếu trình duyệt cho phép (Android Chrome); iOS bỏ qua
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    if (matchMedia("(pointer: coarse)").matches) await o.lock?.("landscape").catch(() => {});
  } catch {
    /* iPhone Safari không hỗ trợ — game vẫn chiếm trọn 100dvh */
  }
}

function StartScreen({ onStart }: { onStart: () => void }) {
  const t = useT();
  const lang = useWorld((s) => s.lang);
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-end gap-4 bg-cover bg-center p-6 pb-[12vh] text-center" style={{ backgroundImage: `linear-gradient(180deg, rgba(12,16,48,.05) 30%, rgba(12,16,48,.85) 100%), url(${worldAsset("art/keyart_valley.webp")})` }}>
      <motion.div initial={{ y: 30, opacity: 0, skewX: -8 }} animate={{ y: 0, opacity: 1, skewX: -8 }} transition={{ type: "spring", stiffness: 200, damping: 20 }} className="w-title text-5xl sm:text-7xl">{t("title")}</motion.div>
      <p className="max-w-md text-sm text-white/85 sm:text-base">{t("tagline")}</p>
      <NameField onEnter={onStart} />
      <button
        type="button"
        onClick={onStart}
        className="w-btn w-btn--gold w-btn--lg"
      >
        <Sparkles size={20} className="mr-2 inline -translate-y-0.5" />
        {t("start")}
      </button>
      <div className="flex gap-2">
        {(["en", "vi"] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => {
              useWorld.setState({ lang: l });
              try {
                localStorage.setItem("world.lang", l);
              } catch {}
            }}
            className={`rounded-full px-3 py-1 text-xs font-black ${lang === l ? "bg-white text-indigo-950" : "bg-white/15 text-white"}`}
          >
            {l === "en" ? "English" : "Tiếng Việt"}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-white/60">{t("fullscreenNote")}</p>
      <Credit />
    </div>
  );
}

/** Vòng tròn phép lớn dưới chân khi đang thuần hoá */
const CA_OFFSET = new THREE.Vector2(0.0009, 0.0006);

function BattleCircle() {
  const p = useWorld((s) => s.player);
  return <MagicCircle radius={2.4} position={[p.x, 0.05, p.z]} color="#ff9ecb" color2="#ffd27a" intensity={1.2} revealSpeed={1.5} spin={1.4} />;
}

/** Hộ thể của nhân vật loé lên khi đỡ đòn */
function PlayerShield() {
  const shieldAt = useWorld((s) => s.shieldAt);
  const scene = useWorld((s) => s.scene);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (performance.now() - shieldAt > 1000) return;
    setOn(true);
    const tm = setTimeout(() => setOn(false), 420);
    return () => clearTimeout(tm);
  }, [shieldAt]);
  if (!on || scene !== "hub") return null;
  const p = useWorld.getState().player;
  return <Shield radius={0.95} position={[p.x, p.y + 0.95, p.z]} color="#9fe6ff" />;
}

// ───────────── Điều khiển ─────────────

function isTyping(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

function useKeyboard() {
  useEffect(() => {
    const keys = new Set<string>();
    const update = () => {
      const x = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
      const y = (keys.has("w") || keys.has("arrowup") ? 1 : 0) - (keys.has("s") || keys.has("arrowdown") ? 1 : 0);
      useWorld.setState({ input: { x, y, run: keys.has("shift") } });
    };
    const down = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      keys.add(e.key.toLowerCase());
      update();
    };
    const up = (e: KeyboardEvent) => {
      keys.delete(e.key.toLowerCase());
      update();
    };
    const blur = () => {
      keys.clear();
      update();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);
}

/** Joystick ảo cho màn hình cảm ứng */
function Joystick() {
  const [touch, setTouch] = useState(false);
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const active = useRef<number | null>(null);
  const overlay = useWorld((s) => s.overlay);
  useEffect(() => setTouch(window.matchMedia("(pointer: coarse)").matches), []);
  if (!touch || overlay === "battle" || overlay === "museum" || overlay === "characters") return null;
  const R = 46;
  const move = (e: React.PointerEvent) => {
    if (active.current !== e.pointerId || !base.current) return;
    const r = base.current.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > R) {
      dx = (dx / d) * R;
      dy = (dy / d) * R;
    }
    setKnob({ x: dx, y: dy });
    useWorld.setState({ input: { x: dx / R, y: -dy / R, run: Math.min(1, d / R) > 0.92 } });
  };
  const end = () => {
    active.current = null;
    setKnob({ x: 0, y: 0 });
    useWorld.setState({ input: { x: 0, y: 0, run: false } });
  };
  return (
    <div
      ref={base}
      onPointerDown={(e) => {
        e.stopPropagation();
        active.current = e.pointerId;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        move(e);
      }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      className="w-joy absolute z-20 rounded-full border-2 border-white/40 bg-white/10 backdrop-blur"
    >
      <div className="absolute left-1/2 top-1/2 h-14 w-14 rounded-full bg-gradient-to-br from-white to-sky-200 shadow-lg" style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} />
    </div>
  );
}
