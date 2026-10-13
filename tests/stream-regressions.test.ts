import test from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { NodeStream } from "../src/api.ts";

// Synthetic Komari fixtures; no production identifiers or data.
const uuid = "11111111-1111-4111-8111-111111111111";
const nodes = { [uuid]: { uuid, name: "Synthetic private node" } };
const statuses = { [uuid]: { online: true, cpu: 0 } };
function harness(closeEvent = true) {
  const old = {
    document: globalThis.document,
    location: globalThis.location,
    WebSocket: globalThis.WebSocket,
    fetch: globalThis.fetch,
  };
  const events: any[][] = [];
  const sockets: Socket[] = [];
  let denial: number | null = null;
  let hold = false;
  const releases: (() => void)[] = [];
  let unavailable = false;
  let calls = 0;
  let visibility: (() => void) | undefined;
  class Socket {
    static OPEN = 1;
    readyState = 0;
    onopen: any;
    onmessage: any;
    onclose: any;
    onerror: any;
    sent: any[] = [];
    constructor(public url: string) {
      sockets.push(this);
    }
    send(data: string) {
      this.sent.push(JSON.parse(data));
    }
    open() {
      this.readyState = 1;
      this.onopen?.();
    }
    reply(request: any, result: unknown) {
      this.onmessage?.({
        data: JSON.stringify({ jsonrpc: "2.0", id: request.id, result }),
      });
    }
    close() {
      this.readyState = 3;
      if (closeEvent) this.onclose?.();
    }
  }
  const document = {
    hidden: false,
    addEventListener(_name: string, listener: () => void) {
      visibility = listener;
    },
    removeEventListener() {},
  };
  Object.assign(globalThis, {
    document,
    location: { protocol: "http:", host: "localhost" },
    WebSocket: Socket,
    fetch: async (_url: unknown, init: RequestInit) => {
      calls++;
      if (unavailable) throw new Error("Synthetic fallback unavailable");
      const req = JSON.parse(String(init.body));
      if (hold) await new Promise<void>((resolve) => releases.push(resolve));
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: req.id,
          ...(denial !== null
            ? { error: { code: denial, message: "Synthetic access denied" } }
            : {
                result: req.method === "common:getNodes" ? nodes : statuses,
              }),
        }),
        { headers: { "content-type": "application/json" } },
      );
    },
  });
  const stream = new NodeStream((...args) => events.push(args));
  return {
    stream,
    events,
    sockets,
    calls: () => calls,
    hold: () => {
      hold = true;
    },
    release: () => {
      hold = false;
      releases.splice(0).forEach((resolve) => resolve());
    },
    deny: (code: number) => {
      denial = code;
    },
    unavailable: () => {
      unavailable = true;
    },
    hide: () => {
      document.hidden = true;
      visibility?.();
    },
    cleanup: () => {
      stream.destroy();
      Object.assign(globalThis, old);
    },
  };
}
for (const transport of ["HTTP", "WebSocket"])
  for (const code of [-32040, -32041])
    test(`${transport} native denial ${code} clears displayed snapshot and last immediately`, async () => {
      const h = harness();
      try {
        h.stream.start();
        await setImmediate();
        assert.equal(h.events.at(-1)![0][0].name, "Synthetic private node");
        assert.equal(typeof h.events.at(-1)![2], "number");
        if (transport === "HTTP") {
          h.deny(code);
          h.stream.refresh();
          await setImmediate();
        } else {
          const ws = h.sockets[0];
          ws.open();
          ws.reply(ws.sent[0], nodes);
          ws.reply(ws.sent[1], statuses);
          h.unavailable();
          h.stream.refresh();
          ws.onmessage({
            data: JSON.stringify({
              jsonrpc: "2.0",
              id: ws.sent[2].id,
              error: { code, message: "Synthetic access denied" },
            }),
          });
        }
        assert.equal(h.events.at(-1)![0], null);
        assert.equal(h.events.at(-1)![2], null);
        assert.match(h.events.at(-1)![1], /Synthetic access denied/);
        h.unavailable();
        await setImmediate();
        assert.equal(h.events.at(-1)![0], null);
        assert.equal(h.events.at(-1)![2], null);
      } finally {
        h.cleanup();
      }
    });

for (const code of [-32040, -32041]) {
  test(`HTTP denial ${code} retires an outstanding WS snapshot and retries after a bounded delay`, async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
    const h = harness(false);
    try {
      h.stream.start();
      await setImmediate();
      h.deny(code);
      h.stream.refresh();
      const ws = h.sockets[0];
      ws.open();
      const lateMessage = ws.onmessage;
      await setImmediate();
      assert.equal(h.events.at(-1)![0], null);
      assert.equal(h.events.at(-1)![2], null);
      for (const req of ws.sent)
        lateMessage({
          data: JSON.stringify({
            jsonrpc: "2.0",
            id: req.id,
            result: req.method === "common:getNodes" ? nodes : statuses,
          }),
        });
      assert.equal(
        h.events.at(-1)![0],
        null,
        "obsolete WS cannot restore private data",
      );
      assert.equal(h.events.at(-1)![2], null);
      assert.equal(ws.readyState, 3);
      const before = h.calls();
      t.mock.timers.tick(4999);
      assert.equal(h.calls(), before, "no immediate reauthentication loop");
      assert.equal(h.sockets.length, 1);
      t.mock.timers.tick(1);
      assert.equal(
        h.sockets.length,
        2,
        "reconnection is not permanently stopped",
      );
      assert.ok(h.calls() > before, "HTTP polling resumes after the delay");
      await setImmediate();
      h.hide();
      t.mock.timers.tick(30000);
      assert.equal(h.sockets.length, 2, "hidden page cancels auth retry");
    } finally {
      h.cleanup();
      t.mock.timers.reset();
    }
  });

  test(`delayed HTTP denial ${code} clears a newer accepted WS snapshot`, async () => {
    const h = harness(false);
    try {
      h.stream.start();
      await setImmediate();
      h.deny(code);
      h.hold();
      h.stream.refresh();
      const ws = h.sockets[0];
      ws.open();
      ws.reply(ws.sent[0], nodes);
      ws.reply(ws.sent[1], statuses);
      assert.equal(h.events.at(-1)![3], "Live");
      assert.equal(typeof h.events.at(-1)![2], "number");
      h.release();
      await setImmediate();
      assert.equal(
        h.events.at(-1)![0],
        null,
        "auth denial must bypass snapshot revision guard",
      );
      assert.equal(h.events.at(-1)![2], null);
      assert.match(h.events.at(-1)![1], /Synthetic access denied/);
      assert.equal(ws.readyState, 3);
    } finally {
      h.release();
      h.cleanup();
    }
  });
}

test("stalled CONNECTING handshake is replaced even without a close event while HTTP keeps polling", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  const h = harness(false);
  try {
    h.stream.start();
    await setImmediate();
    const first = h.sockets[0];
    assert.equal(first.readyState, 0);
    const before = h.calls();
    t.mock.timers.tick(11000);
    await setImmediate();
    assert.ok(h.calls() > before, "HTTP polling continues during handshake");
    assert.equal(first.readyState, 3, "stale CONNECTING socket is closed");
    t.mock.timers.tick(5000);
    assert.equal(h.sockets.length, 2, "stale socket is replaced");
    h.hide();
    t.mock.timers.tick(30000);
    assert.equal(h.sockets.length, 2, "pause cancels handshake/retry timers");
  } finally {
    h.cleanup();
    t.mock.timers.reset();
  }
});

test("unanswered OPEN RPC has its own deadline after the handshake timer is cleared", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  const h = harness();
  try {
    h.stream.start();
    await setImmediate();
    const ws = h.sockets[0];
    t.mock.timers.tick(10000);
    await setImmediate();
    ws.open();
    assert.equal(ws.sent.length, 2);
    t.mock.timers.tick(1000);
    assert.equal(ws.readyState, 1, "opening clears the old handshake deadline");
    h.unavailable();
    t.mock.timers.tick(10000);
    assert.equal(
      ws.readyState,
      3,
      "unanswered OPEN RPC times out after 11 seconds",
    );
    assert.match(h.events.at(-1)![1], /实时连接超时/);
    t.mock.timers.tick(5000);
    assert.equal(h.sockets.length, 2);
    await setImmediate();
  } finally {
    h.cleanup();
    t.mock.timers.reset();
  }
});
