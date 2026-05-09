import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  root: "client",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5000,
    strictPort: true,
    allowedHosts: true,
    hmr: false,
    proxy: { "/api": { target: "http://localhost:8080", changeOrigin: true } },
  },
  build: {
    outDir: "../dist/client",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React — loads immediately
          "vendor-react":  ["react", "react-dom"],
          // Data fetching — loads on first query
          "vendor-query":  ["@tanstack/react-query"],
          // Charts — only loaded when a chart tab is visited
          "vendor-charts": ["recharts"],
          // Date utilities if present
          "vendor-date":   ["date-fns"],
        },
      },
    },
    // Raise warning threshold — after splitting, individual chunks should be under 500KB
    chunkSizeWarningLimit: 600,
  },
});
