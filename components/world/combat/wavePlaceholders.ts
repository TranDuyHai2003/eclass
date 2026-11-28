"use client";
/**
 * Mô hình tạm (thủ tục) cho Giáo Sin + Khiên Con lắc — dùng khi weapons.glb chưa có node `w_lance` / `w_shield`.
 * Dựng đúng quy ước của bản Blender sẽ thay (xem PLAN.md T22): đơn vị mét, gốc ở chỗ tay nắm / chuôi, trục cán +Y,
 * vật liệu đặt tên (phần phát sáng `glow_*`), node con được hoạt hoạ: `pend_pivot` → `chain` (dài 1 m theo −Y, co giãn theo L)
 * + `bob` (đặt ở y = −L). userData.metric = true → useWeaponModel KHÔNG chuẩn hoá kích thước (giữ mét thật).
 */
import * as THREE from "three";

const std = (name: string, color: string, metal = 0.2, rough = 0.6) => {
  const m = new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough });
  m.name = name;
  return m;
};

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, name: string): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.name = name;
  return m;
}

/** Giáo Sin: cán 1,5 m, quấn tay cầm, vành chắn, lưỡi uốn theo đúng một bước sóng sin, mũi nhọn; dải sóng phát sáng dọc cán */
export function buildLance(): THREE.Object3D {
  const root = new THREE.Group();
  root.name = "w_lance";
  root.userData.metric = true;
  const shaftM = std("lance_shaft", "#2b3a5c", 0.5, 0.4);
  const gripM = std("lance_grip", "#5a3a2a", 0, 0.9);
  const metalM = std("lance_metal", "#cfdcec", 0.9, 0.25);
  const glowM = std("glow_wave", "#7ad8ff");
  // cán (trục +Y từ chuôi)
  const shaft = mesh(new THREE.CylinderGeometry(0.022, 0.026, 1.5, 10), shaftM, "shaft");
  shaft.position.y = 0.75;
  const grip = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.34, 10), gripM, "grip");
  grip.position.y = 0.6;
  const pommel = mesh(new THREE.SphereGeometry(0.04, 12, 8), metalM, "pommel");
  const guard = mesh(new THREE.TorusGeometry(0.06, 0.015, 8, 20), metalM, "guard");
  guard.position.y = 1.5;
  guard.rotation.x = Math.PI / 2;
  // lưỡi: ống nhỏ uốn theo x = 0,035·sin(2π·u), u ∈ [0, 1] trên 0,36 m
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24;
    pts.push(new THREE.Vector3(0.035 * Math.sin(Math.PI * 2 * u), 1.5 + 0.36 * u, 0));
  }
  const blade = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.022, 8), metalM, "blade");
  const tip = mesh(new THREE.ConeGeometry(0.03, 0.14, 10), metalM, "tip");
  tip.position.y = 1.93;
  // dải sóng sáng quấn quanh nửa trên cán (đọc được từ xa: "đây là vũ khí sóng")
  const gp: THREE.Vector3[] = [];
  for (let i = 0; i <= 64; i++) {
    const u = i / 64;
    gp.push(new THREE.Vector3(0.034 * Math.cos(u * Math.PI * 6), 0.85 + 0.6 * u, 0.034 * Math.sin(u * Math.PI * 6)));
  }
  const glow = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(gp), 96, 0.007, 5), glowM, "glow_coil");
  const edge = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => p.clone().setZ(0.012))), 48, 0.006, 5), glowM, "glow_edge");
  // mốc vệt chém (WeaponTrail / Hub trailEdge)
  const t = new THREE.Object3D();
  t.name = "__tip";
  t.position.y = 2.0;
  const b = new THREE.Object3D();
  b.name = "__base";
  b.position.y = 1.25;
  root.add(shaft, grip, pommel, guard, blade, tip, glow, edge, t, b);
  return root;
}

/** Khiên Con lắc: vòng nắm ở gốc, `pend_pivot` (xoay theo trọng lực mỗi khung), `chain` 1 m theo −Y, `bob` = đĩa khiên */
export function buildShield(): THREE.Object3D {
  const root = new THREE.Group();
  root.name = "w_shield";
  root.userData.metric = true;
  const metalM = std("shield_metal", "#d9c9a0", 0.85, 0.3);
  const chainM = std("shield_chain", "#8a8f9c", 0.9, 0.35);
  const faceM = std("shield_face", "#b8742e", 0.6, 0.45);
  const glowM = std("glow_bob", "#ffc86b");
  const handle = mesh(new THREE.TorusGeometry(0.045, 0.012, 8, 18), metalM, "handle");
  const pivot = new THREE.Group();
  pivot.name = "pend_pivot";
  // dây: hình trụ cao 1 m, đỉnh ở gốc, chạy xuống −Y (code co giãn scale.y = L)
  const chainGeo = new THREE.CylinderGeometry(0.008, 0.008, 1, 6);
  chainGeo.translate(0, -0.5, 0);
  const chain = mesh(chainGeo, chainM, "chain");
  // các mắt xích sáng nhỏ dọc dây (để thấy dây dài / ngắn)
  for (let i = 1; i < 6; i++) {
    const link = mesh(new THREE.TorusGeometry(0.014, 0.004, 5, 10), chainM, `link${i}`);
    link.position.y = -i / 6;
    link.rotation.y = (i % 2) * (Math.PI / 2);
    chain.add(link);
  }
  // quả lắc = đĩa khiên mặt hướng ra trước (+Z), tâm ở gốc của bob
  const bob = new THREE.Group();
  bob.name = "bob";
  bob.position.y = -0.4;
  const disc = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 28), faceM, "bob_disc");
  disc.rotation.x = Math.PI / 2;
  const rim = mesh(new THREE.TorusGeometry(0.22, 0.018, 8, 32), metalM, "bob_rim");
  const boss = mesh(new THREE.SphereGeometry(0.05, 14, 10), glowM, "glow_boss");
  boss.position.z = 0.03;
  // vạch chia góc trên mặt khiên (phát sáng) — gợi "mặt đồng hồ" con lắc
  const tick = new THREE.BoxGeometry(0.012, 0.05, 0.01);
  for (let i = 0; i < 12; i++) {
    const tk = mesh(tick, glowM, `glow_tick${i}`);
    const a = (i / 12) * Math.PI * 2;
    tk.position.set(Math.sin(a) * 0.16, Math.cos(a) * 0.16, 0.03);
    tk.rotation.z = -a;
    bob.add(tk);
  }
  const top = new THREE.Object3D();
  top.name = "__tip";
  top.position.y = -0.22;
  bob.add(disc, rim, boss, top);
  pivot.add(chain, bob);
  const base = new THREE.Object3D();
  base.name = "__base";
  pivot.add(base);
  root.add(handle, pivot);
  return root;
}

export function buildPlaceholder(id: string): THREE.Object3D | null {
  if (id === "lance") return buildLance();
  if (id === "shield") return buildShield();
  return null;
}
