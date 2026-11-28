"use client";
/**
 * Texture nén KTX2 (Basis Universal) cho mọi đường tải GLTF / VRM: MỘT KTX2Loader dùng chung, detectSupport(gl) một lần
 * (gọi installKtx2 trong onCreated của Canvas). Bộ giải mã wasm ở public/world/basis/ (chép từ three bằng
 * `node scripts/ktx2-convert.mjs --transcoder`; nâng three thì chép lại).
 * - GLTFLoader của three VÀ của three-stdlib (drei useGLTF dùng bản này — một thể hiện chung do R3F giữ) được móc ở parse():
 *   loader chưa có KTX2Loader thì gắn bản chung → mọi useGLTF / new GLTFLoader() đọc được KHR_texture_basisu, không phải sửa
 *   từng chỗ gọi. withKtx2(loader) dùng cho extendLoader của useGLTF nếu muốn gắn tường minh.
 * - loadWithKtx2(loader, url): asset có bản KTX2 (lib/world/ktx2.ts) → tải bản đó; hỏng (máy không giải mã được, kho asset chưa
 *   có file) → tải bản gốc và từ đó cả phiên chỉ dùng bản gốc.
 */
import type { WebGLRenderer } from "three";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLTFLoader as StdGLTFLoader } from "three-stdlib";
import { WORLD_ASSET_BASE } from "@/lib/world/avatars";
import { ktx2Url } from "@/lib/world/ktx2";

let shared: KTX2Loader | null = null;
let resolveReady: (k: KTX2Loader | null) => void = () => {};
const ready = new Promise<KTX2Loader | null>((r) => (resolveReady = r));
/** bản KTX2 từng hỏng trong phiên này → không thử nữa */
let broken = false;

type HasKtx2 = { ktx2Loader: unknown; setKTX2Loader: (l: KTX2Loader) => unknown; parse: (...a: never[]) => unknown };
function hook(proto: HasKtx2) {
  const parse = proto.parse as (...a: unknown[]) => unknown;
  if ((parse as { ktx2Hooked?: boolean }).ktx2Hooked) return;
  const wrapped = function (this: HasKtx2, ...a: unknown[]) {
    if (!this.ktx2Loader && shared) this.setKTX2Loader(shared);
    return parse.apply(this, a);
  };
  (wrapped as { ktx2Hooked?: boolean }).ktx2Hooked = true;
  proto.parse = wrapped as HasKtx2["parse"];
}

export function installKtx2(gl: WebGLRenderer) {
  if (shared) return shared;
  try {
    shared = new KTX2Loader().setTranscoderPath(`${WORLD_ASSET_BASE}/basis/`).detectSupport(gl);
    hook(GLTFLoader.prototype as unknown as HasKtx2);
    hook(StdGLTFLoader.prototype as unknown as HasKtx2);
  } catch (e) {
    console.warn("[world] KTX2 không dùng được — tải texture gốc", e);
    shared = null;
    broken = true;
  }
  resolveReady(shared);
  return shared;
}

/** extendLoader cho useGLTF / gắn vào GLTFLoader tự tạo */
export function withKtx2<T extends { setKTX2Loader: (l: KTX2Loader) => unknown }>(loader: T): T {
  if (shared) loader.setKTX2Loader(shared);
  return loader;
}

/** Tải GLTF / VRM, ưu tiên bản KTX2 nếu có; chờ Canvas khởi tạo KTX2 tối đa 3 s rồi tải bản gốc */
export async function loadWithKtx2(loader: GLTFLoader, url: string): Promise<GLTF> {
  const alt = broken ? null : ktx2Url(url);
  if (!alt) return loader.loadAsync(url);
  const k = await Promise.race([ready, new Promise<null>((r) => setTimeout(() => r(null), 3000))]);
  if (!k) return loader.loadAsync(url);
  loader.setKTX2Loader(k);
  try {
    return await loader.loadAsync(alt);
  } catch (e) {
    broken = true;
    console.warn("[world] bản KTX2 hỏng / chưa có — tải bản gốc", alt, e);
    return loader.loadAsync(url);
  }
}
