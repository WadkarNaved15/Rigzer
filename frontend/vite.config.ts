import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

export default defineConfig({
  define: {
    "process.env.IS_PREACT": JSON.stringify("true"),
  },

  plugins: [
    react(),
    svgr(), // ✅ Added SVG as React component support
  ],

  css: {
    postcss: "./postcss.config.js",
  },

  // 🧩 Fix worker & esbuild issues with @kixelated/hang
  optimizeDeps: {
    exclude: [
      "@kixelated/hang",
      "@ffmpeg/ffmpeg",
      "@ffmpeg/util",
    ],
  },

  worker: {
    format: "es", // ensures proper module workers
  },

  ssr: {
    noExternal: ["@kixelated/hang"], // bundle Hang’s internal workers correctly
  },

  build: {
    target: "esnext", // needed for WebTransport & AudioWorklet support
  },

  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
});