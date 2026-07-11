# 验收清单 — 信号引擎重做 + 残留优化收尾

> 关联 spec: `signal-engine-overhaul/spec.md`
> 每项需在实际页面或控制台验证通过后勾选。

## 动量因子（P0-1）

- [ ] `state.priceSnapshots` 存在且持久化（刷新页面后仍在）
- [ ] `fetchPricesNow` 成功后 `state.priceSnapshots[symbol]` 追加当天快照，同日覆盖不重复
- [ ] 每品种最多 60 条快照（超限自动裁剪旧数据）
- [ ] 样本≥20 时 `computeMomentum` 返回 ma20/ma60/roc20/score/status
- [ ] 样本<20 时 `computeMomentum` 返回 status='unknown'、score=null
- [ ] `FTApp.recordPriceSnapshot` / `FTApp.computeMomentum` 可在控制台调用

## 基本面因子真实化（P0-2）

- [ ] `getFundamentalComposite('螺纹钢')` 返回 69.1（或最新日报值）
- [ ] `getFundamentalComposite` 对无日报品种返回 null
- [ ] `getEffectiveFundScore` 不再读取百分位（百分位变化不影响基本面分）
- [ ] 无外部数据且无手动分时 `isSweetSignal` 返回 false
- [ ] 低百分位但无外部日报的品种不再自动判为"甜点"

## 信号矩阵重写（P1-1 / P1-2 / P2-1 / P2-2）

- [ ] 信号矩阵"动量信号"列不再为空（有灯或待验证标记）
- [ ] 综合评级 = 估值×0.4 + 动量×0.35 + 基本面×0.25
- [ ] 低位(p≤25) + 动量 down → "观望"（不买入，逆势不抄底）
- [ ] 低位(p≤25) + 动量 up/flat + 综合分≥70 → "买入"
- [ ] 高位(p>75) → "回避"
- [ ] 动量 unknown 或基本面 null → 评级旁灰色"待验证"
- [ ] 详情列含 MA 排列、roc20%、外部综合分或"无外部数据"
- [ ] 买入+加仓占比>60% 时 `#signalHealthWarn` 显示警告
- [ ] 占比≤60% 时 `#signalHealthWarn` 为空
- [ ] 信号通知只在评级变为"买入"时触发（非旧逻辑误推）
- [ ] 不再出现"满屏 11/13 买入"现象（动量/基本面缺失品种降为观望+待验证）

## 信号页 UI（P2-3）

- [ ] signal.html 标题下方显示免责 info-box
- [ ] 表格上方存在 `#signalHealthWarn` 容器

## 残留优化（P1-3 / P2-4 / P2-5 / P3-1 / P3-2）

- [ ] settings.html "清除 Token"按钮可一键清除，输入框清空，toast 提示
- [ ] 三路全失败时 toast 含具体失败原因拼接，状态灯红色
- [ ] restoreFromGist 本地更新时弹 confirm 确认；取消则不恢复
- [ ] restoreFromGist Gist 更新或无时间戳时直接恢复不弹窗
- [ ] journal.html "× 清空"按钮重置三个过滤器并重新渲染
- [ ] closePosition 后 equityHistory 追加/更新当天节点
- [ ] renderEquityChart 有 X/Y 轴标签、起始资金基线、末端净值标注
- [ ] equityHistory<2 但 closedTrades 有数据时显示临时曲线

## 整体回归

- [ ] 4 个页面（pool/signal/trade/journal/dashboard）控制台无报错
- [ ] 观察池百分位/成本/基本面仍正常显示（未因改造回归）
- [ ] git commit + push 成功
