import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        // Critical for SSE: disable proxy response buffering
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes) => {
            // Prevent http-proxy from chunking SSE responses
            proxyRes.headers["x-accel-buffering"] = "no";
          });
        },
      },
    },
  },
});
