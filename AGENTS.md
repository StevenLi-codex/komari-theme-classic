# 项目交付规则

用户要求：每次项目更新必须同步 GitHub 正式 Release，包括源码、README、预览图或发布相关文件的更新。不要只推送 main 就结束任务。

- 常规修复与文档更新递增补丁版本；较大功能更新按语义化版本处理。
- package.json、package-lock.json、theme.json、README 和 tag 保持版本一致。
- 不覆盖已发布 tag 和附件，以新版本发布。
- Release 固定附带 theme.tar.gz 和 theme.tar.gz.sha256，不使用草稿或预发布作为正式交付。
- 版本变化后刷新预览图。电脑比例为 1920×1200，保持原始比例。
- 发布前完成适当回归、构建和安装包检查；发布后核验附件哈希并运行 Verify published release 工作流。
- 用户已经授权本仓库公开发布和每次更新同步 Release；普通版本更新不重复请求确认。
