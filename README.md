# x86 Monitor

面向 Monitor Hub 的独立中文主题，使用 Windows 95/2000 管理控制台视觉：蓝色窗口标题、斜面边框、分段资源条与绿色性能曲线。当前版本 **0.3.0**，主题短名保持 `x86-monitor`，可更新已有同名主题。

## 安装

上传根目录的 `theme.tar.gz` 到 Hub → 主题管理，选择 x86 Monitor。`theme.tar.gz.sha256` 用于校验；源码 ZIP 不能作为安装包上传。包根目录直接包含 `theme.json` 与 `dist/`，不增加主题名目录。

站点设置在 Hub 中保存：主标题、宽屏列数、导航、历史图、速率与公告。个人显示偏好保存在访客浏览器；存储不可用时仍能正常访问。

## 本地开发

要求 Node.js 22+、npm；打包需要 Python 3.12+。不依赖全局 TypeScript。

```powershell
npm ci
npx playwright install chromium
npm run dev
```

默认地址 `http://127.0.0.1:4173`：

- `/`：真实同源 Hub 数据；断网不会替换成演示节点。
- `/demo.html`：明确标注的演示页面。
- `/demo.html?scenario=edge`：长名称、离线、等待上报、畸形指标、过期、特殊分组和文本转义案例。
- `/demo.html?scenario=empty`：空站点。
- `/#/node/{id}`：独立详情，四个分类页，支持浏览器返回、Esc 和直接刷新。

开发服务器监听本机回环地址，保存 `src/`、`public/`、`theme.json` 后自动重新构建，手动刷新浏览器查看。`PORT` 可调整端口。

```powershell
$env:MONITOR_HUB = 'https://your-test-hub.example'
npm run dev
```

`MONITOR_HUB` 只供开发服务器使用，不写入浏览器代码。默认 `http://127.0.0.1:9911`，代理 `/api/*`、WebSocket `/api/ws` 和 `/admin`。登录、权限和节点管理由 Hub 处理。

## 检查与打包

```powershell
npm run check
npm test
npm run test:ui
npm run screenshots
npm run pack
npm run verify-package
```

`npm test` 包含构建、实际数据格式化与校验测试、归档资源哈希检查；`test:ui` 使用 Chromium 验证桌面、手机、八个屏幕宽度、四个详情分类、焦点和滚动恢复、文本/gzip 实时更新、陈旧 HTTP 回复、历史范围与失败重试、断流重连、轮询、权限错误和存储被禁用。

截图命令自动启动临时预览服务，在根目录生成电脑、手机、详情与异常案例截图，`preview.png` 使用 1920×1200 电脑比例。正式包排除 `demo.html` 与演示数据脚本。

```text
theme.tar.gz
├── theme.json
├── preview.png
├── LICENSE
├── THIRD_PARTY.md
├── THIRD_PARTY_NOTICES.txt
└── dist/
    ├── index.html
    ├── assets/           # SHA-256 内容哈希 JS/CSS
    ├── flags/
    ├── favicon.svg
    └── apple-touch-icon.png
```

归档固定文件顺序和时间戳；相同构建与预览输入可重复生成相同校验值。验证覆盖 gzip CRC、文件类型、路径、数量、大小、版本与静态资源哈希。

## 结构与功能边界

`src/main.ts` 负责页面与交互，`api.ts` 负责 HTTP、WebSocket、串行解压和轮询，`format.ts` 负责状态/数值，`chart.ts` 负责 SVG 图表，`config.ts` 从 `theme.json` 读取默认配置。演示入口为 `demo-entry.ts`，数据为 `demo-data.ts`，与生产入口独立打包。页面不使用外部运行时 UI 库。

离线、等待首次上报、指标异常分别显示；缺失数值显示 N/A。累计流量取 Hub 统计，历史范围依据 `history_days`；到期与最后上报优先使用 `expires_in`、`last_seen_ago`，只在旧 Hub 缺字段时回退。节点名称、备注、公告、地区与图表文字均转义为安全文本。

## 发布与已知验证边界

本地测试使用真实浏览器与模拟 Hub 协议回复，不能替代实际 Hub 上传/升级验收。当前目录没有提供可访问的测试 Hub 和远端仓库地址，因此实际 Hub 安装、GitHub 安装和公开 Release 尚未验证。

发布时设置 `theme.json.url` 为自己的仓库地址，版本 `0.3.0` 对应 tag `v0.3.0`；正式 Release 上传 `theme.tar.gz` 与校验文件。完成测试 Hub 验收后再提交主题列表收录。

官方资料：[主题开发](https://monitor-document.pages.dev/dev/theme)、[架构与协议](https://monitor-document.pages.dev/dev/architecture)、[默认主题](https://github.com/monitor-probe/monitor-theme-default)。
