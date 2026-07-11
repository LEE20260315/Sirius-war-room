# Checklist

## P0-1: 行情源激活
- [x]settings.html 新增"启用自动行情"开关
- [x]开关开启后 dataSource='auto'，保存后自动调用 fetchPricesNow
- [x]数据源模式改为 auto/manual 二选一
- [x]pool.html 首次打开提示"建议启用自动行情源"（仅一次）
- [x]三路降级链正常工作（futsseapi → 东财 → 新浪 → 手动）
- [x]观察池现价列显示自动获取的价格

## P0-2: API Key 安全存储
- [x]app-core.js 新增 saveSecure/loadSecure/removeSecure 函数（sessionStorage）
- [x]saveSettings 不再将 apiKey 写入 state.settings
- [x]Token 从 sessionStorage 读取，不进入 localStorage 序列化
- [x]settings.html Token 输入框 type=password
- [x]关闭浏览器标签后 Token 自动清除

## P1-1: GitHub Gist 同步
- [x]app-core.js 新增 syncToGist() 函数
- [x]首次同步创建私有 Gist，gistId 存 sessionStorage
- [x]后续同步 PATCH 更新 Gist
- [x]restoreFromGist() 从 Gist 恢复 state
- [x]checkAutoBackup 末尾自动调用 syncToGist（有 Token 时）
- [x]401 时提示"Token 已失效"
- [x]settings.html 新增 Gist 同步配置卡片
- [x]"立即同步"和"从Gist恢复"按钮工作正常

## P1-2: 开仓价预填 + 通知推送
- [x]openTradeModal 预填选中品种现价到 tradePrice
- [x]品种下拉切换时更新 tradePrice
- [x]现价为 0 时留空
- [x]refreshSignals 检测信号从非买入变为买入
- [x]Notification.permission='granted' 时弹出通知
- [x]通知标题和 body 内容正确
- [x]signal.html 新增"开启信号通知"按钮
- [x]授权后按钮变为"已开启通知"并禁用

## P2-1: 交易日志搜索过滤
- [x]journal.html 新增搜索过滤栏（品种+类型+关键词）
- [x]renderJournal 支持过滤参数
- [x]品种下拉过滤正常
- [x]类型下拉过滤正常
- [x]关键词搜索实时过滤（oninput）
- [x]清空过滤显示全部
- [x]空结果显示"无匹配日志"

## P2-2: XSS 防护
- [x]renderTrades 中用户输入字段经过 escapeHtml
- [x]renderRolloverHistory 中 note 字段经过 escapeHtml
- [x]renderDashboard 动态文本安全
- [x]renderJournal 已全量 escapeHtml（复核确认）
- [x]输入 `<script>alert(1)</script>` 不执行

## 端到端验证
- [x]node -c 语法检查 app-core.js 通过
- [x]node -c 语法检查 ui-core.js 通过
- [x]推送所有修改文件到 GitHub 成功
- [x]线上设置页启用行情源后观察池价格自动刷新
- [x]线上交易页开仓价自动预填
- [x]线上日志页搜索过滤功能正常
