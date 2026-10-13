import { test, expect, type Page } from "@playwright/test";
// Synthetic Komari 1.3.0 fixtures only; never production data.
const uuid = "11111111-1111-4111-8111-111111111111";
const node = {
  uuid,
  name: "Synthetic node",
  region: "JP",
  group: "Synthetic",
  mem_total: 8192,
  disk_total: 8192,
};
const report = {
  online: true,
  time: "2026-01-01T00:00:00Z",
  cpu: 0,
  uptime: 9000,
  ram: 4096,
  ram_total: 8192,
  disk: 1024,
  disk_total: 8192,
  net_in: 0,
  net_out: 2048,
  net_total_up: 10000,
};
async function komari(
  page: Page,
  options: {
    noSocket?: boolean;
    error?: boolean;
    empty?: boolean;
    historyError?: boolean;
    settings?: unknown;
  } = {},
) {
  let status = { ...report };
  let sockets = 0;
  let calls = 0;
  const result = (r: any) =>
    r.method === "common:getNodes"
      ? options.empty
        ? {}
        : { [uuid]: node }
      : r.method === "common:getNodesLatestStatus"
        ? { [uuid]: status, "not-visible": report }
        : r.params.type === "load"
          ? {
              records: {
                [uuid]: [
                  {
                    time: "2026-01-01T00:00:00Z",
                    cpu: 0,
                    ram: 100,
                    disk: 20,
                    net_in: 10,
                    net_out: 20,
                  },
                  {
                    time: "2026-01-01T00:05:00Z",
                    cpu: 10,
                    ram: 200,
                    disk: 30,
                    net_in: 20,
                    net_out: 40,
                  },
                ],
              },
            }
          : {
              records: [
                { time: "2026-01-01T00:00:00Z", task_id: 3, value: 40 },
                { time: "2026-01-01T00:05:00Z", task_id: 3, value: -1 },
              ],
              tasks: [
                { id: 3, name: "Synthetic probe", loss: 12.5, total: 16 },
              ],
            };
  await page.route("**/api/**", async (route) => {
    if (options.error)
      return route.fulfill({
        status: 401,
        contentType: "text/plain",
        body: "需要登录后查看",
      });
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/me")
      return route.fulfill({ json: { logged_in: false } });
    if (path === "/api/public")
      return route.fulfill({
        json: {
          status: "success",
          data: {
            sitename: "Synthetic station",
            record_preserve_time: 24,
            ping_record_preserve_time: 24,
            theme_settings: options.settings ?? {},
          },
        },
      });
    const req = route.request().postDataJSON();
    calls++;
    if (options.historyError && req.method === "common:getRecords")
      return route.fulfill({
        json: {
          jsonrpc: "2.0",
          id: req.id,
          error: { code: -32603, message: "Synthetic history error" },
        },
      });
    return route.fulfill({
      json: { jsonrpc: "2.0", id: req.id, result: result(req) },
    });
  });
  await page.routeWebSocket("**/api/rpc2", (ws) => {
    sockets++;
    if (options.noSocket || options.error) {
      ws.close();
      return;
    }
    ws.onMessage((raw) => {
      const req = JSON.parse(String(raw));
      ws.send(
        JSON.stringify({ jsonrpc: "2.0", id: req.id, result: result(req) }),
      );
    });
  });
  return {
    setStatus: (s: Partial<typeof report>) => {
      status = { ...status, ...s };
    },
    sockets: () => sockets,
    calls: () => calls,
  };
}
test("native UUID node detail, offline hardware history, zero and monthly N/A", async ({
  page,
}) => {
  const backend = await komari(page);
  await page.goto("/");
  await expect(page.locator(".node-window")).toHaveCount(1);
  await expect(page.locator(".meter-number").first()).toHaveText("0%");
  await page.locator('[data-action="detail"]').first().click();
  await expect(page).toHaveURL(new RegExp(uuid));
  await expect(page.locator(".detail-header")).toContainText("Synthetic node");
  await page.locator('[data-tab="network"]').click();
  await expect(page.locator(".probe-grid")).toContainText("Synthetic probe");
  await expect(page.locator(".detail-sections")).not.toContainText("TCP 握手");
  await expect(page.locator(".probe-grid")).toContainText("12.5%");
  await expect(page.locator(".probe-grid")).toContainText("超时");
  await expect(page.locator(".traffic-block")).toContainText("N/A");
  backend.setStatus({ online: false });
  await page.locator('.desktop-actions [data-action="refresh"]').click();
  await expect(page.locator(".detail-header")).toContainText("离线");
  await page.locator('[data-tab="performance"]').click();
  await expect(
    page.locator(".performance-chart-grid .graph-line path"),
  ).toHaveCount(3);
});
test("HTTP fallback is polling, not claimed live", async ({ page }) => {
  await komari(page, { noSocket: true });
  await page.goto("/");
  await expect(page.locator(".node-window")).toHaveCount(1);
  await expect(page.locator(".status-ready")).toContainText("轮询中");
});
test("RPC2 periodically refreshes and reconnects after visibility pause", async ({
  page,
}) => {
  await page.clock.install();
  const b = await komari(page);
  await page.goto("/");
  await expect(page.locator(".status-ready")).toContainText("实时连接");
  b.setStatus({ cpu: 82 });
  await page.clock.fastForward(5100);
  await expect(page.locator(".meter-number").first()).toHaveText("82%");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const before = b.sockets();
  await page.clock.fastForward(20000);
  expect(b.sockets()).toBe(before);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(b.sockets).toBeGreaterThan(before);
});
test("history RPC errors retain retry UI", async ({ page }) => {
  await komari(page, { historyError: true });
  await page.goto("/#/node/" + uuid);
  await expect(page.locator(".history-error").first()).toContainText(
    "Synthetic history error",
  );
  await expect(
    page.locator('.history-error [data-action="refresh"]').first(),
  ).toBeVisible();
});
test("private API rejection is readable and never shows old nodes", async ({
  page,
}) => {
  await komari(page, { error: true });
  await page.goto("/");
  await expect(page.locator(".error-banner")).toContainText("需要登录后查看");
  await expect(page.locator(".node-window")).toHaveCount(0);
});
test("empty snapshot and managed config escaping work on theme subpath", async ({
  page,
}) => {
  await komari(page, {
    empty: true,
    settings: JSON.stringify({
      notice: "<img src=x onerror=alert(1)>",
      columns: 99,
    }),
  });
  await page.goto("/themes/komari-classic/dist/index.html");
  const missingThemeIndex = await page.request.get("/themes/komari-classic/");
  expect(missingThemeIndex.status()).toBe(404);
  const missingDistAsset = await page.request.get(
    "/themes/komari-classic/classic.js",
  );
  expect(missingDistAsset.status()).toBe(404);
  await expect(page.locator(".node-window")).toHaveCount(0);
  await expect(page.locator(".notice")).toContainText("<img src=x");
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  await expect(page.locator(".status-ready")).toContainText("ayingQAQ");
});
test("live refresh preserves connected card and search caret", async ({
  page,
}) => {
  const b = await komari(page);
  await page.goto("/");
  await expect(page.locator(".node-window")).toHaveCount(1);
  const card = await page.locator(".node-window").elementHandle();
  await page.locator("#search-box").fill("Synthetic");
  await page
    .locator("#search-box")
    .evaluate((e: HTMLInputElement) => e.setSelectionRange(1, 3));
  b.setStatus({ cpu: 82 });
  await page.evaluate(() =>
    document
      .querySelector<HTMLButtonElement>(
        '.desktop-actions [data-action="refresh"]',
      )!
      .click(),
  );
  await expect(page.locator(".meter-number").first()).toHaveText("82%");
  expect(await card!.evaluate((e) => e.isConnected)).toBe(true);
  expect(
    await page
      .locator("#search-box")
      .evaluate((e: HTMLInputElement) => [e.selectionStart, e.selectionEnd]),
  ).toEqual([1, 3]);
});
