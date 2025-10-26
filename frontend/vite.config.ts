import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  define: {
    "process.env.IS_PREACT": JSON.stringify("true"),
  },
  plugins: [react()],

  css: {
    postcss: "./postcss.config.js",
  },

  // 🧩 Fix worker & esbuild issues with @kixelated/hang
  optimizeDeps: {
    exclude: ["@kixelated/hang"], // prevent pre-bundling breaking worker imports
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
});
