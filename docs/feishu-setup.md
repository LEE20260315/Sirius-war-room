# 飞书自建应用与多维表格配置指南

> **用途**:Sirius 期货作战室的云端数据存储层
> **前置条件**:已有飞书账号,能创建自建应用与多维表格
> **预计耗时**:15-20 分钟

---

## 一、整体架构

```
浏览器(GitHub Pages)
   ↓ HTTPS + X-Sirius-Token
Cloudflare Workers(sirius-proxy)
   ↓ Bearer tenant_access_token
飞书开放平台 https://open.feishu.cn/open-apis
   ↓
飞书多维表格(5 张数据表)
```

**安全底线**:飞书 App Secret 只存在于 Cloudflare Workers 环境变量(secrets),前端代码、仓库、wrangler.toml 中均不出现。

---

## 二、自建应用配置

### 2.1 进入飞书开放平台

访问 https://open.feishu.cn/app → 登录 → 「创建企业自建应用」(如已有应用可跳过)。

- **应用名称**:`Sirius 期货作战室`(或任意)
- **应用描述**:`期货模拟盘与实盘一体化交易系统的数据同步代理`
- **应用图标**:可选上传

### 2.2 勾选权限

进入应用 → 「权限管理」→ 「应用权限」→ 搜索并开通以下权限:

| 权限名 | 权限标识 | 用途 |
|---|---|---|
| 查看、评论、编辑和管理多维表格 | `bitable:app` | 增删改查 Bitable 记录(必需) |
| 查看、评论和编辑知识库 | `wiki:wiki` | 解析 wiki 链接拿 app_token(必需) |
| 获取知识库节点信息 | `wiki:wiki:readonly` | 只读查询 wiki 节点(可选,辅助) |

勾选后点击「发布版本」→ 等待管理员审批(个人版可直接生效)。

### 2.3 获取 App ID 与 App Secret

进入「凭证与基础信息」页面,记录:

- **App ID**:`cli_xxxxxxxxxxxxxxxx`(16-20 位)
- **App Secret**:`xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`(32 位)

> ⚠️ App Secret 仅此处可见一次,请立即记录到密码管理器。后续在 Cloudflare Worker 中配置 secrets 时需要。

### 2.4 添加多维表格协作者

1. 打开你的飞书多维表格(用户已有:`https://pcnsyza4ija3.feishu.cn/wiki/RnELwmdOGiVRhWktTtJcEJKXnSe`)
2. 右上角点击「...」菜单 → 「添加协作者」
3. 搜索你的应用名(如「Sirius 期货作战室」)
4. 权限选择「可编辑」
5. 点击「邀请」

> 如果搜索不到应用,说明应用版本未发布或权限未开通,回到 §2.2 检查。

---

## 三、解析 app_token

你提供的多维表格是 wiki 链接,Worker 内部需要的是 `app_token`(Bitable 的真实 ID)。

### 3.1 用 curl 一次性解析

在终端执行以下两条命令(Linux/Mac/Git Bash/WSL 均可):

```bash
# Step 1: 获取 tenant_access_token
curl -s -X POST https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal \
  -H "Content-Type: application/json" \
  -d '{"app_id":"cli_xxx替换","app_secret":"xxx替换"}'
# 返回:{"code":0,"tenant_access_token":"t-xxx","expire":7200}

# Step 2: 解析 wiki node
curl -s "https://open.feishu.cn/open-apis/wiki/v2/spaces/get_node?token=RnELwmdOGiVRhWktTtJcEJKXnSe" \
  -H "Authorization: Bearer t-xxx替换为Step1的token"
# 返回:{"code":0,"data":{"node":{"obj_token":"bascnxxxxxxxxxxxxx","obj_type":"bitable"}}}
#                                            ^^^^^^^^^^^^^^^^^^^^^ 就是 app_token
```

记录 `obj_token` 的值,这就是 `FEISHU_APP_TOKEN`。

### 3.2 替代方案:从浏览器 URL 直接获取

如果你在飞书多维表格的「...」菜单中能找到「在新标签页打开 Bitable」,打开后 URL 会变成:

```
https://xxx.feishu.cn/base/{app_token}?table={table_id}&view={view_id}
```

`/base/` 后面那段就是 `app_token`。

---

## 四、5 张数据表 schema

如果飞书多维表格中已有部分表,请对照下方 schema 补齐字段;如果某张表未建请新建。

> **字段类型说明**:用飞书多维表格原生类型名,如「单行文本」「数字」「日期」「单选」「多行文本」。

### 4.1 表 1:实盘成交流水

**表名建议**:`实盘成交流水`
**table_id**:建表后从 URL `?table=tblxxx` 取

| 字段名 | 类型 | 说明 |
|---|---|---|
| record_id | 单行文本 | 主键,前端生成 |
| trade_time | 日期 | 成交时间(精确到秒) |
| symbol | 单行文本 | 品种名(如 白糖) |
| symbol_code | 单行文本 | 合约代码(如 SR509) |
| exchange | 单选 | SHFE / INE / DCE / CZCE / GFEX / CFFEX |
| direction | 单选 | 多 / 空 |
| action | 单选 | 开 / 加 / 减 / 平 |
| price | 数字 | 成交价 |
| volume | 数字 | 手数 |
| multiplier | 数字 | 合约乘数 |
| margin_rate | 数字 | 保证金比例(%) |
| stop_loss | 数字 | 止损价(仅开仓) |
| take_profit | 数字 | 止盈价(仅开仓) |
| reason | 单选 | 开仓理由 / 平仓原因 |
| account | 单选 | 实盘(固定值) |
| note | 多行文本 | 备注 |
| created_at | 日期 | 创建时间 |
| client_id | 单行文本 | 客户端去重 ID |

### 4.2 表 2:模拟成交流水

**表名建议**:`模拟成交流水`

字段与「实盘成交流水」**完全一致**,仅 `account` 字段固定值为「模拟」。

### 4.3 表 3:观察池快照

**表名建议**:`观察池快照`

| 字段名 | 类型 | 说明 |
|---|---|---|
| record_id | 单行文本 | 主键 |
| symbol | 单行文本 | 品种名 |
| symbol_code | 单行文本 | 合约代码 |
| exchange | 单选 | 交易所 |
| tier | 单选 | 核心 / 观察 |
| multiplier | 数字 | 乘数 |
| margin_rate | 数字 | 保证金(%) |
| tick_size | 数字 | 最小变动价位 |
| cost_line | 数字 | 成本线 |
| percentile | 数字 | 分位 % |
| price | 数字 | 现价快照 |
| account | 单选 | sim / real |
| snapshot_time | 日期 | 快照时间 |
| client_id | 单行文本 | 去重 ID |

### 4.4 表 4:资金账户流水

**表名建议**:`资金账户流水`

| 字段名 | 类型 | 说明 |
|---|---|---|
| record_id | 单行文本 | 主键 |
| account | 单选 | sim / real |
| flow_type | 单选 | 入金 / 出金 / 权益快照 |
| amount | 数字 | 金额 |
| balance | 数字 | 当日可用资金(仅快照) |
| occupied_margin | 数字 | 当日占用保证金(仅快照) |
| floating_pnl | 数字 | 当日浮动盈亏(仅快照) |
| realized_pnl | 数字 | 当日已实现盈亏(仅快照) |
| note | 多行文本 | 备注 |
| flow_time | 日期 | 发生时间 |
| client_id | 单行文本 | 去重 ID |

> **flow_type 单选选项**:`deposit`(入金)、`withdraw`(出金)、`equity_snapshot`(权益快照)。建议直接用中文标签「入金/出金/权益快照」更直观,前端会做映射。

### 4.5 表 5:品种参数字典

**表名建议**:`品种参数字典`

| 字段名 | 类型 | 说明 |
|---|---|---|
| symbol | 单行文本 | 品种名(主键) |
| symbol_code | 单行文本 | 默认合约代码 |
| exchange | 单选 | 交易所 |
| multiplier | 数字 | 合约乘数 |
| margin_rate | 数字 | 保证金(%) |
| tick_size | 数字 | 最小变动价位 |
| is_core | 单选 | 是 / 否 |
| enabled | 单选 | 是 / 否 |
| updated_at | 日期 | 更新时间 |

---

## 五、获取所有 table_id

每张表建好后,在飞书多维表格中切到该表,从浏览器地址栏复制 `?table=tblxxxxxxxx` 那段,记录 5 个 table_id:

```
实盘成交流水   →  tblxxxxxxxx  →  FEISHU_TABLE_REAL_TRADES
模拟成交流水   →  tblxxxxxxxx  →  FEISHU_TABLE_SIM_TRADES
观察池快照     →  tblxxxxxxxx  →  FEISHU_TABLE_POOL_SNAPSHOT
资金账户流水   →  tblxxxxxxxx  →  FEISHU_TABLE_ACCOUNT_LEDGER
品种参数字典   →  tblxxxxxxxx  →  FEISHU_TABLE_VARIETY_DICT
```

---

## 六、产出清单(配置 Worker 时使用)

完成上述步骤后,你应该手里有 9 个值:

| # | 名称 | 在哪获取 | 用途 |
|---|---|---|---|
| 1 | `FEISHU_APP_ID` | 飞书开放平台 → 凭证与基础信息 | Worker secret |
| 2 | `FEISHU_APP_SECRET` | 同上 | Worker secret |
| 3 | `FEISHU_APP_TOKEN` | §3.1 解析 wiki node 得到 | Worker secret |
| 4 | `SIRIUS_ACCESS_TOKEN` | 自己生成(32 位随机串) | Worker secret + 前端 sessionStorage |
| 5 | `FEISHU_TABLE_REAL_TRADES` | §5 | Worker secret |
| 6 | `FEISHU_TABLE_SIM_TRADES` | §5 | Worker secret |
| 7 | `FEISHU_TABLE_POOL_SNAPSHOT` | §5 | Worker secret |
| 8 | `FEISHU_TABLE_ACCOUNT_LEDGER` | §5 | Worker secret |
| 9 | `FEISHU_TABLE_VARIETY_DICT` | §5 | Worker secret |

> **生成 SIRIUS_ACCESS_TOKEN 的方法**:在浏览器控制台执行 `crypto.randomUUID().replace(/-/g,'')` 即可得到 32 位随机串。

---

## 七、下一步

完成本指南后,继续阅读 [`docs/config-checklist.md`](./config-checklist.md) 完成 Cloudflare Worker 的部署与配置。
