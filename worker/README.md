# Sirius 期货作战室 - Cloudflare Workers 代理

## 概述

本 Worker 是「Sirius 期货作战室」前端(GitHub Pages 静态站点)与飞书多维表格之间的
Serverless 代理层,负责:

1. 飞书 `tenant_access_token` 自动续期(2 小时有效期,提前 5 分钟续期)
2. 飞书 Bitable 记录的增删改查(CRUD + 批量 + upsert)
3. 用自定义访问口令(`X-Sirius-Token` header)校验来源,确保飞书 App 凭证不进入前端代码

### 架构图(文字版)

```
┌──────────────────────┐       HTTPS + X-Sirius-Token       ┌─────────────────────────┐
│  前端(GitHub Pages)  │  ───────────────────────────────► │  Cloudflare Worker      │
│  lee20260315.github.io│                                    │  sirius-proxy           │
└──────────────────────┘                                    │                         │
                                                            │  ├─ /api/health         │
                                                            │  ├─ /api/records (CRUD) │
                                                            │  ├─ /api/records/batch  │
                                                            │  └─ /api/records/upsert │
                                                            └───────────┬─────────────┘
                                                                        │
                                          ┌─────────────────────────────┼─────────────────────────┐
                                          │                             │                         │
                                          ▼                             ▼                         ▼
                            ┌──────────────────────┐    ┌────────────────────────┐    ┌──────────────────┐
                            │  Feishu OpenAPI      │    │  Cloudflare KV         │    │  Worker Secrets  │
                            │  open.feishu.cn      │    │  SIRIUS_CACHE          │    │  (运行时注入)    │
                            │  - tenant token      │    │  - tenant_access_token │    │  - FEISHU_APP_*  │
                            │  - Bitable records   │    │    {token, expireAt}   │    │  - SIRIUS_TOKEN  │
                            └──────────────────────┘    └────────────────────────┘    │  - TABLE_*_ID    │
                                                                                       └──────────────────┘
```

## 前置条件

- Cloudflare 账号(免费版即可,Workers 免费额度 10 万次/天)
- Node.js ≥ 18(用于本地运行 wrangler)
- 飞书自建应用(已在飞书开放平台创建,获得 `app_id` / `app_secret`)
- 飞书多维表格(已创建并接入 Bitable,获得 `app_token` 与 5 张表的 `table_id`)
- 飞书多维表格 wiki 链接:`https://pcnsyza4ija3.feishu.cn/wiki/RnELwmdOGiVRhWktTtJcEJKXnSe`

## 本地开发

```bash
cd worker
npm install
npm run dev
```

### `.dev.vars` 文件示例(本地开发用,**不要提交**)

在 `worker/` 目录下创建 `.dev.vars`,填入本地测试用的密钥:

```
FEISHU_APP_ID=cli_xxxxxxxxxxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FEISHU_APP_TOKEN=xxxxxxxxxxxxxxxx
SIRIUS_ACCESS_TOKEN=请改成一段长随机字符串
FEISHU_TABLE_REAL_TRADES=tblxxxxxxxxxxxx
FEISHU_TABLE_SIM_TRADES=tblxxxxxxxxxxxx
FEISHU_TABLE_POOL_SNAPSHOT=tblxxxxxxxxxxxx
FEISHU_TABLE_ACCOUNT_LEDGER=tblxxxxxxxxxxxx
FEISHU_TABLE_VARIETY_DICT=tblxxxxxxxxxxxx
CORS_ORIGIN=http://localhost:5173
```

> ⚠️ `.dev.vars` 必须在 `.gitignore` 中,切勿提交到仓库。

## 部署步骤

### 1. 创建 KV 命名空间

```bash
wrangler kv:namespace create SIRIUS_CACHE
```

输出形如:

```
{ "binding": "SIRIUS_CACHE", "id": "abc123def456..." }
```

### 2. 把返回的 id 填入 `wrangler.toml`

将 `wrangler.toml` 中:

```toml
[[kv_namespaces]]
binding = "SIRIUS_CACHE"
id = "TODO_CREATE_KV_NAMESPACE_AND_FILL_ID"
```

的 `id` 替换为上一步返回的真实 id。

### 3. 逐个配置 secrets

按提示粘贴值(共 9 个,不含 `CORS_ORIGIN`,它通过 `[vars]` 配置):

```bash
wrangler secret put FEISHU_APP_ID
wrangler secret put FEISHU_APP_SECRET
wrangler secret put FEISHU_APP_TOKEN
wrangler secret put SIRIUS_ACCESS_TOKEN
wrangler secret put FEISHU_TABLE_REAL_TRADES
wrangler secret put FEISHU_TABLE_SIM_TRADES
wrangler secret put FEISHU_TABLE_POOL_SNAPSHOT
wrangler secret put FEISHU_TABLE_ACCOUNT_LEDGER
wrangler secret put FEISHU_TABLE_VARIETY_DICT
```

### 4. 部署

```bash
npm run deploy
```

### 5. 部署后获得 Worker URL

形如:`https://sirius-proxy.<your-account>.workers.dev`

### 6. 验证

```bash
curl https://sirius-proxy.<your-account>.workers.dev/api/health
# 期望返回: {"status":"ok","time":"2026-07-19T..."}

curl -H "X-Sirius-Token: <你的口令>" \
     "https://sirius-proxy.<your-account>.workers.dev/api/records?table=variety_dict&pageSize=10"
```

## 接口文档

所有接口(除 `/api/health` 外)均要求请求头携带 `X-Sirius-Token`,值与 Worker 的
`SIRIUS_ACCESS_TOKEN` secret 一致。

### `table` 短名映射

前端只传短名,Worker 内部映射到真实 `table_id`:

| 短名              | 用途           |
| ----------------- | -------------- |
| `real_trades`     | 真实交易记录   |
| `sim_trades`      | 模拟交易记录   |
| `pool_snapshot`   | 持仓池快照     |
| `account_ledger`  | 账户流水       |
| `variety_dict`    | 品种字典       |

### 1. 健康检查

- **方法 / 路径**:`GET /api/health`
- **鉴权**:不需要
- **响应**:`{ "status": "ok", "time": "2026-07-19T08:00:00.000Z" }`

### 2. 查询记录

- **方法 / 路径**:`GET /api/records`
- **Query 参数**:
  - `table`(必填):表短名
  - `filter`(可选):飞书 filter 表达式,如 `AND(CurrentValue.[client_id]="xxx")`
  - `pageSize`(可选,默认 100)
  - `pageToken`(可选):分页 token
- **响应**:`{ "code": "OK", "data": { "items": [...], "page_token": "...", "has_more": false, "total": 100 } }`
- **示例**:

```bash
curl -H "X-Sirius-Token: xxx" \
     "https://sirius-proxy.a.workers.dev/api/records?table=real_trades&pageSize=20"
```

### 3. 新增单条记录

- **方法 / 路径**:`POST /api/records`
- **Query 参数**:`table`(必填)
- **Body**:字段对象,如 `{ "client_id": "rt-001", "direction": "多", "price": 4200 }`
- **响应**:`{ "code": "OK", "data": { "record": { "record_id": "recXXX", "fields": {...} } } }`
- **示例**:

```bash
curl -X POST -H "X-Sirius-Token: xxx" -H "Content-Type: application/json" \
     -d '{"client_id":"rt-001","direction":"多"}' \
     "https://sirius-proxy.a.workers.dev/api/records?table=real_trades"
```

### 4. 批量新增记录

- **方法 / 路径**:`POST /api/records/batch`
- **Query 参数**:`table`(必填)
- **Body**:字段对象数组,如 `[ {...}, {...} ]`
- **响应**:`{ "code": "OK", "data": { "records": [...] } }`

### 5. 更新单条记录

- **方法 / 路径**:`PUT /api/records/:id`
- **路径参数**:`:id` 为飞书 `record_id`
- **Query 参数**:`table`(必填)
- **Body**:字段对象(部分字段也可)
- **响应**:`{ "code": "OK", "data": { "record": {...} } }`

### 6. 删除单条记录

- **方法 / 路径**:`DELETE /api/records/:id`
- **路径参数**:`:id` 为飞书 `record_id`
- **Query 参数**:`table`(必填)
- **响应**:`{ "code": "OK", "data": {} }`

### 7. Upsert(按 `client_id`)

- **方法 / 路径**:`POST /api/records/upsert`
- **Query 参数**:`table`(必填)
- **Body**:字段对象,**必须包含 `client_id` 字段**
- **响应**:`{ "code": "OK", "data": { "record": {...}, "action": "created" | "updated" } }`
- **实现说明**:
  - 当前简化方案:拉前 100 条记录按 `client_id` 本地比对查找
  - 优化方向:可改用飞书 `filter` 让服务端精确过滤,支持超过 100 条记录的场景

## CORS 配置

Worker 允许以下来源跨域访问(通过 `Access-Control-Allow-Origin` 头):

- 生产:`https://lee20260315.github.io`(由 `wrangler.toml` 的 `CORS_ORIGIN` 控制)
- 本地:可在 `.dev.vars` 中覆盖为 `http://localhost:*` 之类的值

OPTIONS 预检请求直接返回 204,所有响应统一附加 CORS 头。

## 错误码

所有错误响应统一格式:`{ "code": "...", "message": "...", "detail": ... }`

| code               | HTTP 状态 | 说明                                                  |
| ------------------ | --------- | ----------------------------------------------------- |
| `UNAUTHORIZED`     | 401       | `X-Sirius-Token` 缺失或与 `SIRIUS_ACCESS_TOKEN` 不一致 |
| `INVALID_TABLE`    | 400       | `table` 参数缺失或短名不在映射表中                    |
| `INVALID_BODY`     | 400       | 请求体不是合法 JSON,或结构不符合要求                 |
| `NOT_FOUND`        | 404       | 路径或方法未匹配                                      |
| `FEISHU_API_ERROR` | 502       | 调用飞书 API 失败,`detail` 含 `feishuCode` / `feishuMsg` |
| `INTERNAL_ERROR`   | 500       | 未捕获的内部错误                                      |

## Token 续期机制

- 飞书 `tenant_access_token` 有效期 2 小时(7200 秒)
- Worker 通过 Cloudflare KV(`SIRIUS_CACHE` 命名空间)缓存 token,缓存结构:

  ```json
  { "token": "t-xxx", "expireAt": 1721400000000 }
  ```

- 每次取 token 时:
  - 先读 KV,若剩余有效期 > 5 分钟,直接用缓存的 token
  - 否则调用飞书 `/auth/v3/tenant_access_token/internal` 重新获取,并写回 KV
- KV 写入时设置 `expirationTtl = expire - 300`,确保不会使用即将过期的 token
- KV 读写失败不阻塞主流程,最坏情况每次都重新获取 token(多一次飞书调用,不影响功能)

## 安全注意事项

1. **密钥只放 secrets,不进代码**
   - `FEISHU_APP_ID` / `FEISHU_APP_SECRET` / `FEISHU_APP_TOKEN` / `SIRIUS_ACCESS_TOKEN`
     以及 5 个 `FEISHU_TABLE_*` 全部通过 `wrangler secret put` 注入,不写入 `wrangler.toml`
   - `wrangler.toml` 仅保留 `CORS_ORIGIN` 这种非敏感配置
2. **`.dev.vars` 必须在 `.gitignore` 中**
   - 本地开发用的 `.dev.vars` 含明文密钥,切勿提交
3. **`X-Sirius-Token` 是前后端共享的访问口令**
   - 前端通过 `sessionStorage` 安全存储(关闭标签页即失效),避免明文写入 HTML
   - 前端调用接口时通过 `X-Sirius-Token` 请求头携带,Worker 与 `SIRIUS_ACCESS_TOKEN` 比对
   - 即使口令泄露,攻击者也只能读写飞书 Bitable 数据,无法获取飞书 App 凭证
4. **CORS 限制来源**
   - 默认只允许 `https://lee20260315.github.io` 跨域访问,降低被恶意站点调用的风险
5. **错误响应不泄露堆栈**
   - 全局 `try-catch` 捕获后,生产环境响应体不返回原始堆栈(仅在 `INTERNAL_ERROR` 时返回 `detail.stack`)
