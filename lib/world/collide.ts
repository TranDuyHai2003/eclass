/**
 * Thoát kẹt: người chơi nằm TRONG vật cản (rơi / bay từ trên cao xuống lòng công trình, bị dịch chuyển vào tường…)
 * → điểm trống gần nhất: quét các vòng tròn đồng tâm bước 0,35 m (24 hướng, lệch pha mỗi vòng) tới maxR.
 */
export function nearestFree(blocked: (x: number, z: number, y: number) => boolean, x: number, z: number, y: number, maxR = 8): [number, number] | null {
  for (let r = 0.35; r <= maxR; r += 0.35)
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2 + r;
      const px = x + Math.cos(a) * r;
      const pz = z + Math.sin(a) * r;
      if (!blocked(px, pz, y)) return [px, pz];
    }
  return null;
}
