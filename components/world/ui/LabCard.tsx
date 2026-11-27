"use client";
/**
 * Thẻ điều khiển phòng thí nghiệm vũ trụ (Thế giới Bất Khả): nằm bên phải, KHÔNG che cảnh — mô phỏng chạy ngay trên kỳ quan.
 * Mỗi thí nghiệm: câu chuyện ngắn → điều khiển (thanh trượt / nút) → số liệu sống → câu hỏi "Thử nghĩ".
 */
import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FlaskConical, RotateCcw, X } from "lucide-react";
import { GOLDEN_ANGLE, sierpinskiStats } from "@/lib/world/cosmosLab";
import { useWorld } from "../store";
import { closeLab, patchLab, useLab, type HopfMode } from "../lab";
import { LAB_TITLES } from "../scene/CosmosLab";

export function LabCard() {
  const id = useLab((s) => s.id);
  const vi = useWorld((s) => s.lang === "vi");
  return (
    <AnimatePresence>
      {id && (
        <motion.aside key={id} className="w-lab pointer-events-auto" initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} transition={{ type: "spring", stiffness: 340, damping: 32 }}>
          <header className="w-lab__head">
            <FlaskConical size={16} />
            <span>{LAB_TITLES[id][vi ? "vi" : "en"]}</span>
            <button type="button" aria-label="close" onClick={closeLab}>
              <X size={16} />
            </button>
          </header>
          <div className="w-lab__body">
            {id === "lorenz" && <Lorenz vi={vi} />}
            {id === "fib" && <Fib vi={vi} />}
            {id === "hopf" && <Hopf vi={vi} />}
            {id === "knot" && <Knot vi={vi} />}
            {id === "sierp" && <Sierp vi={vi} />}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function Think({ children }: { children: React.ReactNode }) {
  return <p className="w-lab__think">{children}</p>;
}
const sci = (x: number) => (x === 0 ? "0" : x >= 0.01 ? x.toFixed(x < 10 ? 3 : 1) : x.toExponential(1).replace("e", "·10^"));

function Lorenz({ vi }: { vi: boolean }) {
  const L = useLab((s) => s.lorenz);
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const g = c.getContext("2d");
    if (!g) return;
    const W = c.width;
    const H = c.height;
    g.clearRect(0, 0, W, H);
    // thang log: 10⁻¹⁰ … 10²
    const y = (v: number) => H - ((v + 10) / 12) * H;
    g.strokeStyle = "rgba(200,190,255,.18)";
    g.lineWidth = 1;
    for (let e = -10; e <= 2; e += 2) {
      g.beginPath();
      g.moveTo(0, y(e));
      g.lineTo(W, y(e));
      g.stroke();
    }
    g.strokeStyle = "#ffd27a";
    g.lineWidth = 2;
    g.beginPath();
    L.hist.forEach((v, i) => {
      const x = (i / 159) * W;
      if (i) g.lineTo(x, y(v));
      else g.moveTo(x, y(v));
    });
    g.stroke();
  }, [L.hist]);
  return (
    <>
      <p>
        {vi
          ? "Hai hạt sáng (vàng, xanh ngọc) xuất phát gần như cùng một chỗ — chỉ lệch ε. Cùng một định luật, không có gì ngẫu nhiên. Hãy xem chúng bám nhau được bao lâu."
          : "Two glowing particles (gold, mint) start almost at the same spot — only ε apart. Same law, nothing random. Watch how long they stay together."}
      </p>
      <label className="w-lab__row">
        <span>ε = {L.eps.toExponential(0).replace("e", "·10^")}</span>
        <input type="range" min={-9} max={-1} step={1} value={Math.round(Math.log10(L.eps))} onChange={(e) => patchLab("lorenz", { eps: 10 ** Number(e.target.value), seed: L.seed + 1 })} />
      </label>
      <button type="button" className="w-lab__btn" onClick={() => patchLab("lorenz", { seed: L.seed + 1 })}>
        <RotateCcw size={14} /> {vi ? "Thả lại" : "Release again"}
      </button>
      <div className="w-lab__stat">
        <span>t = {L.t.toFixed(1)}</span>
        <span>
          {vi ? "khoảng cách" : "distance"} = <b>{sci(L.dist)}</b>
        </span>
      </div>
      <canvas ref={cv} width={300} height={90} className="w-lab__chart" />
      <small className="w-lab__note">{vi ? "Trục dọc thang log (mỗi vạch ×100): khoảng cách tăng theo hàm mũ rồi bão hoà bằng cỡ cánh bướm." : "Log scale (each line ×100): the gap grows exponentially, then saturates at the size of the butterfly."}</small>
      <Think>{vi ? "Thử nghĩ: giảm ε đi 1000 lần thì dự báo được lâu hơn bao nhiêu? Vì sao dự báo thời tiết quá 2 tuần gần như không thể?" : "Think: make ε 1000× smaller — how much longer can you predict? Why is weather beyond two weeks nearly unforecastable?"}</Think>
    </>
  );
}

function Fib({ vi }: { vi: boolean }) {
  const F = useLab((s) => s.fib);
  const presets: [string, number][] = [
    [vi ? "Góc vàng" : "Golden", GOLDEN_ANGLE],
    ["137°", 137],
    ["138°", 138],
    ["135° = ⅜", 135],
    ["144° = ⅖", 144],
    ["90°", 90],
  ];
  return (
    <>
      <p>
        {vi
          ? "Mỗi hạt mới mọc ra ở tâm, xoay đi một góc α so với hạt trước rồi bị đẩy ra ngoài. Góc nào cho hoa nhiều hạt nhất, không chừa khe?"
          : "Each new seed appears at the centre, turned by an angle α from the previous one, then pushed outward. Which angle packs the most seeds with no gaps?"}
      </p>
      <label className="w-lab__row">
        <span>
          α = <b>{F.angle.toFixed(2)}°</b>
        </span>
        <input type="range" min={120} max={150} step={0.01} value={F.angle} onChange={(e) => patchLab("fib", { angle: Number(e.target.value) })} />
      </label>
      <div className="w-lab__chips">
        {presets.map(([l, a]) => (
          <button key={l} type="button" className={Math.abs(F.angle - a) < 0.005 ? "is-on" : ""} onClick={() => patchLab("fib", { angle: a, seed: F.seed + 1 })}>
            {l}
          </button>
        ))}
      </div>
      <div className="w-lab__chips">
        <span>{vi ? "Tô họ xoắn:" : "Highlight spirals:"}</span>
        {[0, 8, 13, 21, 34].map((f) => (
          <button key={f} type="button" className={F.fam === f ? "is-on" : ""} onClick={() => patchLab("fib", { fam: f })}>
            {f || (vi ? "Không" : "None")}
          </button>
        ))}
      </div>
      <small className="w-lab__note">
        {vi
          ? "Góc vàng = 360°/φ² — φ là số \"vô tỉ nhất\": không phân số nào xấp xỉ tốt, nên hạt không bao giờ xếp thẳng hàng. Góc hữu tỉ p/q vòng → q tia thẳng, phí chỗ."
          : "Golden angle = 360°/φ² — φ is the \"most irrational\" number: no fraction approximates it well, so seeds never line up. A rational p/q turn → q straight spokes, wasted space."}
      </small>
      <Think>{vi ? "Thử nghĩ: đếm số đường xoắn theo mỗi chiều trên hoa hướng dương thật — vì sao luôn là hai số Fibonacci liền nhau?" : "Think: count the spirals each way on a real sunflower — why are they always two consecutive Fibonacci numbers?"}</Think>
    </>
  );
}

function Hopf({ vi }: { vi: boolean }) {
  const H = useLab((s) => s.hopf);
  const modes: [HopfMode, string][] = [
    ["point", vi ? "Một điểm" : "One point"],
    ["circle", vi ? "Một vĩ tuyến" : "A latitude"],
    ["two", vi ? "Hai điểm" : "Two points"],
  ];
  return (
    <>
      <p>
        {vi
          ? "Quả cầu nhỏ là mặt cầu S². Khối vòng tròn khổng lồ là S³ — mặt cầu 3 chiều, chiếu xuống không gian ta sống. Mỗi điểm trên quả cầu nhỏ ứng với đúng MỘT vòng tròn sáng."
          : "The small globe is the sphere S². The giant bundle of circles is S³ — the 3-sphere, projected into our space. Every point of the small globe corresponds to exactly ONE glowing circle."}
      </p>
      <div className="w-lab__chips">
        {modes.map(([m, l]) => (
          <button key={m} type="button" className={H.mode === m ? "is-on" : ""} onClick={() => patchLab("hopf", { mode: m })}>
            {l}
          </button>
        ))}
      </div>
      <label className="w-lab__row">
        <span>{vi ? "vĩ độ" : "latitude"}</span>
        <input type="range" min={0.15} max={2.6} step={0.01} value={H.eta} onChange={(e) => patchLab("hopf", { eta: Number(e.target.value), auto: false })} />
      </label>
      <label className="w-lab__row">
        <span>{vi ? "kinh độ" : "longitude"}</span>
        <input type="range" min={0} max={6.283} step={0.01} value={H.phi} onChange={(e) => patchLab("hopf", { phi: Number(e.target.value), auto: false })} />
      </label>
      <label className="w-lab__check">
        <input type="checkbox" checked={H.auto} onChange={(e) => patchLab("hopf", { auto: e.target.checked })} /> {vi ? "Cho điểm tự chạy" : "Let the point wander"}
      </label>
      <small className="w-lab__note">
        {H.mode === "circle"
          ? vi
            ? "Một vĩ tuyến (vòng tròn trên S²) ↦ cả một mặt xuyến (bánh donut) dệt bằng các vòng tròn — vòng nào cũng móc qua mọi vòng khác."
            : "A latitude (a circle on S²) ↦ a whole torus (doughnut) woven from circles — each one linked through every other."
          : H.mode === "two"
            ? vi
              ? "Hai điểm bất kỳ ↦ hai vòng tròn móc vào nhau như hai mắt xích — không thể tách rời mà không cắt."
              : "Any two points ↦ two circles linked like chain links — impossible to separate without cutting."
            : vi
              ? "Kéo điểm đi khắp quả cầu: vòng tròn tương ứng bay khắp không gian, lúc nhỏ lúc to, nhưng các vòng khác nhau không bao giờ cắt nhau."
              : "Drag the point around the globe: its circle sweeps through space, small then huge, yet distinct circles never intersect."}
      </small>
      <Think>{vi ? "Thử nghĩ: kéo điểm về cực nam — vì sao vòng tròn phình to ra vô hạn thành một đường thẳng?" : "Think: drag the point to the south pole — why does its circle blow up into an infinite straight line?"}</Think>
    </>
  );
}

function Knot({ vi }: { vi: boolean }) {
  const K = useLab((s) => s.knot);
  return (
    <>
      <p>
        {vi
          ? "Có cách nào kéo, xoắn (không cắt) để gỡ nút này thành một vòng tròn trơn không? Thử hàng giờ không được chưa phải là chứng minh. Toán học có một mẹo: tô màu."
          : "Can you pull and twist (no cutting) to turn this knot into a plain circle? Failing for hours is not a proof. Mathematics has a trick: colouring."}
      </p>
      <label className="w-lab__check">
        <input type="checkbox" checked={K.tricolor} onChange={(e) => patchLab("knot", { tricolor: e.target.checked, seed: K.seed + 1 })} /> {vi ? "Tô ba màu (cắt tại chỗ chui dưới)" : "Three-colour it (cut where it passes under)"}
      </label>
      <label className="w-lab__check">
        <input type="checkbox" checked={K.bead} onChange={(e) => patchLab("knot", { bead: e.target.checked })} /> {vi ? "Hạt sáng chạy dọc nút" : "Bead running along the knot"}
      </label>
      <small className="w-lab__note">
        {vi
          ? "Luật: ở mỗi chỗ giao, ba đoạn gặp nhau hoặc cùng màu, hoặc đủ cả ba màu. Kéo / xoắn kiểu gì luật đó vẫn giữ. Vòng tròn trơn chỉ tô được MỘT màu — nút ba lá tô được BA màu ⇒ không bao giờ gỡ thành vòng tròn."
          : "Rule: at every crossing the three strands are either all the same colour or all different. Any pulling / twisting preserves this. A plain circle can only get ONE colour — the trefoil takes THREE ⇒ it can never be untied."}
      </small>
      <Think>{vi ? "Thử nghĩ: nút số 8 (4 chỗ giao) không tô 3 màu được — vậy nó có gỡ được không? (Gợi ý: chứng cứ chỉ chạy một chiều!)" : "Think: the figure-eight knot (4 crossings) can't be 3-coloured — so can it be untied? (Hint: the proof only works one way!)"}</Think>
    </>
  );
}

function Sierp({ vi }: { vi: boolean }) {
  const lv = useLab((s) => s.sierp.level);
  const s = sierpinskiStats(lv);
  return (
    <>
      <p>
        {vi
          ? "Lấy một khối tứ diện. Nối trung điểm các cạnh, giữ 4 khối góc, bỏ lõi giữa. Lặp lại với từng khối con… mãi mãi."
          : "Take a tetrahedron. Join the midpoints of its edges, keep the 4 corner pieces, throw away the core. Repeat on every piece… forever."}
      </p>
      <label className="w-lab__row">
        <span>
          {vi ? "bậc" : "level"} <b>{lv}</b>
        </span>
        <input type="range" min={0} max={5} step={1} value={lv} onChange={(e) => patchLab("sierp", { level: Number(e.target.value) })} />
      </label>
      <table className="w-lab__table">
        <tbody>
          <tr>
            <td>{vi ? "Số khối" : "Pieces"}</td>
            <td>
              4<sup>{lv}</sup> = <b>{s.count}</b>
            </td>
          </tr>
          <tr>
            <td>{vi ? "Thể tích" : "Volume"}</td>
            <td>
              (½)<sup>{lv}</sup> = <b>{(s.volume * 100).toFixed(s.volume < 0.1 ? 2 : 0)}%</b>
            </td>
          </tr>
          <tr>
            <td>{vi ? "Diện tích mặt" : "Surface area"}</td>
            <td>
              <b>100%</b> {vi ? "(không đổi!)" : "(unchanged!)"}
            </td>
          </tr>
          <tr>
            <td>{vi ? "Chiều fractal" : "Fractal dimension"}</td>
            <td>
              log 4 / log 2 = <b>2</b>
            </td>
          </tr>
        </tbody>
      </table>
      <Think>{vi ? "Thử nghĩ: chia mãi thì thể tích về 0 mà diện tích vẫn y nguyên — vật thể cuối cùng là \"khối\" hay \"mặt\"? Vì sao chiều của nó đúng bằng 2?" : "Think: divide forever and the volume goes to 0 while the area stays — is the final object a \"solid\" or a \"surface\"? Why is its dimension exactly 2?"}</Think>
    </>
  );
}
