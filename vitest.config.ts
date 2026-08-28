import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // The app uses `import "server-only"` guards; vitest runs outside Next,
      // so map it to an empty module.
      "server-only": path.resolve(__dirname, "src/test/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    passWithNoTests: true,
    env: {
      LLM_MOCK: "1",
    },
  },
});
