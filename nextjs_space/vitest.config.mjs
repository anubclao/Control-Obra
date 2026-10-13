/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    // Sincroniza los snapshots de plantillas antes de la suite.
    // Spec: docs/specs/audit-formatos-snapshots-wiring.md §AC-1.
    globalSetup: ["./scripts/sync-formatos-snapshots.mjs"],
    include: ["tests/verifiers/**/*.spec.{ts,tsx}"],
    // Forzar que vitest NO use caché de transform: cuando reescribimos
    // fillers, los timestamps cambian pero el hash de vite puede
    // confundir y dar versiones cacheadas. Con `cache: false` siempre
    // retransforma.
    cache: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/index.ts",
        "src/types/**",
        "src/mocks/**",
        "src/app/**/layout.tsx",
        "src/app/**/page.tsx",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
