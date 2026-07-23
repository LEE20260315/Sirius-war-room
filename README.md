# Sirius 期货作战室 v0.23

> 起始 15,000 → 目标 1,000,000 — 模拟盘与实盘一体化、飞书多维表格云端存储的个人期货交易系统。
>
> 围绕"观察 → 基本面 → 信号 → 交易 → 复盘"五段式工作流,提供从品种筛选、信号识别、下单录入到资金曲线复盘的完整闭环。所有数据本地优先存储,通过 Cloudflare Workers 代理异步同步飞书多维表格,换浏览器不丢数据。

## 特性

- **动态百分位系统(v0.23)**:废弃静态 price-history.json 的 min-max 区间%,改为从东财近3年日线K线实时回补,用**真实统计分位**(现价高于历史上多少%交易日的收盘价)替代静态区间位置。上市不足3年品种自动标注「样本不足3年」。
- **左侧观察信号(v0.23)**:信号引擎新增"⚡极端低位"独立标志(分位<10% + 动量/基本面未确认),右侧买入纪律不变,左侧提供底仓探索参考。
- **双账户隔离**:模拟盘 / 实盘独立切换,数据互不污染
- **云端存储**:基于飞书多维表格 + Cloudflare Workers 代理,换浏览器不丢数据
- **云端行情缓存**:通过 Cloudflare Workers 服务端抓取东财行情(KV 缓存 + stale-while-revalidate),无 CORS 限制,现价刷新速度从 7s → 0.2s
- **本地优先 + 异步同步**:断网可继续录入,联网自动补传
- **资金账户复盘**:账户总览 / 资金曲线 / 回撤曲线 / 绩效指标 / 品种理由归因
- **菜单式实盘录入**:合约按交易所分组 + 主力合约 + 未来 5 个活跃交割月(01/05/09/10) + 智能搜索(品种名/代码/合约号任一) + 按钮化交易类型
- **交易类型按钮稳定性**:按钮显式 `pointer-events: auto`,初始化顺序保证事件先绑定再触发账户切换,表单重置后自动重绑事件
- **基本面数据源开关**:五维(供需/库存/基差/宏观/技术)独立启用/禁用,禁用后剩余维度权重自动归一化至 100%
- **信号矩阵持仓标记**:实盘账户下持仓品种在信号页有"持仓多/空"角标与高亮
- **设置页云同步即时生效**:保存配置后立即调用 `CloudSync.reinit()` 重新初始化,无需手动刷新页面
- **深色主题**:Claude Design System 设计令牌,所有页面视觉一致

## 在线访问

https://lee20260315.github.io/Sirius-war-room/

## 本地运行

直接用浏览器打开 `index.html`,或运行本地静态服务器:

```bash
python -m http.server 8000
# 访问 http://localhost:8000/
```

## 动态百分位系统(v0.23 核心升级)

原版使用 `price-history.json` 的静态 low/high 区间计算 `(price-low)/(high-low)*100` (min-max 归一化),存在两个问题:

1. **不是统计分位**:区间位置% ≠ 统计分位,容易误读为"价格在历史上处于什么水平"  
2. **静态上限卡死**:品种创新高后永久 100%,不再有区分度

v0.23 改为:

```
百分位 = 现价高于历史上多少%交易日的收盘价
       = (收盘价低于现价的交易日数 ÷ 总交易日数) × 100
```

| 项目 | 旧版 | v0.23 |
|---|---|---|
| 数据源 | `price-history.json`(手工维护) | 东财 `push2his` 日线K线(自动拉取,1000条≈4年) |
| 算法 | `(price-low)/(high-low)*100` | 二分查找真实统计分位 |
| 缓存 | 无 | 独立 localStorage key `futures_percentile_data`,24h 保鲜 |
| 数据不足 | 不检测 | <500 个交易日标记 ⚠ 样本不足3年 |
| 刷新策略 | 静态文件 | 云端 Worker 缓存 → 直连分批(每批3个,间隔2s) → JSONP 三保险 |

- 多晶硅(2024.12上市)、碳酸锂(2023.07上市)等品种会自动标注"样本不足3年"
- 创新高品种的百分位可以达到 100%(历史上从未这么高过),不再被静态上限卡住
- 过渡期兼容:动态数据未加载完成时使用旧静态文件预填充,并标注"~静态"

## 左侧观察信号(⚡极端低位)

在信号引擎的趋势过滤优先级中新增独立判定:

```
if 分位 < 10% && (动量down || 动量unknown || 基本面缺失 || 基本面 < 40)
  → ⚡极端低位 (左侧观察提醒,非买卖建议)
```

不破坏原有右侧买入纪律(`分位≤25% + 动量up/flat + composite ≥ 70`),仅在极端低位时提供底仓探索参考。

## 工作流

```
观察池 ──→ 基本面 ──→ 信号引擎 ──→ 模拟交易/实盘录入 ──→ 交易日志 ──→ 仪表盘复盘
   │          │           │                │                  │              │
   │          │           │                │                  │              └─ 资金曲线/回撤/归因
   │          │           │                │                  └─ 历史成交 + 复盘笔记
   │          │           │                └─ 开仓/加仓/平仓 + 止损止盈方向校验
   │          │           └─ 估值·动量·基本面三因子 + 趋势过滤 + 极低位标志 + 持仓标记
   │          └─ 五维评分(供需/库存/基差/宏观/技术) + 位置定性 + 数据源开关归一化
   └─ 品种行情 + 动态百分位 + 成本线 + 价差监控
```

每个环节均按当前账户(模拟盘/实盘)独立隔离,数据互不污染。

## 页面结构

| 页面 | 文件 | 说明 |
|---|---|---|
| 观察池 | `pages/pool.html` | 品种行情 + 动态百分位(近3年K线) + 成本线 + 价差监控 + 添加/移除品种 |
| 基本面 | `pages/fundamental.html` | 五维评分(供需/库存/基差/宏观/技术) + 位置定性小结 + 数据源开关归一化 |
| 信号引擎 | `pages/signal.html` | 估值·动量·基本面三因子矩阵 + 趋势过滤 + 极低位标志 + 持仓品种高亮角标 |
| 模拟交易 | `pages/trade.html` | 模拟开/加/平仓 + 止损止盈方向校验 + 持仓管理 + 浮动盈亏 + 移仓换月 |
| 实盘录入 | `pages/real-trade.html` | 实盘成交流水录入 + 合约按交易所分组(主力+5个活跃月) + 三合一智能搜索 + 按钮化交易类型 |
| 交易日志 | `pages/journal.html` | 历史成交记录 + 复盘笔记 + 按品种/类型/关键词筛选 |
| 仪表盘 | `pages/dashboard.html` | 账户总览卡片 + 资金曲线 + 回撤曲线 + 胜率/盈亏比/最大回撤 + 品种/理由归因 |
| 设置 | `pages/settings.html` | 风控参数 + 云同步配置(即时生效) + 数据管理 + GitHub Gist 备份 |

## 文件结构

```
Sirius-war-room/
├── pages/                       # 8 个 HTML 页面
│   ├── pool.html                # 观察池
│   ├── fundamental.html         # 基本面
│   ├── signal.html              # 信号引擎
│   ├── trade.html                # 模拟交易
│   ├── real-trade.html          # 实盘录入
│   ├── journal.html              # 交易日志
│   ├── dashboard.html           # 仪表盘
│   └── settings.html             # 设置
├── shared/
│   ├── app-core.js              # 状态管理 + 数据存储 + 行情抓取 + 动态百分位系统(双账户隔离)
│   ├── cloud-sync.js            # 飞书云同步模块(本地优先 + 异步同步 + reinit 机制)
│   ├── chart-engine.js          # Canvas 图表引擎(资金/回撤/归因/胜率)
│   ├── ui-core.js               # UI 渲染 + 业务逻辑 + 信号引擎(含极低位标志) + 账户切换全局监听
│   ├── real-trade.js            # 实盘录入模块(合约搜索/按钮化类型/方向校验)
│   ├── fund-dimension-config.js # 基本面五维配置 + 模板 + 拒绝闸门
│   ├── styles.css               # 公共样式 + Claude Design System 变量
│   ├── cost-reference.json      # 成本参考数据
│   ├── price-history.json       # 历史价格数据(已废弃,保留仅兼容)
│   └── fundamental-feed.json    # 基本面外部信号源
├── worker/                      # Cloudflare Workers 代理
│   ├── src/
│   │   ├── index.js             # Worker 入口
│   │   ├── router.js            # 路由 + token 校验 + 行情缓存端点 + K线缓存端点
│   │   ├── price-fetcher.js     # 东财行情服务端抓取(现价 + K线)
│   │   ├── feishu.js            # 飞书 API 封装
│   │   └── response.js          # 统一响应工具
│   ├── wrangler.toml
│   └── README.md                # 部署文档
├── docs/
│   ├── feishu-setup.md          # 飞书应用与表结构配置
│   └── config-checklist.md      # 密钥/口令配置清单
└── index.html                   # 入口跳转页
```

## 部署

### 1. 飞书应用配置
参见 `docs/feishu-setup.md` — 创建自建应用、开通 `bitable:app` 权限、创建 5 张数据表。

### 2. Cloudflare Workers 部署
参见 `worker/README.md` — 创建 KV、设置 secrets、部署 Worker。

### 3. 前端配置
打开 `pages/settings.html` → 「Sirius 云同步配置」分区,填入 Worker URL 和访问口令。

详细配置清单见 `docs/config-checklist.md`。

## 技术栈

- 纯静态多页面 HTML(无构建系统)
- 原生 JavaScript + Tailwind CSS 4.3.1(CDN browser runtime)
- Claude Design System 设计令牌(CSS 变量)
- 飞书开放平台 API + Cloudflare Workers + KV 缓存
- 原生 Canvas 2D 绘图(无图表库)

## 数据流

```
[浏览器]                  [Cloudflare Worker]            [飞书开放平台]
   │                              │                              │
   │  CloudSync.upsertRecord()    │                              │
   ├─────────────────────────────→│  PATCH /bitable/records     │
   │  X-Sirius-Token 校验        ├─────────────────────────────→│
   │                              │  Bearer app_access_token    │
   │  本地优先:写入 localStorage  │                              │
   │  断网入队,联网补传           │  KV 缓存(可选)              │
   │←─────────────────────────────┤  失败重试 + 异常上报        │
                                                              │
[GitHub Gist] ← 定时备份(可选) ──── shared/app-core.js 触发
```

- 前端只调 Worker 代理,绝不直连飞书写接口
- Worker 内置 token 校验 + CORS 白名单 + KV 缓存

### 云端行情缓存(cloud 数据源模式)

```
[Worker KV 缓存] ←── stale-while-revalidate ──── [Cloudflare Worker]
     │                                                     │
     │  GET /api/prices ──→ KV 新鲜 → 直接返回              │
     │  GET /api/prices ──→ KV 过期 → 返回旧值 + 后台刷新   │
     │  POST /api/prices/refresh ──→ 强制刷新 + 飞书持久化   │
     │  GET  /api/klines  ──→ 返回缓存K线(百分位数据用)    │
     │                                                     │
     │                          fetchAllPrices(symbols)     │
     │  push2.eastmoney.com ◄────────────────────────────── │
     │  push2his.eastmoney.com                              │
     │                                                     │
     └─ 现价: KV TTL 120s(新鲜期 30s)                     │
        K线: KV TTL 24h                                    │
        飞书 pool_snapshot: 按日 upsert(后台异步,不阻塞)   │
```

- 前端 settings.html 数据源下拉选择「云端缓存（推荐）」,需先配置云同步(Worker URL + 访问口令)
- cloud 模式失败时自动降级到 futsseapi→东财JSONP→新浪 三路回退
- 本地 localStorage 双账户隔离存储,断网可继续录入

## 安全

- App Secret 仅存在于 Cloudflare Workers 环境变量
- 前端只调用代理,绝不直连飞书写接口
- 自定义访问口令(X-Sirius-Token header)校验来源
- Worker 启用 CORS,仅允许 GitHub Pages 域名

## Changelog

### v0.23 (2026-07) — 动态百分位 + 左侧极端低位信号

- **动态百分位系统**:废弃静态 `price-history.json` 的 min-max 区间%,改为从东财近3年日线K线实时回补,用二分查找计算真实统计分位。独立 localStorage 缓存 24h 保鲜,云端 Worker 优先→直连分批 JSONP 三保险。
- **数据不足标记**:<500 个交易日的品种显示「⚠样本不足3年」,多晶硅、碳酸锂等新上市品种自动标注。
- **静态预填充**:动态数据未加载完成时从旧 price-history.json 合成预填充,标注「~静态」避免空白期。
- **左侧极端低位信号**:信号引擎新增"⚡极端低位"独立标志(分位<10% + 动量/基本面未确认),不破坏右侧买入纪律。
- **云同步 key 统一**:废弃 `ft_access_token` 死代码,统一为 `sirius_token`(saveSecure/loadSecure)。
- **import 校验修复**:`validateImportData` 支持新账户隔离结构(accounts.sim),`handleImport` 改用 `Object.assign` 保留引用。
- **文案修正**:README/pool.html 中"历史分位%"→"动态百分位(近3年K线)"。

### 2026-07 — Sirius 重构

- 仓库重命名 `futures-tracker` → `Sirius-war-room`
- 双账户隔离架构(模拟盘/实盘独立 state)
- 飞书云同步模块 + Cloudflare Workers 代理
- 云端行情缓存(cloud 数据源模式):Worker 服务端抓取东财行情 + KV stale-while-revalidate + 飞书 pool_snapshot 持久化,现价刷新从 7s → 0.2s,无 CORS 限制
- 实盘录入页(菜单式合约搜索 + 按钮化交易类型)
- 仪表盘账户总览 + 资金曲线 + 回撤 + 绩效归因
- 基本面五维评分 + 数据源开关归一化
- 信号矩阵持仓标记
- 设置页云同步即时生效(reinit 机制)
- 实盘合约下拉生成主力 + 未来 5 个活跃交割月
- 基本面权重归一化至 100%
- 修复二:交易类型按钮 pointer-events + 初始化顺序 + resetForm 重绑事件

### 2026-07-23 — 观察池行情抓取修复

- **CZCE/GFEX 合约代码 3 位格式**:CZCE/GFEX 使用 1 位年+2 位月格式(如 SR609),`contractToFutsseDm`/`validateContract`/`ensureContractList` 按交易所自动切换格式
- **跨年歧义修复**:`validateContract` 双向 4 年窗口校准,`601`→2026 年而非 2016 年
- **GFEX 市场码修正**:东财 GFEX 市场码从错误的 `8`(实际为中金所) 修正为 `225`,多晶硅(34250)、碳酸锂(143300)、工业硅(8250)均正常获取
- **合约号空值回填**:`_backfillContractCodes()` 每次加载时从 `EXCHANGE_VARIETIES.defaultContract` 回填缺失的 `contractCode`,解决手动添加品种合约号空白的问题
- **历史回补降级**:分批 3 个+2 次重试+数据不足用现有区间计算,不再弹"回补失败"
- **K 线数据量提升**:`lmt` 从 30 提升至 60 条

## License

MIT
