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
async function request<T>(url: string, timeout = 15000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
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
export const getNodes = (): Promise<{ nodes: NodeInfo[] }> =>
  request("/api/nodes");
export async function getMe(): Promise<Me> {
  const raw = await request<Me>("/api/me");
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new ApiError(200, "站点信息格式错误");
  return {
    site_name: typeof raw.site_name === "string" ? raw.site_name : undefined,
    name: typeof raw.name === "string" ? raw.name : undefined,
    history_days: valid(raw.history_days)
      ? Math.min(365, Math.max(1, Math.floor(raw.history_days)))
      : 7,
    authed: raw.authed === true,
  };
}
export async function getHistory(id: number, hours = 24): Promise<NodeHistory> {
  const data = await request<NodeHistory>(
    `/api/nodes/${id}/metrics?hours=${hours}&points=120&series=metrics`,
  );
  if (!data || !Array.isArray(data.metrics))
    throw new ApiError(200, "历史数据格式错误");
  return {
    ...data,
    metrics: data.metrics.filter(
      (p) => p && typeof p === "object" && valid(p.ts),
    ),
  };
}
export async function getPing(
  id: number,
  hours = 6,
): Promise<import("./types.js").PingHistory> {
  const data = await request<import("./types.js").PingHistory>(
    `/api/nodes/${id}/metrics?hours=${hours}&points=120&series=ping`,
  );
  if (!data || !Array.isArray(data.ping))
    throw new ApiError(200, "延迟数据格式错误");
  return {
    probes: Object.fromEntries(
      Object.entries(data.probes ?? {}).filter(
        ([, name]) => typeof name === "string",
      ),
    ),
    loss: data.loss,
    step: data.step,
    ping: data.ping.filter(
      (p) => p && valid(p.ts) && (p.latency === null || valid(p.latency)),
    ),
  };
}
export function sanitizeNodes(value: unknown): NodeInfo[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<number>();
  return value
    .filter(
      (n): n is NodeInfo =>
        !!n &&
        typeof n === "object" &&
        Number.isSafeInteger(n.id) &&
        n.id >= 0 &&
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
  private retry: ReturnType<typeof setTimeout> | null = null;
  private poll: ReturnType<typeof setInterval> | null = null;
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  private gen = 0;
  private nodes: NodeInfo[] | null = null;
  private error: string | null = null;
  private last: number | null = null;
  private connection = "连接中";
  private demo = false;
  private frameChain = Promise.resolve();
  private fetching: number | null = null;
  private revision = 0;
  constructor(private notify: Listener) {}
  private emit() {
    this.notify(this.nodes, this.error, this.last, this.connection);
  }
  private accept(raw: unknown, transport: "Live" | "Polling" = "Live") {
    const obj = raw as { nodes?: unknown } | null;
    if (!obj || !Array.isArray(obj.nodes))
      throw new ApiError(200, "节点数据格式错误");
    this.nodes = sanitizeNodes(obj.nodes);
    this.error = null;
    this.last = Date.now();
    this.connection = transport;
    this.revision++;
    this.emit();
  }
  private async fetchOnce(gen: number) {
    if (this.fetching === gen) return;
    this.fetching = gen;
    const revision = this.revision;
    try {
      const data = await getNodes();
      if (gen === this.gen && !document.hidden && revision === this.revision) {
        this.accept(data, "Polling");
      }
    } catch (e) {
      if (gen === this.gen && !document.hidden && revision === this.revision) {
        if (e instanceof ApiError && e.status === 401) {
          this.nodes = null;
          this.last = null;
        }
        this.error = (e as Error).message;
        this.connection = "Offline";
        this.emit();
      }
    } finally {
      if (this.fetching === gen) this.fetching = null;
    }
  }
  start(demo = false) {
    this.demo = demo;
    if (demo) return;
    document.addEventListener("visibilitychange", this.visibility);
    this.resume();
  }
  setDemo(data: NodeInfo[]) {
    this.nodes = data;
    this.error = null;
    this.connection = "Demo";
    this.last = Date.now();
    this.emit();
  }
  private visibility = () => {
    if (document.hidden) this.pause();
    else this.resume();
  };
  refresh = () => {
    if (!this.demo) void this.fetchOnce(this.gen);
  };
  private startPoll(gen: number) {
    if (!this.poll)
      this.poll = setInterval(() => void this.fetchOnce(gen), 5000);
  }
  private connect(gen: number) {
    if (gen !== this.gen || document.hidden) return;
    const zip = typeof DecompressionStream === "function" ? "?gzip" : "";
    const url = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/ws${zip}`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      this.startPoll(gen);
      this.retry = setTimeout(() => this.connect(gen), 5000);
      return;
    }
    this.ws = ws;
    this.frameChain = Promise.resolve();
    const arm = () => {
      if (this.watchdog) clearTimeout(this.watchdog);
      this.watchdog = setTimeout(() => {
        if (ws !== this.ws) return;
        this.error = "实时连接超时，正在重连";
        this.connection = "重新连接中";
        this.emit();
        this.resume();
      }, 11000);
    };
    arm();
    ws.onmessage = (event: MessageEvent<string | Blob>) => {
      this.frameChain = this.frameChain
        .then(async () => {
          let content: string;
          if (typeof event.data === "string") content = event.data;
          else if (typeof DecompressionStream === "function")
            content = await new Response(
              event.data.stream().pipeThrough(new DecompressionStream("gzip")),
            ).text();
          else throw new Error("Unsupported binary frame");
          if (
            ws !== this.ws ||
            ws.readyState !== WebSocket.OPEN ||
            gen !== this.gen ||
            document.hidden
          )
            return;
          this.accept(JSON.parse(content));
          arm();
          if (this.poll) {
            clearInterval(this.poll);
            this.poll = null;
          }
        })
        .catch((e) => console.warn("Dropped unreadable monitor frame", e));
    };
    ws.onerror = () => ws.close();
    ws.onclose = () => {
      if (ws !== this.ws || gen !== this.gen) return;
      this.ws = null;
      if (this.watchdog) clearTimeout(this.watchdog);
      this.watchdog = null;
      this.connection = "Polling";
      this.emit();
      this.startPoll(gen);
      this.retry = setTimeout(() => this.connect(gen), 5000);
    };
  }
  private pause() {
    this.gen++;
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
    if (this.poll) clearInterval(this.poll);
    if (this.retry) clearTimeout(this.retry);
    if (this.watchdog) clearTimeout(this.watchdog);
    this.poll = this.retry = this.watchdog = null;
  }
  private resume() {
    this.pause();
    if (document.hidden) return;
    const gen = this.gen;
    void this.fetchOnce(gen);
    this.startPoll(gen);
    this.connect(gen);
  }
  destroy() {
    this.pause();
    document.removeEventListener("visibilitychange", this.visibility);
  }
}
