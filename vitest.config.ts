import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    testTimeout: 60_000,
    setupFiles: ["./tests/setup-first-party-verticals.ts"],
  },
  resolve: {
    alias: {
      "@aether/contracts": path.resolve(__dirname, "contracts/src/index.ts"),
      "@aether/agent": path.resolve(__dirname, "agents/src/index.ts"),
      "@aether/control-plane": path.resolve(__dirname, "control-plane/src/index.ts"),
      "@aether/workstation": path.resolve(__dirname, "workstation/src/index.ts"),
      "@aether/runtime": path.resolve(__dirname, "runtime/src/index.ts"),
    },
  },
});
