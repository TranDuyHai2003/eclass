"use client";
/**
 * Bảng điều khiển phòng Học cùng nhau (DOM phủ trên cảnh 3D, chỉ hiện ở cảnh "study").
 * Dựa trên nghiên cứu (xem docs/ai-reviews/study-room/PLAN.md):
 *  - MỘT mục tiêu cụ thể trước phiên + tự kiểm cuối khối học (theo dõi tiến độ — bằng chứng tốt nhất);
 *  - đồng hồ chung của phòng (25/5 theo giờ thực) hoặc đồng hồ riêng 25/5 · 15/3 · 50/10;
 *  - đếm người đang ngồi học (hiện diện thật, không chat);
 *  - chế độ Tập trung: ẩn HUD, máy quay sát vai, cảnh bớt chuyển động; chỉ còn đồng hồ + mục tiêu;
 *  - giải lao chủ động: đứng dậy, vươn vai, nhìn xa ~6 m trong 20 giây;
 *  - âm nền mưa / lửa tự tạo, MẶC ĐỊNH TẮT, mức nhỏ;
 *  - thống kê riêng lưu trên máy (không cần tài khoản), gợi ý ôn lại sau 1 · 3 · 7 ngày.
 */
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BarChart3, BookOpen, Clock3, CloudRain, Eye, EyeOff, Flame, Pause, Play, RotateCcw, Target, Users, VolumeX, X } from "lucide-react";
import { useWorld } from "../store";
import { PLANS, fmtClock, pause, reset, roomPhase, setPlan, soloView, start, tick, type PhaseView } from "@/lib/world/studyTimer";
import { addBlock, addFocus, blockCounts, dayKey, dueReviews, goalRate, lastDays, logGoal, minutesOn, streak, totalMinutes, type GoalResult } from "@/lib/world/studyStats";
import { suggestSeat } from "@/lib/world/studyRoom";
import { occupiedSeats, presence, saveStats, savePrefs, setFocus, stand, useStudy, type Ambient } from "../scene/study/studyState";
import { setAmbient } from "../scene/study/studyAudio";
import { sfx } from "@/lib/world/sfx";

const CSS = `
.w-study{position:absolute;right:max(12px,env(safe-area-inset-right));top:calc(max(10px,env(safe-area-inset-top)) + var(--u,1)*58px);z-index:25;width:min(86vw,calc(var(--u,1)*360px));color:#f6ead0;font-family:var(--font-bvp),system-ui,sans-serif;pointer-events:auto}
.w-study__card{background:linear-gradient(180deg,rgba(38,26,18,.86),rgba(24,17,12,.9));border:1px solid rgba(233,173,98,.45);border-radius:16px;box-shadow:0 8px 28px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,230,180,.12);backdrop-filter:blur(6px);padding:calc(var(--u,1)*10px) calc(var(--u,1)*14px)}
.w-study__row{display:flex;align-items:center;gap:8px}
.w-study__phase{font-size:calc(var(--u,1)*11px);font-weight:800;letter-spacing:.12em;text-transform:uppercase}
.w-study__time{font-family:var(--font-chakra),var(--font-bvp),monospace;font-weight:700;font-size:calc(var(--u,1)*34px);line-height:1;font-variant-numeric:tabular-nums}
.w-study__bar{height:4px;border-radius:4px;background:rgba(255,255,255,.12);overflow:hidden;margin-top:6px}
.w-study__bar i{display:block;height:100%;background:linear-gradient(90deg,#e9ad62,#f4cf7a);transition:width .8s linear}
.w-study__bar--break i{background:linear-gradient(90deg,#83917d,#b5d1a8)}
.w-study__btn{display:inline-flex;align-items:center;gap:5px;border-radius:999px!important;padding:5px 11px!important;font-size:calc(var(--u,1)*12px);font-weight:700;background:rgba(255,255,255,.08)!important;border:1px solid rgba(233,173,98,.35)!important;color:#f6ead0!important;white-space:nowrap}
.w-study__btn:hover{background:rgba(233,173,98,.18)!important}
.w-study__btn--on{background:linear-gradient(180deg,#f4cf7a,#d9a04e)!important;color:#2a1a0c!important;border-color:transparent!important}
.w-study__seg{display:inline-flex;border-radius:999px;background:rgba(0,0,0,.25);padding:2px;border:1px solid rgba(233,173,98,.25)}
.w-study__seg button{border-radius:999px!important;padding:3px 10px!important;font-size:calc(var(--u,1)*11px);font-weight:700;color:#cdbfa3!important;gap:4px}
.w-study__seg button[aria-pressed=true]{background:#e9ad62!important;color:#2a1a0c!important}
.w-study__goal{width:100%;background:rgba(0,0,0,.28)!important;border:1px solid rgba(233,173,98,.3)!important;border-radius:10px!important;padding:6px 10px!important;font-size:calc(var(--u,1)*13px);color:#f6ead0;outline:none}
.w-study__goal:focus{border-color:#e9ad62}
.w-study__muted{color:#bfae8e;font-size:calc(var(--u,1)*11.5px)}
.w-study__pop{margin-top:8px}
.w-study__bars{display:flex;align-items:flex-end;gap:6px;height:56px}
.w-study__bars div{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px}
.w-study__bars b{width:100%;border-radius:4px 4px 1px 1px;background:linear-gradient(180deg,#f4cf7a,#b87a3a);min-height:2px}
.w-study__bars span{font-size:9px;color:#bfae8e}
.w-study__ask{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:40;width:min(90vw,360px);pointer-events:auto}
.w-study-focus .w-hud,.w-study-focus .w-joy{opacity:0!important;pointer-events:none!important;transition:opacity .5s}
`;

/** Pha hiện tại: đồng hồ riêng (khi chọn) hoặc nhịp chung của phòng */
function currentView(now: number): PhaseView {
  const s = useStudy.getState();
  return s.mode === "solo" ? soloView(s.solo, now) : roomPhase(now);
}

export function StudyPanel() {
  const vi = useWorld((s) => s.lang === "vi");
  const seat = useStudy((s) => s.seat);
  const focus = useStudy((s) => s.focus);
  const mode = useStudy((s) => s.mode);
  const solo = useStudy((s) => s.solo);
  const goal = useStudy((s) => s.goal);
  const askGoal = useStudy((s) => s.askGoal);
  const ambient = useStudy((s) => s.ambient);
  const vol = useStudy((s) => s.vol);
  const stats = useStudy((s) => s.stats);
  const statsOpen = useStudy((s) => s.statsOpen);
  const [view, setView] = useState<PhaseView>(() => roomPhase(Date.now()));
  const [pres, setPres] = useState({ studying: 0, inRoom: 1 });
  const [open, setOpen] = useState(true);
  const [hint, setHint] = useState<number | null>(null);
  const acc = useRef({ pending: 0, block: 0, cycle: -1, phase: "focus" as string, savedAt: 0 });
  const goalRef = useRef<HTMLInputElement>(null);

  // điện thoại: thu gọn sẵn (màn hình nhỏ)
  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) setOpen(false);
  }, []);
  // vừa ngồi xuống: thu gọn để nhìn thấy bàn + tường chính
  useEffect(() => {
    if (seat !== null) setOpen(false);
  }, [seat]);

  // Nhịp 1 giây: cập nhật đồng hồ, tiến đồng hồ riêng, cộng thời gian tập trung khi đang NGỒI trong pha học
  useEffect(() => {
    const flush = () => {
      const a = acc.current;
      if (a.pending > 0) {
        saveStats(addFocus(useStudy.getState().stats, dayKey(new Date()), a.pending));
        a.pending = 0;
      }
    };
    let last = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      const dt = Math.min(5000, Math.max(0, now - last));
      last = now;
      const s = useStudy.getState();
      if (s.mode === "solo") {
        const r = tick(s.solo, now);
        if (r.ended) {
          useStudy.setState({ solo: r.s });
          sfx.chime(r.ended === "focus" ? 2 : 1);
        }
      }
      const v = currentView(now);
      const a = acc.current;
      // sang chu kỳ mới: chốt khối học vừa qua (đủ ≥ 60% thời gian ngồi → tính một khối trọn vẹn)
      if (a.cycle !== v.cycle || a.phase !== v.phase) {
        if (a.cycle !== -1 && a.phase === "focus") {
          const blockMs = s.mode === "solo" ? soloView({ ...s.solo, phase: "focus" }, now).dur : 25 * 60_000;
          if (blockCounts(a.block, blockMs)) {
            flush();
            saveStats(addBlock(useStudy.getState().stats));
            if (s.mode === "room") sfx.chime(2);
            if (useStudy.getState().goal.trim()) useStudy.setState({ askGoal: true, focus: false });
          }
        }
        a.cycle = v.cycle;
        a.phase = v.phase;
        a.block = 0;
      }
      const running = s.mode === "room" || s.solo.since !== null;
      if (s.seat !== null && v.phase === "focus" && running) {
        a.pending += dt;
        a.block += dt;
      }
      if (now - a.savedAt > 15000) {
        a.savedAt = now;
        flush();
      }
      setView(v);
      setPres(presence());
      if (s.seat === null) {
        const sg = suggestSeat(occupiedSeats());
        setHint(sg ? sg.id : null);
      }
    }, 1000);
    return () => {
      window.clearInterval(id);
      flush();
    };
  }, []);

  // Chế độ tập trung: ẩn HUD của game (lớp CSS trên gốc), Esc để thoát
  useEffect(() => {
    const root = document.querySelector(".w-root");
    root?.classList.toggle("w-study-focus", focus);
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape" && useStudy.getState().focus) setFocus(false);
    };
    window.addEventListener("keydown", k);
    return () => {
      root?.classList.remove("w-study-focus");
      window.removeEventListener("keydown", k);
    };
  }, [focus]);

  // ô nhập: chặn phím lọt ra trò chơi (WASD, F, B, J…)
  useEffect(() => {
    const el = goalRef.current;
    if (!el) return;
    const stop = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Enter" || e.key === "Escape") el.blur();
    };
    el.addEventListener("keydown", stop);
    el.addEventListener("keyup", stop);
    return () => {
      el.removeEventListener("keydown", stop);
      el.removeEventListener("keyup", stop);
    };
  });

  const T = (v: string, e: string) => (vi ? v : e);
  const isFocus = view.phase === "focus";
  const k = 1 - view.remain / Math.max(1, view.dur);
  const phaseLabel = isFocus ? T("Đang tập trung", "Focus") : view.phase === "long" ? T("Nghỉ dài", "Long break") : T("Giải lao", "Break");
  const soloPaused = mode === "solo" && solo.since === null;

  const setAmb = (a: Ambient, v = vol) => {
    useStudy.setState({ ambient: a, vol: v });
    setAmbient(a, v);
    savePrefs();
  };
  const answer = (r: GoalResult) => {
    const s = useStudy.getState();
    saveStats(logGoal(s.stats, { day: dayKey(new Date()), text: s.goal, result: r }));
    useStudy.setState({ askGoal: false, goal: r === "done" ? "" : s.goal });
    savePrefs();
  };

  const today = dayKey(new Date());
  const reviews = dueReviews(stats, today);

  return (
    <>
      <style>{CSS}</style>
      <div className="w-study" onPointerDown={(e) => e.stopPropagation()}>
        <div className="w-study__card">
          <div className="w-study__row" style={{ justifyContent: "space-between" }}>
            <div>
              <div className="w-study__phase" style={{ color: isFocus ? "#f4cf7a" : "#a8c3a0" }}>
                {phaseLabel}
                {soloPaused ? ` · ${T("tạm dừng", "paused")}` : ""}
              </div>
              <div className="w-study__time">{fmtClock(view.remain)}</div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="w-study__muted inline-flex items-center gap-1" title={T("Đang ngồi học / trong phòng", "Studying / in room")}>
                <Users size={13} />
                {T(`${pres.studying} đang học · ${pres.inRoom} trong phòng`, `${pres.studying} studying · ${pres.inRoom} here`)}
              </span>
              {!focus && (
                <div className="w-study__seg" role="group" aria-label={T("Đồng hồ", "Timer")}>
                  <button type="button" aria-pressed={mode === "room"} onClick={() => (useStudy.setState({ mode: "room" }), savePrefs())}>
                    {T("Chung", "Room")}
                  </button>
                  <button type="button" aria-pressed={mode === "solo"} onClick={() => (useStudy.setState({ mode: "solo" }), savePrefs())}>
                    {T("Riêng", "Solo")}
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className={`w-study__bar ${isFocus ? "" : "w-study__bar--break"}`}>
            <i style={{ width: `${k * 100}%` }} />
          </div>

          {focus ? (
            <div className="mt-2 flex items-center gap-2">
              <Target size={15} className="shrink-0 text-[#e9ad62]" />
              <span className="min-w-0 flex-1 truncate text-sm">{goal || T("Tập trung vào một việc", "One thing at a time")}</span>
              <button type="button" className="w-study__btn" onClick={() => setFocus(false)}>
                <Eye size={14} />
                {T("Thoát", "Exit")}
              </button>
            </div>
          ) : (
            <>
              {!isFocus && (
                <p className="w-study__muted mt-2">{T("Giải lao chủ động: đứng dậy vươn vai, uống nước, nhìn xa ~6 m trong 20 giây.", "Active break: stand, stretch, drink water, look ~6 m away for 20 s.")}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {mode === "solo" && (
                  <>
                    <div className="w-study__seg">
                      {PLANS.map((p) => (
                        <button key={p.id} type="button" aria-pressed={solo.plan === p.id} onClick={() => (useStudy.setState({ solo: setPlan(useStudy.getState().solo, p.id) }), savePrefs())}>
                          {p.id}
                        </button>
                      ))}
                    </div>
                    <button type="button" className="w-study__btn" onClick={() => useStudy.setState({ solo: solo.since === null ? start(solo, Date.now()) : pause(solo, Date.now()) })}>
                      {solo.since === null ? <Play size={13} /> : <Pause size={13} />}
                      {solo.since === null ? T("Bắt đầu", "Start") : T("Dừng", "Pause")}
                    </button>
                    <button type="button" className="w-study__btn" aria-label={T("Đặt lại", "Reset")} onClick={() => useStudy.setState({ solo: reset(solo) })}>
                      <RotateCcw size={13} />
                    </button>
                  </>
                )}
                <button type="button" className="w-study__btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
                  <Clock3 size={13} />
                  {open ? T("Thu gọn", "Less") : T("Mở rộng", "More")}
                </button>
                {seat !== null && (
                  <button type="button" className="w-study__btn w-study__btn--on" onClick={() => setFocus(true)}>
                    <EyeOff size={13} />
                    {T("Tập trung", "Focus mode")}
                  </button>
                )}
              </div>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
                    <label className="mt-2 block">
                      <span className="w-study__muted mb-1 inline-flex items-center gap-1">
                        <Target size={12} />
                        {T("Mục tiêu phiên này (một việc cụ thể)", "This session's goal (one concrete thing)")}
                      </span>
                      <input
                        ref={goalRef}
                        className="w-study__goal"
                        maxLength={120}
                        value={goal}
                        placeholder={T("VD: Giải 4 phương trình bậc nhất và thử lại", "e.g. Solve 4 linear equations and check them")}
                        onChange={(e) => useStudy.setState({ goal: e.target.value })}
                        onBlur={savePrefs}
                      />
                    </label>
                    {seat === null ? (
                      <p className="w-study__muted mt-2">
                        <BookOpen size={12} className="mr-1 inline -translate-y-px" />
                        {T("Đi tới một ghế trống, bấm F để ngồi học.", "Walk to a free chair and press F to sit.")}
                        {hint !== null ? T(` Gợi ý: chỗ ${hint + 1}.`, ` Suggested: seat ${hint + 1}.`) : ""}
                      </p>
                    ) : (
                      <p className="w-study__muted mt-2">
                        {T("Cất điện thoại ra xa, bật Không làm phiền. Bước đi hoặc bấm F để đứng dậy.", "Put your phone away, turn on Do Not Disturb. Move or press F to stand up.")}{" "}
                        <button type="button" className="underline" onClick={() => stand()}>
                          {T("Đứng dậy", "Stand up")}
                        </button>
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="w-study__muted">{T("Âm nền", "Ambience")}</span>
                      <div className="w-study__seg">
                        {(
                          [
                            ["off", <VolumeX key="o" size={12} />, T("Tắt", "Off")],
                            ["rain", <CloudRain key="r" size={12} />, T("Mưa", "Rain")],
                            ["fire", <Flame key="f" size={12} />, T("Lửa", "Fire")],
                            ["both", null, T("Cả hai", "Both")],
                          ] as [Ambient, React.ReactNode, string][]
                        ).map(([a, icon, label]) => (
                          <button key={a} type="button" aria-pressed={ambient === a} onClick={() => setAmb(a)} className="inline-flex items-center gap-1">
                            {icon}
                            {label}
                          </button>
                        ))}
                      </div>
                      {ambient !== "off" && (
                        <input type="range" min={0} max={1} step={0.05} value={vol} aria-label={T("Âm lượng", "Volume")} onChange={(e) => setAmb(ambient, Number(e.target.value))} className="w-24 accent-[#e9ad62]" />
                      )}
                      <button type="button" className={`w-study__btn ${statsOpen ? "w-study__btn--on" : ""}`} onClick={() => useStudy.setState({ statsOpen: !statsOpen })}>
                        <BarChart3 size={13} />
                        {T("Thống kê", "Stats")}
                      </button>
                    </div>
                    {statsOpen && (
                      <div className="w-study__pop">
                        <div className="w-study__bars" aria-label={T("Phút tập trung 7 ngày qua", "Focus minutes, last 7 days")}>
                          {(() => {
                            const days = lastDays(stats, today);
                            const max = Math.max(25, ...days.map((d) => d.min));
                            return days.map((d) => (
                              <div key={d.day} title={`${d.day}: ${d.min}′`}>
                                <b style={{ height: `${(d.min / max) * 44}px` }} />
                                <span>{d.day.slice(8)}</span>
                              </div>
                            ));
                          })()}
                        </div>
                        <p className="w-study__muted mt-1">
                          {T(
                            `Hôm nay ${minutesOn(stats, today)} phút · chuỗi ${streak(stats, today)} ngày · tổng ${totalMinutes(stats)} phút · ${stats.blocks} khối học · mục tiêu đạt ${Math.round(goalRate(stats) * 100)}%`,
                            `Today ${minutesOn(stats, today)} min · ${streak(stats, today)}-day streak · ${totalMinutes(stats)} min total · ${stats.blocks} blocks · goals ${Math.round(goalRate(stats) * 100)}%`,
                          )}
                        </p>
                        {reviews.length > 0 && (
                          <div className="mt-1">
                            <p className="w-study__muted">{T("Ôn lại cách quãng — thử một bài tương tự:", "Spaced review — try a similar problem:")}</p>
                            <ul className="ml-4 list-disc text-xs">
                              {reviews.map((r) => (
                                <li key={r.day + r.text}>
                                  {r.text} <span className="w-study__muted">({T(`${r.gap} ngày trước`, `${r.gap}d ago`)})</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <p className="w-study__muted mt-1 opacity-70">{T("Lưu trên máy này, không gửi đi đâu.", "Saved on this device only.")}</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {askGoal && (
          <motion.div className="w-study__ask" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} onPointerDown={(e) => e.stopPropagation()}>
            <div className="w-study__card text-center">
              <div className="flex justify-end">
                <button type="button" aria-label={T("Đóng", "Close")} onClick={() => useStudy.setState({ askGoal: false })}>
                  <X size={16} />
                </button>
              </div>
              <p className="w-study__phase text-[#f4cf7a]">{T("Hết khối học", "Block complete")}</p>
              <p className="mt-1 text-sm">{T("Bạn đã đạt mục tiêu chưa?", "Did you reach your goal?")}</p>
              <p className="mt-1 text-sm italic text-[#e9d9b8]">“{goal}”</p>
              <div className="mt-3 flex justify-center gap-2">
                <button type="button" className="w-study__btn w-study__btn--on" onClick={() => answer("done")}>
                  {T("Xong rồi", "Done")}
                </button>
                <button type="button" className="w-study__btn" onClick={() => answer("part")}>
                  {T("Một phần", "Partly")}
                </button>
                <button type="button" className="w-study__btn" onClick={() => answer("no")}>
                  {T("Chưa", "Not yet")}
                </button>
              </div>
              <p className="w-study__muted mt-2">{T("Mẹo nhớ lâu: cuối phiên tự giải lại một bài mà không nhìn lời giải.", "Tip: end by solving one problem from memory, then check.")}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
