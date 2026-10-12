# Monitor Classic v1.0.1

协议核对后的修复版本，包含 README 整理与网络探测边界修复。

- README 删除「手机布局」「主题设置」「本地开发」「检查与打包」章节，保留安装、功能与桌面预览。
- 按官方主题开发指南及架构协议完成框架、接口和数据语义核对，记录见 `docs/protocol-audit.md`。
- 修复一条探测线路全超时时，遮挡其他有效线路曲线的问题。
- 最新探测全部超时时显示 N/A，不沿用历史成功延迟。
- 缺失聚合丢包率且存在超时记录时显示 N/A，不误报 0%。

## 安装与更新

在 Hub 主题管理中更新 Monitor Classic，或上传本 Release 的 `theme.tar.gz`。

GitHub 安装地址：`https://github.com/ayingQAQ/monitor-theme-classic`。

另附 `theme.tar.gz.sha256`，用于核对下载文件。主题短名仍为 `monitor-classic`，版本 `1.0.1` 对应 tag `v1.0.1`。

后续每次项目更新均同步新的正式 Release，不覆盖历史发布。
