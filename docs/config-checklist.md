# Sirius 期货作战室 · 配置清单

本文档汇总所有需要在飞书 + Cloudflare Workers + 前端三处填写的密钥与配置项。
详细步骤参见 `docs/feishu-setup.md` 和 `worker/README.md`。

## 一、飞书应用配置(阶段一产出)

| 配置项 | 在哪里拿 | 填到哪里 |
|---|---|---|
| App ID | 飞书开放平台 → 应用 → 凭证与基础信息 | Cloudflare Workers secret `FEISHU_APP_ID` |
| App Secret | 同上 | Cloudflare Workers secret `FEISHU_APP_SECRET` |
| App Token | 多维表格 URL 解析(见 feishu-setup.md) | Cloudflare Workers secret `FEISHU_APP_TOKEN` |
| Table ID · 实盘成交流水 | 多维表格 URL `?table=tblXXX` | `FEISHU_TABLE_REAL_TRADES` |
| Table ID · 模拟成交流水 | 同上 | `FEISHU_TABLE_SIM_TRADES` |
| Table ID · 观察池快照 | 同上 | `FEISHU_TABLE_POOL_SNAPSHOT` |
| Table ID · 资金账户流水 | 同上 | `FEISHU_TABLE_ACCOUNT_LEDGER` |
| Table ID · 品种参数字典 | 同上 | `FEISHU_TABLE_VARIETY_DICT` |

**权限要求**:
- 应用开通 `bitable:app` 权限
- 应用被加为目标多维表格的协作者(否则 403)

## 二、Cloudflare Workers 部署

### 1. 创建 KV 命名空间

```bash
cd worker
npx wrangler kv:namespace create SIRIUS_CACHE
# 输出 id,填到 wrangler.toml 的 [[kv_namespaces]] id 字段(替换 TODO_CREATE_KV_NAMESPACE_AND_FILL_ID)
```

### 2. 设置 secrets

```bash
npx wrangler secret put FEISHU_APP_ID
npx wrangler secret put FEISHU_APP_SECRET
npx wrangler secret put FEISHU_APP_TOKEN
npx wrangler secret put SIRIUS_ACCESS_TOKEN          # 自定义访问口令,自己起一个长字符串
npx wrangler secret put FEISHU_TABLE_REAL_TRADES
npx wrangler secret put FEISHU_TABLE_SIM_TRADES
npx wrangler secret put FEISHU_TABLE_POOL_SNAPSHOT
npx wrangler secret put FEISHU_TABLE_ACCOUNT_LEDGER
npx wrangler secret put FEISHU_TABLE_VARIETY_DICT
```

### 3. 部署

```bash
npx wrangler deploy
# 输出 https://sirius-proxy.<your-subdomain>.workers.dev
```

### 4. 修改 wrangler.toml(可选)

如需自定义域名或修改 CORS allowlist,编辑 `wrangler.toml` 的 `[vars]` 节。

## 三、前端配置(用户在浏览器内填)

打开 `https://lee20260315.github.io/Sirius-war-room/pages/settings.html` → 「Sirius 云同步配置」分区:

| 字段 | 填什么 |
|---|---|
| 代理地址 | 上一步部署得到的 Worker URL(如 `https://sirius-proxy.xxx.workers.dev`) |
| 访问口令 | 与 Workers secret `SIRIUS_ACCESS_TOKEN` 完全一致 |

操作:
1. 填入代理地址和访问口令
2. 点「测试连接」应显示绿色「✓ 连接成功」
3. 点「保存配置」后,所有数据将自动拉取飞书云端并同步

## 四、安全底线

- ✅ App Secret 仅存在于 Cloudflare Workers secrets,不会出现在前端代码
- ✅ 前端只持有用户自定义访问口令,通过 `X-Sirius-Token` header 传给 Worker
- ✅ Worker 校验口令后才转发到飞书 API,失败返回 401
- ✅ 所有密钥不会 commit 到仓库(`.gitignore` 已加 `.env` / `.env.local` / `*.secret`)
- ✅ Worker 启用 CORS,仅允许 `https://lee20260315.github.io`

## 五、常见问题

- **测试连接失败 401**:访问口令与 Workers secret 不一致
- **测试连接失败 502**:飞书 API 报错,检查 App ID/Secret/App Token 是否正确,应用权限是否开通
- **测试连接失败 500**:Worker 内部错误,运行 `npx wrangler tail` 查看实时日志
- **数据未同步**:打开浏览器 dev tools → Application → Local Storage,查看 `ft_proxy_base` 是否有值;查看 Console 是否有 `[CloudSync]` 报错
- **离线补传不工作**:检查 `state.syncQueue` 是否有待补传项;触发 `window.dispatchEvent(new Event('online'))` 手动测试

## 六、相关文档

- `docs/feishu-setup.md` — 飞书应用与表结构详细配置
- `worker/README.md` — Cloudflare Workers 部署文档
- `README.md` — 项目总览
