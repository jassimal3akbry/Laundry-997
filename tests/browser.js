// Browser tests use local fixtures and Playwright routes for mocked services.
// An unreachable proxy blocks external traffic, including from service workers.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

function launchBrowser() {
  return chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    proxy: { server: "http://127.0.0.1:1", bypass: "127.0.0.1,localhost,[::1]" },
  });
}

module.exports = { launchBrowser };
