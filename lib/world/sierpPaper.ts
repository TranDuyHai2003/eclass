/**
 * Tam giác Sierpiński bằng GIẤY (đảo Sierpiński, Thế giới Bất Khả) — thuần, không three:
 *  cấp n giữ lại 3ⁿ tam giác cạnh S / 2ⁿ; đi từ cấp n − 1 lên n "bóc" 3ⁿ⁻¹ tam giác ngược ở giữa mỗi tam giác cũ.
 *  Diện tích còn lại (3/4)ⁿ, chu vi tổng (3/2)ⁿ × chu vi ban đầu → diện tích → 0 nhưng chu vi → ∞.
 * Toạ độ phẳng (x ngang, y đứng), tam giác đều đỉnh hướng lên, gốc ở trung điểm cạnh đáy của tam giác lớn.
 */
export type Tri = { x: number; y: number; s: number; up: boolean };

/** tam giác đều cạnh s, tâm (x, y) (trọng tâm), đỉnh lên / xuống → 3 đỉnh */
export function triVerts(t: Tri): [number, number][] {
  const h = (t.s * Math.sqrt(3)) / 2;
  const k = t.up ? 1 : -1;
  return [
    [t.x - t.s / 2, t.y - (k * h) / 3],
    [t.x + t.s / 2, t.y - (k * h) / 3],
    [t.x, t.y + (k * 2 * h) / 3],
  ];
}

/** tam giác còn giữ ở cấp n (cạnh lớn S) */
export function keptAt(S: number, n: number): Tri[] {
  const h = (S * Math.sqrt(3)) / 2;
  let list: Tri[] = [{ x: 0, y: h / 3, s: S, up: true }];
  for (let k = 0; k < n; k++) {
    const next: Tri[] = [];
    for (const t of list) {
      const s = t.s / 2;
      const hh = (s * Math.sqrt(3)) / 2;
      // 3 góc: trái dưới, phải dưới, đỉnh
      next.push({ x: t.x - s / 2, y: t.y - hh / 3, s, up: true });
      next.push({ x: t.x + s / 2, y: t.y - hh / 3, s, up: true });
      next.push({ x: t.x, y: t.y + (2 * hh) / 3, s, up: true });
    }
    list = next;
  }
  return list;
}

/** tam giác (ngược) bị bóc khi đi từ cấp n − 1 lên cấp n: tâm trùng tâm tam giác cũ, cạnh bằng nửa */
export function peeledAt(S: number, n: number): Tri[] {
  if (n <= 0) return [];
  return keptAt(S, n - 1).map((t) => ({ x: t.x, y: t.y, s: t.s / 2, up: false }));
}

export function stats(n: number) {
  return { count: 3 ** n, area: (3 / 4) ** n, perimeter: (3 / 2) ** n, peeled: n > 0 ? 3 ** (n - 1) : 0 };
}
