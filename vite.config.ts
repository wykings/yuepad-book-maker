import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 3000,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
    rollupOptions: {
      input: {
        main: `${root}index.html`,
        en: `${root}en/index.html`,
        "zh-cn": `${root}zh-cn/index.html`,
        "zh-tw": `${root}zh-tw/index.html`,
      },
    },
  },
});
