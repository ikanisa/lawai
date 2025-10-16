import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  // Cast to `any` to avoid workspace duplicate Vite type mismatches at build time.
  plugins: [react(), tsconfigPaths()] as any,
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    coverage: {
      provider: "v8",
    },
  }
});
