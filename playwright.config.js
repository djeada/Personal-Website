const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:8000",
    browserName: "chromium",
    colorScheme: "dark",
  },
  webServer: {
    command: "python3 -m http.server 8000 --directory src",
    url: "http://127.0.0.1:8000",
    reuseExistingServer: true,
  },
});
