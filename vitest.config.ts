import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  // `@/` resolves in Next but not here unless it is said twice. Without this
  // a test can only import by relative path, which is a silent tax on every
  // test written after the first one that tried.
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
