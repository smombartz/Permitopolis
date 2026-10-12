import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Two projects: pure logic runs in node; render tests mount pages in jsdom.
export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["lib/**/*.test.ts", "tests/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "render",
          environment: "jsdom",
          include: ["tests/render/**/*.test.tsx", "components/**/*.test.tsx"],
          setupFiles: ["tests/render/setup.ts"],
          css: false,
        },
      },
    ],
  },
});
