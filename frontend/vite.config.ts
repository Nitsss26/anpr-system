import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0", // Allow external connections
    port: 6000,
    proxy: {
      "/api": {
        target: "http://backend:6001", // Use Docker service name
        changeOrigin: true,
      },
    },
  },
})
