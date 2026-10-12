import { test, expect, type Page, type WebSocketRoute } from "@playwright/test";
import { gzipSync } from "node:zlib";
const metrics = {
  cpu: 33,
  uptime: 9000,
  mem_total: 8192,
  mem_used: 4096,
  disk_total: 8192,
  disk_used: 1024,
  net_rx: 1024,
  net_tx: 2048,
};
const node = {
  id: 1,
  name: "Live node",
  country: "JP",
  group: "all",
  online: true,
  metrics,
  last_seen_ago: 5,
  expires_in: 20,
};
test("Hub probe names, timeout and aggregate loss render without invented carrier values", async ({
  page,
}) => {
  await hub(page);
  await page.goto("/#/node/1");
  await page.locator('[data-tab="network"]').click();
  await expect(page.locator(".probe-grid")).toContainText("真实电信");
  await expect(page.locator(".probe-grid")).toContainText("真实联通");
  await expect(page.locator(".probe-grid")).toContainText("12.5%");
  await expect(page.locator(".probe-grid")).toContainText("超时 / 无响应");
  await expect(page.locator(".traffic-block").first()).toContainText("N/A");
});
test("offline nodes retain memory and disk history from hardware totals", async ({
  page,
}) => {
  const backend = await hub(page);
  await page.goto("/#/node/1");
  await expect(page.locator(".detail-header")).toContainText("Live node");
  backend.socket()!.send(
    JSON.stringify({
      nodes: [
        {
          ...node,
          name: "Offline node",
          online: false,
          metrics: null,
          mem_total: 8192,
          disk_total: 8192,
        },
      ],
    }),
  );
  await expect(page.locator(".detail-header")).toContainText("Offline node");
  await page.getByRole("button", { name: "性能监视器" }).click();
  await expect(page.locator(".detail-chart-grid .graph-line path")).toHaveCount(
    3,
  );
});
test("network history errors remain visible with a retry action", async ({
  page,
}) => {
  await hub(page, { historyError: true });
  await page.goto("/#/node/1");
  await page.getByRole("button", { name: "网络流量" }).click();
  await expect(page.locator(".detail-chart-grid")).toContainText(
    "查询历史的请求太多",
  );
  await expect(
    page
      .locator(".detail-chart-grid")
      .getByRole("button", { name: "重试历史" })
      .first(),
  ).toBeVisible();
});
async function hub(
  page: Page,
  options: {
    days?: number;
    historyError?: boolean;
    noSocket?: boolean;
    delayNodes?: boolean;
    config?: unknown;
  } = {},
) {
  let socket: WebSocketRoute | undefined;
  const historyRequests: string[] = [];
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    let value: unknown = {};
    if (url.pathname === "/api/me")
      value = { site_name: "Test Hub", history_days: options.days ?? 7 };
    else if (url.pathname.includes("/config")) value = options.config ?? {};
    else if (url.pathname === "/api/nodes") {
      if (options.delayNodes)
        await new Promise((resolve) => setTimeout(resolve, 400));
      value = { nodes: [node] };
    } else if (url.pathname.endsWith("/metrics")) {
      historyRequests.push(url.search);
      if (
        options.historyError &&
        url.searchParams.get("series") === "metrics"
      ) {
        await route.fulfill({
          status: 429,
          contentType: "text/plain",
          body: "查询历史的请求太多，稍后再试",
        });
        return;
      }
      value =
        url.searchParams.get("series") === "ping"
          ? {
              probes: { "1": "真实电信", "2": "真实联通", "3": "真实移动" },
              loss: { "2": 12.5 },
              ping: [
                { task_id: 1, ts: 100, latency: 40 },
                { task_id: 1, ts: 110, latency: 43 },
                { task_id: 2, ts: 110, latency: null },
                { task_id: 3, ts: 110, latency: 61 },
              ],
            }
          : {
              metrics: [
                {
                  ts: 100,
                  cpu: 15,
                  mem_used: 1024,
                  disk_used: 512,
                  net_rx: 10,
                  net_tx: 20,
                },
                {
                  ts: 110,
                  cpu: 42,
                  mem_used: 2048,
                  disk_used: 1024,
                  net_rx: 20,
                  net_tx: 40,
                },
              ],
            };
    }
    await route.fulfill({ json: value });
  });
  await page.routeWebSocket("**/api/ws**", (ws) => {
    socket = ws;
    if (options.noSocket) ws.close();
    else ws.send(JSON.stringify({ nodes: [node] }));
  });
  return { socket: () => socket, historyRequests };
}

test("text and gzip updates preserve search selection and card control focus", async ({
  page,
}) => {
  const backend = await hub(page);
  await page.goto("/");
  await expect(page.locator(".node-window")).toHaveCount(1);
  await page.locator("#search-box").fill("Live");
  await page
    .locator("#search-box")
    .evaluate((input: HTMLInputElement) => input.setSelectionRange(1, 3));
  backend.socket()!.send(
    gzipSync(
      JSON.stringify({
        nodes: [{ ...node, metrics: { ...metrics, cpu: 71 } }],
      }),
    ),
  );
  backend.socket()!.send(
    JSON.stringify({
      nodes: [{ ...node, metrics: { ...metrics, cpu: 82 } }],
    }),
  );
  await expect(page.locator(".meter-number").first()).toHaveText("82%");
  expect(
    await page
      .locator("#search-box")
      .evaluate((input: HTMLInputElement) => [
        input.selectionStart,
        input.selectionEnd,
      ]),
  ).toEqual([1, 3]);
  await page.locator('[data-action="min"]').focus();
  backend.socket()!.send(
    JSON.stringify({
      nodes: [{ ...node, metrics: { ...metrics, cpu: 83 } }],
    }),
  );
  await expect(page.locator(".meter-number").first()).toHaveText("83%");
  await expect(page.locator('[data-action="min"]')).toBeFocused();
});
test("HTTP response started before a live update cannot replace the newer snapshot", async ({
  page,
}) => {
  const backend = await hub(page, { delayNodes: true });
  await page.goto("/");
  await expect(page.locator(".node-window")).toHaveCount(1);
  backend
    .socket()!
    .send(JSON.stringify({ nodes: [{ ...node, name: "New snapshot" }] }));
  await expect(page.locator(".node-title")).toContainText("New snapshot");
  await page.waitForTimeout(650);
  await expect(page.locator(".node-title")).toContainText("New snapshot");
});
test("direct detail entry shows loading then resolved node, history range follows retention", async ({
  page,
}) => {
  const backend = await hub(page, { days: 2, delayNodes: true });
  await page.goto("/#/node/1");
  await expect(page.locator(".detail-inner")).not.toContainText("未找到");
  await expect(page.locator(".detail-header")).toContainText("Live node");
  await expect(page.locator("#history-range option")).toHaveText([
    "1 小时",
    "6 小时",
    "1 天",
    "2 天",
  ]);
  await page.locator("#history-range").selectOption("48");
  await expect
    .poll(() => backend.historyRequests.some((q) => q.includes("hours=48")))
    .toBe(true);
  await expect(page.locator(".detail-graph .graph-time")).toContainText("01/");
});
test("history failures stay visible and refresh retries the history query", async ({
  page,
}) => {
  const backend = await hub(page, { historyError: true });
  await page.goto("/#/node/1");
  await expect(page.locator(".detail-sections .history-error")).toContainText(
    "查询历史的请求太多",
  );
  const before = backend.historyRequests.filter((q) =>
    q.includes("series=metrics"),
  ).length;
  await page.locator('.detail-sections [data-action="refresh"]').click();
  await expect
    .poll(
      () =>
        backend.historyRequests.filter((q) => q.includes("series=metrics"))
          .length,
    )
    .toBeGreaterThan(before);
});
test("unavailable WebSocket falls back to HTTP polling without pretending to be live", async ({
  page,
}) => {
  await hub(page, { noSocket: true });
  await page.goto("/");
  await expect(page.locator(".node-window")).toHaveCount(1);
  await expect(page.locator(".status-ready")).toContainText("轮询中");
  await expect(page.locator(".status-ready")).not.toContainText("实时连接");
});
test("Hub authorization errors are readable, proxy HTML never enters the page", async ({
  page,
}) => {
  await page.routeWebSocket("**/api/ws**", (ws) => ws.close());
  await page.route("**/api/**", (route) =>
    route.fulfill({
      status: 401,
      contentType: "text/plain",
      body: "需要登录后查看",
    }),
  );
  await page.goto("/");
  await expect(page.locator(".error-banner")).toContainText("需要登录后查看");
  await expect(page.locator(".empty-state")).toContainText("暂时无法连接站点");
  await page.unroute("**/api/**");
  await page.route("**/api/**", (route) =>
    route.fulfill({
      status: 502,
      contentType: "text/html",
      body: "<h1>PRIVATE PROXY RESPONSE</h1>",
    }),
  );
  await page.locator(".error-banner button").click();
  await expect(page.locator(".error-banner")).toContainText("HTTP 502");
  await expect(page.locator("body")).not.toContainText(
    "PRIVATE PROXY RESPONSE",
  );
});
test("blocked local storage and broken optional configuration keep the console usable", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("blocked");
      },
    }),
  );
  await hub(page, {
    config: {
      columns: 99,
      notice: "<img src=x onerror=alert(1)>",
      show_sidebar: false,
    },
  });
  await page.goto("/");
  await expect(page.locator(".node-window")).toHaveCount(1);
  await expect(page.locator(".notice")).toContainText("<img src=x");
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  await page.locator('[data-action="toggle-sidebar"]').first().click();
  await page.locator('[data-modal="settings"]').click();
  await page.locator("#pref-compact").check();
  await expect(page.locator("#pref-compact")).toBeChecked();
});

test("expired access clears previously displayed private node data", async ({
  page,
}) => {
  const backend = await hub(page);
  await page.goto("/");
  await expect(page.locator(".node-window")).toHaveCount(1);
  backend.socket()!.close();
  await page.route("**/api/nodes", (route) =>
    route.fulfill({
      status: 401,
      contentType: "text/plain",
      body: "需要登录后查看",
    }),
  );
  await page.locator('.desktop-actions [data-action="refresh"]').click();
  await expect(page.locator(".error-banner")).toContainText("需要登录后查看");
  await expect(page.locator(".node-window")).toHaveCount(0);
});

test("a stalled stream is replaced and unreadable frames never keep it alive", async ({
  page,
}) => {
  await page.clock.install();
  const backend = await hub(page);
  await page.goto("/");
  await expect(page.locator(".node-window")).toHaveCount(1);
  const old = backend.socket();
  old!.send("not JSON");
  await page.clock.fastForward(12_000);
  await expect.poll(() => backend.socket() !== old).toBe(true);
  await expect(page.locator(".status-ready")).toContainText("实时连接");
});

test("monthly consumption is not guessed from receive and send counters", async ({
  page,
}) => {
  const backend = await hub(page);
  await page.goto("/#/node/1");
  await expect(page.locator(".detail-header")).toBeVisible();
  backend.socket()!.send(
    JSON.stringify({
      nodes: [
        {
          ...node,
          name: "Traffic node",
          month_rx: 3000,
          month_tx: 4000,
          traffic_mode: "max",
        },
      ],
    }),
  );
  await expect(page.locator(".detail-header")).toContainText("Traffic node");
  await page.locator('[data-tab="network"]').click();
  await expect(
    page
      .locator(".properties div")
      .filter({ has: page.locator("dt", { hasText: "本月已用流量（Hub）" }) })
      .locator("dd"),
  ).toHaveText("N/A");
});
