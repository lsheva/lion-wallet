import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [preact(), tailwindcss()],
  root: "src/popup",
  resolve: {
    alias: {
      "@": resolve(__dirname, "src/popup"),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: resolve(__dirname, "dist/popup"),
    emptyOutDir: true,
  },
});
