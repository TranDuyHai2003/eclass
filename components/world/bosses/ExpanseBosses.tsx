"use client";
/**
 * Boss + sự kiện của Vùng Kỳ quan (gắn trong Expanse): triệu hồi bằng vật phẩm (Chìa Khảo sát → Kẻ Khảo sát Gấp,
 * Thẻ Rút → Sổ Mưa), tự mở Đêm Đèn lồng (đêm, đã hạ boss 1, mỗi đêm một lần). Một trận / sự kiện một lúc.
 * Gỡ lỗi (bản dev): window.__boss.summon("surveyor" | "ledger"), .lantern(), .end(), .state()
 */
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useWorld } from "../store";
import { DAY } from "../fx/dayState";
import { WATER_LEVEL, blockTop } from "@/lib/world/terrain";
import { flattestSite } from "@/lib/world/arenaSite";
import { ENV } from "../combat/combat";
import { t as tt } from "@/lib/world/i18n";
import { nightKey, shouldStart } from "@/lib/world/lanternNight";
import { ITEM_USE } from "../craft/itemUse";
import { SurveyorFight } from "./Surveyor";
import { LedgerFight } from "./RainLedger";
import { LanternNight } from "./LanternNight";
import { loadProgress, saveProgress, toast, useFight, type BossId, type Fight } from "./bossStore";
import { encAutoJoin, encDebug, encEnd, encSummon } from "./encounterNet";

let mounts = 0;
const isNight = () => DAY.night.value >= 0.5;
const inCave = () => {
  const p = useWorld.getState().player;
  return p.y < blockTop(p.x, p.z) - 2.5;
};

/** giờ địa phương (tôn trọng window.__hour khi thử) */
function localNow(): { y: number; m: number; d: number; h: number } {
  const d = new Date();
  const o = (window as unknown as { __hour?: number }).__hour;
  return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate(), h: typeof o === "number" ? o : d.getHours() + d.getMinutes() / 60 };
}

export function summon(id: BossId, force = false): boolean {
  const lang = useWorld.getState().lang;
  const f = useFight.getState();
  if (f.fight || f.eventOn) {
    toast(tt(lang, "bxBusy"), "warn");
    return false;
  }
  if (inCave() && !force) {
    toast(tt(lang, "bxOutdoor"), "warn");
    return false;
  }
  const w = useWorld.getState();
  const p = w.player;
  let fight: Fight;
  if (id === "surveyor") {
    fight = { id, cx: Math.floor(p.x) + 0.5, cz: Math.floor(p.z) + 0.5, y: p.y, seed: (Math.random() * 1e9) | 0, rot: 0 };
    toast(tt(lang, "bxIntro"), "info");
  } else {
    // bến dọc theo hướng nhìn (làm tròn 90°); người chơi đứng ở đầu bến gần
    const rot = (((Math.round(w.playerYaw / (Math.PI / 2)) % 4) + 4) % 4) as number;
    const ax = Math.round(Math.sin((rot * Math.PI) / 2));
    const az = Math.round(Math.cos((rot * Math.PI) / 2));
    fight = { id, cx: Math.floor(p.x + ax * 9) + 0.5, cz: Math.floor(p.z + az * 9) + 0.5, y: p.y, seed: (Math.random() * 1e9) | 0, rot };
    toast(tt(lang, "bxLedgerHow"), "info");
  }
  // dời tâm sang chỗ phẳng nhất gần đó (≤ 16 m) — đồi cao hơn sàn làm khuất báo trước; không phá địa hình
  const g = (x: number, z: number) => ENV.ground(x, z, p.y + 6);
  const site = flattestSite(fight.cx, fight.cz, g, { half: id === "surveyor" ? 12 : 13, radius: 16, step: 4, water: WATER_LEVEL });
  fight = { ...fight, cx: site.cx, cz: site.cz, y: g(site.cx, site.cz) };
  useFight.setState({ fight });
  // nhiều người: xin server lập chỗ trận (mình là chủ); gần trận đang có thì server trả trận đó → vào làm khách
  encSummon(id, fight);
  return true;
}

export function ExpanseBosses() {
  const fight = useFight((s) => s.fight);
  const eventOn = useFight((s) => s.eventOn);
  const ev = useFight((s) => s.ev);
  const checkAt = useRef(0);
  const lanternRef = useRef<() => boolean>(() => false);

  useEffect(() => {
    ITEM_USE.survey_key = ({ bench }) => {
      if (!bench && !isNight()) {
        toast(tt(useWorld.getState().lang, "bxNeedNight"), "warn");
        return true;
      }
      summon("surveyor");
      return true;
    };
    ITEM_USE.draw_token = () => {
      summon("ledger");
      return true;
    };
    const startLantern = () => {
      if (useFight.getState().fight || useFight.getState().eventOn) return false;
      const p = useWorld.getState().player;
      const seed = (Math.random() * 1e9) | 0;
      useFight.setState({ eventOn: true, ev: { cx: p.x, cz: p.z, y: p.y, key: seed } });
      encSummon("lantern", { cx: p.x, cz: p.z, y: p.y, seed, rot: 0 });
      return true;
    };
    if (process.env.NODE_ENV !== "production")
      Object.assign(window, {
        __boss: {
          summon: (id: BossId) => summon(id, true),
          lantern: startLantern,
          end: () => {
            const st = useFight.getState();
            if (st.fight) encEnd(st.fight.seed, "retreat");
            if (st.ev) encEnd(st.ev.key, "retreat");
            useFight.setState({ fight: null, eventOn: false, ev: null });
          },
          state: () => ({ fight: useFight.getState().fight?.id ?? null, event: useFight.getState().eventOn }),
          net: encDebug,
        },
      });
    lanternRef.current = startLantern;
    mounts++;
    return () => {
      mounts--;
      delete ITEM_USE.survey_key;
      delete ITEM_USE.draw_token;
      // rời Vùng Kỳ quan → huỷ trận / sự kiện. Chờ một nhịp: Fast Refresh (dev) gỡ rồi gắn lại ngay — đừng xoá trận đang đánh
      setTimeout(() => {
        if (mounts === 0) useFight.setState({ fight: null, eventOn: false, ev: null });
      }, 0);
    };
  }, []);

  // Đêm Đèn lồng tự mở: kiểm 2 s / lần
  useFrame(() => {
    const now = performance.now();
    if (now - checkAt.current < 2000) return;
    checkAt.current = now;
    const pl = useWorld.getState().player;
    // trận của người khác ở gần (đã bước vào đấu trường) → vào làm khách
    encAutoJoin(pl.x, pl.z);
    const f = useFight.getState();
    if (f.fight || f.eventOn || inCave()) return;
    const pr = loadProgress();
    const t = localNow();
    const key = nightKey(t.y, t.m, t.d, t.h);
    if (!shouldStart({ night: isNight(), cleared: pr.surveyor, key, lastKey: pr.lantern, busy: false })) return;
    if (lanternRef.current()) {
      pr.lantern = key;
      saveProgress(pr);
    }
  });

  return (
    <>
      {fight?.id === "surveyor" && <SurveyorFight key={fight.seed} fight={fight} onEnd={() => useFight.setState({ fight: null })} />}
      {fight?.id === "ledger" && <LedgerFight key={fight.seed} fight={fight} onEnd={() => useFight.setState({ fight: null })} />}
      {eventOn && ev && (
        <LanternNight
          key={ev.key}
          cx={ev.cx}
          cz={ev.cz}
          y={ev.y}
          seed={ev.key}
          onEnd={() => useFight.setState({ eventOn: false, ev: null })}
        />
      )}
    </>
  );
}
