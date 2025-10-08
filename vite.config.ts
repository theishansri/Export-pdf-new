import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    fs: {
      allow: ["./", "./client", "./shared"],
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "server/**"],
    },
  },
  build: {
    outDir: "dist/spa",
  },
  plugins: [
    react(),
    expressPlugin(mode),
    visualizer({
      filename: "dist/bundle-analysis.html",
      open: true,
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
}));

function expressPlugin(mode: string): Plugin {
  return {
    name: "express-plugin",
    apply: "serve", // only during dev
    async configureServer(server) {
      if (mode !== "development") return; // skip in production

      // Import Node backend here, inside the function, so Vite won't see it during build
      const { createServer } = await import("./server");
      const app = await createServer();
      server.middlewares.use(app);
    },
  };
}
