import type { ThemeConfig } from "./types.js";
import manifest from "../komari-theme.json";
const defaults = Object.fromEntries(
  manifest.configuration.data
    .filter((f) => "key" in f)
    .map((f) => [f.key, f.default]),
) as unknown as ThemeConfig;
const pick = (saved: Record<string, unknown>): ThemeConfig => ({
  site_label:
    typeof saved.site_label === "string"
      ? saved.site_label.slice(0, 90)
      : defaults.site_label,
  columns:
    typeof saved.columns === "number" &&
    Number.isInteger(saved.columns) &&
    saved.columns >= 2 &&
    saved.columns <= 5
      ? saved.columns
      : defaults.columns,
  show_sidebar:
    typeof saved.show_sidebar === "boolean"
      ? saved.show_sidebar
      : defaults.show_sidebar,
  show_chart:
    typeof saved.show_chart === "boolean"
      ? saved.show_chart
      : defaults.show_chart,
  show_traffic:
    typeof saved.show_traffic === "boolean"
      ? saved.show_traffic
      : defaults.show_traffic,
  notice:
    typeof saved.notice === "string"
      ? saved.notice.slice(0, 1000)
      : defaults.notice,
});
export async function loadConfig(): Promise<ThemeConfig> {
  try {
    const r = await fetch(`/api/public`, {
      signal: AbortSignal.timeout(8000),
    });
    const envelope = r.ok ? await r.json() : null;
    let data = envelope?.data?.theme_settings;
    if (typeof data === "string") data = JSON.parse(data);
    return data && typeof data === "object" && !Array.isArray(data)
      ? pick(data)
      : defaults;
  } catch {
    return defaults;
  }
}
export { defaults };
