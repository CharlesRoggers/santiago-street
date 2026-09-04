import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@ss/shared": fileURLToPath(new URL("../shared/src/index.ts", import.meta.url)) }
  },
  test: { globals: true, include: ["src/**/*.test.ts"] }
});
