import type { HistoryPoint } from "./types.js";
import { html, valid } from "./format.js";
export function chartSvg(
  points: Array<number | null>,
  label = "CPU（24小时）",
  width = 280,
  height = 90,
  options: { hours?: number; end?: number; unit?: string } = {},
): string {
  const data = points.slice(-120);
  const hasData = data.some(valid);
  const segments: string[] = [];
  let partial: string[] = [];
  data.forEach((v, i) => {
    if (valid(v)) {
      const x = 3 + (i / Math.max(data.length - 1, 1)) * (width - 6);
      const y = height - 4 - (Math.min(100, v) / 100) * (height - 8);
      partial.push(
        `${partial.length ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`,
      );
    } else if (partial.length) {
      segments.push(partial.join(" "));
      partial = [];
    }
  });
  if (partial.length) segments.push(partial.join(" "));
  const gridX = Array.from(
    { length: 13 },
    (_, i) => `<path d="M${((i * width) / 12).toFixed(1)} 0V${height}"/>`,
  ).join("");
  const gridY = Array.from(
    { length: 5 },
    (_, i) => `<path d="M0 ${((i * height) / 4).toFixed(1)}H${width}"/>`,
  ).join("");
  const end = options.end;
  const stamp = (ts: number) =>
    new Date(ts * 1000).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  const left = end
    ? stamp(end - (options.hours ?? 24) * 3600)
    : `${options.hours ?? 24} 小时前`;
  const right = end ? stamp(end) : "现在";
  const last = [...data].reverse().find(valid);
  return `<div class="graph ${hasData ? "" : "graph-empty"}"><div class="graph-caption"><span>${html(label)}</span><span>${hasData && last !== undefined ? `${last.toFixed(1)}${html(options.unit ?? "%")}` : "暂无历史"}</span></div>
    <div class="graph-plot"><span class="graph-scale graph-scale-top">100</span><span class="graph-scale graph-scale-bottom">0</span><svg class="graph-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="${html(label)}：${hasData ? "历史趋势" : "暂无历史数据"}"><g class="graph-grid">${gridX}${gridY}</g><g class="graph-line">${segments.map((d) => `<path d="${d}"/>`).join("")}</g></svg>${hasData ? "" : '<span class="graph-no-data">暂无历史数据</span>'}</div>
    <div class="graph-time"><span>${html(left)}</span><span>${html(right)}</span></div></div>`;
}
export function chartFromHistory(
  history: HistoryPoint[] | undefined,
): Array<number | null> {
  if (!Array.isArray(history)) return [];
  return history.map((p) => (p && valid(p.cpu) ? Math.min(100, p.cpu) : null));
}
export function demoChart(seed: number): number[] {
  return Array.from({ length: 72 }, (_, i) => {
    const base =
      10 +
      Math.abs(Math.sin(i * 0.26 + seed * 0.9)) * 9 +
      5 * Math.sin(i * 0.11 + seed);
    const pulse =
      Math.max(0, 1 - Math.abs(i - ((32 + seed * 3) % 60)) / 9) * 22;
    const jitter = Math.abs(Math.sin(i * 9.9 + seed * 13.4)) * 9;
    return Math.max(2, Math.min(88, base + pulse + jitter));
  });
}
