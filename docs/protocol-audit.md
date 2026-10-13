# Komari 协议核对

目标：Komari 1.3.0。对照源码 `web/rpc/jsonrpc/common.go`、`common.record.go`、`database/models/models.go`、`database/utils.go`、`database/models/theme.go`、`web/api/admin/theme.go`。

| 接口 | 合约/处理 |
| --- | --- |
| GET `/api/me` | 原始对象 `logged_in`；不是 Monitor envelope |
| GET `/api/public` | `data.sitename`、`theme_settings` 对象/JSON字符串；保留时间单位小时 |
| RPC `common:getNodes` | UUID字典，只映射该白名单，额外过滤 hidden；丢弃 token、remark、IP |
| RPC `common:getNodesLatestStatus` | UUID字典；`ram`→mem_used、`disk`→disk_used、net_in/out→速率、net_total→累计；connections 已包含 UDP，TCP = connections - connections_udp |
| RPC `common:getRecords` load | `{type:"load",uuid,hours,maxCount:120}`；records[uuid] 时间转 Unix 秒，缺字段 null、零保留 |
| RPC `common:getRecords` ping | tasks 提供名称和完整窗口 loss；records value <0→null；不以降采样计算丢包率 |
| WebSocket `/api/rpc2` | 主动 JSON-RPC 请求与响应 ID；5秒更新、11秒超时、5秒重连、HTTP回退、visibility暂停 |
| 主题 ZIP | 根 komari-theme.json；configuration.type=managed，data 中 switch/string/number/textbox；dist/index.html |
| 静态资源 | `/themes/komari-classic/dist/` 命名空间支持首页与主题子路径（Komari `/themes/:id/*path` 从主题根读取，必须包含 dist）；API始终同源绝对路径 |

`billing_cycle` 天，负价格未知，expired_at 为 RFC3339。累计流量不是月流量，月用量/额度剩余保持 N/A。没有额外扫描其他节点、没有第三方请求。

单元测试为合成 fixtures；Playwright demo/接口测试也明确是合成数据。真实匿名 API 浏览器验证通过临时只读网关进行；网关自身没有 `/themes/komari-classic` 静态别名，因此 smoke 测试仅对静态请求做同源根路径改写，API/WS全部真实转发。实际 Komari 服务原生支持该主题资源路径。
