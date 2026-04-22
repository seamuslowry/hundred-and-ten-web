import { defineConfig } from "vitest/config";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [
    tanstackRouter({
      routesDirectory: "./routes",
      generatedRouteTree: "./routeTree.gen.ts",
      routeFileIgnorePattern: ".test.tsx",
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  build: {
    outDir: "dist",
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
});
