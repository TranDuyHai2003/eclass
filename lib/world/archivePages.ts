/**
 * "Hồi âm" — 5 trang ghi chép rách của một người thủ thư cũ, rải trên sàn hành lang Thư khố (vị trí: PAGES trong
 * archiveLayout.ts). Ghép lại là một chứng minh nhỏ: Thư khố vô tận luôn liên thông (đồ thị + bất biến + ngưỡng thấm).
 * Nhặt đủ 5 trang → mở Ghi chép thực địa "archivegraph" (lib/world/story.ts).
 */
import type { Lang } from "./i18n";

export const PAGE_TEXT: readonly Record<Lang, string>[] = [
  {
    vi: "Ngày thứ ba. Tôi đánh số các phòng như toạ độ (i, j). Mỗi phòng mở là một ĐỈNH; hai phòng mở sát vách nhau thì nối một CẠNH. Câu hỏi duy nhất còn lại: từ cửa sảnh, có đi tới được MỌI phòng mở không — tức là đồ thị này có liên thông không?",
    en: "Day three. I number the rooms like coordinates (i, j). Every open room is a VERTEX; two open rooms that share a wall get an EDGE. Only one question is left: from the hall door, can I reach EVERY open room — is this graph connected?",
  },
  {
    vi: "Người xây để lại một quy luật: hàng i hay cột j nào chia hết cho 3 thì luôn là hành lang, không bao giờ đóng. Các hành lang ấy cắt nhau thành một cái LƯỚI. Lưới thì liên thông: đi dọc một hàng rồi rẽ sang một cột là tới mọi giao điểm.",
    en: "The builders left a rule: any row i or column j divisible by 3 is a corridor and never closes. Those corridors cross into a GRID. A grid is connected: walk along a row, turn onto a column, and you reach every crossing.",
  },
  {
    vi: "Còn các phòng không nằm trên hành lang? Mỗi phòng như thế đều sát vách một ô hành lang (i hoặc i ± 1 chia hết cho 3). Nên mỗi phòng mở chỉ cách lưới đúng một bước. Lưới liên thông + mọi phòng bám vào lưới ⇒ cả Thư khố liên thông. QED — nếu như phòng chịu đứng yên.",
    en: "And the rooms off the corridors? Each one shares a wall with a corridor cell (i or i ± 1 is divisible by 3). So every open room is one step from the grid. Connected grid + every room hangs on it ⇒ the whole archive is connected. QED — if only the rooms would stay still.",
  },
  {
    vi: "Chúng KHÔNG đứng yên. Phòng sau lưng tôi đổi dạng mỗi khi tôi không nhìn. Nhưng tôi để ý: hành lang thì chưa bao giờ đổi. Chứng minh ở trang trước chỉ dựa vào hành lang — một BẤT BIẾN. Mọi thứ khác có thể chạy loạn; điều không đổi mới là thứ để bám vào.",
    en: "They do NOT stay still. The rooms behind me change whenever I look away. But the corridors never have. The proof on the last page only leans on the corridors — an INVARIANT. Everything else may shift; the thing that never changes is what you hold on to.",
  },
  {
    vi: "Nếu không có lưới hành lang thì sao? Giả sử mỗi phòng mở ngẫu nhiên với xác suất p. Dưới một ngưỡng — khoảng 0,593 trên lưới vuông — mọi vùng mở đều hữu hạn, sớm muộn gì cũng cụt. Trên ngưỡng, bỗng xuất hiện một đường đi vô tận. Đó là lý thuyết thấm. Thư khố gian lận để không ai bị nhốt. Tôi nghĩ… nó muốn chúng ta đi sâu hơn.",
    en: "What if there were no corridor grid? Say each room is open at random with probability p. Below a threshold — about 0.593 on a square grid — every open region is finite; sooner or later it dead-ends. Above it, an endless path suddenly appears. That is percolation. The archive cheats so that no one is ever trapped. I think… it wants us to go deeper.",
  },
];

const KEY = "world.archive.pages";
/** mặt nạ bit các trang đã nhặt (localStorage; lỗi / không có → 0) */
export function loadPages(): number {
  try {
    const v = Number(localStorage.getItem(KEY) ?? 0);
    return Number.isFinite(v) ? v & 31 : 0;
  } catch {
    return 0;
  }
}
export function savePages(mask: number) {
  try {
    localStorage.setItem(KEY, String(mask & 31));
  } catch {}
}
export const pageCount = (mask: number) => ((mask & 1) + ((mask >> 1) & 1) + ((mask >> 2) & 1) + ((mask >> 3) & 1) + ((mask >> 4) & 1)) as number;
