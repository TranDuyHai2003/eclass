import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "react-hooks/set-state-in-effect": "off"
    }
  },
  {
    // Three.js / React Three Fiber: vật liệu, uniform, ref được cập nhật mỗi khung hình trong useFrame — đó là cách R3F hoạt động,
    // không phải state React. Rule bất biến của React Compiler không áp dụng cho các đối tượng three này.
    files: ["components/world/fx/**", "components/world/scene/**", "components/world/vault/**", "components/world/player/**", "components/world/combat/**", "components/world/WorldClient.tsx"],
    rules: { "react-hooks/immutability": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Custom ignores:
    "public/pdf.worker.min.mjs",
    "scripts/**",
    "_backup/**"
  ]),
]);

export default eslintConfig;
