/** Monitor Hub public nodes snapshot. Omitted keys are legal; never infer a zero from them. */
export interface Metrics {
  uptime?: number;
  cpu?: number;
  load?: number[];
  mem_total?: number;
  mem_used?: number;
  swap_total?: number;
  swap_used?: number;
  disk_total?: number;
  disk_used?: number;
  net_rx?: number;
  net_tx?: number;
  total_rx?: number;
  total_tx?: number;
  month_rx?: number;
  month_tx?: number;
  tcp?: number;
  udp?: number;
  procs?: number;
}
export interface NodeInfo {
  id: string | number;
  name: string;
  sort?: number;
  public?: boolean;
  online: boolean;
  country?: string;
  group?: string;
  public_remark?: string;
  last_seen?: number | null;
  last_seen_ago?: number | null;
  metrics?: Metrics | null;
  mem_total?: number;
  disk_total?: number;
  os?: string;
  kernel?: string;
  arch?: string;
  virt?: string;
  cpu_name?: string;
  cpu_cores?: number;
  traffic_limit?: number;
  traffic_mode?: string;
  month_used?: number;
  month_rx?: number;
  month_tx?: number;
  total_rx?: number;
  total_tx?: number;
  expires_at?: string | null;
  expires_in?: number | null;
  price?: number;
  currency?: string;
  billing_cycle?: string;
  ip?: string;
  hostname?: string;
  remark?: string;
}
export interface HistoryPoint {
  ts: number;
  cpu: number | null;
  mem_used?: number | null;
  disk_used?: number | null;
  net_rx?: number | null;
  net_tx?: number | null;
}
export interface NodeHistory {
  metrics?: HistoryPoint[];
  ping?: unknown[];
  step?: number;
}
export interface PingHistory {
  ping: Array<{ ts: number; task_id?: number; latency: number | null }>;
  probes: Record<string, string>;
  loss?: Record<string, number>;
  step?: number;
}
export interface Me {
  site_name?: string;
  name?: string;
  history_days?: number;
  authed?: boolean;
}
export interface ThemeConfig {
  site_label: string;
  columns: number;
  show_sidebar: boolean;
  show_chart: boolean;
  show_traffic: boolean;
  notice: string;
}
