# 协议、框架与接口核对

检查日期：2026-10-13。范围为 Monitor Classic 当前源码、构建和安装包；不涉及修改 Monitor Hub 或 agent。

依据：[官方主题开发指南](https://monitor-document.pages.dev/dev/theme)、[官方架构与协议](https://monitor-document.pages.dev/dev/architecture)。

## 框架和职责

官方要求主题为浏览器运行的静态单页应用，Hub 提供构建产物，不在安装时编译源码。架构图中的 React 是内置后台/默认主题的实现，不构成第三方主题必须使用 React 或 Vite 的要求。

本项目使用 TypeScript、esbuild、原生 DOM/CSS/SVG，输出 `dist/index.html` 和静态资源；安装包不包含 Node 服务、开发代理或演示数据。npm 锁文件记录依赖，TypeScript 负责类型检查，Playwright 负责浏览器回归。

agent 的 JSON-RPC `hello`、`report`、`ping.result` 和 Bearer token 连接属于 agent ↔ Hub。本主题不访问 `/api/agent/*`、不读取 agent token、不模拟采集，也不自己从内核计数器累加流量。

## 浏览器接口

| 接口 | 实现 | 核对结果 |
| --- | --- | --- |
| `GET /api/me` | `getMe()` | 同源读取名称、登录状态、`history_days`；缺失历史天数回退 7 天，异常结构拒绝进入页面状态 |
| `GET /api/nodes` | `NodeStream.fetchOnce()` | 快照结构校验、节点去重、非法指标区分；过期 HTTP 回复不会覆盖更新的 WebSocket 快照 |
| `GET /api/nodes/{id}/metrics` | `getHistory()` / `getPing()` | `hours` 跟随保留期，`points=120`，按 `series=metrics` 或 `series=ping` 请求 |
| WebSocket `/api/ws?gzip` | `NodeStream.connect()` | 同源 `ws/wss`；支持文本和 Blob gzip，串行解压，连接失效后的帧丢弃 |
| `GET /api/themes/monitor-classic/config` | `loadConfig()` | 清单声明默认值，检查保存值；失败、404、无效响应回退默认值，不弹错误 |

主题只读这些接口。访客显示偏好存在 `localStorage`，站点设置由 Hub 保存；本主题没有自带站点设置写入界面，因此不需要 `PUT /api/themes/{short}/config`。

## 数据语义与连接恢复

- `online=false` 是离线，`online=true` 且 `metrics=null` 是等待首次上报；不完整指标单独标为异常，缺失值不当成 0。
- 到期使用 `expires_in`，最近上报使用 `last_seen_ago`；字段不存在才兼容旧 Hub，`null` 与缺字段分开处理。
- 瞬时速率按 Hub 的 B/s 转换为十进制 bit/s；累计流量使用 Hub 的 `total_rx/total_tx`，额度计费使用 `month_used`，不根据网卡 lifetime 计数器计算。
- 指标历史使用时间戳和 `step`，有空值或缺失时间段时断开曲线。未提供 `cpu_max/net_rx_max/net_tx_max` 时仍显示平均指标，不声称展示瞬时峰值。
- 探测名称来自 `probes`，按 `task_id` 首次出现顺序画线；探测超时保留 `latency=null`，丢包率使用 Hub 聚合 `loss`，不平均各桶的百分比。
- WebSocket 失效时每 5 秒轮询并重连；11 秒没有有效帧触发恢复。不可解码帧不延长有效连接计时。
- 页面隐藏关闭 WebSocket、停止轮询；历史请求与快照回复通过代次校验丢弃。返回前台立即取快照并重连。
- Hub 纯文本错误经安全转义显示；反代 HTML 不进入页面。401 清除旧节点快照；配置失败不会阻断主页面。

## 路由、静态资源和安装

- 主入口 `/`；详情 `/#/node/{id}`，hash 不发送到服务器，刷新仍请求根入口。`/admin` 留给 Hub。
- 标签页与页头使用 `/favicon.svg`，触摸图标使用 `/apple-touch-icon.png`。PNG 实测 180×180，保持 Hub 的图标替换路径。
- JavaScript/CSS 文件名包含 SHA-256 内容哈希，以适应 Hub 的静态资源长期缓存。
- `theme.json` 包含必需字段，`short=monitor-classic`，`url` 为公开仓库，已发布 `1.0.0` 对应 `v1.0.0`。
- 根目录提供 MIT 许可证，`preview.png` 为 1920×1200（16:10）。包验证覆盖 gzip 完整性、根目录、路径、类型、数量、体积、版本及资源哈希。
- 已发布 v1.0.0 通过官方主题列表检查器的真实 Hub 上传安装检查：[验证记录](https://github.com/ayingQAQ/monitor-theme-classic/actions/runs/38276792817)。这是安装验收，不等于所有真实部署环境或升级路径均已测试。

## 本次发现与修复

1. **一条线路全超时会遮住其他正常线路曲线。** 旧合并图的空数据判断只检查最后 120 条记录，Hub 按探测分组返回时，最后一组全空会覆盖其他有效线。现在按全部探测是否存在有效值判断，保留各线路自己的超时断点。
2. **卡片延迟可能沿用超时前的旧值。** 旧实现寻找历史中最后一个成功值，现在只从最新时间戳内取值；最新时间全部超时则显示 `N/A`。
3. **缺失聚合丢包率时不应给出误导性的 0%。** 已有超时记录但缺失 `loss` 时显示 `N/A`，不根据有限历史点伪造整个查询范围的百分比。

以上已在当前源码修复，两个新增浏览器用例先复现失败后验证通过。类型检查、14 项单元/构建检查、31 项浏览器回归通过。

本次更新同步 `main` 源码与 README；已发布的 v1.0.0 tag 和 Release 附件保持原样，不重写历史发布。这些修复需后续版本安装包才能进入已有 Hub 安装。
