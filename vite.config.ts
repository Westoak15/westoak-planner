import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
export default defineConfig({
  root: "client",
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": { target: "http://localhost:5000", changeOrigin: true } } },
  build: { outDir: "../dist/client", emptyOutDir: true },
});
