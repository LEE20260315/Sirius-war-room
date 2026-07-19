# Sirius 期货作战室

> 起始 15,000 → 目标 1,000,000 — 模拟盘与实盘一体化、飞书多维表格云端存储的个人期货交易系统。

## 特性

- **双账户隔离**:模拟盘 / 实盘独立切换,数据互不污染
- **云端存储**:基于飞书多维表格 + Cloudflare Workers 代理,换浏览器不丢数据
- **本地优先 + 异步同步**:断网可继续录入,联网自动补传
- **资金账户复盘**:账户总览 / 资金曲线 / 回撤曲线 / 绩效指标 / 品种理由归因
- **菜单式实盘录入**:合约按交易所分组 + 主力合约 + 未来 5 个活跃交割月(01/05/09/10) + 智能搜索(品种名/代码/合约号任一) + 按钮化交易类型
- **基本面数据源开关**:五维(供需/库存/基差/宏观/技术)独立启用/禁用,禁用后剩余维度权重自动归一化至 100%
- **信号矩阵持仓标记**:实盘账户下持仓品种在信号页有"持仓多/空"角标与高亮
- **设置页云同步即时生效**:保存配置后立即调用 `CloudSync.reinit()` 重新初始化,无需手动刷新页面
- **深色主题**:Claude Design System 设计令牌,所有页面视觉一致

## 在线访问

https://lee20260315.github.io/futures-tracker/

## 本地运行

直接用浏览器打开 `index.html`,或运行本地静态服务器:

```bash
python -m http.server 8000
# 访问 http://localhost:8000/
```

## 页面结构

| 页面 | 文件 | 说明 |
|---|---|---|
| 观察池 | `pages/pool.html` | 品种行情 + 分位% + 成本线 + 价差 |
| 基本面 | `pages/fundamental.html` | 五维打分 + 位置定性小结 |
| 信号引擎 | `pages/signal.html` | 估值·动量·基本面三因子 + 趋势过滤 |
| 模拟交易 | `pages/trade.html` | 模拟开平仓 + 持仓管理 + 浮动盈亏 |
| 实盘录入 | `pages/real-trade.html` | 实盘成交流水录入(菜单式) |
| 交易日志 | `pages/journal.html` | 历史成交记录 + 复盘 |
| 仪表盘 | `pages/dashboard.html` | 账户总览 + 资金曲线 + 回撤 + 绩效归因 |
| 设置 | `pages/settings.html` | 风控参数 + 云同步配置 + 数据管理 |

## 文件结构

```
futures-tracker/
├── pages/              # 8 个 HTML 页面
├── shared/
│   ├── app-core.js     # 状态管理 + 数据存储 + 行情抓取(双账户隔离)
│   ├── cloud-sync.js   # 飞书云同步模块(本地优先 + 异步同步)
│   ├── chart-engine.js # Canvas 图表引擎(资金/回撤/归因)
│   ├── ui-core.js      # UI 渲染 + 业务逻辑
│   ├── real-trade.js   # 实盘录入模块
│   ├── styles.css      # 公共样式 + Claude Design System 变量
│   └── *.json          # 静态数据(成本/历史/基本面)
├── worker/             # Cloudflare Workers 代理
│   ├── src/
│   │   ├── index.js    # Worker 入口
│   │   ├── router.js   # 路由 + token 校验
│   │   ├── feishu.js   # 飞书 API 封装
│   │   └── response.js # 统一响应工具
│   ├── wrangler.toml
│   └── README.md       # 部署文档
├── docs/
│   ├── feishu-setup.md       # 飞书应用与表结构配置
│   └── config-checklist.md   # 密钥/口令配置清单
└── index.html          # 入口跳转页
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

## 安全

- App Secret 仅存在于 Cloudflare Workers 环境变量
- 前端只调用代理,绝不直连飞书写接口
- 自定义访问口令(X-Sirius-Token header)校验来源
- Worker 启用 CORS,仅允许 GitHub Pages 域名

## License

MIT
