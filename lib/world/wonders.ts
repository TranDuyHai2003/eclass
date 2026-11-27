/**
 * Mathematical Wonders — curiosity layer beyond the curriculum (university & modern mathematics).
 * Not exam content: short, true stories that make students ask "wait, how is that possible?".
 */
import type { L } from "./i18n";

export const WONDER_IDS = ["tesseract", "klein", "lorenz", "poincare", "blackhole"] as const;
export type WonderId = (typeof WONDER_IDS)[number];

export interface WonderDef {
  id: WonderId;
  name: L;
  /** One-line hook shown first */
  hook: L;
  /** The story (2–4 sentences) */
  story: L;
  /** A question to wonder about */
  question: L;
  /** Where it shows up in culture / research */
  seeAlso: L;
  level: L;
  color: string;
}

export const WONDERS: Record<WonderId, WonderDef> = {
  tesseract: {
    id: "tesseract",
    name: { en: "The Tesseract", vi: "Siêu lập phương (Tesseract)" },
    hook: { en: "A cube's shadow… from the fourth dimension.", vi: "Cái bóng của một khối lập phương… từ chiều thứ tư." },
    story: {
      en: "A square has 4 vertices, a cube 8. Keep doubling: the 4-dimensional hypercube has 16 vertices, 32 edges, 24 square faces and 8 cubic cells. What you see is its 3D projection rotating in a plane that contains the hidden w-axis — that's why cubes seem to turn inside out.",
      vi: "Hình vuông có 4 đỉnh, lập phương có 8. Cứ nhân đôi: siêu lập phương 4 chiều có 16 đỉnh, 32 cạnh, 24 mặt vuông và 8 khối lập phương. Thứ em thấy là hình chiếu 3D của nó đang quay trong một mặt phẳng chứa trục w bị ẩn — vì thế các khối lập phương như lộn trong ra ngoài.",
    },
    question: { en: "How many vertices would a 5-dimensional cube have? Can you find the rule for edges?", vi: "Lập phương 5 chiều có bao nhiêu đỉnh? Em tìm được quy luật cho số cạnh không?" },
    seeAlso: {
      en: "Edwin Abbott's novella “Flatland” (1884) imagines a 2D world meeting a 3D sphere; Greg Egan's novel “Diaspora” sends its characters into a universe with more spatial dimensions.",
      vi: "Truyện “Flatland” (Edwin Abbott, 1884) kể về thế giới 2 chiều gặp một quả cầu 3 chiều; tiểu thuyết “Diaspora” của Greg Egan đưa nhân vật vào vũ trụ có nhiều chiều không gian hơn.",
    },
    level: { en: "Linear algebra · geometry of ℝⁿ", vi: "Đại số tuyến tính · hình học ℝⁿ" },
    color: "#7fe3ff",
  },
  klein: {
    id: "klein",
    name: { en: "The Klein Bottle", vi: "Chai Klein" },
    hook: { en: "A bottle with no inside and no outside.", vi: "Một cái chai không có bên trong, cũng chẳng có bên ngoài." },
    story: {
      en: "Glue two Möbius strips along their edges and you get a closed surface with only one side. In our 3D world it must pass through itself, but in 4D it fits without any self-intersection. Felix Klein described it in 1882.",
      vi: "Dán hai dải Möbius theo mép, em được một mặt kín chỉ có một phía. Trong không gian 3 chiều nó buộc phải xuyên qua chính mình, nhưng trong 4 chiều thì nằm gọn không tự cắt. Felix Klein mô tả nó năm 1882.",
    },
    question: { en: "An ant walks on it without crossing an edge. Can it reach the “other side” of where it started?", vi: "Một con kiến bò trên đó, không vượt qua mép nào. Nó có tới được “mặt bên kia” chỗ nó xuất phát không?" },
    seeAlso: { en: "Topology — the study of shapes that survive stretching and bending.", vi: "Tô-pô học — môn nghiên cứu hình dạng không đổi khi kéo giãn, uốn cong." },
    level: { en: "Topology", vi: "Tô-pô" },
    color: "#c39bff",
  },
  lorenz: {
    id: "lorenz",
    name: { en: "The Lorenz Butterfly", vi: "Cánh bướm Lorenz" },
    hook: { en: "Three simple equations that can never be predicted for long.", vi: "Ba phương trình đơn giản mà không thể dự đoán lâu dài." },
    story: {
      en: "In 1963 meteorologist Edward Lorenz studied x′ = σ(y − x), y′ = x(ρ − z) − y, z′ = xy − βz. With σ = 10, ρ = 28, β = 8/3 the path loops forever around two wings, never repeating — and two starting points closer than an atom drift completely apart. This is chaos.",
      vi: "Năm 1963, nhà khí tượng Edward Lorenz nghiên cứu x′ = σ(y − x), y′ = x(ρ − z) − y, z′ = xy − βz. Với σ = 10, ρ = 28, β = 8/3, quỹ đạo lượn mãi quanh hai cánh mà không bao giờ lặp lại — và hai điểm xuất phát gần nhau hơn một nguyên tử rồi cũng tách xa hẳn. Đó là hỗn loạn.",
    },
    question: { en: "Each equation uses only + − × — so where does the unpredictability come from?", vi: "Mỗi phương trình chỉ có + − × — vậy sự khó đoán đến từ đâu?" },
    seeAlso: { en: "The “butterfly effect”; derivatives here are rates of change — the same f′ you met in the valley.", vi: "“Hiệu ứng cánh bướm”; đạo hàm ở đây là tốc độ thay đổi — chính là f′ em gặp trong thung lũng." },
    level: { en: "Differential equations · dynamical systems", vi: "Phương trình vi phân · hệ động lực" },
    color: "#ffb35c",
  },
  poincare: {
    id: "poincare",
    name: { en: "The Poincaré Disk", vi: "Đĩa Poincaré" },
    hook: { en: "An infinite world squeezed inside a circle.", vi: "Cả một thế giới vô hạn nằm gọn trong một hình tròn." },
    story: {
      en: "In hyperbolic geometry, through a point outside a line there are infinitely many parallels, and a triangle's angles add up to less than 180°. In this disk model every tile is the same size — they only look smaller near the rim, which is infinitely far away. M. C. Escher used it in his “Circle Limit” prints.",
      vi: "Trong hình học hyperbolic, qua một điểm ngoài đường thẳng có vô số đường song song, và tổng ba góc của tam giác nhỏ hơn 180°. Trong mô hình đĩa này mọi viên gạch đều to như nhau — chúng chỉ trông nhỏ dần ở mép, nơi xa vô tận. M. C. Escher dùng nó trong loạt tranh “Circle Limit”.",
    },
    question: { en: "Seven heptagons meet… no, three meet at each corner. Why can't you do that on a flat floor?", vi: "Ở mỗi đỉnh có ba hình bảy cạnh gặp nhau. Vì sao không làm được thế trên sàn phẳng?" },
    seeAlso: {
      en: "Games like HyperRogue and Hyperbolica let you walk in it; Greg Egan's “Orthogonal” novels change the geometry of space-time itself.",
      vi: "Các game như HyperRogue, Hyperbolica cho em đi dạo trong đó; bộ “Orthogonal” của Greg Egan thay đổi cả hình học của không–thời gian.",
    },
    level: { en: "Non-Euclidean geometry", vi: "Hình học phi Euclid" },
    color: "#ffd27a",
  },
  blackhole: {
    id: "blackhole",
    name: { en: "The Black Hole", vi: "Hố đen" },
    hook: { en: "Gravity so strong it bends light itself.", vi: "Hấp dẫn mạnh đến mức bẻ cong cả ánh sáng." },
    story: {
      en: "In Einstein's general relativity (1915), mass curves space-time and light follows the curves. Look at the sky behind it: it is stretched into rings — gravitational lensing. Light passing closer than 1.5 times the event-horizon radius gets trapped in orbit (the photon sphere); anything that crosses the horizon can never come back. In 2019 the Event Horizon Telescope photographed the shadow of the black hole M87*.",
      vi: "Trong thuyết tương đối rộng của Einstein (1915), khối lượng làm cong không–thời gian và ánh sáng đi theo đường cong đó. Nhìn bầu trời phía sau: nó bị kéo thành vòng — thấu kính hấp dẫn. Ánh sáng đi gần hơn 1,5 lần bán kính chân trời sự kiện sẽ bị giữ trên quỹ đạo (mặt cầu photon); thứ gì vượt qua chân trời thì không bao giờ quay lại. Năm 2019, Kính thiên văn Chân trời Sự kiện chụp được bóng của hố đen M87*.",
    },
    question: { en: "If light always takes the “straightest” path, how can it bend?", vi: "Nếu ánh sáng luôn đi đường “thẳng nhất”, làm sao nó bị bẻ cong?" },
    seeAlso: { en: "Geodesics — the curved-space version of straight lines; the same physics forces GPS satellites to correct their clocks.", vi: "Đường trắc địa — “đường thẳng” trong không gian cong; cũng là lý do đồng hồ vệ tinh GPS phải hiệu chỉnh." },
    level: { en: "Differential geometry · general relativity", vi: "Hình học vi phân · thuyết tương đối rộng" },
    color: "#ff9d5c",
  },
};
