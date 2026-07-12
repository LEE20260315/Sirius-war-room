# Checklist

> 对应任务验收标准与 spec 要求。全部勾选后方可结束。

## 配置对象
- [x] `pages/fundamental.html` 顶部内联脚本存在独立 `FUND_DIMENSION_CONFIG`，含 dimensions / indicatorToDimension / varietyTemplates / templates / refuseThreshold
- [x] 填充与计分函数均从该 config 读取，无硬编码品种-维度分支散落

## 改动一：删除综合分倒填
- [x] `loadFundamental` 中基于 `extScore`/百分位的 `autoScores`（basis/supply/inventory 阈值倒填）已删除
- [x] "估值/供给/库存维度已根据外部日报(XX分)自动填充"提示文案已删除
- [x] 维度分改由 `fullReport` 真实指标加权归一化得出
- [x] 无 active 指标的维度显示"—/无数据源"，未写入 0 分占位、未进综合分归一化

## 改动二：分品种模板
- [x] 农产品（棕榈油/天然橡胶/白糖）启用完整五维，供需/库存权重加重，基差/技术"待手动输入"
- [x] 贵金属与铜（黄金/白银/铜）只亮宏观一档，其余标灰"无品种级数据源"，综合分旁有"当前为宏观情绪分，非品种基本面"
- [x] 新能源/黑色（碳酸锂/螺纹钢/玻璃/多晶硅）走轻量模组，只显示仓单分位 + "⚠ 轻量模组，仅供参考"

## 改动三：综合分归一化 + 拒绝出分
- [x] 综合分 = `Σ(dimScoreᵢ×wᵢ)/Σ(wᵢ有效)×10`（0–100），不再用 `sum/50`
- [x] 有效权重占比 < 50% 时显示"数据不足，拒绝出分"
- [x] 拒绝出分时列出缺失/过期项及原因（未更新/样本不足/疑似故障），与后台日报"active 权重<50%→未出分"规则一致
- [x] 轻量模组品种不计算归一化综合分

## 改动四：新鲜度与告警去重
- [x] 综合分/面板旁有数据新鲜度角标，日报日期距今 >3天黄、>7天红、正常灰
- [x] `anomalyAlert` 按 `;` 拆分并按指标名去重，OIL_WTI 重复告警只渲染一次

## 验收标准（浏览器截图确认）
- [x] 1. 白糖：供需/库存/宏观按真实指标亮分，基差/技术"待手动输入"，综合分按有效维度归一化
- [x] 2. 白银：只亮宏观一档，其余"无数据源"，有"宏观情绪分"提示
- [x] 3. 任一品种有效权重 < 50% 时显示"拒绝出分"而非虚高分数
- [x] 4. 日报日期滞后时新鲜度角标变色；OIL_WTI 告警只出现一次
- [x] 5. 仅改 `pages/fundamental.html`，未改动后台采集逻辑与 `shared/*.js`

## 范围与回归
- [x] `shared/app-core.js`、`shared/ui-core.js`、`shared/fundamental-feed.json` 未被修改
- [x] 信号引擎 `signal.html` 基本面因子（`getFundamentalComposite`）行为未受影响
- [x] 档位徽章/分数/变化/摘要配色沿用原设计 token，未引入新色系
- [x] 提交说明列明改了哪几个函数（loadFundamental / updateFundTotal / renderExternalFundSignal + 新增解析辅助）及原因
