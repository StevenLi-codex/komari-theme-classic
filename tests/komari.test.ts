import test from "node:test";
import assert from "node:assert/strict";
import {
  getNodes,
  getHistory,
  getPing,
  getMe,
  NodeStream,
} from "../src/api.ts";
import { loadConfig } from "../src/config.ts";
import { normalizeSnapshot } from "../src/komari.ts";
test("UUID detail routes roundtrip safely while numeric IDs stay demo compatible", async () => {
  const routes = await import("../src/routes.ts").catch(() => ({
    parseNodeId: () => null,
    nodeHash: () => "",
  }));
  assert.equal(routes.parseNodeId("#/node/" + uuid), uuid);
  assert.equal(routes.nodeHash(uuid), "#/node/" + uuid);
  assert.equal(routes.parseNodeId("#/node/1"), 1);
  assert.equal(routes.parseNodeId("#/node/%22%3E"), null);
});
const uuid = "11111111-1111-4111-8111-111111111111";
const node = {
  uuid,
  name: "Synthetic Komari node",
  region: "🇯🇵",
  weight: 4,
  mem_total: 8192,
  disk_total: 16384,
  cpu_cores: 2,
  kernel_version: "6.1",
  virtualization: "kvm",
  public_remark: "Public",
  remark: "PRIVATE",
  token: "SECRET",
};
async function withFetch(
  run: () => Promise<void>,
  respond: (url: string, init?: RequestInit) => unknown,
) {
  const old = globalThis.fetch;
  globalThis.fetch = async (url, init) =>
    new Response(JSON.stringify(respond(String(url), init)), {
      headers: { "content-type": "application/json" },
    });
  try {
    await run();
  } finally {
    globalThis.fetch = old;
  }
}
export { uuid, node, withFetch };
test("Komari billing days, negative unknown price and RFC3339 expiry are preserved honestly", () => {
  const normalize = (extra: any) =>
    normalizeSnapshot({ [uuid]: { ...node, ...extra } }, {})[0];
  assert.equal(normalize({ price: 0, billing_cycle: 30 }).price, 0);
  assert.equal(normalize({ price: -1 }).price, undefined);
  assert.equal(normalize({ billing_cycle: 30 }).billing_cycle, "30 天");
  assert.equal(normalize({ billing_cycle: -1 }).billing_cycle, undefined);
  assert.equal(
    normalize({ expired_at: "2028-02-29T12:00:00+08:00" }).expires_at,
    "2028-02-29T12:00:00+08:00",
  );
  assert.equal(normalize({ expired_at: "bad" }).expires_at, undefined);
  assert.equal(normalize({ currency: "¥" }).currency, "¥");
});
test("RPC2 stream sends correlated requests periodically, ignores wrong ids and marks errors stale", async () => {
  const old = {
    document: globalThis.document,
    location: globalThis.location,
    WebSocket: globalThis.WebSocket,
    fetch: globalThis.fetch,
  };
  let ws: any;
  const events: any[] = [];
  class Socket {
    static OPEN = 1;
    readyState = 1;
    onopen: any;
    onmessage: any;
    onclose: any;
    onerror: any;
    sent: any[] = [];
    constructor(public url: string) {
      ws = this;
    }
    send(s: string) {
      this.sent.push(JSON.parse(s));
    }
    close() {
      this.readyState = 3;
    }
  }
  Object.assign(globalThis, {
    document: {
      hidden: false,
      addEventListener() {},
      removeEventListener() {},
    },
    location: { protocol: "http:", host: "localhost" },
    WebSocket: Socket,
    fetch: async () => {
      throw Error("offline");
    },
  });
  const stream = new NodeStream((...args) => events.push(args));
  try {
    stream.start();
    assert.ok(ws.url.endsWith("/api/rpc2"));
    ws.onopen();
    assert.equal(ws.sent.length, 2);
    const respond = (req: any, result: any) =>
      ws.onmessage({
        data: JSON.stringify({ jsonrpc: "2.0", id: req.id, result }),
      });
    respond({ id: 99999 }, { [uuid]: node });
    assert.ok(!events.some((e) => e[3] === "Live"));
    respond(ws.sent[0], { [uuid]: node });
    respond(ws.sent[1], { [uuid]: { online: true, cpu: 0 } });
    assert.equal(events.at(-1)[0][0].id, uuid);
    assert.equal(events.at(-1)[3], "Live");
    stream.refresh();
    assert.equal(ws.sent.length, 4);
    ws.onmessage({
      data: JSON.stringify({
        jsonrpc: "2.0",
        id: ws.sent[2].id,
        error: { code: -32603, message: "test error" },
      }),
    });
    assert.equal(events.at(-1)[3], "Offline");
    assert.match(events.at(-1)[1], /test error/);
    assert.equal(events.at(-1)[0][0].id, uuid);
  } finally {
    stream.destroy();
    Object.assign(globalThis, old);
  }
});
test("Komari public settings accepts object or JSON string and retention is hours not days", async () => {
  for (const setting of [
    { columns: 4, site_label: "" },
    JSON.stringify({ columns: 4, site_label: "" }),
  ])
    await withFetch(
      async () => {
        const conf = await loadConfig();
        assert.equal(conf.columns, 4);
        const me = await getMe();
        assert.equal(me.site_name, "Synthetic site");
        assert.equal(me.history_days, 1);
        assert.equal(me.authed, true);
      },
      (url) =>
        url === "/api/me"
          ? { logged_in: true, username: "Test" }
          : {
              status: "success",
              data: {
                sitename: "Synthetic site",
                record_preserve_time: 24,
                ping_record_preserve_time: 24,
                theme_settings: setting,
              },
            },
    );
});
test("Komari ping maps -1 to gaps and uses full-window task loss rather than sampled failures", async () => {
  await withFetch(
    async () => {
      const p = await getPing(uuid, 6);
      assert.deepEqual(p.probes, { "3": "Synthetic probe" });
      assert.deepEqual(p.loss, { "3": 12.5 });
      assert.deepEqual(p.ping, [
        { ts: 100, task_id: 3, latency: 0 },
        { ts: 110, task_id: 3, latency: null },
      ]);
    },
    (_url, init) => {
      const req = JSON.parse(String(init?.body));
      assert.equal(req.params.type, "ping");
      return {
        jsonrpc: "2.0",
        id: req.id,
        result: {
          records: [
            { task_id: 3, time: "1970-01-01T00:01:40Z", value: 0 },
            { task_id: 3, time: "1970-01-01T00:01:50Z", value: -1 },
            { task_id: 3, time: "bad", value: 9 },
          ],
          tasks: [{ id: 3, name: "Synthetic probe", loss: 12.5, total: 16 }],
        },
      };
    },
  );
});
test("Komari load history keeps UUID, timestamps, missing values distinct from zero", async () => {
  await withFetch(
    async () => {
      const h = await getHistory(uuid, 6);
      assert.deepEqual(h.metrics, [
        {
          ts: 100,
          cpu: 0,
          mem_used: 10,
          disk_used: null,
          net_rx: 0,
          net_tx: null,
        },
      ]);
    },
    (_url, init) => {
      const req = JSON.parse(String(init?.body));
      assert.equal(req.method, "common:getRecords");
      assert.deepEqual(req.params, {
        type: "load",
        uuid,
        hours: 6,
        maxCount: 120,
      });
      return {
        jsonrpc: "2.0",
        id: req.id,
        result: {
          records: {
            [uuid]: [
              { time: "1970-01-01T00:01:40Z", cpu: 0, ram: 10, net_in: 0 },
              { time: "broken", cpu: 9 },
            ],
          },
        },
      };
    },
  );
});
test("Komari RPC dictionaries join only public node whitelist and map real fields without leaking secrets", async () => {
  const requests: string[] = [];
  await withFetch(
    async () => {
      const data = await getNodes();
      assert.equal(data.nodes.length, 1);
      const n = data.nodes[0];
      assert.equal(n.id, uuid);
      assert.equal(n.country, "JP");
      assert.equal(n.sort, 4);
      assert.equal(n.kernel, "6.1");
      assert.equal(n.virt, "kvm");
      assert.equal(n.metrics?.cpu, 0);
      assert.equal(n.metrics?.mem_used, 4096);
      assert.equal(n.metrics?.net_rx, 100);
      assert.equal(n.metrics?.tcp, 3);
      assert.equal(n.metrics?.load?.[0], 0);
      assert.equal(n.metrics?.total_tx, 900);
      assert.equal(n.metrics?.month_rx, undefined);
      assert.equal(n.month_used, undefined);
      assert.equal(n.remark, undefined);
      assert.ok(!JSON.stringify(n).includes("SECRET"));
      assert.deepEqual(requests.sort(), [
        "common:getNodes",
        "common:getNodesLatestStatus",
      ]);
    },
    (url, init) => {
      assert.equal(url, "/api/rpc2");
      assert.equal(init?.method, "POST");
      const req = JSON.parse(String(init?.body));
      requests.push(req.method);
      return {
        jsonrpc: "2.0",
        id: req.id,
        result:
          req.method === "common:getNodes"
            ? { [uuid]: node }
            : {
                [uuid]: {
                  online: true,
                  time: "2026-01-01T00:00:00Z",
                  cpu: 0,
                  ram: 4096,
                  ram_total: 8192,
                  net_in: 100,
                  net_out: 0,
                  net_total_up: 900,
                  connections: 5,
                  connections_udp: 2,
                  load: 0,
                  load5: 1,
                  load15: 2,
                },
                "not-visible": { online: true, cpu: 99 },
              },
      };
    },
  );
});
