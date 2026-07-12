# 基本面页评分逻辑按数据来源分档改造 Spec

## Why

当前 `pages/fundamental.html` 的基本面评分存在两类"假分"问题：
1. **综合分倒填五维**：`FTRender.loadFundamental`（实现于 `shared/ui-core.js`，由基本面页调用）把外部日报的"综合分（0–100）"按阈值（≥60→8/7、≥45→6/5…）直接倒填进"供需/库存/基差"三个维度，这些分数并无对应指标出处；无外部数据时又用历史百分位反推，形成循环论证。
2. **综合分把空维度当 0 分**：`updateFundTotal` 用简单 `sum/50`，未采集到的维度被当作 0 分计入，系统性压低综合分。

此外外部信号面板存在 OIL_WTI 同一 stale 告警被重复渲染 7 次的 bug，且缺少数据新鲜度提示。本 spec 把评分改为"按数据真实来源分档填充，无来源则留空标注"，核心原则：**页面上每一分要么有明确数据出处，要么明确标注"无数据源"，禁止用综合分反推维度分。**

## What Changes

### 改动一：删除"综合分倒填五维"逻辑
- 删除 `loadFundamental` 中基于 `extScore`/百分位的 `autoScores`（basis/supply/inventory 三档阈值倒填）。
- 改为：解析外部日报 `fullReport` 中该品种小节里**真实存在的指标**，按前缀映射到对应维度。映射关系：
  - 宏观环境 ← `FRED*`（PCE/CPI/失业/2Y，如 `FRED_2YR_YIELD`）、`DXY`、`GPR`、`VIX`
  - 供需格局 ← `ONI`、`ENSO_FORECAST`、`MPOB_STOCK`、`WASDE_STOCK`（仅农产品小节出现）
  - 库存水平 ← `COMEX*`、`LME*`（如 `LME_COPPER_INV`）、`DOMESTIC_INV*`（`DOMESTIC_INV_RU/SR/LC`）、`COT*`（`COT_GOLD_NET_LONG` 等）
  - 基差结构 ← 目前无采集器 → 一律"—（待手动输入）"
  - 技术形态 ← 目前无采集器 → 一律"—（待手动输入）"
- 某维度在该品种小节内无对应有效（active）指标时，显示"—"或"无数据源"，**不给默认分或 0 分占位**。

### 改动二：分品种类别使用不同维度模板
- **农产品（棕榈油/天然橡胶/白糖）**：启用完整五维，供需/库存权重加重（主力品种）。basis/technical 仍显示"待手动输入"。
- **贵金属与铜（黄金/白银/铜）**：只亮"宏观环境"一档，其余维度标灰显示"无品种级数据源"，并在综合分旁标注"当前为宏观情绪分，非品种基本面"。
- **新能源/黑色（碳酸锂/螺纹钢/玻璃/多晶硅）**：走轻量模组，只显示仓单分位（从 `fullReport` 解析"仓单分位: XX.X"），保留"⚠ 轻量模组，仅供参考"标注。
- **品种→维度模板的映射抽成文件顶部独立 config 对象 `FUND_DIMENSION_CONFIG`**（含维度定义、指标→维度前缀映射、品种→模板、模板权重、拒绝出分阈值）。

### 改动三：综合分改为有效维度归一化 + 拒绝出分闸门
- 综合分只对"有真实指标的有效维度"做权重归一化：`综合(0-100) = Σ(dimScoreᵢ × wᵢ) / Σ(wᵢ有效) × 10`，不再把空维度当 0 分。
- 当有效维度权重占模板总权重 `< 50%` 时，综合分显示"数据不足，拒绝出分"，并列出缺失/过期项及原因（未更新/样本不足/疑似故障），与后台 README/日报"拒绝出分"规则（`active 权重 < 50%` → "未出分"）保持一致。
- 轻量模组品种不计算归一化综合分，直接展示仓单分位 + "⚠ 轻量模组，仅供参考"。

### 改动四：数据新鲜度与告警去重
- 综合分旁新增"数据新鲜度"角标：以外部日报 `record.date` 与当前系统日期比对，>3 天黄色、>7 天红色、正常灰色。
- 修复 `renderExternalFundSignal` 中 OIL_WTI 告警重复渲染 bug：`record.anomalyAlert` 按 `;` 拆分后**按指标名去重**（同一条 stale 告警只显示一次）。

## Impact

- **Affected code**：仅 `pages/fundamental.html`。通过在页面内联 `<script>`（加载于 `shared/ui-core.js` 之后）中定义 `FUND_DIMENSION_CONFIG` 并覆写 `FTRender.loadFundamental` / `FTRender.updateFundTotal` / `FTRender.renderExternalFundSignal` 实现；现有 `DOMContentLoaded` 初始化链对这些方法的调用会自动走到覆写版本。
- **不改动**：`shared/app-core.js`（`getFundamentalComposite` / `getEffectiveFundScore` / 采集逻辑保持不变，信号引擎 `signal.html` 仍直接用外部日报综合分作为基本面因子）、`shared/ui-core.js`（不直接编辑，仅在本页覆写其方法）、`shared/fundamental-feed.json`（只读）、后台采集。
- **Affected specs**：`optimize-pool-fundamental-dropdowns`（其"外部基本面信号面板"需求被本 spec 细化/收紧填充规则）。

## ADDED Requirements

### Requirement: 维度模板配置对象
基本面页 SHALL 在文件顶部内联脚本中定义独立 config 对象 `FUND_DIMENSION_CONFIG`，集中维护：维度清单（key/name/inputId/noteId）、指标→维度前缀映射、品种→模板、模板（启用维度/权重/标注/是否轻量）、拒绝出分阈值（0.5）。所有填充与计分逻辑均从该 config 读取，不得硬编码散落。

#### Scenario: 配置对象集中可读
- **WHEN** 开发者查看 `pages/fundamental.html` 顶部
- **THEN** 可见 `FUND_DIMENSION_CONFIG` 对象，含上述全部字段
- **AND** 后续填充/计分函数均引用该对象，无硬编码品种-维度分支

### Requirement: 按真实指标分档填充维度
`FTRender.loadFundamental` SHALL 解析所选品种在最新日报 `fullReport` 中对应小节的 active 指标（形如 `ONI 89.1 (正向,w=0.35) 样本239`），按 `FUND_DIMENSION_CONFIG.indicatorToDimension` 的前缀规则映射到维度；维度有 ≥1 个 active 指标时为"有效"，分数（0–10）由该维度指标的加权百分位归一化得出（反向指标取 `100-pct`）；维度无 active 指标时显示"—/无数据源"，不给默认分或 0 分占位。`fullReport` 缺失/品种未出分时，全部维度显示"无数据源"。

#### Scenario: 农产品维度按真实指标亮分
- **WHEN** 用户选择"白糖"
- **THEN** 解析白糖小节，ONI/WASDE_STOCK 映射到"供需格局"并亮分，DOMESTIC_INV_SR 映射到"库存水平"并亮分
- **AND** 宏观/基差/技术无对应 active 指标，显示"无数据源"或"待手动输入"
- **AND** 维度 note 标注来源指标（如"ONI 89.1, WASDE_STOCK 1.8"）

#### Scenario: 指标缺失维度不留假分
- **WHEN** 某维度在该品种小节内无 active 指标
- **THEN** 该维度评分列显示"—"，不写入 0 分、不进综合分归一化

### Requirement: 分品种类别维度模板
系统 SHALL 按 `FUND_DIMENSION_CONFIG.varietyTemplates` 为不同品种类别套用不同模板：农产品用完整五维模板（供需/库存权重加重）；贵金属与铜只亮宏观一档、其余标灰"无品种级数据源"并标注"当前为宏观情绪分，非品种基本面"；新能源/黑色走轻量模组、只显示仓单分位并标注"⚠ 轻量模组，仅供参考"。

#### Scenario: 贵金属只亮宏观
- **WHEN** 用户选择"白银"
- **THEN** 仅"宏观环境"亮分（FRED_2YR_YIELD/GPR/DXY），供需/库存/基差/技术标灰"无品种级数据源"
- **AND** 综合分旁显示"当前为宏观情绪分，非品种基本面"

#### Scenario: 轻量模组只显示仓单分位
- **WHEN** 用户选择"螺纹钢"
- **THEN** 维度表区显示仓单分位（如 30.9）+ "⚠ 轻量模组，仅供参考"
- **AND** 不计算归一化综合分

### Requirement: 有效维度归一化综合分 + 拒绝出分闸门
`FTRender.updateFundTotal` SHALL 仅对有效维度做权重归一化得到 0–100 综合分；当有效权重占模板总权重 `< 50%` 时显示"数据不足，拒绝出分"并列出缺失/过期项及原因（未更新/样本不足/疑似故障）。

#### Scenario: 有效权重足够时归一化出分
- **WHEN** 白糖有效维度为供需(0.35)+库存(0.30)，合计 0.65 ≥ 0.5
- **THEN** 综合分 = (供需分×0.35 + 库存分×0.30)/0.65 × 10，显示 0–100 数值与进度条

#### Scenario: 有效权重不足时拒绝出分
- **WHEN** 某品种有效权重占比 < 50%
- **THEN** 综合分位置显示"数据不足，拒绝出分"
- **AND** 下方列出缺失项及原因（如"OIL_WTI: 数据过期（7天未更新）[⚠疑似故障]"、"COT_*: 样本量不足"）

### Requirement: 数据新鲜度角标
`FTRender.renderExternalFundSignal` SHALL 在综合分/面板旁渲染数据新鲜度角标，以日报 `record.date` 与当前系统日期差值判定：≤3 天灰色、>3 天黄色、>7 天红色。

#### Scenario: 日报滞后变色
- **WHEN** 日报日期距今 5 天
- **THEN** 新鲜度角标显示黄色（如"滞后 5 天"）
- **AND** 距今 >7 天时显示红色

### Requirement: OIL_WTI 告警去重
`FTRender.renderExternalFundSignal` SHALL 对 `record.anomalyAlert` 按 `;` 拆分并按指标名去重，同一 stale 告警只渲染一次。

#### Scenario: 重复告警只显示一次
- **WHEN** anomalyAlert 含 7 条 "OIL_WTI延迟7天(⚠疑似故障)"
- **THEN** 面板告警区只渲染一条 "OIL_WTI延迟7天(⚠疑似故障)"

## MODIFIED Requirements

### Requirement: loadFundamental 填充逻辑
`FTRender.loadFundamental`（基本面页覆写版）SHALL 不再使用外部日报综合分或百分位反推维度分；改为解析 `fullReport` 真实指标按 `FUND_DIMENSION_CONFIG` 映射分档填充，并按品种模板灰显/标注无数据源维度；手动保存的 basis/technical 分仍可回填到对应输入框。

### Requirement: updateFundTotal 综合分计算
`FTRender.updateFundTotal`（覆写版）SHALL 改为有效维度权重归一化（0–100）+ 拒绝出分闸门（有效权重 < 50% 时显示"数据不足，拒绝出分"并附缺失原因清单），不再使用 `sum/50`。

### Requirement: renderExternalFundSignal 面板
`FTRender.renderExternalFundSignal`（覆写版）SHALL 新增数据新鲜度角标，并对 anomalyAlert 按指标名去重后渲染；其余档位徽章/分数/变化/摘要/品种段落展示保持原设计 token 配色不变。

## REMOVED Requirements

### Requirement: 综合分倒填五维
**Reason**: 用外部日报综合分按阈值倒填 basis/supply/inventory 产生无数据来源的假分，违反"每一分都要有出处"原则；无外部数据时用百分位反推形成循环论证。
**Migration**: 维度分改由 `fullReport` 真实指标加权归一化得出；无指标维度显示"—/无数据源"，不再反推。`app-core.js` 中 `getFundamentalComposite`/`getEffectiveFundScore`（信号引擎基本面因子用）保持不变，不在本页使用综合分反推维度分。
