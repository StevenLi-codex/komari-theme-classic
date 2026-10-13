import type { NodeInfo, NodeHistory, Me } from "./types.js";
import { valid } from "./format.js";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function isAuthError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    [401, 403, -32040, -32041].includes(error.status)
  );
}
async function request<T>(
  url: string,
  timeout = 15000,
  init: RequestInit = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      credentials: "same-origin",
    });
    if (!res.ok) {
      const s = res.headers.get("content-type")?.startsWith("text/plain")
        ? (await res.text()).trim().slice(0, 300)
        : "";
      throw new ApiError(res.status, s || `服务器返回 HTTP ${res.status}`);
    }
    const obj = await res.json().catch(() => {
      throw new ApiError(res.status, "服务器返回的数据格式错误");
    });
    return obj as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(0, "网络不可用，请检查与 Hub 的连接");
  } finally {
    clearTimeout(timer);
  }
}
import { normalizeSnapshot, object, timestamp } from "./komari.js";
let rpcId = 0;
export async function rpc(
  method: string,
  params: Record<string, unknown> = {},
): Promise<unknown> {
  const id = ++rpcId;
  const data = await request<{
    jsonrpc?: string;
    id?: number;
    result?: unknown;
    error?: { code: number; message: string };
  }>("/api/rpc2", 15000, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  if (data?.error) throw new ApiError(data.error.code, data.error.message);
  if (!data || data.jsonrpc !== "2.0" || data.id !== id || !("result" in data))
    throw new ApiError(200, "RPC 响应格式错误");
  return data.result;
}
export const getNodes = async (): Promise<{ nodes: NodeInfo[] }> => {
  const [nodes, statuses] = await Promise.all([
    rpc("common:getNodes"),
    rpc("common:getNodesLatestStatus"),
  ]);
  return { nodes: normalizeSnapshot(nodes, statuses) };
};
async function requestHistory(
  type: "load" | "ping",
  id: string | number,
  hours: number,
): Promise<Record<string, unknown>> {
  for (let attempt = 0; ; attempt++) {
    try {
      return object(
        await rpc("common:getRecords", {
          type,
          uuid: String(id),
          hours,
          maxCount: 120,
        }),
      );
    } catch (error) {
      if (
        !(error instanceof ApiError) ||
        ![429, 503].includes(error.status) ||
        attempt >= 3
      )
        throw error;
      await new Promise((r) => setTimeout(r, 250 * 2 ** attempt));
    }
  }
}
export async function getMe(): Promise<Me> {
  const [raw, pub] = await Promise.all([
    request<Record<string, unknown>>("/api/me"),
    request<Record<string, unknown>>("/api/public"),
  ]);
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new ApiError(200, "站点信息格式错误");
  const data = object(pub?.data);
  const hours = valid(data.record_preserve_time)
    ? data.record_preserve_time
    : 24;
  const pingHours = valid(data.ping_record_preserve_time)
    ? data.ping_record_preserve_time
    : hours;
  return {
    site_name: typeof data.sitename === "string" ? data.sitename : undefined,
    history_days: Math.min(hours, pingHours) / 24,
    authed: raw.logged_in === true,
  };
}
export async function getHistory(
  id: string | number,
  hours = 24,
): Promise<NodeHistory> {
  const data = await requestHistory("load", id, hours);
  if (
    !data.records ||
    typeof data.records !== "object" ||
    Array.isArray(data.records)
  )
    throw new ApiError(200, "历史数据格式错误");
  const points = object(data.records)[String(id)] ?? [];
  if (!Array.isArray(points)) throw new ApiError(200, "历史数据格式错误");
  return {
    metrics: points
      .flatMap((raw) => {
        const p = object(raw),
          ts = timestamp(p.time);
        if (ts === undefined) return [];
        return [
          {
            ts,
            cpu: valid(p.cpu) ? p.cpu : null,
            mem_used: valid(p.ram) ? p.ram : null,
            disk_used: valid(p.disk) ? p.disk : null,
            net_rx: valid(p.net_in) ? p.net_in : null,
            net_tx: valid(p.net_out) ? p.net_out : null,
          },
        ];
      })
      .sort((a, b) => a.ts - b.ts),
  };
}
export async function getPing(
  id: string | number,
  hours = 6,
): Promise<import("./types.js").PingHistory> {
  const data = await requestHistory("ping", id, hours);
  if (
    !Array.isArray(data.records) ||
    (data.tasks !== null && !Array.isArray(data.tasks))
  )
    throw new ApiError(200, "延迟数据格式错误");
  const probes: Record<string, string> = {},
    loss: Record<string, number> = {};
  for (const raw of (data.tasks ?? []) as unknown[]) {
    const task = object(raw);
    if (valid(task.id) && typeof task.name === "string") {
      probes[String(task.id)] = task.name;
      if (
        valid(task.loss) &&
        task.loss <= 100 &&
        valid(task.total) &&
        task.total > 0
      )
        loss[String(task.id)] = task.loss;
    }
  }
  return {
    probes,
    loss,
    ping: data.records
      .flatMap((raw) => {
        const p = object(raw),
          ts = timestamp(p.time);
        if (
          ts === undefined ||
          !valid(p.task_id) ||
          typeof p.value !== "number" ||
          !Number.isFinite(p.value)
        )
          return [];
        return [
          { ts, task_id: p.task_id, latency: p.value < 0 ? null : p.value },
        ];
      })
      .sort((a, b) => a.ts - b.ts),
  };
}
export function sanitizeNodes(value: unknown): NodeInfo[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string | number>();
  return value
    .filter(
      (n): n is NodeInfo =>
        !!n &&
        typeof n === "object" &&
        ((typeof n.id === "number" &&
          Number.isSafeInteger(n.id) &&
          n.id >= 0) ||
          (typeof n.id === "string" && /^[0-9a-f-]{36}$/i.test(n.id))) &&
        typeof n.name === "string" &&
        typeof n.online === "boolean" &&
        !ids.has(n.id) &&
        !!ids.add(n.id),
    )
    .map((n) => {
      const next = { ...n } as NodeInfo & Record<string, unknown>;
      for (const key of [
        "country",
        "group",
        "public_remark",
        "os",
        "kernel",
        "arch",
        "virt",
        "cpu_name",
        "currency",
        "billing_cycle",
        "ip",
        "hostname",
        "remark",
        "expires_at",
      ]) {
        if (next[key] !== null && typeof next[key] !== "string")
          delete next[key];
      }
      // A malformed payload remains distinct from metrics:null (first report pending).
      if (!n.online) next.metrics = null;
      else if (n.metrics !== null && n.metrics !== undefined) {
        next.metrics =
          typeof n.metrics === "object" && !Array.isArray(n.metrics)
            ? Object.fromEntries(
                Object.entries(n.metrics).filter(([key, v]) =>
                  key === "load"
                    ? Array.isArray(v) && v.every(valid)
                    : valid(v),
                ),
              )
            : {};
      }
      return next;
    });
}
type Listener = (
  nodes: NodeInfo[] | null,
  error: string | null,
  last: number | null,
  connection: string,
) => void;
export class NodeStream {
  private ws: WebSocket | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private gen = 0;
  private revision = 0;
  private fetching = false;
  private demo = false;
  private nodes: NodeInfo[] | null = null;
  private error: string | null = null;
  private last: number | null = null;
  private connection = "连接中";
  private pending = new Map<number, "nodes" | "statuses">();
  private parts: Partial<Record<"nodes" | "statuses", unknown>> = {};
  constructor(private notify: Listener) {}
  private emit() {
    this.notify(this.nodes, this.error, this.last, this.connection);
  }
  private accept(nodes: NodeInfo[], transport: string) {
    this.nodes = nodes;
    this.error = null;
    this.last = Date.now();
    this.connection = transport;
    this.revision++;
    this.emit();
  }
  private fail(error: unknown) {
    this.error = error instanceof Error ? error.message : "实时数据格式错误";
    this.connection = "Offline";
    if (isAuthError(error)) {
      this.nodes = null;
      this.last = null;
      this.revision++;
      // Revoke every pending transport before a late snapshot can restore data.
      this.pause();
      const gen = this.gen;
      this.retry = setTimeout(() => {
        if (gen === this.gen && !document.hidden) this.resume();
      }, 5000);
    }
    this.emit();
  }
  private async fetchOnce(gen: number) {
    if (this.fetching) return;
    this.fetching = true;
    const revision = this.revision;
    try {
      const data = await getNodes();
      if (gen === this.gen && !document.hidden && revision === this.revision)
        this.accept(data.nodes, "Polling");
    } catch (e) {
      if (
        gen === this.gen &&
        !document.hidden &&
        (isAuthError(e) || revision === this.revision)
      )
        this.fail(e);
    } finally {
      this.fetching = false;
    }
  }
  private requestSnapshot() {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN || this.pending.size) return;
    this.parts = {};
    for (const [kind, method] of [
      ["nodes", "common:getNodes"],
      ["statuses", "common:getNodesLatestStatus"],
    ] as const) {
      const id = ++rpcId;
      this.pending.set(id, kind);
      ws.send(JSON.stringify({ jsonrpc: "2.0", id, method, params: {} }));
    }
    this.timeout = setTimeout(() => {
      if (ws !== this.ws) return;
      this.fail(new Error("实时连接超时，重新连接"));
      ws.close();
    }, 11000);
  }
  private clearPending() {
    this.pending.clear();
    this.parts = {};
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = null;
  }
  private connect(gen: number) {
    if (gen !== this.gen || document.hidden) return;
    let ws: WebSocket;
    try {
      ws = new WebSocket(
        `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/rpc2`,
      );
    } catch {
      this.retry = setTimeout(() => this.connect(gen), 5000);
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      if (ws === this.ws && gen === this.gen) {
        this.clearPending();
        this.requestSnapshot();
      }
    };
    ws.onmessage = (event) => {
      if (ws !== this.ws || gen !== this.gen || document.hidden) return;
      try {
        const data = JSON.parse(event.data);
        const kind = this.pending.get(data.id);
        if (!kind) return;
        if (data.error) throw new ApiError(data.error.code, data.error.message);
        if (data.jsonrpc !== "2.0" || !("result" in data))
          throw new Error("RPC 响应格式错误");
        this.pending.delete(data.id);
        this.parts[kind] = data.result;
        if (!this.pending.size) {
          const snapshot = normalizeSnapshot(
            this.parts.nodes,
            this.parts.statuses,
          );
          this.clearPending();
          this.accept(snapshot, "Live");
        }
      } catch (e) {
        this.clearPending();
        this.fail(e);
        ws.close();
      }
    };
    ws.onerror = () => ws.close();
    ws.onclose = () => {
      if (ws !== this.ws || gen !== this.gen) return;
      this.ws = null;
      this.clearPending();
      if (!this.error) {
        this.connection = "Polling";
        this.emit();
      }
      void this.fetchOnce(gen);
      this.retry = setTimeout(() => this.connect(gen), 5000);
    };
    this.timeout = setTimeout(() => {
      if (ws !== this.ws || gen !== this.gen || document.hidden) return;
      this.fail(new Error("实时连接握手超时，重新连接"));
      // Retire directly: closing CONNECTING need not deliver onclose promptly.
      ws.onclose = null;
      ws.onerror = null;
      ws.close();
      this.ws = null;
      this.clearPending();
      void this.fetchOnce(gen);
      this.retry = setTimeout(() => this.connect(gen), 5000);
    }, 11000);
  }
  start(demo = false) {
    this.demo = demo;
    if (demo) return;
    document.addEventListener("visibilitychange", this.visibility);
    this.resume();
  }
  setDemo(data: NodeInfo[]) {
    this.accept(data, "Demo");
  }
  private visibility = () => {
    if (document.hidden) this.pause();
    else this.resume();
  };
  refresh = () => {
    if (this.demo || document.hidden) return;
    if (this.ws?.readyState === WebSocket.OPEN) this.requestSnapshot();
    else void this.fetchOnce(this.gen);
  };
  private tick(gen: number) {
    if (document.hidden) return;
    if (this.ws?.readyState === WebSocket.OPEN) this.requestSnapshot();
    else void this.fetchOnce(gen);
  }
  private pause() {
    this.gen++;
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
    if (this.timer) clearInterval(this.timer);
    if (this.retry) clearTimeout(this.retry);
    this.timer = this.retry = null;
    this.clearPending();
  }
  private resume() {
    this.pause();
    if (document.hidden) return;
    const gen = this.gen;
    void this.fetchOnce(gen);
    this.timer = setInterval(() => this.tick(gen), 5000);
    this.connect(gen);
  }
  destroy() {
    this.pause();
    document.removeEventListener("visibilitychange", this.visibility);
  }
}
