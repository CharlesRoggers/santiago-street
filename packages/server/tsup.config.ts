import { defineConfig } from "tsup";

/** Bundles the server (and @ss/shared) into a single ESM file for Node. */
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  target: "node22",
  platform: "node",
  sourcemap: true,
  clean: true,
  noExternal: ["@ss/shared"],
  esbuildOptions(o) { o.alias = { "@ss/shared": "../shared/src/index.ts" }; }
});
