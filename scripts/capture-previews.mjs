import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { cpSync } from "node:fs";
import { join } from "node:path";
const root = join(import.meta.dirname, "..");
const server = spawn(process.execPath, [join(root, "scripts/serve.mjs")], {
  cwd: root,
  env: { ...process.env, PORT: "4179" },
  stdio: "ignore",
  windowsHide: true,
});
let launchError;
server.on("error", (error) => (launchError = error));
let browser;
try {
  const deadline = Date.now() + 10000;
  while (true) {
    try {
      const res = await fetch("http://127.0.0.1:4179/demo.html");
      if (res.ok) break;
    } catch {}
    if (launchError || server.exitCode !== null || Date.now() > deadline)
      throw launchError || new Error("Preview server did not start");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1200 },
    deviceScaleFactor: 1,
  });
  await page.goto("http://127.0.0.1:4179/demo.html");
  await page.locator(".node-window").last().waitFor();
  await page.evaluate(() => document.fonts.ready);
  if (
    await page
      .locator("img")
      .evaluateAll((images) => images.some((image) => !image.complete))
  )
    await page.waitForLoadState("networkidle");
  await page.screenshot({ path: join(root, "screenshot-desktop.png") });
  cpSync(join(root, "screenshot-desktop.png"), join(root, "preview.png"));
  await page.locator(".node-window").first().press("Enter");
  await page.screenshot({ path: join(root, "screenshot-detail-desktop.png") });
  await page.locator('[data-tab="network"]').click();
  await page.screenshot({ path: join(root, "screenshot-network-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:4179/demo.html");
  await page.locator(".node-window").last().waitFor();
  await page.screenshot({ path: join(root, "screenshot-mobile.png") });
  await page.locator(".node-window").first().press("Enter");
  await page.screenshot({ path: join(root, "screenshot-detail-mobile.png") });
  await page.goto("http://127.0.0.1:4179/demo.html?scenario=edge");
  await page.locator(".node-window").last().waitFor();
  await page.screenshot({ path: join(root, "screenshot-edge-mobile.png") });
  console.log(
    "Captured desktop, mobile, detail and edge-state previews; preview.png is 1920 × 1200.",
  );
} finally {
  await browser?.close();
  server.kill();
}
