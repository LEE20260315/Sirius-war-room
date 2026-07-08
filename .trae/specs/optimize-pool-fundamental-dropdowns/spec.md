# 观察池与基本面页优化（交易所分类下拉 + 修复缺失模块）Spec

## Why
当前线上 `https://lee20260315.github.io/futures-tracker/pages/pool.html` 存在致命 bug：`shared/` 目录下仅有 `app-core.js`，而所有页面都引用了 `signal-engine.js`、`trade-engine.js`、`chart-engine.js`、`ui-core.js` 四个**根本不存在**的文件。这导致 `FTRender` 对象完全未定义，进而：
- 观察池表格始终为空（`FTRender.renderPool` 不存在）
- "添加品种" / "添加合约" 按钮点击无任何反应（`FTRender.addPoolRow` 不存在）
- 基本面、信号、交易、日志、仪表盘页面全部无法渲染
- 数据源状态条仍显示"13/14 成功"——因为 `state.pool` 在 `loadState()` 时被填入了 13 个 `DEFAULT_COMMODITIES`，但用户在 UI 上看不到，造成"没有品种却仍在刷新十几个"的错觉
- `FTApp.toggleAutoRefresh` / `FTApp.updateRefreshInterval` 在 HTML 中被调用却未在 `FTApp` 导出对象中暴露

此外，手动输入品种的方式效率低，页面切换闪烁刺眼，刷新间隔档位不符合实际需求。

## What Changes
- **修复缺失模块**：创建 `shared/ui-core.js`，定义 `FTRender` 全局对象，实现观察池/基本面等页面的渲染逻辑；创建 `signal-engine.js`、`trade-engine.js`、`chart-engine.js` 三个最小存根文件（保证 404 不再出现且不报错），核心渲染集中在 `ui-core.js`。
- **修复导出遗漏**：在 `app-core.js` 的 `FTApp` 导出对象中补上 `toggleAutoRefresh`、`updateRefreshInterval`、`startAutoRefresh`、`stopAutoRefresh`、`fetchPricesFromCustomApi`、`exportData`、`importData`、`handleImport`、`toggleAutoBackup` 等被 HTML/逻辑调用但未导出的函数。
- **BREAKING**：观察池"添加品种"由手动输入改为**按期货交易所分类的下拉选择器**，内置 SHFE / DCE / CZCE / GFEX / CFFEX 五大交易所及其品种清单；选择品种后自动填入默认主力合约、乘数、保证金率、costLine 占位。
- **BREAKING**：刷新间隔档位调整为 `1分钟 / 5分钟 / 30分钟 / 1小时`（即 60 / 300 / 1800 / 3600 秒），默认 1 分钟；同步更新所有页面 `<select id="refreshInterval">` 的 option 与 `localStorage` 默认值。
- **预置观察池**：将 `DEFAULT_COMMODITIES` 替换为用户指定的 8 个品种——棕榈油、白糖、天然橡胶、铜、黄金、白银、多晶硅、棉花；并在观察池表格中按"农产品 / 黑色系 / 有色金属 / 贵金属 / 能源化工 / 新能源"分类分组显示（分组小节标题行）。
- **合约选择器**：每个品种的"合约"列由静态文本改为可编辑下拉，默认为主力连续合约（如 `P0`/`SR0`/`RU0`/`CU0`/`AU0`/`AG0`/`PS0`/`CF0`），用户可手动输入具体合约代码（如 `P2609`）。
- **基本面页品种选择器**：`fundSpeciesSelect` 由扁平 `<option>` 列表改为 `<optgroup>` 按交易所分组的下拉，与观察池下拉共享同一份交易所-品种数据源。
- **页面切换过渡**：为 `<main>` 区域加入淡入过渡（`opacity` + `transform`，300ms），消除切换页面时白屏闪烁；保持 Claude 设计风格（沿用现有 `--color-*`/`--font-*` token，不引入新色系）。
- **数据源计数修正**：`fetchPricesNow` 中所有 `state.pool.length` 改为基于实际可见品种计数；当 `state.pool` 为空时显示"数据源: 手动模式 · 无品种"而非"0/0 成功"。
- **计算 bug 排查与修复**：检查 `getCurrentEquity`、`onPriceUpdate` 中引用的 `document.getElementById('tab-trade')` / `'tab-dashboard'`（当前页面是 SPA-style tab 但实际是多页 HTML，这些元素在新页面架构下不存在）逻辑，改为安全判空。
- **飞书日报基本面数据集成**：从用户的外部系统（飞书多维表格 `Cxvob3GdTaEX2OspVWccfnWfnje` / `tblBxw2GPKuZx020`，每日从美国专业网站抓取的期货基本面日报）抽取数据，落盘为仓库内静态 `shared/fundamental-feed.json`；基本面页新增"外部基本面信号"面板，展示所选品种最新的 档位 / 分数 / 变化 / 完整日报摘要，作为客观判断依据。前端只读本地 JSON，不直接调用飞书 API（静态站点无法安全持有 token）。

## Impact
- Affected specs: 观察池渲染、基本面渲染、自动刷新、数据源状态、品种元数据、外部基本面数据集成
- Affected code:
  - `shared/app-core.js`（补全 FTApp 导出、修正数据源计数、更新 DEFAULT_COMMODITIES、新增交易所-品种主数据、修正 onPriceUpdate tab 引用、新增 `FEISHU_VARIETY_MAP` 名称归一化表）
  - `shared/ui-core.js`（**新建**，FTRender 全部渲染逻辑，含外部基本面信号面板渲染）
  - `shared/fundamental-feed.json`（**新建**，从飞书日报导出的最近 30 天数据，前端只读）
  - `shared/signal-engine.js`（**新建存根**）
  - `shared/trade-engine.js`（**新建存根**）
  - `shared/chart-engine.js`（**新建存根**）
  - `pages/pool.html`（下拉选择器、刷新间隔 option、过渡 class、分类分组容器）
  - `pages/fundamental.html`（品种下拉 optgroup、刷新间隔 option、过渡 class、新增"外部基本面信号"面板容器）
  - `pages/dashboard.html` / `pages/signal.html` / `pages/trade.html` / `pages/journal.html` / `pages/settings.html`（统一刷新间隔 option、过渡 class、移除对不存在元素的强依赖）

## ADDED Requirements

### Requirement: 交易所分类品种主数据
系统 SHALL 在 `app-core.js` 中维护一份 `EXCHANGE_VARIETIES` 主数据，按国内五大期货交易所分组，每条记录包含：`exchange`（交易所代码）、`category`（板块分类）、`symbol`（中文名）、`code`（合约代码前缀，如 `P`/`SR`/`RU`/`CU`/`AU`/`AG`/`PS`/`CF`）、`multiplier`（乘数）、`marginRate`（保证金率）、`defaultContract`（默认主力连续合约，如 `P0`）。

#### Scenario: 主数据覆盖用户指定品种
- **WHEN** 开发者查看 `EXCHANGE_VARIETIES`
- **THEN** 至少包含：棕榈油(DCE/农产品)、白糖(CZCE/农产品)、棉花(CZCE/农产品)、天然橡胶(SHFE/能源化工)、铜(SHFE/有色金属)、黄金(SHFE/贵金属)、白银(SHFE/贵金属)、多晶硅(GFEX/新能源)
- **AND** 同时覆盖原 DEFAULT_COMMODITIES 中其他常见品种（螺纹钢、铁矿石、玻璃、纯碱、甲醇、PVC、PP、玉米、生猪、尿素、烧碱、热卷）以保证信号/基本面页可选

### Requirement: 观察池品种下拉选择器
观察池页面 SHALL 将"+ 添加品种"按钮的行为改为弹出一个**按交易所分组**的下拉选择器（使用 `<optgroup>`），用户选择品种后自动新增一行，预填该品种的合约（默认主力连续）、乘数、保证金率。

#### Scenario: 用户从下拉选择品种
- **WHEN** 用户点击"+ 添加品种"
- **THEN** 弹出包含五大交易所分组的下拉/modal
- **AND** 用户选择"棕榈油"
- **THEN** 观察池表格新增一行，合约列默认显示 `P0`，乘数为 10，保证金率为 0.08
- **AND** 新行立即可编辑、可保存

#### Scenario: 防止重复添加
- **WHEN** 用户尝试添加观察池中已存在的品种
- **THEN** 提示"该品种已在观察池中"，不重复新增

### Requirement: 合约可编辑下拉
观察池每行的"合约"列 SHALL 为可编辑的输入框 + 数据列表（`<input list>` + `<datalist>`），默认值为该品种主力连续合约，用户可输入具体月份合约（如 `P2609`）。

#### Scenario: 默认主力合约
- **WHEN** 新品种被加入观察池
- **THEN** 合约列显示该品种的 `defaultContract`（如铜显示 `CU0`）

#### Scenario: 用户切换具体合约
- **WHEN** 用户在合约列输入 `CU2609`
- **THEN** 输入框接受该值并保存到 `state.pool[i].contractCode`

### Requirement: 观察池按板块分组显示
观察池表格 SHALL 在渲染时按品种的 `category` 字段（农产品/黑色系/有色金属/贵金属/能源化工/新能源）分组，每组以小节标题行（跨列、`bg-surface-dim`、`font-serif`）分隔。

#### Scenario: 分组渲染
- **WHEN** 观察池包含棕榈油、白糖、铜、黄金、多晶硅
- **THEN** 表格依次显示"农产品"小节标题 → 棕榈油行、白糖行 → "有色金属"小节标题 → 铜行 → "贵金属"小节标题 → 黄金行 → "新能源"小节标题 → 多晶硅行

### Requirement: 刷新间隔档位调整
所有页面的刷新间隔 `<select id="refreshInterval">` SHALL 仅提供四档：`1分钟(60)` / `5分钟(300)` / `30分钟(1800)` / `1小时(3600)`，默认选中 `60`。

#### Scenario: 档位变更
- **WHEN** 用户打开任意页面顶部的刷新间隔下拉
- **THEN** 仅看到上述四个选项，不再有 30秒/2分钟

### Requirement: 基本面品种下拉按交易所分组
基本面页面的 `#fundSpeciesSelect` SHALL 使用 `<optgroup label="交易所名">` 按交易所分组，数据源与观察池共用 `EXCHANGE_VARIETIES`。

#### Scenario: 基本面下拉分组
- **WHEN** 用户在基本面页打开品种下拉
- **THEN** 看到"上海期货交易所"、"大连商品交易所"、"郑州商品交易所"、"广州期货交易所"、"中国金融期货交易所"五个分组
- **AND** 每个分组下为该交易所的品种

### Requirement: 页面切换淡入过渡
所有页面的 `<main>` 区域 SHALL 在 `DOMContentLoaded` 后通过添加 `page-enter` class 触发淡入动画（`opacity: 0 → 1`，`transform: translateY(8px) → 0`，时长 300ms，easing `cubic-bezier(0.4,0,0.2,1)`），消除切换闪烁。

#### Scenario: 切换页面无白屏闪烁
- **WHEN** 用户从观察池点击导航到基本面页
- **THEN** 新页面 main 区域以 300ms 淡入呈现，不出现整页白屏闪烁

### Requirement: FTRender 渲染对象
系统 SHALL 在 `shared/ui-core.js` 中定义 `window.FTRender` 对象，至少导出：`renderPool`、`addPoolRow`、`savePool`、`removePoolRow`、`loadFundamental`、`saveFundamental`、`refreshSignals`、`renderDashboard`、`renderTrades`、`renderJournal`、`openTradeModal`、`openJournalModal`、`openVarietyPicker`、`renderExternalFundSignal`、`loadFundamentalFeed`。

#### Scenario: 观察池首次渲染
- **WHEN** `pool.html` 的 `DOMContentLoaded` 触发并调用 `FTRender.renderPool()`
- **THEN** 表格 `#poolBody` 渲染出当前 `state.pool` 的所有品种行，按板块分组
- **AND** 空池时显示 `empty-state` 提示

### Requirement: 飞书日报基本面数据落盘
系统 SHALL 在仓库内维护 `shared/fundamental-feed.json`，内容由飞书多维表格 `Cxvob3GdTaEX2OspVWccfnWfnje` / `tblBxw2GPKuZx020` 的最近 30 天记录导出生成。每条记录字段：`date`（YYYY-MM-DD）、`weekday`、`summary`（今日概况）、`signalChange`（信号变化）、`anomalyAlert`（异常告警）、`dataStatus`、`fullReport`（完整日报原文，可截断至 4000 字符）、`varieties`（对象，key 为品种名，value 为 `{score, level, change}`）。前端 SHALL 仅通过 `fetch('../shared/fundamental-feed.json')` 读取，不直接调用飞书 API。

#### Scenario: 数据文件存在且可读
- **WHEN** 基本面页加载并调用 `FTRender.loadFundamentalFeed()`
- **THEN** 成功 fetch `shared/fundamental-feed.json` 并缓存到 `window.__fundFeed`
- **AND** 失败时面板显示"外部数据加载失败，请稍后重试"，不阻塞页面其余功能

#### Scenario: 品种名称归一化
- **WHEN** 飞书数据中品种为"橡胶"/"黄金"/"白银"
- **THEN** 系统通过 `FEISHU_VARIETY_MAP` 映射为项目符号"天然橡胶"/"黄金"(亦兼容"金")/"白银"(亦兼容"银")
- **AND** 反向映射用于在面板中按用户选择的品种符号查找飞书记录

### Requirement: 基本面页外部信号面板
基本面页 SHALL 在品种选择器下方、5 维度评分表上方，新增"外部基本面信号（每日日报）"面板，展示所选品种在最近一日的 `level`（档位）、`score`（分数）、`change`（变化）以及日报摘要，并显示数据日期。

#### Scenario: 选中品种有飞书数据
- **WHEN** 用户在基本面页选择"棕榈油"
- **THEN** 面板显示：数据日期（如 2026-07-06）、档位徽章（"加仓"=绿色 / "底仓"=黄绿 / "不动"=中性黄 / "警惕拥挤"=红色）、分数（如 70.2）、变化（如 +20.2，带↑/↓箭头与颜色）
- **AND** 下方显示该品种在完整日报中的对应段落（截取"【品种名】"开头的小节）
- **AND** 显示"今日概况"与"异常告警"摘要

#### Scenario: 选中品种无飞书数据
- **WHEN** 用户选择"棉花"（飞书日报未覆盖）
- **THEN** 面板显示"该品种暂无外部日报数据"占位
- **AND** 不影响下方 5 维度手动评分功能

#### Scenario: 档位徽章配色沿用 Claude 设计 token
- **WHEN** 渲染档位徽章
- **THEN** "加仓"用 `--color-success` 背景、"底仓"用 `--color-brand-500`、"不动"用 `--color-surface-muted`、"警惕拥挤"用 `--color-error`，不引入新色系

## MODIFIED Requirements

### Requirement: 数据源状态计数
`fetchPricesNow` 中所有计数 SHALL 基于实际 `state.pool` 长度；当 `state.pool` 为空时，状态条显示"数据源: 手动模式 · 观察池为空"，不触发任何网络请求。

#### Scenario: 空池不刷新
- **WHEN** `state.pool.length === 0` 且用户点击"立即刷新"
- **THEN** 不发起 EastMoney/Sina 请求
- **AND** 状态条显示"数据源: 手动模式 · 观察池为空"
- **AND** Toast 提示"观察池为空，请先添加品种"

### Requirement: FTApp 导出完整性
`window.FTApp` 导出对象 SHALL 包含所有被 HTML `onchange`/`onclick` 调用的函数，至少包括：`toggleAutoRefresh`、`updateRefreshInterval`、`fetchPricesNow`、`toggleTheme`、`initTheme`、`loadState`、`loadSettings`、`initAutoRefresh`、`initAutoBackup`、`updateBackupDisplay`、`populateFundSelect`、`escapeHtml`、`showToast`、`openModal`、`closeModal`、`exportData`、`importData`、`handleImport`、`toggleAutoBackup`、`saveSettings`、`state`、`DEFAULT_COMMODITIES`、`FUND_DIMENSIONS`、`getCurrentEquity`、`getRealizedEquity`、`onPriceUpdate`、`setDataSourceStatus`、`setLastUpdateTime`、`isSweetSignal`、`updateHeaderStats`。

#### Scenario: 切换自动刷新不报错
- **WHEN** 用户在任意页面切换"自动刷新"开关
- **THEN** `FTApp.toggleAutoRefresh()` 正常执行，不抛出 "is not a function"

### Requirement: DEFAULT_COMMODITIES 预置品种
`DEFAULT_COMMODITIES` SHALL 默认包含用户指定的 8 个品种（棕榈油、白糖、天然橡胶、铜、黄金、白银、多晶硅、棉花），每条记录字段对齐 `EXCHANGE_VARIETIES` 中的元数据（含 `category` 字段），合约默认为主力连续。

#### Scenario: 首次访问预置品种
- **WHEN** 全新浏览器（无 localStorage）首次访问观察池
- **THEN** 表格按板块分组显示上述 8 个品种，合约列分别为 `P0`/`SR0`/`RU0`/`CU0`/`AU0`/`AG0`/`PS0`/`CF0`

### Requirement: onPriceUpdate 安全判空
`onPriceUpdate` SHALL 在引用 `document.getElementById('tab-trade')` / `'tab-dashboard'` 前做 `null` 判空，避免在多页 HTML 架构下抛错。

#### Scenario: 价格更新不因 tab 元素缺失而报错
- **WHEN** 价格刷新完成调用 `onPriceUpdate()`
- **THEN** 即使当前页面不存在 `tab-trade` 元素，也不抛出 `Cannot read property 'classList' of null`

## REMOVED Requirements

### Requirement: 手动输入品种名称
**Reason**: 用户要求"能自动的就自动，不要去手动"，按交易所分类下拉更高效且避免拼写错误。
**Migration**: 旧 `state.pool` 中已存在的品种数据保留不变；新增品种一律通过下拉选择器。对于 `EXCHANGE_VARIETIES` 未覆盖的品种，仍保留"自定义输入"入口作为兜底。
