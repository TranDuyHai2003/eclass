import { test } from "node:test";
import assert from "node:assert/strict";
import { setHeavyAssetBase, worldAsset } from "@/lib/world/avatars";

test("model nặng (avatars/, anim/) đi qua kho riêng khi có WORLD_HEAVY_ASSET_BASE; asset khác giữ gốc cũ", () => {
  setHeavyAssetBase(null);
  assert.equal(worldAsset("avatars/savi.vrm"), "/world/avatars/savi.vrm");
  setHeavyAssetBase("https://cdn.example.test/world/");
  assert.equal(worldAsset("avatars/savi.vrm"), "https://cdn.example.test/world/avatars/savi.vrm");
  assert.equal(worldAsset("/anim/ual.glb"), "https://cdn.example.test/world/anim/ual.glb");
  assert.equal(worldAsset("props/hub_plaza.glb"), "/world/props/hub_plaza.glb");
  assert.equal(worldAsset("art/avatars-banner.webp"), "/world/art/avatars-banner.webp");
  setHeavyAssetBase("");
  assert.equal(worldAsset("anim/ual.glb"), "/world/anim/ual.glb");
});
