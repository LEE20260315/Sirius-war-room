# Tasks

- [x]Task 1: app-core.js 新增安全存储 + Gist 同步 + 设置改造
  - [x]SubTask 1.1: 新增 `saveSecure(key, value)` / `loadSecure(key)` / `removeSecure(key)` 函数，使用 sessionStorage 存储敏感信息
  - [x]SubTask 1.2: 新增 `syncToGist()` 函数：POST/PATCH 私有 Gist，首次创建保存 gistId 到 sessionStorage，401 时提示 Token 失效
  - [x]SubTask 1.3: 新增 `restoreFromGist()` 函数：从 Gist 恢复 state，Object.assign 合并
  - [x]SubTask 1.4: 修改 `saveSettings()`：不再将 apiKey 写入 state.settings；dataSource 改为 'auto'/'manual'
  - [x]SubTask 1.5: 修改 `checkAutoBackup()`：末尾若有 loadSecure('githubToken') 则调用 syncToGist
  - [x]SubTask 1.6: FTApp 导出 saveSecure/loadSecure/syncToGist/restoreFromGist

- [x]Task 2: settings.html 行情源引导 + Gist 同步配置区
  - [x]SubTask 2.1: 数据源设置区新增"启用自动行情"开关（checkbox），映射到 dataSource='auto'/'manual'
  - [x]SubTask 2.2: 新增 GitHub Gist 同步配置卡片：Token 输入框（type=password）+ Gist ID 显示 + "立即同步"/"从Gist恢复"按钮
  - [x]SubTask 2.3: saveSettings 保存时，Token 通过 saveSecure 存 sessionStorage，不进入 state
  - [x]SubTask 2.4: loadSettings 加载时，Token 从 sessionStorage 读取回填输入框
  - [x]SubTask 2.5: 数据源模式下拉改为 auto/manual 二选一（移除 api 选项或降为高级设置）

- [x]Task 3: ui-core.js openTradeModal 开仓价预填 + 品种切换联动
  - [x]SubTask 3.1: openTradeModal 打开时预填选中品种的观察池现价到 tradePrice
  - [x]SubTask 3.2: 为品种下拉 select 添加 onchange 事件，切换品种时更新 tradePrice 为新品种现价
  - [x]SubTask 3.3: 现价为 0 时留空不预填

- [x]Task 4: ui-core.js refreshSignals 信号通知推送
  - [x]SubTask 4.1: 在 refreshSignals 中记录上次信号状态（用模块级变量 lastSignalMap）
  - [x]SubTask 4.2: 当某品种信号从非买入变为买入（估值灯 green 且 isSweetSignal=true）且 Notification.permission='granted'，弹出通知
  - [x]SubTask 4.3: 通知标题"📈 {品种} 触发做多信号"，body 显示"估值{pct}% · 成本价差{diff}"
  - [x]SubTask 4.4: FTApp 导出 requestNotificationPermission 函数

- [x]Task 5: signal.html 通知权限按钮
  - [x]SubTask 5.1: 在信号引擎页面顶部新增"开启信号通知"按钮
  - [x]SubTask 5.2: 点击调用 Notification.requestPermission()，授权后按钮变为"已开启通知"并禁用
  - [x]SubTask 5.3: 页面加载时若 Notification.permission='granted'，按钮直接显示"已开启通知"

- [x]Task 6: journal.html 搜索过滤栏 + renderJournal 过滤
  - [x]SubTask 6.1: journal.html 新增搜索过滤栏：品种下拉(全部/各品种) + 类型下拉(全部/交易/信号/观察/风控) + 关键词输入框
  - [x]SubTask 6.2: renderJournal 支持过滤参数：根据品种、类型、关键词过滤 items 再渲染
  - [x]SubTask 6.3: 过滤栏 oninput/onchange 实时触发 renderJournal
  - [x]SubTask 6.4: 空结果时显示"无匹配日志"提示

- [x]Task 7: ui-core.js 全量 XSS 防护审计
  - [x]SubTask 7.1: 审计 renderTrades 中所有 innerHTML 赋值，确保用户输入字段（reason 等）经过 escapeHtml
  - [x]SubTask 7.2: 审计 renderRolloverHistory 中 note 字段是否经过 escapeHtml
  - [x]SubTask 7.3: 审计 renderDashboard 中所有动态文本是否安全
  - [x]SubTask 7.4: 确认 renderJournal 已全量 escapeHtml（当前代码看起来已做，复核确认）

- [x]Task 8: pool.html 首次打开引导提示
  - [x]SubTask 8.1: DOMContentLoaded 中，若 dataSource='manual' 且 state.pool 非空，延迟 2 秒 toast 提示"建议在设置页启用自动行情源"
  - [x]SubTask 8.2: 提示仅显示一次（用 sessionStorage 标记 'pool_hint_shown'）

- [x]Task 9: 语法检查 + 推送 GitHub + 线上验证
  - [x]SubTask 9.1: node -c 语法检查 app-core.js 和 ui-core.js
  - [x]SubTask 9.2: 推送修改的文件到 GitHub
  - [x]SubTask 9.3: 线上验证：设置页启用行情源后观察池价格自动刷新
  - [x]SubTask 9.4: 线上验证：交易页开仓价自动预填
  - [x]SubTask 9.5: 线上验证：日志页搜索过滤功能正常

# Task Dependencies
- Task 2 依赖 Task 1（需要 saveSecure/loadSecure/syncToGist）
- Task 3, 4, 7 互相独立，可并行修改 ui-core.js 的不同函数
- Task 5 依赖 Task 4（需要 requestNotificationPermission）
- Task 6 独立
- Task 8 独立
- Task 9 依赖 Task 1-8 全部完成
