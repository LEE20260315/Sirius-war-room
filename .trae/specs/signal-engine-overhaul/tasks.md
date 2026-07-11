# 任务清单 — 信号引擎重做 + 残留优化收尾

> 关联 spec: `signal-engine-overhaul/spec.md`
> 所有任务按依赖顺序编排，建议自上而下执行。

## 阶段一：动量因子激活（P0-1）

- [ ] T1. app-core.js：`state` 对象新增 `priceSnapshots: {}` 字段（loadState 兼容旧数据，无则初始化为 `{}`）
- [ ] T2. app-core.js：实现 `recordPriceSnapshot(symbol, price)` —— 当天日期去重（同日覆盖）、保留最近 60 条、写回 `state.priceSnapshots[symbol]` 并 `saveState()`
- [ ] T3. app-core.js：在 `fetchPricesNow` 成功更新某品种价格后调用 `recordPriceSnapshot(symbol, price)`（注意只在 price>0 时记录）
- [ ] T4. app-core.js：实现 `computeMomentum(symbol)` —— 基于 `state.priceSnapshots[symbol]` 计算 ma20/ma60/roc20/score/status；样本<20 返回 `{status:'unknown', score:null, samples:n}`
  - score 归一化：status=up → 70-100（roc20 越大涨得越多越高）；flat → 40-70；down → 0-40
  - status：MA20>MA60 且 roc20>0 → 'up'；MA20<MA60 且 roc20<0 → 'down'；否则 'flat'
- [ ] T5. app-core.js：FTApp 导出新增 `recordPriceSnapshot`、`computeMomentum`

## 阶段二：基本面因子真实化（P0-2）

- [ ] T6. app-core.js：实现 `getFundamentalComposite(symbol)` —— 从 `window.__fundFeed` 读取最新 record 的 varieties[feishuName].score，返回 0-100 或 null（注意飞书名映射 PROJECT_TO_FEISHU_MAP）
- [ ] T7. app-core.js：改造 `getEffectiveFundScore(symbol, dimKey)` —— 手动分>0 取手动分；否则用 `getFundamentalComposite` 映射（≥60→7, ≥45→5, ≥30→3, <30→2；basis 用 8/6/4/2）；**删除百分位推算分支**；无数据返回 0
- [ ] T8. app-core.js：改造 `isSweetSignal(symbol)` —— 估值分≥4 AND `getFundamentalComposite`≥50 AND supply/inventory 有效分≥5；无外部数据返回 false
- [ ] T9. app-core.js：FTApp 导出新增 `getFundamentalComposite`

## 阶段三：信号矩阵重写（P1-1 / P1-2 / P2-1 / P2-2）

- [ ] T10. ui-core.js：重写 `refreshSignals` 主体逻辑
  - 估值分（0-100）= `100 - percentile`；估值灯：p>75 red / p<=25 green / p<=50 yellow / 其他 yellow
  - 动量：`computeMomentum(symbol)`；动量灯：status=up green / flat yellow / down red / unknown gray
  - 基本面：`getFundamentalComposite`；基本面灯：≥60 green / ≥40 yellow / <40 red / null gray
  - 综合评级分 = 估值分×0.4 + 动量分×0.35 + 基本面分×0.25（任一 unknown/null 时降级观望+待验证）
  - 评级规则（按 spec P1-2 顺序判定）：高位>75→回避；低位≤25+down→观望(逆势)；综合分≥70+status∈{up,flat}+p≤25→买入；综合分≥60+status≠down+p≤35→加仓；其他→观望
- [ ] T11. ui-core.js：详情列文案 —— "估值 X% · 动量 MA20>MA60 roc+Y% · 基本面 外部Z分(或无外部数据)"；逆势时加"逆势，不抄底"
- [ ] T12. ui-core.js：待验证标签 —— 动量 unknown 或基本面 null 时，评级单元格内追加 `<span class="text-xs text-ink-faint">(待验证)</span>`
- [ ] T13. ui-core.js：信号分布健康度 —— 渲染前统计买入+加仓占比；>60% 写入 `#signalHealthWarn` 警告文案，否则清空
- [ ] T14. ui-core.js：信号通知逻辑同步更新 —— isBuySignal 判定改用新评级（rate==='买入'），避免旧逻辑误推

## 阶段四：信号页 UI（P2-3）

- [ ] T15. signal.html：标题区"三因子信号矩阵"下方加 `info-box` 免责说明
- [ ] T16. signal.html：信号矩阵表格上方加 `<div id="signalHealthWarn"></div>` 容器

## 阶段五：残留优化点（P1-3 / P2-4 / P2-5 / P3-1 / P3-2）

- [ ] T17. settings.html：Gist 同步配置区加"清除 Token"按钮，onclick 调 `removeSecure('githubToken')+removeSecure('gistId')`、清空输入框、toast"Token 已从本地清除"
- [ ] T18. app-core.js：`fetchPricesNow` 三路降级 —— 每路失败记录原因到 `fetchFailReasons` 数组；全部失败分支 toast"⚠ 行情获取失败：{拼接}，已切换手动模式"，`setDataSourceStatus('offline',...)`
- [ ] T19. app-core.js：`restoreFromGist` —— 对比本地 `state.lastBackup` 与 Gist 数据 `lastBackup`；本地更新时 `confirm()` 弹窗；取消则 return false
- [ ] T20. journal.html：搜索过滤栏右侧加"× 清空"按钮，重置三个过滤器并触发 `renderJournal()`
- [ ] T21. app-core.js：`updateEquityHistory` 导出；平仓当天已有节点则更新而非追加
- [ ] T22. ui-core.js：`closePosition` 末尾调用 `FTApp.updateEquityHistory()`
- [ ] T23. ui-core.js：`renderEquityChart` 增强 —— X 轴日期标签、Y 轴金额标签、起始资金水平基线、末端净值标注；equityHistory<2 但 closedTrades 有数据时构建临时曲线

## 阶段六：验证与推送

- [ ] T24. 本地校验：浏览器控制台无报错；signal.html 打开后动量列有内容（新池 unknown 属正常）、免责说明显示、无满屏买入
- [ ] T25. git add + commit："fix: 信号引擎重做（动量激活+基本面真实化+加权评分+趋势过滤）+ 残留优化收尾"
- [ ] T26. push 到 GitHub（用 PAT）
