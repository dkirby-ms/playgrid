import { resolve } from "node:path";
import { defineConfig } from "vite";
import pkg from "./package.json";

export default defineConfig({
  resolve: {
    alias: {
      "@eschaton/shared": resolve(__dirname, "../shared/src/index.ts"),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    port: 3000,
  },
  build: {
    target: "es2022",
  },
});
