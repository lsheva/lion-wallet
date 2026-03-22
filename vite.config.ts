import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [solid(), tailwindcss()],
  root: "src/popup",
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "src/shared"),
      "@": resolve(__dirname, "src/popup"),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  base: "./",
  build: {
    outDir: resolve(__dirname, "dist/popup"),
    emptyOutDir: true,
  },
});
