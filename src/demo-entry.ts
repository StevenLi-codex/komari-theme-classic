import { demo } from "./demo-data.js";
import type { NodeInfo } from "./types.js";
declare const __MAIN_ASSET__: string;
const scenario = new URLSearchParams(location.search).get("scenario");
const data: NodeInfo[] = structuredClone(demo);
if (scenario === "edge") {
  data[0].name = "生产环境 / 东京 · 超长节点名称用于验证手机和桌面布局不溢出";
  data[0].public_remark = "维护窗口：每周日 02:00，长备注按安全文本显示。";
  data[1].online = false;
  data[1].metrics = null;
  data[1].last_seen_ago = 5400;
  data[2].metrics = null;
  data[3].metrics = { cpu: 18 };
  data[4].expires_in = -2;
  data[5].price = 0;
  data[5].group = "全部";
  data[6].group = "";
  data[6].expires_in = 2;
  data[7].name = "<img src=x onerror=alert(1)>";
  data[7].group = "*";
}
(window as Window & { __X86_DEMO_NODES__?: NodeInfo[] }).__X86_DEMO_NODES__ =
  scenario === "empty" ? [] : data;
await import(__MAIN_ASSET__);
