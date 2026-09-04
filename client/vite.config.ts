import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/catalog": "http://localhost:3001",
      "/policy-check": "http://localhost:3001",
      "/order": "http://localhost:3001",
      "/agent": "http://localhost:3001",
      "/payment": "http://localhost:3001",
      "/health": "http://localhost:3001"
    }
  }
});
