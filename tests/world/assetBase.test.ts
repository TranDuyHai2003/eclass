import { test } from "node:test";
import assert from "node:assert/strict";
import { setHeavyAssetBase, worldAsset } from "@/lib/world/avatars";

test("có WORLD_HEAVY_ASSET_BASE thì MỌI asset /world đi qua kho CDN; không có thì dùng /world của app", () => {
  setHeavyAssetBase(null);
  assert.equal(worldAsset("avatars/savi.vrm"), "/world/avatars/savi.vrm");
  assert.equal(worldAsset("props/hub_plaza.glb"), "/world/props/hub_plaza.glb");
  setHeavyAssetBase("https://cdn.example.test/world/");
  assert.equal(worldAsset("avatars/savi.vrm"), "https://cdn.example.test/world/avatars/savi.vrm");
  assert.equal(worldAsset("/anim/ual.glb"), "https://cdn.example.test/world/anim/ual.glb");
  assert.equal(worldAsset("props/hub_plaza.glb"), "https://cdn.example.test/world/props/hub_plaza.glb");
  assert.equal(worldAsset("audio/hubDay_bed.ogg"), "https://cdn.example.test/world/audio/hubDay_bed.ogg");
  // đường dẫn cũ có sẵn tiền tố /world/ không bị lặp
  assert.equal(worldAsset("/world/voxel/tiles.png"), "https://cdn.example.test/world/voxel/tiles.png");
  assert.equal(worldAsset("basis/"), "https://cdn.example.test/world/basis/");
  setHeavyAssetBase("");
  assert.equal(worldAsset("anim/ual.glb"), "/world/anim/ual.glb");
});
