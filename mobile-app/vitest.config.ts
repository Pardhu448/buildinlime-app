import { defineConfig } from "vitest/config"
import path from "node:path"

// Mobile test config.
//
// Deliberately a plain node environment, NOT jest-expo (see
// agentGuides/testingAndCiSetup.md §4): the code worth testing — the offline
// executor, upload manager, mutation-fns, collection helpers — is pure
// TypeScript. RN/Expo native modules are mocked per-test with vi.mock(); the
// heavy mock surface (expo-file-system, expo-crypto, netinfo, react-native)
// gets fleshed out alongside the upload-manager specs in Phase 3.
//
// Component *rendering* is out of scope for now; that is the one thing that
// would justify jest-expo + Testing Library Native.
export default defineConfig({
  resolve: {
    // Mirrors tsconfig `paths`: "@/*" -> repo root.
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
  },
})
