import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@ss/shared": fileURLToPath(new URL("../shared/src/index.ts", import.meta.url))
    }
  },
  server: { port: 5173 },
  build: {
    target: "es2022",
    sourcemap: true
  },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Santiago Street",
        short_name: "SantiagoSt",
        description: "Fútbol callejero 3v3 en una ciudad viva.",
        lang: "es",
        display: "fullscreen",
        orientation: "landscape",
        background_color: "#0b0d12",
        theme_color: "#0b0d12",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"]
      }
    })
  ]
});
