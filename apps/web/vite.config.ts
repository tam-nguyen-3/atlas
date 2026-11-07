import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    host: "localhost",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: process.env.ATLAS_API_PROXY_TARGET ?? "http://localhost:3000",
        changeOrigin: false,
      },
    },
  },
  preview: {
    proxy: {
      "/api": {
        target: process.env.ATLAS_API_PROXY_TARGET ?? "http://localhost:3000",
        changeOrigin: false,
      },
    },
  },
});
