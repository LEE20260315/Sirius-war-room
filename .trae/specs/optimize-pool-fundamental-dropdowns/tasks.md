# Tasks

- [ ] Task 1: 修复 app-core.js 核心数据层与导出
  - [ ] SubTask 1.1: 新增 `EXCHANGE_VARIETIES` 主数据（五大交易所分组、含 category/multiplier/marginRate/defaultContract）
  - [ ] SubTask 1.2: 替换 `DEFAULT_COMMODITIES` 为用户指定的 8 个品种（棕榈油/白糖/天然橡胶/铜/黄金/白银/多晶硅/棉花），每条含 `category` 字段，合约为主力连续
  - [ ] SubTask 1.3: 补全 `FTApp` 导出对象，加入 `toggleAutoRefresh`、`updateRefreshInterval`、`startAutoRefresh`、`stopAutoRefresh`、`fetchPricesFromCustomApi`、`exportData`、`importData`、`handleImport`、`toggleAutoBackup` 等
  - [ ] SubTask 1.4: `onPriceUpdate` 中对 `getElementById('tab-trade')`/`'tab-dashboard'` 增加 null 判空
  - [ ] SubTask 1.5: `fetchPricesNow` 增加空池早返回逻辑（不发起网络请求，状态条显示"观察池为空"，Toast 提示）
  - [ ] SubTask 1.6: `initAutoRefresh` 默认间隔改为 `60`，并把 `refreshInterval` 的合法值校验放宽到包含 1800/3600

- [x] Task 2: 创建 shared/ui-core.js（FTRender 渲染对象）
  - [x] SubTask 2.1: 定义 `window.FTRender`，实现 `renderPool`（按 category 分组、分组标题行、品种行内联编辑、合约 input+datalist、操作列删除按钮）
  - [x] SubTask 2.2: 实现 `addPoolRow` / `openVarietyPicker`（弹出按交易所分组的品种选择 modal，含 `<optgroup>`，去重校验）
  - [x] SubTask 2.3: 实现 `removePoolRow`（删除并重渲染）
  - [x] SubTask 2.4: 实现 `savePool`（将表格中可编辑字段写回 `state.pool`，调用 `FTApp.saveState`）
  - [x] SubTask 2.5: 实现 `loadFundamental` / `saveFundamental`（读写 `state.fundamentals[symbol]`，5 维度评分 + 进度条更新）
  - [x] SubTask 2.6: 实现 `refreshSignals` / `renderDashboard` / `renderTrades` / `renderJournal` / `openTradeModal` / `openJournalModal`（最小可用实现，渲染表格/卡片，避免报错；trade/journal 模态框可保存到 state）
  - [x] SubTask 2.7: 实现 `loadFundamentalFeed`（fetch `../shared/fundamental-feed.json`，缓存到 `window.__fundFeed`，失败时容错）与 `renderExternalFundSignal`（按选中品种渲染档位徽章/分数/变化/日报摘要，使用 `FEISHU_VARIETY_MAP` 归一化）

- [x] Task 3: 创建三个存根文件 shared/signal-engine.js、trade-engine.js、chart-engine.js
  - [x] SubTask 3.1: 三个文件各写入最小占位内容（注释 + 空导出），确保 404 消失且不抛错

- [ ] Task 3.5: 从飞书日报导出 shared/fundamental-feed.json
  - [ ] SubTask 3.5.1: 用 `lark-cli base +record-list` 分页拉取飞书表 `Cxvob3GdTaEX2OspVWccfnWfnje` / `tblBxw2GPKuZx020` 最近 30 天记录（按 `日期` 字段降序）
  - [ ] SubTask 3.5.2: 将每条记录转换为 `{date, weekday, summary, signalChange, anomalyAlert, dataStatus, fullReport(截断4000), varieties: {品种:{score,level,change}}}` 结构
  - [ ] SubTask 3.5.3: 写入 `shared/fundamental-feed.json`，并在 app-core.js 中新增 `FEISHU_VARIETY_MAP`（橡胶↔天然橡胶、黄金↔金、白银↔银，其余同名）

- [ ] Task 4: 改造 pages/pool.html
  - [ ] SubTask 4.1: 顶部刷新间隔 `<select>` 改为 1分钟/5分钟/30分钟/1小时 四档
  - [ ] SubTask 4.2: `<main>` 标签加 `page-enter` 初始 class，DOMContentLoaded 后触发动画
  - [ ] SubTask 4.3: 添加品种选择 modal HTML（按交易所 optgroup + 自定义输入兜底）与 `<datalist id="contractList">`
  - [ ] SubTask 4.4: "+ 添加品种"按钮 onclick 改为 `FTRender.openVarietyPicker()`
  - [ ] SubTask 4.5: 注入 `page-enter` 关键帧 CSS（300ms fade+translate，沿用现有 token，Claude 风格）
  - [ ] SubTask 4.6: 分组标题行样式（跨 9 列、`bg-surface-dim`、`font-serif`、`text-ink-muted`、小字号）

- [ ] Task 5: 改造 pages/fundamental.html
  - [ ] SubTask 5.1: `#fundSpeciesSelect` 改为 `<optgroup>` 按交易所分组（数据由 `FTApp.populateFundSelect` 重写为分组渲染）
  - [ ] SubTask 5.2: 顶部刷新间隔 select 同步改为四档
  - [ ] SubTask 5.3: `<main>` 加 page-enter 过渡
  - [ ] SubTask 5.4: 在品种选择器下方、5 维度评分表上方新增 `<div id="externalFundPanel">` 容器，DOMContentLoaded 时调用 `FTRender.loadFundamentalFeed()` 加载数据并 `renderExternalFundSignal()` 渲染；品种切换时同步刷新该面板
  - [ ] SubTask 5.5: 档位徽章样式（加仓=success/底仓=brand-500/不动=surface-muted/警惕拥挤=error），沿用 Claude 设计 token

- [ ] Task 6: 改造其余页面（dashboard / signal / trade / journal / settings）
  - [ ] SubTask 6.1: 五个页面的刷新间隔 select 统一改为四档
  - [ ] SubTask 6.2: 五个页面的 `<main>` 加 page-enter 过渡 class 与 CSS
  - [ ] SubTask 6.3: 移除/修正对不存在 DOM 元素的强引用

- [ ] Task 7: 重写 populateFundSelect 为按交易所分组
  - [ ] SubTask 7.1: `app-core.js` 中 `populateFundSelect` 改为基于 `EXCHANGE_VARIETIES` 生成 `<optgroup>`，并把 `fundSpeciesSelect` 的 onchange 行为保持为 `FTRender.loadFundamental()`

- [ ] Task 8: 联调与回归验证
  - [ ] SubTask 8.1: 全新 localStorage 访问 pool.html，确认 8 个预置品种按板块分组显示
  - [ ] SubTask 8.2: 点击"+ 添加品种"，从下拉选择"螺纹钢"，确认新增到黑色系分组
  - [ ] SubTask 8.3: 切换"自动刷新"开关，确认无 "is not a function" 报错
  - [ ] SubTask 8.4: 切换刷新间隔到 1小时，确认 timer 正常重建
  - [ ] SubTask 8.5: 在基本面页打开品种下拉，确认五大交易所分组正确
  - [ ] SubTask 8.6: 清空 state.pool（localStorage 手动清空）后点击"立即刷新"，确认不发起网络请求且 Toast 提示"观察池为空"
  - [ ] SubTask 8.7: 在多页间来回切换，确认 main 区域淡入过渡无白屏闪烁
  - [ ] SubTask 8.8: 浏览器控制台无 JS 报错
  - [ ] SubTask 8.9: 基本面页选择"棕榈油"，确认外部信号面板显示最新日期的档位/分数/变化与日报摘要
  - [ ] SubTask 8.10: 基本面页选择"棉花"，确认面板显示"该品种暂无外部日报数据"占位且 5 维度评分仍可用
  - [ ] SubTask 8.11: 基本面页选择"天然橡胶"，确认通过 FEISHU_VARIETY_MAP 正确映射到飞书"橡胶"数据

# Task Dependencies
- Task 2 依赖 Task 1（FTRender 需要使用 EXCHANGE_VARIETIES、修正后的 FTApp 导出）
- Task 3.5 可与 Task 1 并行（导出飞书数据不依赖代码改动）
- Task 4 / Task 5 依赖 Task 2 与 Task 3.5（页面 onclick 调用 FTRender.*，基本面页需要 fundamental-feed.json）
- Task 6 依赖 Task 2（其他页面也调用 FTRender.*）
- Task 7 依赖 Task 1（populateFundSelect 需要 EXCHANGE_VARIETIES）
- Task 8 依赖 Task 1-7 + Task 3.5 全部完成
