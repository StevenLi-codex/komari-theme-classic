import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/ui",
  timeout: 30000,
  fullyParallel: true,
  use: { baseURL: "http://127.0.0.1:4178", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: "npm run build && node scripts/serve.mjs",
    url: "http://127.0.0.1:4178",
    env: { PORT: "4178" },
    reuseExistingServer: false,
  },
});
