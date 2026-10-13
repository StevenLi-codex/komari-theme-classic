# Komari Classic · 经典监控台

原生 **Komari 1.3.0** 主题，保留 Windows 95/2000 蓝色标题栏、立体边框、卡片、导航树、资源进度条和 SVG 曲线。

**原设计与上游作者：[ayingQAQ / monitor-theme-classic](https://github.com/ayingQAQ/monitor-theme-classic)**（基于上游 1.0.4，commit `988df2e`）。Komari 协议移植维护：StevenLi-codex。此项目不是 Komari 官方主题。原 MIT 版权及第三方资源声明保留于 `LICENSE`、`THIRD_PARTY.md`、`THIRD_PARTY_NOTICES.txt`。

## 安装与回滚

1. 从 [Releases](https://github.com/StevenLi-codex/komari-theme-classic/releases) 下载 `theme.zip` 和 `theme.zip.sha256`。如果尚无 Release，请按下方构建。
2. 核对：`sha256sum -c theme.zip.sha256`。
3. 登录 **Komari 管理后台 → 主题管理 → 上传主题**，上传 `theme.zip`，然后选择 **Komari Classic**。不要上传源码 ZIP，不要解压后重新加目录。
4. 在主题配置中设置标题（留空跟随站点名称）、卡片列数 2–5、侧栏、历史曲线、网络速率、纯文本公告。
5. 刷新首页，核对节点、在线状态、详情、历史和管理后台链接。

**回滚：**切换回默认主题或之前主题即可；该主题不修改节点、历史数据库或 agent。切换前记录原主题名称与配置，保留原安装包。不要删除正在使用的主题。

## 功能与边界

- UUID 节点详情、国家/分组筛选、搜索、卡片/紧凑视图、隐藏/恢复、最小化、资源告警、到期告警、性能/网络/硬件详情、键盘操作、移动端、设备本地偏好。
- 原生 `/api/rpc2` HTTP 与 WebSocket JSON-RPC；5 秒主动刷新，关联请求 ID，断线重连、HTTP 回退、页面隐藏暂停、保留旧数据显示连接失败与刷新时间。无核心功能第三方请求。
- `/api/me` 读取登录状态，`/api/public` 读取站点标题、保留时长（小时）与 `theme_settings`；后台仍是 Komari 内置 `/admin`。
- 只从 `common:getNodes` 白名单建立节点，不把多余状态变成节点；不显示私有 remark、token/IP。
- Ping `-1` 是丢包/曲线断点；丢包率使用服务器任务的完整查询窗口统计，不用降采样图点推算。探测类型由 Komari 配置，不固定为 TCP。
- **月流量与剩余额度 N/A**：本端口只获得累计计数，未确认可用的公开月结算 API；绝不把 `net_total_up/down` 当月用量。价格 `-1` 是未知；billing_cycle 单位为天。
- 测试/demo 使用明确标记的合成数据，不是生产数据；demo 不进入安装包。
- 当前兼容性目标及验证范围是 **Komari 1.3.0**；没有宣称其他版本兼容。

## 开发、验证与打包

需要 Node.js 24+、Python 3.11+。

```sh
npm ci
npm run check
npm test
npx playwright install --with-deps chromium
npm run test:ui
npm run pack
sha256sum -c theme.zip.sha256
```

输出 `dist/`、`theme.zip`、`theme.zip.sha256`。ZIP 根目录包含 `komari-theme.json`、`dist/index.html` 及版权声明；打包可复现，JS/CSS 带内容哈希。

```sh
KOMARI_SERVER=http://127.0.0.1:25777 npm run dev
# 本地 demo: http://127.0.0.1:4173/demo.html
```

开发代理转发同源 API/WebSocket；不要将本地开发服务器暴露公网。预览图片沿用上游视觉资产。详细协议映射见 [协议核对](docs/protocol-audit.md)。
