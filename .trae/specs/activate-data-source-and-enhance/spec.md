# 激活行情源与系统增强 Spec

## Why

根据专业评测报告，系统框架设计扎实但存在 6 项关键缺陷：行情数据源代码已写好但未在设置页引导激活、API Key 明文存储有安全风险、开仓价需手动输入、信号无推送、交易日志无搜索、部分 innerHTML 未做 XSS 防护。本 spec 覆盖 P0+P1+P2 共 6 项任务，使系统从"可用"升级为"好用"。

## What Changes

### P0-1: 行情源三路激活 + 自动降级
- **设置页新增「一键启用行情源」引导**：在 settings.html 数据源设置区新增"启用自动行情"开关，开启后自动调用 fetchPricesNow 并启动自动刷新
- **三路自动降级已实现**：fetchPricesNow 已实现 futsseapi → 东财JSONP → 新浪 → 手动的降级链，无需修改核心逻辑
- **设置页数据源模式简化**：将 `manual` / `api` 二选一改为 `auto`（三路自动降级）/ `manual`（纯手动），移除自定义 API URL 作为主选项（保留为高级设置）
- **首次打开引导**：pool.html 加载时若 dataSource='manual' 且观察池有品种，toast 提示"建议在设置页启用自动行情源"

### P0-2: API Key 安全存储改造
- **GitHub Token / API Key 改用 sessionStorage**：新增 `saveSecure(key, value)` / `loadSecure(key)` 辅助函数，敏感信息存 sessionStorage（关闭标签即清除）
- **settings.html 新增 GitHub Gist 同步配置区**：Token 输入框 + Gist ID 显示 + 同步/恢复按钮
- **saveSettings 不再将 token 写入 state**：Token 从 sessionStorage 读取，不进入 localStorage 的 state 序列化
- **Token 失效检测**：syncToGist 的 catch 块检测 401 状态，提示"Token 已失效，请重新设置"

### P1-1: GitHub Gist 自动同步
- **新增 syncToGist()**：将 state 序列化为 JSON 上传到私有 Gist，首次自动创建并保存 gistId
- **新增 restoreFromGist()**：页面加载时若有 token + gistId，从 Gist 恢复数据
- **挂载到自动备份定时器**：checkAutoBackup 末尾若有 token 则调用 syncToGist
- **设置页新增手动同步/恢复按钮**

### P1-2: 开仓价自动预填 + 浏览器通知推送
- **开仓价预填**：openTradeModal 打开时，读取选中品种的观察池最新现价预填入 tradePrice 输入框；品种切换时也自动更新
- **浏览器通知**：refreshSignals 中若信号状态从非买入变为买入（percentile≤25 + isSweetSignal），且 Notification.permission='granted'，弹出系统通知
- **通知权限请求**：signal.html 新增"开启信号通知"按钮，点击请求 Notification 权限

### P2-1: 交易日志搜索/过滤
- **journal.html 新增搜索栏**：品种下拉过滤 + 关键词搜索框 + 类型过滤（交易/信号/观察/风控）
- **renderJournal 支持过滤参数**：根据搜索条件过滤日志条目再渲染
- **实时过滤**：输入时即时过滤（oninput 事件）

### P2-2: 全量 escapeHtml XSS 防护
- **审计所有 innerHTML 赋值**：ui-core.js 中 27 处 innerHTML 赋值，确保用户输入内容（日志标题/内容/教训、交易理由等）均经过 escapeHtml
- **renderTrades 的 reason 字段**：开仓/平仓理由若来自用户输入，渲染时需 escapeHtml
- **renderJournal 已做 escapeHtml**：确认日志渲染已安全，重点检查 trades 和 rollover 渲染

## Impact

- Affected specs: `fix-activate-percentile-cost-signal`（上一轮修复的延续）
- Affected code:
  - `shared/app-core.js`（新增 saveSecure/loadSecure/syncToGist/restoreFromGist；修改 saveSettings 不存 token；fetchPricesNow 无需改）
  - `shared/ui-core.js`（openTradeModal 预填价格；refreshSignals 通知推送；renderJournal 过滤；renderTrades XSS 审计）
  - `pages/settings.html`（新增行情源引导 + Gist 同步配置区 + Token 输入）
  - `pages/pool.html`（首次打开提示）
  - `pages/signal.html`（通知权限按钮）
  - `pages/journal.html`（搜索过滤栏）
  - `pages/trade.html`（品种切换时更新开仓价）

## ADDED Requirements

### Requirement: 一键启用行情源
settings.html 数据源设置区 SHALL 新增"启用自动行情"开关，开启后 dataSource 设为 'auto'，自动调用 fetchPricesNow + startAutoRefresh。

#### Scenario: 用户首次启用行情源
- **WHEN** 用户在设置页打开"启用自动行情"开关并保存
- **THEN** dataSource 设为 'auto'，自动调用 fetchPricesNow 获取价格
- **AND** 自动刷新定时器启动（间隔由 refreshInterval 控制）
- **AND** 观察池现价列显示自动获取的价格

#### Scenario: 三路自动降级
- **WHEN** fetchPricesNow 执行
- **THEN** 依次尝试 futsseapi（SHFE/DCE）→ 东财JSONP（CZCE/GFEX）→ 新浪
- **AND** 每个品种只要任一源成功即标记 ok，不再尝试其他源
- **AND** 全部失败时回退手动模式并 toast 提示

### Requirement: API Key 安全存储
系统 SHALL 提供 saveSecure(key, value) / loadSecure(key) 函数，将敏感信息（GitHub Token、API Key）存入 sessionStorage 而非 localStorage。

#### Scenario: 保存 GitHub Token
- **WHEN** 用户在设置页输入 GitHub Token 并保存
- **THEN** Token 通过 saveSecure('githubToken', value) 存入 sessionStorage
- **AND** Token 不出现在 state.settings 中，不进入 localStorage 序列化
- **AND** 关闭浏览器标签后 Token 自动清除

#### Scenario: 页面加载读取 Token
- **WHEN** 页面加载需要 Token 时
- **THEN** 通过 loadSecure('githubToken') 从 sessionStorage 读取
- **AND** 若 Token 不存在（标签已关闭），静默跳过 Gist 同步

### Requirement: GitHub Gist 自动同步
系统 SHALL 提供 syncToGist() 将 state 同步到私有 Gist，restoreFromGist() 从 Gist 恢复。

#### Scenario: 首次同步创建 Gist
- **WHEN** 用户配置 Token 后点击"立即同步"
- **THEN** 调用 POST /gists 创建私有 Gist，内容为 state JSON
- **AND** 返回的 gistId 通过 saveSecure 存入 sessionStorage
- **AND** toast 提示"数据已同步到 GitHub Gist"

#### Scenario: 后续同步更新 Gist
- **WHEN** 已有 gistId，再次同步
- **THEN** 调用 PATCH /gists/{gistId} 更新内容
- **AND** toast 提示"数据已同步"

#### Scenario: Token 失效
- **WHEN** syncToGist 收到 401 响应
- **THEN** toast 提示"Token 已失效，请重新设置"
- **AND** 不崩溃，不影响其他功能

#### Scenario: 自动备份时同步
- **WHEN** checkAutoBackup 触发且 sessionStorage 有 Token
- **THEN** 自动调用 syncToGist

### Requirement: 开仓价自动预填
openTradeModal SHALL 读取选中品种的观察池最新现价预填入开仓价输入框。

#### Scenario: 打开开仓模态框
- **WHEN** 用户点击"添加交易"
- **THEN** 品种下拉默认选中第一个品种
- **AND** 开仓价输入框预填该品种的观察池现价
- **AND** 若现价为 0 则留空

#### Scenario: 切换品种更新价格
- **WHEN** 用户在开仓模态框切换品种
- **THEN** 开仓价自动更新为新选中品种的现价

### Requirement: 信号通知推送
refreshSignals SHALL 在信号从非买入变为买入时弹出浏览器通知。

#### Scenario: 触发买入通知
- **WHEN** 某品种信号从"观望"变为"买入"（percentile≤25 + isSweetSignal）
- **AND** Notification.permission='granted'
- **THEN** 弹出系统通知"📈 {品种} 触发做多信号"
- **AND** 通知 body 显示信号原因

#### Scenario: 请求通知权限
- **WHEN** 用户在 signal.html 点击"开启信号通知"按钮
- **THEN** 调用 Notification.requestPermission()
- **AND** 授权后按钮变为"已开启通知"并禁用

### Requirement: 交易日志搜索过滤
journal.html SHALL 提供品种过滤 + 关键词搜索 + 类型过滤。

#### Scenario: 按品种过滤
- **WHEN** 用户在品种下拉选择"白糖"
- **THEN** 日志列表仅显示品种为"白糖"的条目

#### Scenario: 关键词搜索
- **WHEN** 用户在搜索框输入"止损"
- **THEN** 日志列表显示标题或内容包含"止损"的条目
- **AND** 实时过滤（oninput 触发）

#### Scenario: 清空过滤
- **WHEN** 用户清空搜索框且品种选"全部"
- **THEN** 显示所有日志条目

### Requirement: 全量 XSS 防护
所有 innerHTML 赋值中包含用户输入的部分 SHALL 经过 escapeHtml。

#### Scenario: 交易理由含 HTML
- **WHEN** 用户在开仓理由输入 `<script>alert(1)</script>`
- **THEN** renderTrades 渲染时该内容被转义为 `&lt;script&gt;alert(1)&lt;/script&gt;`
- **AND** 不执行脚本

## MODIFIED Requirements

### Requirement: 数据源模式
dataSource 从 'manual'/'api' 改为 'auto'/'manual'。'auto' 启用三路自动降级，'manual' 纯手动。自定义 API URL 保留为高级设置但不再是主选项。

### Requirement: saveSettings 不存 Token
saveSettings SHALL 不再将 API Key / GitHub Token 写入 state.settings。敏感信息通过 saveSecure 存 sessionStorage。

### Requirement: openTradeModal 预填价格
openTradeModal SHALL 在品种选择变化时更新开仓价预填值（当前只在打开时预填第一个品种）。
