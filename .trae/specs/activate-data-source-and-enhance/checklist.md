# Checklist

## P0-1: 行情源激活
- [ ] settings.html 新增"启用自动行情"开关
- [ ] 开关开启后 dataSource='auto'，保存后自动调用 fetchPricesNow
- [ ] 数据源模式改为 auto/manual 二选一
- [ ] pool.html 首次打开提示"建议启用自动行情源"（仅一次）
- [ ] 三路降级链正常工作（futsseapi → 东财 → 新浪 → 手动）
- [ ] 观察池现价列显示自动获取的价格

## P0-2: API Key 安全存储
- [ ] app-core.js 新增 saveSecure/loadSecure/removeSecure 函数（sessionStorage）
- [ ] saveSettings 不再将 apiKey 写入 state.settings
- [ ] Token 从 sessionStorage 读取，不进入 localStorage 序列化
- [ ] settings.html Token 输入框 type=password
- [ ] 关闭浏览器标签后 Token 自动清除

## P1-1: GitHub Gist 同步
- [ ] app-core.js 新增 syncToGist() 函数
- [ ] 首次同步创建私有 Gist，gistId 存 sessionStorage
- [ ] 后续同步 PATCH 更新 Gist
- [ ] restoreFromGist() 从 Gist 恢复 state
- [ ] checkAutoBackup 末尾自动调用 syncToGist（有 Token 时）
- [ ] 401 时提示"Token 已失效"
- [ ] settings.html 新增 Gist 同步配置卡片
- [ ] "立即同步"和"从Gist恢复"按钮工作正常

## P1-2: 开仓价预填 + 通知推送
- [ ] openTradeModal 预填选中品种现价到 tradePrice
- [ ] 品种下拉切换时更新 tradePrice
- [ ] 现价为 0 时留空
- [ ] refreshSignals 检测信号从非买入变为买入
- [ ] Notification.permission='granted' 时弹出通知
- [ ] 通知标题和 body 内容正确
- [ ] signal.html 新增"开启信号通知"按钮
- [ ] 授权后按钮变为"已开启通知"并禁用

## P2-1: 交易日志搜索过滤
- [ ] journal.html 新增搜索过滤栏（品种+类型+关键词）
- [ ] renderJournal 支持过滤参数
- [ ] 品种下拉过滤正常
- [ ] 类型下拉过滤正常
- [ ] 关键词搜索实时过滤（oninput）
- [ ] 清空过滤显示全部
- [ ] 空结果显示"无匹配日志"

## P2-2: XSS 防护
- [ ] renderTrades 中用户输入字段经过 escapeHtml
- [ ] renderRolloverHistory 中 note 字段经过 escapeHtml
- [ ] renderDashboard 动态文本安全
- [ ] renderJournal 已全量 escapeHtml（复核确认）
- [ ] 输入 `<script>alert(1)</script>` 不执行

## 端到端验证
- [ ] node -c 语法检查 app-core.js 通过
- [ ] node -c 语法检查 ui-core.js 通过
- [ ] 推送所有修改文件到 GitHub 成功
- [ ] 线上设置页启用行情源后观察池价格自动刷新
- [ ] 线上交易页开仓价自动预填
- [ ] 线上日志页搜索过滤功能正常
