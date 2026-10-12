import type { NodeInfo } from "./types.js";
export const demo: NodeInfo[] = [
  ["Tokyo-01", "JP", "生产环境", 28, 40, 42, 36, 24, 6, 14.6, 3.2],
  ["Los Angeles-01", "US", "生产环境", 12, 39, 61, 128, 12, 14, 6.2, 1.8],
  ["Frankfurt-01", "DE", "生产环境", 46, 45, 38, 92, 30, 1, 12.8, 4.9],
  ["Singapore-01", "SG", "生产环境", 18, 48, 55, 68, 18, 22, 9.1, 2.4],
  ["Tokyo-02", "JP", "开发环境", 33, 26, 47, 41, 16, 5, 8.4, 1.6],
  ["Los Angeles-02", "US", "开发环境", 22, 35, 36, 119, 8, 17, 5.6, 1.2],
  ["Frankfurt-02", "DE", "备份节点", 53, 32, 32, 98, 22, 11, 18.4, 6.1],
  ["Singapore-02", "SG", "备份节点", 16, 35, 41, 62, 14, 9, 7.3, 2.1],
].map(
  ([name, country, group, cpu, mem, disk, ping, days, hours, down, up], i) => ({
    id: i + 1,
    name: String(name),
    online: true,
    country: String(country),
    group: String(group),
    sort: i,
    metrics: {
      cpu: Number(cpu),
      mem_used: (Number(mem) / 100) * 8 * 1024 ** 3,
      mem_total: 8 * 1024 ** 3,
      disk_used: (Number(disk) / 100) * 80 * 1024 ** 3,
      disk_total: 80 * 1024 ** 3,
      uptime: (Number(days) * 24 + Number(hours)) * 3600,
      net_rx: (Number(down) * 1e6) / 8,
      net_tx: (Number(up) * 1e6) / 8,
      load: [0.4, 0.32, 0.25],
      total_rx: 523 * 1024 ** 3,
      total_tx: 39 * 1024 ** 3,
      month_rx: 123 * 1024 ** 3,
      month_tx: 14 * 1024 ** 3,
    },
    traffic_limit: 1024 ** 4,
    month_used: 137 * 1024 ** 3,
    expires_in: 120,
    last_seen_ago: 3,
    cpu_cores: 2,
    os: "Debian",
    arch: "x86_64",
    public_remark: "演示节点",
    // Latency only exists via dedicated Hub probe data, not a guaranteed part of node metrics.
    _demoPing: Number(ping),
    _demoProbes: {
      probes: { "1": "上海电信", "2": "北京联通", "3": "广州移动" },
      loss: { "1": 0, "2": 1.2, "3": 0.4 },
      step: 3600,
      ping: [1, 2, 3].flatMap((task_id) =>
        Array.from({ length: 24 }, (_, j) => ({
          task_id,
          ts: 1780000000 + j * 3600,
          latency:
            j === 12 && task_id === 2
              ? null
              : Number(ping) + task_id * 8 + Math.sin(j * 0.7) * 12,
        })),
      ),
    },
  }),
) as NodeInfo[];
