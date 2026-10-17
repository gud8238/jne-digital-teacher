import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90000,
  expect: { timeout: 30000 },
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: process.env.TEST_BASE_URL || "http://localhost:8888",
    headless: true,
    channel: "chrome",
    trace: "retain-on-failure",
  },
  outputDir: "test-results",
});
