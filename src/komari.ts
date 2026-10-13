import type { NodeInfo, Metrics } from "./types.js";
import { valid } from "./format.js";
export const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
export const timestamp = (v: unknown): number | undefined =>
  typeof v === "string" && Number.isFinite(Date.parse(v))
    ? Date.parse(v) / 1000
    : undefined;
const text = (v: unknown): string | undefined =>
  typeof v === "string" ? v : undefined;
const num = (v: unknown): number | undefined => (valid(v) ? v : undefined);
function region(v: unknown): string | undefined {
  const s = text(v);
  if (!s) return undefined;
  if (/^[a-z]{2}$/i.test(s)) return s.toUpperCase();
  const p = [...s].map((c) => c.codePointAt(0)! - 127397);
  return p.length === 2 && p.every((c) => c >= 65 && c <= 90)
    ? String.fromCharCode(...p)
    : undefined;
}
export function normalizeSnapshot(
  nodes: unknown,
  statuses: unknown,
): NodeInfo[] {
  if (
    !nodes ||
    typeof nodes !== "object" ||
    Array.isArray(nodes) ||
    !statuses ||
    typeof statuses !== "object" ||
    Array.isArray(statuses)
  )
    throw new Error("节点数据格式错误");
  const reports = object(statuses);
  return Object.entries(object(nodes))
    .flatMap(([uuid, value]) => {
      const n = object(value),
        s = object(reports[uuid]);
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          uuid,
        ) ||
        typeof n.name !== "string" ||
        n.hidden === true
      )
        return [];
      const metrics: Metrics = {};
      const map: Record<string, keyof Metrics> = {
        cpu: "cpu",
        uptime: "uptime",
        ram: "mem_used",
        ram_total: "mem_total",
        swap: "swap_used",
        swap_total: "swap_total",
        disk: "disk_used",
        disk_total: "disk_total",
        net_in: "net_rx",
        net_out: "net_tx",
        net_total_down: "total_rx",
        net_total_up: "total_tx",
        process: "procs",
        connections_udp: "udp",
      };
      for (const [from, to] of Object.entries(map))
        if (valid(s[from])) (metrics as Record<string, unknown>)[to] = s[from];
      if (valid(s.connections) && valid(s.connections_udp))
        metrics.tcp = Math.max(0, s.connections - s.connections_udp);
      if ([s.load, s.load5, s.load15].every(valid))
        metrics.load = [s.load, s.load5, s.load15] as number[];
      return [
        {
          id: uuid,
          name: n.name,
          online: s.online === true,
          sort: num(n.weight),
          country: region(n.region),
          group: text(n.group),
          public_remark: text(n.public_remark),
          last_seen: timestamp(s.time),
          metrics: s.online === true ? metrics : null,
          mem_total: num(n.mem_total),
          disk_total: num(n.disk_total),
          os: text(n.os),
          kernel: text(n.kernel_version),
          arch: text(n.arch),
          virt: text(n.virtualization),
          cpu_name: text(n.cpu_name),
          cpu_cores: num(n.cpu_cores),
          price: num(n.price),
          currency: text(n.currency),
          billing_cycle:
            valid(n.billing_cycle) && n.billing_cycle > 0
              ? `${n.billing_cycle} 天`
              : undefined,
          expires_at:
            timestamp(n.expired_at) !== undefined
              ? text(n.expired_at)
              : undefined,
          traffic_limit: num(n.traffic_limit),
          traffic_mode: text(n.traffic_limit_type),
        },
      ];
    })
    .sort(
      (a, b) =>
        (a.sort ?? 0) - (b.sort ?? 0) ||
        String(a.id).localeCompare(String(b.id)),
    );
}
