# 信号引擎重做 + 残留优化收尾 Spec

## Why

当前信号引擎出现严重失真：13 个品种观察池里 11 个显示"买入"，这违背真实商品期货市场多空博弈、板块分化的常识（健康比例约 3:4:3）。根因经核查有三：

1. **三因子退化为单因子**：动量信号列完全为空（代码中无任何 MA/趋势计算），基本面信号被 `getEffectiveFundScore` 的"百分位自动推算"逻辑扭曲——低百分位品种自动获得高 supply/inventory 分→`isSweetSignal` 判定"甜点"→绿灯→买入，形成循环论证。最终只剩"估值分位"一个因子在起作用。
2. **判定阈值过松**：`refreshSignals` 中 `p <= 25 && costDiff < 0` 即给"买入"/"加仓"，没有任何动量或趋势确认，等于逆势接飞刀。
3. **基本面未用真实数据**：`fundamental-feed.json` 实际包含 10 个品种的真实综合分（螺纹钢 69.1、白糖 34.4、铜 24.9 等），但 `getEffectiveFundScore` 在无手动分时回退到百分位推算，真实外部日报分反而被覆盖。

本 spec 重做信号引擎三因子逻辑，并合并收尾上一轮遗留的 5 个优化点（清除 Token、三路失败提示、Gist 冲突确认、日志清空、仪表盘盈亏曲线）。

## What Changes

### 🔴 P0-1：激活动量因子（价格快照 + MA20/MA60 + 涨跌速率）
- **app-core.js** 新增 `state.priceSnapshots = {}`（结构 `{ [symbol]: [{date:'YYYY-MM-DD', price}, ...] }`），持久化到 localStorage
- **app-core.js** `fetchPricesNow` 成功取价后调用 `recordPriceSnapshot(symbol, price)`：按当天日期去重（同日覆盖），保留最近 60 个交易日
- **app-core.js** 新增 `computeMomentum(symbol)`：基于快照计算 MA20/MA60、近 20 日涨跌速率，返回 `{ ma20, ma60, roc20, score, status, samples }`
  - `score` 0-100：MA20>MA60 且 roc20>0 → 高分；MA20<MA60 且 roc20<0 → 低分
  - `status`：`'up'` | `'down'` | `'flat'` | `'unknown'`（样本 <20 时 unknown）
- **app-core.js** 导出 `recordPriceSnapshot`、`computeMomentum`

### 🔴 P0-2：基本面因子真实化（移除百分位推算）
- **app-core.js** `getEffectiveFundScore(symbol, dimKey)` 改造：手动分>0 取手动分；否则**直接使用 `fundamental-feed.json` 的综合分**（0-100 归一化到各维度分），**删除基于百分位的自动推算分支**（消除循环论证）
- **app-core.js** 新增 `getFundamentalComposite(symbol)`：返回外部日报综合分（0-100）或 `null`（无数据）
- **app-core.js** `isSweetSignal` 改造：估值分≥4 AND 外部综合分≥50 AND 供给/库存有效分≥5（无外部数据时返回 false，不再推算）

### 🟠 P1-1：加权综合评分
- **ui-core.js** `refreshSignals` 重写综合评级逻辑：
  - 估值分（0-100）= `100 - percentile`（低位=高分）
  - 动量分（0-100）= `computeMomentum().score`
  - 基本面分（0-100）= `getFundamentalComposite()` 或手动分归一化
  - 综合评级分 = 估值分×0.4 + 动量分×0.35 + 基本面分×0.25
  - 三因子中任一为"unknown"时，综合评级降级为"观望"并标"待验证"

### 🟠 P1-2：趋势过滤（低位 + 动量企稳/转多 才给买入）
- **ui-core.js** `refreshSignals` 评级规则改为：
  - 综合分≥70 AND 动量 status∈{up,flat} AND 估值分位≤25 → "买入"（绿）
  - 综合分≥60 AND 动量 status≠down AND 估值分位≤35 → "加仓"（绿）
  - 估值分位>75 → "回避"（红）
  - 估值分位≤25 AND 动量 status=down → "观望"（黄，逆势不抄底）
  - 其他 → "观望"（黄）

### 🟡 P2-1：信号分布健康度提示
- **ui-core.js** `refreshSignals` 渲染前统计买入（含加仓）占比；>60% 时在表格上方插入警告条："⚠ 买入信号占比 XX%，信号高度趋同，可能因子失效或存在系统性风险，请谨慎"
- **signal.html** 表格上方预留 `#signalHealthWarn` 容器

### 🟡 P2-2：待验证标记
- **ui-core.js** `refreshSignals`：动量 status=unknown 或基本面无外部数据时，综合评级单元格旁加灰色"待验证"小标签
- 详情列文案改进：动量显示 MA20/MA60 排列与 roc20%；基本面显示外部综合分或"无外部数据"

### 🟡 P2-3：信号引擎页免责说明
- **signal.html** 标题区下方加 `info-box`："当前信号基于估值/动量/基本面三因子加权，动量因子需积累价格快照后生效。信号仅供研究参考，不构成交易依据。"

### 🟠 P1-3：清除 Token 按钮（残留）
- **settings.html** Gist 同步配置区新增"清除 Token"按钮，调用 `removeSecure('githubToken')` + `removeSecure('gistId')`，清空输入框，toast"Token 已从本地清除"

### 🟡 P2-4：三路降级失败提示细化（残留）
- **app-core.js** `fetchPricesNow` 追踪每路失败原因到 `fetchFailReasons` 数组；全部失败时 toast"⚠ 行情获取失败：{原因拼接}，已切换手动模式"，状态灯红色

### 🟡 P2-5：Gist 恢复冲突确认（残留）
- **app-core.js** `restoreFromGist`：恢复前对比本地 `state.lastBackup` 与 Gist 数据 `lastBackup` 时间戳；本地更新时 `confirm()` 弹窗确认；Gist 更新或无时间戳则直接恢复

### 🟢 P3-1：日志搜索清空按钮（残留）
- **journal.html** 搜索过滤栏右侧加"× 清空"按钮，重置三个过滤器并重新渲染

### 🟢 P3-2：仪表盘盈亏曲线接真实数据（残留）
- **app-core.js** `updateEquityHistory` 在平仓时也被调用（追加当天节点，已有则更新）；导出 `updateEquityHistory`
- **ui-core.js** `closePosition` 末尾调用 `FTApp.updateEquityHistory()`
- **ui-core.js** `renderEquityChart` 增强：X 轴日期、Y 轴金额、起始资金基线、末端净值标注；`equityHistory` 不足 2 条但 `closedTrades` 有数据时用 closedTrades 构建临时曲线

## Impact

- Affected code:
  - `shared/app-core.js`（priceSnapshots 状态、recordPriceSnapshot/computeMomentum/getFundamentalComposite、getEffectiveFundScore/isSweetSignal 改造、fetchPricesNow 失败提示、restoreFromGist 冲突确认、updateEquityHistory 平仓触发+导出）
  - `shared/ui-core.js`（refreshSignals 重写、renderEquityChart 增强、closePosition 调用 updateEquityHistory）
  - `pages/signal.html`（免责说明 + signalHealthWarn 容器）
  - `pages/settings.html`（清除 Token 按钮）
  - `pages/journal.html`（清空筛选按钮）

## ADDED Requirements

### Requirement: 价格快照积累与动量计算
系统 SHALL 在每次行情刷新成功后记录品种当日价格快照，并基于快照序列计算动量指标。

#### Scenario: 记录价格快照
- **WHEN** fetchPricesNow 成功获取某品种价格
- **THEN** 调用 recordPriceSnapshot(symbol, price)
- **AND** 同一天日期的快照被覆盖（不重复追加）
- **AND** 每品种最多保留最近 60 条快照
- **AND** 快照持久化到 localStorage（state.priceSnapshots）

#### Scenario: 计算动量（样本充足）
- **WHEN** 某品种快照数 ≥ 20
- **THEN** computeMomentum 返回 { ma20, ma60, roc20, score, status }
- **AND** status = MA20>MA60 且 roc20>0 ? 'up' : (MA20<MA60 且 roc20<0 ? 'down' : 'flat')
- **AND** score 为 0-100 归一化分（up 趋势高分，down 趋势低分）

#### Scenario: 计算动量（样本不足）
- **WHEN** 某品种快照数 < 20
- **THEN** computeMomentum 返回 { status: 'unknown', score: null, samples: n }

### Requirement: 基本面因子使用真实外部数据
getEffectiveFundScore SHALL 优先使用手动分，其次使用 fundamental-feed.json 真实综合分，不再基于百分位推算。

#### Scenario: 有外部日报数据
- **WHEN** fundamental-feed.json 含该品种综合分
- **THEN** getFundamentalComposite 返回 0-100 综合分
- **AND** getEffectiveFundScore 各维度分由综合分映射（≥60→7, ≥45→5, ≥30→3, <30→2）
- **AND** 不再读取百分位进行推算

#### Scenario: 无外部日报数据且无手动分
- **WHEN** 品种无外部日报且无手动分
- **THEN** getFundamentalComposite 返回 null
- **AND** getEffectiveFundScore 返回 0
- **AND** isSweetSignal 返回 false

### Requirement: 加权综合评分与趋势过滤
refreshSignals SHALL 用加权综合评分 + 趋势过滤生成评级，避免单因子主导。

#### Scenario: 低位 + 动量企稳/转多 → 买入
- **WHEN** 估值分位 ≤ 25 AND 动量 status ∈ {up, flat} AND 综合分 ≥ 70
- **THEN** 评级为"买入"（绿）

#### Scenario: 低位 + 仍在下跌 → 观望（不抄底）
- **WHEN** 估值分位 ≤ 25 AND 动量 status = down
- **THEN** 评级为"观望"（黄）
- **AND** 详情标注"逆势，不抄底"

#### Scenario: 因子缺失 → 降级观望 + 待验证
- **WHEN** 动量 status = unknown OR 基本面无外部数据
- **THEN** 综合评级降为"观望"（黄）
- **AND** 评级旁显示灰色"待验证"标签

#### Scenario: 高位 → 回避
- **WHEN** 估值分位 > 75
- **THEN** 评级为"回避"（红）

### Requirement: 信号分布健康度提示
refreshSignals SHALL 在买入信号占比过高时显示警告。

#### Scenario: 买入占比超阈值
- **WHEN** 买入（含加仓）信号占比 > 60%
- **THEN** 表格上方 #signalHealthWarn 显示"⚠ 买入信号占比 XX%，信号高度趋同，可能因子失效或存在系统性风险，请谨慎"
- **AND** 占比 ≤ 60% 时容器为空

### Requirement: 信号引擎页免责说明
signal.html SHALL 在标题区下方显示免责 info-box。

#### Scenario: 始终显示免责说明
- **WHEN** 用户打开信号引擎页
- **THEN** 显示 info-box"当前信号基于估值/动量/基本面三因子加权，动量因子需积累价格快照后生效。信号仅供研究参考，不构成交易依据。"

### Requirement: 清除 Token 按钮
settings.html SHALL 提供一键清除 Token 的按钮。

#### Scenario: 清除 Token
- **WHEN** 用户点击"清除 Token"
- **THEN** removeSecure('githubToken') + removeSecure('gistId')
- **AND** Token 输入框清空，Gist ID 显示"未同步"
- **AND** toast"Token 已从本地清除"

### Requirement: 三路降级失败原因展示
fetchPricesNow 全部失败时 SHALL 显示具体失败原因。

#### Scenario: 三路全失败
- **WHEN** futsseapi、东财JSONP、新浪均失败
- **THEN** toast"⚠ 行情获取失败：{失败原因拼接}，已切换手动模式"
- **AND** 状态指示灯红色
- **AND** 失败原因示例"futsseapi 超时 / 东财无响应 / 新浪超时"

### Requirement: Gist 恢复冲突确认
restoreFromGist SHALL 在本地数据更新时弹出确认框。

#### Scenario: 本地更新覆盖确认
- **WHEN** 本地 lastBackup 比 Gist 数据 lastBackup 更新
- **THEN** confirm()"Gist 版本时间戳：X / 本地版本时间戳：Y / 本地数据更新，确认用 Gist 版本覆盖吗？"
- **AND** 用户确认后才恢复，取消则中止

#### Scenario: Gist 更新或无时间戳
- **WHEN** Gist lastBackup ≥ 本地 或 Gist 无 lastBackup
- **THEN** 直接恢复不确认

### Requirement: 日志搜索清空按钮
journal.html SHALL 提供"× 清空"按钮。

#### Scenario: 一键清空筛选
- **WHEN** 用户点击"× 清空"
- **THEN** 品种/类型下拉重置为"全部"，关键词清空
- **AND** 重新渲染全部日志

### Requirement: 仪表盘盈亏曲线接真实数据
renderEquityChart SHALL 基于真实 equityHistory / closedTrades 绘制。

#### Scenario: 有 equityHistory 数据
- **WHEN** equityHistory ≥ 2 条
- **THEN** 绘制折线图，X 轴日期，Y 轴金额，起始资金基线，末端净值标注

#### Scenario: equityHistory 不足但 closedTrades 有数据
- **WHEN** equityHistory < 2 条但 closedTrades 有记录
- **THEN** 用 closedTrades 按日期累加 pnl 构建临时曲线，从 initEquity 起始

#### Scenario: 平仓追加节点
- **WHEN** 用户平仓
- **THEN** closePosition 末尾调用 updateEquityHistory
- **AND** 当天已有节点则更新而非追加

## MODIFIED Requirements

### Requirement: refreshSignals 三因子矩阵
refreshSignals SHALL 渲染估值/动量/基本面三列信号灯与综合评级，动量列不再为空，详情列含 MA 排列与外部综合分。当前实现动量列无内容、基本面被百分位推算扭曲、阈值过松，需按本 spec 重写。

### Requirement: getEffectiveFundScore 不再基于百分位推算
getEffectiveFundScore SHALL 移除"无外部日报时基于百分位推算"分支，改为无数据时返回 0。当前实现存在循环论证（低百分位→高分→甜点→买入）。

### Requirement: renderEquityChart 图表增强
renderEquityChart SHALL 增强 X/Y 轴标签、起始资金基线、末端净值标注。当前仅有折线+渐变填充，无坐标轴标签。

### Requirement: updateEquityHistory 平仓触发
updateEquityHistory SHALL 在平仓时被调用并导出。当前仅在 onPriceUpdate 中调用，closePosition 未触发。
