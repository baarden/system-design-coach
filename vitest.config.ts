import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: "client",
          include: ["src/client/**/*.test.{ts,tsx}"],
          environment: "jsdom",
          setupFiles: ["./src/client/test/setup.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "server",
          include: ["src/server/**/*.test.ts"],
          environment: "node",
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/client/**/*.{ts,tsx}", "src/server/**/*.ts"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/client/test/**",
        "src/client/vite-env.d.ts",
        "src/client/env.d.ts",
        "src/client/main.tsx",
        "src/server/index.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "./src/shared"),
    },
  },
});
