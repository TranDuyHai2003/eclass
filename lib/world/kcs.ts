/**
 * Catalog of the Math World — "Function Valley" zone (MVP). English first, Vietnamese translation.
 * KC = knowledge component (each KC is an Echo Creature). PLAN: docs/ai-reviews/game-3d/PLAN.md
 * Official discovery titles/statements live server-side only (lib/world/reveals.ts).
 */
import type { L } from "./i18n";

export const KC_IDS = [
  "kc.slope_sign",
  "kc.extremum_from_fprime",
  "kc.cubic_shape",
  "kc.extremum_value",
  "kc.minmax_interval",
] as const;
export type KcId = (typeof KC_IDS)[number];

export interface KcDef {
  id: KcId;
  name: L;
  /** Creature name (original design) */
  creature: L;
  color: string;
  blurb: L;
}

export const KCS: Record<KcId, KcDef> = {
  "kc.slope_sign": {
    id: "kc.slope_sign",
    name: { en: "Sign of f′ ⇒ increasing / decreasing", vi: "Dấu đạo hàm ⇒ đồng biến, nghịch biến" },
    creature: { en: "Slopewisp", vi: "Dốc Linh" },
    color: "#5ad1a8",
    blurb: { en: "f′ > 0: the path goes up; f′ < 0: it goes down.", vi: "f′ > 0 thì đường đi lên, f′ < 0 thì đi xuống." },
  },
  "kc.extremum_from_fprime": {
    id: "kc.extremum_from_fprime",
    name: { en: "Extrema where f′ changes sign", vi: "Cực trị khi f′ đổi dấu" },
    creature: { en: "Peakfox", vi: "Đỉnh Hồ" },
    color: "#ffb35c",
    blurb: { en: "Extrema sit where f′ changes sign — not everywhere f′ = 0.", vi: "Cực trị nằm ở nơi f′ đổi dấu — không phải mọi nơi f′ = 0." },
  },
  "kc.cubic_shape": {
    id: "kc.cubic_shape",
    name: { en: "Shape of a cubic from Δ′", vi: "Dáng đồ thị bậc ba theo Δ′" },
    creature: { en: "Twistwyrm", vi: "Xoắn Ảnh" },
    color: "#9b8cff",
    blurb: { en: "b² − 3ac > 0: two extrema; ≤ 0: none.", vi: "b² − 3ac > 0: hai cực trị; ≤ 0: không có cực trị." },
  },
  "kc.extremum_value": {
    id: "kc.extremum_value",
    name: { en: "Local max / min values", vi: "Giá trị cực đại, cực tiểu" },
    creature: { en: "Gemcrest", vi: "Ngọc Đỉnh" },
    color: "#ff7eb6",
    blurb: { en: "The extreme value is y; the extreme point is x.", vi: "Giá trị cực trị là y, điểm cực trị là x." },
  },
  "kc.minmax_interval": {
    id: "kc.minmax_interval",
    name: { en: "Max / min on a closed interval", vi: "GTLN, GTNN trên đoạn" },
    creature: { en: "Edgewarden", vi: "Vệ Biên" },
    color: "#62b6ff",
    blurb: { en: "Compare interior extrema with both endpoints.", vi: "So sánh cực trị bên trong đoạn với hai đầu mút." },
  },
};

export const DISCOVERY_IDS = ["D_STILLPOINT", "D_SLOPE_SIGN", "D_FLAT_NOT_PEAK"] as const;
export type DiscoveryId = (typeof DISCOVERY_IDS)[number];

export interface DiscoveryDef {
  id: DiscoveryId;
  /** Teaser shown before the discovery (never gives the answer away) */
  teaser: L;
  predictPrompt: L;
  predictOptions: { id: string; label: L }[];
  ability: { id: string; name: L; desc: L };
  /** KCs tamed when the discovery is confirmed */
  kcs: KcId[];
  /** Question family used to confirm */
  checkFamily: string;
  /** Hint ladder: observation → question → prediction → smaller case */
  hints: L[];
  requires: DiscoveryId[];
}

export const DISCOVERIES: Record<DiscoveryId, DiscoveryDef> = {
  D_STILLPOINT: {
    id: "D_STILLPOINT",
    teaser: { en: "Something special happens at the top of every hill and the bottom of every dip…", vi: "Có gì đó đặc biệt xảy ra trên đỉnh đồi và dưới đáy thung lũng…" },
    predictPrompt: { en: "When the rider stands exactly on a hilltop, what does the slope arrow do?", vi: "Khi người lướt đứng đúng trên đỉnh một ngọn đồi, mũi tên độ dốc sẽ thế nào?" },
    predictOptions: [
      { id: "up", label: { en: "Points steeply up", vi: "Chỉ lên rất dốc" } },
      { id: "flat", label: { en: "Lies flat", vi: "Nằm ngang" } },
      { id: "down", label: { en: "Points steeply down", vi: "Chỉ xuống rất dốc" } },
    ],
    ability: { id: "anchor", name: { en: "Grapple Anchor", vi: "Neo Móc" }, desc: { en: "Fire an anchor that grips points where the slope is zero.", vi: "Phóng neo bám vào những điểm có độ dốc bằng 0." } },
    kcs: ["kc.extremum_value", "kc.cubic_shape"],
    checkFamily: "disc.stillpoint",
    hints: [
      { en: "Watch the arrow under your feet as you ride over a hilltop.", vi: "Nhìn mũi tên dưới chân khi người lướt đi qua đỉnh đồi." },
      { en: "Just before the top the arrow points up, just after it points down. What about in between?", vi: "Ngay trước đỉnh mũi tên chỉ lên, ngay sau đỉnh nó chỉ xuống. Ở giữa thì sao?" },
      { en: "Ride very slowly across the top and watch the slope number.", vi: "Thử kéo người lướt thật chậm qua đỉnh và để ý số độ dốc." },
      { en: "For y = −x² + 1, what is the slope at x = 0?", vi: "Với y = −x² + 1, độ dốc tại x = 0 bằng bao nhiêu?" },
    ],
    requires: [],
  },
  D_SLOPE_SIGN: {
    id: "D_SLOPE_SIGN",
    teaser: { en: "The colour of the arrow under your feet seems to predict the road ahead…", vi: "Màu của mũi tên dưới chân dường như báo trước con đường…" },
    predictPrompt: { en: "If the slope number under your feet is positive, the rider is…", vi: "Nếu số độ dốc dưới chân đang dương, người lướt đang…" },
    predictOptions: [
      { id: "up", label: { en: "Going up (moving right)", vi: "Đi lên (khi đi sang phải)" } },
      { id: "down", label: { en: "Going down", vi: "Đi xuống" } },
      { id: "dep", label: { en: "Can't tell", vi: "Không biết được" } },
    ],
    ability: { id: "sense", name: { en: "Climb Sense", vi: "Cảm Biến Leo" }, desc: { en: "The track glows green where it rises and red where it falls.", vi: "Đường ray tô xanh nơi đi lên, đỏ nơi đi xuống." } },
    kcs: ["kc.slope_sign"],
    checkFamily: "disc.slope_sign",
    hints: [
      { en: "Watch the track colour and the slope number while climbing.", vi: "Để ý màu đường ray và số độ dốc khi người lướt leo lên." },
      { en: "When the path rises to the right, what sign does the slope have?", vi: "Khi đường đi lên sang phải, số độ dốc mang dấu gì?" },
      { en: "Predict: between two still points, does the path rise or fall?", vi: "Dự đoán: giữa hai điểm dừng, đường đi lên hay đi xuống?" },
      { en: "For y = x², the path rises right of x = 0; is f′(x) = 2x positive or negative there?", vi: "Với y = x², bên phải x = 0 đường đi lên; f′(x) = 2x ở đó dương hay âm?" },
    ],
    requires: ["D_STILLPOINT"],
  },
  D_FLAT_NOT_PEAK: {
    id: "D_FLAT_NOT_PEAK",
    teaser: { en: "There's a perfectly flat spot… yet the Grapple Anchor slips right off.", vi: "Có một chỗ phẳng lặng… nhưng Neo Móc lại trượt mất." },
    predictPrompt: { en: "The track y = x³ is flat at x = 0. Is that a peak or a dip?", vi: "Đường ray y = x³ có chỗ độ dốc bằng 0 tại x = 0. Đó có phải đỉnh hoặc đáy không?" },
    predictOptions: [
      { id: "peak", label: { en: "A peak", vi: "Là đỉnh" } },
      { id: "valley", label: { en: "A dip", vi: "Là đáy" } },
      { id: "neither", label: { en: "Neither", vi: "Không phải cả hai" } },
    ],
    ability: { id: "lens", name: { en: "Sign Lens", vi: "Kính Đổi Dấu" }, desc: { en: "Reveals light beams where f′ changes sign — where anchors hold.", vi: "Hiện vạch sáng ở nơi f′ đổi dấu — nơi Neo Móc bám chắc." } },
    kcs: ["kc.extremum_from_fprime", "kc.minmax_interval"],
    checkFamily: "disc.flat_not_peak",
    hints: [
      { en: "Fire the anchor at the flat spot — why does it slip?", vi: "Phóng Neo Móc vào chỗ phẳng — vì sao nó trượt?" },
      { en: "Just before and just after the flat spot, is the path rising or falling?", vi: "Ngay trước và ngay sau chỗ phẳng, đường đi lên hay đi xuống?" },
      { en: "Predict the sign of f′ on both sides of the flat spot.", vi: "Dự đoán dấu của f′ ở hai bên chỗ phẳng." },
      { en: "Compare y = x² and y = x³ around x = 0.", vi: "So sánh y = x² và y = x³ quanh x = 0." },
    ],
    requires: ["D_SLOPE_SIGN"],
  },
};

export interface Misconception {
  id: string;
  name: L;
  fix: L;
}

export const MISCONCEPTIONS: Record<string, Misconception> = {
  M_SIGN_FLIP: {
    id: "M_SIGN_FLIP",
    name: { en: "Flipped the sign of f′", vi: "Đảo dấu f′" },
    fix: { en: "Increasing means f′ > 0. Check the sign by plugging an x from the interval into f′.", vi: "Đồng biến ứng với f′ > 0. Kiểm tra dấu f′ bằng cách thay một giá trị x trong khoảng." },
  },
  M_ROOT_SIGN: {
    id: "M_ROOT_SIGN",
    name: { en: "Wrong sign of a root", vi: "Lấy nhầm dấu nghiệm" },
    fix: { en: "(x − p) = 0 gives x = p, not −p.", vi: "(x − p) = 0 cho nghiệm x = p, không phải −p." },
  },
  M_INTERVAL_OVERREACH: {
    id: "M_INTERVAL_OVERREACH",
    name: { en: "Interval runs past a sign change", vi: "Khoảng vượt qua điểm đổi dấu" },
    fix: { en: "A monotonic interval must stop at the root where f′ changes sign.", vi: "Khoảng đơn điệu phải dừng ở nghiệm của f′ nơi f′ đổi dấu." },
  },
  M_FPRIME_ZERO_IS_EXTREMUM: {
    id: "M_FPRIME_ZERO_IS_EXTREMUM",
    name: { en: "Assumed f′ = 0 means an extremum", vi: "Cho rằng f′ = 0 là có cực trị" },
    fix: { en: "A double (even-multiplicity) root of f′ doesn't change its sign ⇒ no extremum there.", vi: "Nghiệm kép (bội chẵn) của f′ không làm f′ đổi dấu ⇒ không phải điểm cực trị." },
  },
  M_COUNT_MULTIPLICITY: {
    id: "M_COUNT_MULTIPLICITY",
    name: { en: "Counted root multiplicities", vi: "Đếm cả bội của nghiệm" },
    fix: { en: "Number of extrema = number of distinct odd-multiplicity roots of f′.", vi: "Số điểm cực trị = số nghiệm bội lẻ phân biệt của f′." },
  },
  M_DELTA_WRONG: {
    id: "M_DELTA_WRONG",
    name: { en: "Used the wrong discriminant", vi: "Dùng nhầm biệt thức" },
    fix: { en: "Use f′ = 3ax² + 2bx + c: Δ′ = b² − 3ac (not b² − 4ac).", vi: "Xét f′ = 3ax² + 2bx + c: Δ′ = b² − 3ac (không phải b² − 4ac của f)." },
  },
  M_ODD_DEGREE: {
    id: "M_ODD_DEGREE",
    name: { en: "Thought a cubic always has 1 extremum", vi: "Nghĩ bậc ba luôn có 1 cực trị" },
    fix: { en: "A cubic has 0 or 2 extrema — never exactly 1.", vi: "Hàm bậc ba có 0 hoặc 2 điểm cực trị, không bao giờ đúng 1." },
  },
  M_X_NOT_POINT: {
    id: "M_X_NOT_POINT",
    name: { en: "Answered x instead of y", vi: "Trả lời x thay vì y" },
    fix: { en: "The local maximum value is y = f(x₀); the point of maximum is x₀.", vi: "Giá trị cực đại là y = f(x₀); điểm cực đại là x₀." },
  },
  M_MAX_MIN_SWAP: {
    id: "M_MAX_MIN_SWAP",
    name: { en: "Mixed up max and min", vi: "Nhầm cực đại với cực tiểu" },
    fix: { en: "Max: f′ goes from + to −; min: from − to +.", vi: "Cực đại: f′ đổi dấu từ + sang −; cực tiểu: từ − sang +." },
  },
  M_FORGOT_ENDPOINT: {
    id: "M_FORGOT_ENDPOINT",
    name: { en: "Forgot the endpoints", vi: "Quên xét đầu mút" },
    fix: { en: "On a closed interval compare the interior extrema AND both endpoints.", vi: "GTLN/GTNN trên đoạn: so sánh giá trị tại cực trị nằm trong đoạn VÀ tại hai đầu mút." },
  },
  M_F_VS_FPRIME: {
    id: "M_F_VS_FPRIME",
    name: { en: "Mixed up f and f′", vi: "Nhầm đồ thị f với f′" },
    fix: { en: "f′ is the SLOPE of f: it is zero at peaks and dips of f, positive where f climbs.", vi: "f′ là ĐỘ DỐC của f: bằng 0 tại đỉnh/đáy của f, dương ở nơi f đi lên." },
  },
  M_CRIT_OUTSIDE: {
    id: "M_CRIT_OUTSIDE",
    name: { en: "Used a critical point outside the interval", vi: "Dùng điểm tới hạn nằm ngoài đoạn" },
    fix: { en: "Only consider roots of f′ that lie inside the interval.", vi: "Chỉ xét nghiệm của f′ nằm trong đoạn đang xét." },
  },
};
