# Tasks

> 范围：仅改 `pages/fundamental.html`。通过页面内联 `<script>`（位于 `shared/ui-core.js` 之后）定义配置对象并覆写 `FTRender.loadFundamental` / `updateFundTotal` / `renderExternalFundSignal`；不编辑 `shared/*.js`、不改后台采集。

- [x] Task 1: 在 `pages/fundamental.html` 顶部内联脚本中定义 `FUND_DIMENSION_CONFIG` 配置对象
  - [x] 1.1 定义 `dimensions` 清单（key/name/inputId/noteId：macro/supply/inventory/basis/technical）
  - [x] 1.2 定义 `indicatorToDimension` 前缀映射（macro←FRED*/DXY/GPR/VIX；supply←ONI/ENSO_FORECAST/MPOB_STOCK/WASDE_STOCK；inventory←COMEX*/LME*/DOMESTIC_INV*/COT*）
  - [x] 1.3 定义 `varietyTemplates`（棕榈油/天然橡胶/白糖→agri；黄金/白银/铜→metal；碳酸锂/螺纹钢/玻璃/多晶硅→lightweight）
  - [x] 1.4 定义 `templates`（agri 完整五维权重 supply0.35/inventory0.30/macro0.15/basis0.10/technical0.10；metal 仅 macro=1.0 + 灰显标注；lightweight 仓单分位 + 轻量标注）与 `refuseThreshold=0.5`
  - [x] 1.5 增加新鲜度角标容器 `<span id="fundFreshnessBadge">` 与拒绝出分原因清单容器 `<div id="fundRefuseReasons">` 到评分表 tfoot/提示区

- [x] Task 2: 新增 `fullReport` 指标解析辅助函数（内联，挂到 FTRender 或局部）
  - [x] 2.1 `parseVarietySection(fullReport, feishuName)`：用正则提取 `【品种名】…(到下一个【或━━或末尾)` 小节文本
  - [x] 2.2 `parseActiveIndicators(section)`：解析形如 `ONI 89.1 (正向,w=0.35) 样本239` 的行，返回 `[{name,pct,weight,dir}]`
  - [x] 2.3 `parseMissingItems(section)`：解析 `⚠ 缺失分项` 下 `- OIL_WTI: 数据过期…[⚠疑似故障]` 行，返回 `[{name,reason}]`
  - [x] 2.4 `parseWarehouseReceipt(section)`：解析轻量模组 `仓单分位: XX.X`，返回数值或 null
  - [x] 2.5 `mapIndicatorToDim(name)`：按 `indicatorToDimension` 前缀匹配返回维度 key

- [x] Task 3: 覆写 `FTRender.loadFundamental`（删除综合分倒填，改为真实指标分档填充 + 分品种模板）
  - [x] 3.1 删除原 `autoScores`（基于 extScore/百分位的 basis/supply/inventory 阈值倒填）与"估值/供给/库存维度已根据外部日报(XX分)自动填充"提示
  - [x] 3.2 读取所选品种最新日报 record，解析其小节；无 record/无小节时全部维度显示"无数据源"
  - [x] 3.3 农产品模板：active 指标按维度归组，有效维度计算加权分（反向取 100-pct，dimScore=加权均值/10），填入对应 input 并在 note 标注来源指标；无指标维度显示"—/无数据源"；basis/technical 显示"待手动输入"并回填手动保存值
  - [x] 3.4 贵金属模板：仅 macro 维度亮分，供需/库存/基差/技术 input 禁用并标灰"无品种级数据源"；综合分旁注入"当前为宏观情绪分，非品种基本面"提示
  - [x] 3.5 轻量模板：隐藏/替代五维表为仓单分位展示 + "⚠ 轻量模组，仅供参考"，不调归一化综合分
  - [x] 3.6 末尾调用 `this.updateFundTotal()` 与 `this.renderExternalFundSignal()`

- [x] Task 4: 覆写 `FTRender.updateFundTotal`（有效维度归一化 + 拒绝出分闸门）
  - [x] 4.1 计算有效维度集合（有 active 指标的模板维度）及其权重和 `validWeight`
  - [x] 4.2 `validWeight/totalWeight < refuseThreshold` → 综合分显示"数据不足，拒绝出分"，在 `#fundRefuseReasons` 渲染缺失项及原因
  - [x] 4.3 否则综合分 = `Σ(dimScoreᵢ×wᵢ)/Σ(wᵢ有效)×10`（0–100），更新 `#fundTotalScore` 文案与 `#fundScoreBar` 进度条宽度
  - [x] 4.4 轻量模板：不显示归一化分，保留仓单分位 + 轻量标注

- [x] Task 5: 覆写 `FTRender.renderExternalFundSignal`（数据新鲜度角标 + OIL_WTI 告警去重）
  - [x] 5.1 计算日报 `record.date` 与今天差值，渲染 `#fundFreshnessBadge`（≤3天灰/>3天黄/>7天红，文案"滞后 N 天"或"实时"）
  - [x] 5.2 `anomalyAlert` 按 `;` 拆分，按指标名（`OIL_WTI` 等）去重后渲染告警区，重复条目只出现一次
  - [x] 5.3 保留原有档位徽章/分数/变化/摘要/品种段落渲染与设计 token 配色不变

- [x] Task 6: 浏览器验证四点验收标准并截图
  - [x] 6.1 启动本地静态服务器（`python -m http.server`），打开 `pages/fundamental.html`
  - [x] 6.2 选白糖：供需/库存亮分、基差/技术"待手动输入"、综合分按有效维度归一化
  - [x] 6.3 选白银：仅宏观亮分、其余"无数据源"、有"宏观情绪分"提示
  - [x] 6.4 构造/选用有效权重<50%的品种：显示"数据不足，拒绝出分"并列缺失原因
  - [x] 6.5 确认顶部日报日期滞后时新鲜度角标变色；OIL_WTI 告警只出现一次
  - [x] 6.6 截图存证，提交时说明改了哪几个函数及原因

# Task Dependencies
- Task 2 依赖 Task 1（解析函数引用 config）
- Task 3、4 依赖 Task 1 + Task 2
- Task 5 仅依赖 Task 1（容器 id），可与 Task 3/4 并行
- Task 6 依赖 Task 3 + 4 + 5 全部完成
