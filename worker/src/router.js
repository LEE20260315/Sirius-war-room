/**
 * 轻量路由器
 * 不引入第三方库,使用原生 URL 解析 + 正则匹配
 */

import { json, error } from './response.js';
import {
  listRecords,
  createRecord,
  batchCreateRecords,
  updateRecord,
  deleteRecord,
  upsertRecord,
} from './feishu.js';
import { fetchAllPrices, fetchKlines } from './price-fetcher.js';

/**
 * 行情池品种清单(与前端 DEFAULT_COMMODITIES 中的核心池一致,只取 symbol + contractCode)
 * 用于 /api/prices/* 与 /api/klines/* 抓取行情
 */
const POOL_VARIETIES = [
  { symbol: '棕榈油', contractCode: 'P2609' },
  { symbol: '白糖', contractCode: 'SR609' },
  { symbol: '棉花', contractCode: 'CF609' },
  { symbol: '天然橡胶', contractCode: 'RU2609' },
  { symbol: '铜', contractCode: 'CU2609' },
  { symbol: '黄金', contractCode: 'AU2608' },
  { symbol: '白银', contractCode: 'AG2608' },
  { symbol: '多晶硅', contractCode: 'PS2609' },
  { symbol: '碳酸锂', contractCode: 'LC2611' },
  { symbol: '豆油', contractCode: 'Y2609' },
  { symbol: '菜油', contractCode: 'OI609' },
];

/**
 * 行情缓存新鲜期(毫秒),超过此时间视为 stale,后台刷新
 */
const PRICE_CACHE_TTL_MS = 30 * 1000;

/**
 * 日期字段名清单(飞书 Bitable 日期类型字段需要毫秒时间戳)
 */
const DATETIME_FIELDS = new Set([
  'trade_time',
  'created_at',
  'snapshot_time',
  'flow_time',
  'updated_at',
]);

/**
 * 把 record 中的日期字段从字符串转成毫秒时间戳
 * 飞书 Bitable 日期字段只接受 number(毫秒)
 * 支持格式:ISO 字符串 / "YYYY-MM-DD HH:mm:ss" / 已是 number(跳过) / null(跳过)
 * @param {Object} fields - 字段对象,会原地修改
 * @returns {Object} 转换后的字段对象
 */
function convertDatetimeFields(fields) {
  if (!fields || typeof fields !== 'object') return fields;
  for (const key of Object.keys(fields)) {
    if (!DATETIME_FIELDS.has(key)) continue;
    const v = fields[key];
    if (v == null) continue;
    if (typeof v === 'number') continue; // 已是数字,跳过
    if (typeof v === 'string') {
      // "YYYY-MM-DD HH:mm:ss" 飞书不识别,转成 ISO 再转毫秒
      const normalized = v.includes('T') ? v : v.replace(' ', 'T');
      const ms = Date.parse(normalized);
      if (!isNaN(ms)) {
        fields[key] = ms;
      }
    }
  }
  return fields;
}

/**
 * 获取 table 短名到真实 table_id 的映射
 * @param {Object} env - Worker 环境变量
 * @returns {Object} 短名 -> table_id
 */
function getTableMap(env) {
  return {
    real_trades: env.FEISHU_TABLE_REAL_TRADES,
    sim_trades: env.FEISHU_TABLE_SIM_TRADES,
    pool_snapshot: env.FEISHU_TABLE_POOL_SNAPSHOT,
    account_ledger: env.FEISHU_TABLE_ACCOUNT_LEDGER,
    variety_dict: env.FEISHU_TABLE_VARIETY_DICT,
  };
}

/**
 * 从 URL 中解析 table 短名并返回真实 table_id
 * @param {URL} url
 * @param {Object} env
 * @returns {{tableId: string, tableKey: string} | {error: Response}}
 */
function resolveTableId(url, env) {
  const tableKey = url.searchParams.get('table');
  if (!tableKey) {
    return { error: error('INVALID_TABLE', '缺少 table 参数', 400, null, env) };
  }
  const map = getTableMap(env);
  const tableId = map[tableKey];
  if (!tableId) {
    return {
      error: error('INVALID_TABLE', `未知 table: ${tableKey}`, 400, { tableKey }, env),
    };
  }
  return { tableId, tableKey };
}

/**
 * 校验 X-Sirius-Token 头,与 env.SIRIUS_ACCESS_TOKEN 不一致返 401
 * @param {Request} req
 * @param {Object} env
 * @returns {Response|null} 校验失败返回 Response,成功返回 null
 */
function checkToken(req, env) {
  const token = req.headers.get('X-Sirius-Token');
  if (!token || token !== env.SIRIUS_ACCESS_TOKEN) {
    return error('UNAUTHORIZED', '无效或缺失 X-Sirius-Token', 401, null, env);
  }
  return null;
}

/**
 * 路由分发主函数
 * @param {Request} req
 * @param {Object} env
 * @param {Object} ctx
 * @returns {Promise<Response>}
 */
export async function router(req, env, ctx) {
  const url = new URL(req.url);
  const method = req.method.toUpperCase();
  const path = url.pathname;

  // GET /api/health - 健康检查,不校验口令
  if (path === '/api/health' && method === 'GET') {
    return json({ status: 'ok', time: new Date().toISOString() }, 200, env);
  }

  // 其余接口均校验 X-Sirius-Token
  const authError = checkToken(req, env);
  if (authError) return authError;

  // GET /api/records - 查询记录列表
  if (path === '/api/records' && method === 'GET') {
    const table = resolveTableId(url, env);
    if (table.error) return table.error;
    const filter = url.searchParams.get('filter') || undefined;
    const pageSize = url.searchParams.get('pageSize') || 100;
    const pageToken = url.searchParams.get('pageToken') || undefined;
    const data = await listRecords(env, table.tableId, { filter, pageSize, pageToken });
    return json({ code: 'OK', data }, 200, env);
  }

  // POST /api/records - 新增单条记录
  if (path === '/api/records' && method === 'POST') {
    const table = resolveTableId(url, env);
    if (table.error) return table.error;
    let fields;
    try {
      fields = await req.json();
    } catch (e) {
      return error('INVALID_BODY', '请求体不是合法 JSON', 400, null, env);
    }
    convertDatetimeFields(fields);
    const data = await createRecord(env, table.tableId, fields);
    return json({ code: 'OK', data }, 200, env);
  }

  // POST /api/records/batch - 批量新增
  if (path === '/api/records/batch' && method === 'POST') {
    const table = resolveTableId(url, env);
    if (table.error) return table.error;
    let arr;
    try {
      arr = await req.json();
    } catch (e) {
      return error('INVALID_BODY', '请求体不是合法 JSON', 400, null, env);
    }
    if (!Array.isArray(arr)) {
      return error('INVALID_BODY', '批量新增 body 必须是数组', 400, null, env);
    }
    const records = arr.map((fields) => ({ fields: convertDatetimeFields(fields) }));
    const data = await batchCreateRecords(env, table.tableId, records);
    return json({ code: 'OK', data }, 200, env);
  }

  // POST /api/records/upsert - 按 client_id upsert
  if (path === '/api/records/upsert' && method === 'POST') {
    const table = resolveTableId(url, env);
    if (table.error) return table.error;
    let fields;
    try {
      fields = await req.json();
    } catch (e) {
      return error('INVALID_BODY', '请求体不是合法 JSON', 400, null, env);
    }
    convertDatetimeFields(fields);
    const data = await upsertRecord(env, table.tableId, { fields });
    return json({ code: 'OK', data }, 200, env);
  }

  // PUT /api/records/:id - 更新单条
  const putMatch = path.match(/^\/api\/records\/([^/]+)$/);
  if (putMatch && method === 'PUT') {
    const table = resolveTableId(url, env);
    if (table.error) return table.error;
    const recordId = putMatch[1];
    let fields;
    try {
      fields = await req.json();
    } catch (e) {
      return error('INVALID_BODY', '请求体不是合法 JSON', 400, null, env);
    }
    convertDatetimeFields(fields);
    const data = await updateRecord(env, table.tableId, recordId, fields);
    return json({ code: 'OK', data }, 200, env);
  }

  // DELETE /api/records/:id - 删除单条
  const delMatch = path.match(/^\/api\/records\/([^/]+)$/);
  if (delMatch && method === 'DELETE') {
    const table = resolveTableId(url, env);
    if (table.error) return table.error;
    const recordId = delMatch[1];
    const data = await deleteRecord(env, table.tableId, recordId);
    return json({ code: 'OK', data }, 200, env);
  }

  // GET /api/prices - 读取行情缓存
  // KV prices_cache 存 { prices, fetched_at }:
  //   - 缓存新鲜(< 30s):返回 { prices, stale: false }
  //   - 缓存过期:返回旧值 { prices, stale: true },ctx.waitUntil 后台刷新
  //   - 无缓存(冷启动):同步抓取、写 KV、返回 { prices, stale: false }
  if (path === '/api/prices' && method === 'GET') {
    const cached = await env.SIRIUS_CACHE.get('prices_cache');
    if (cached) {
      let parsed = null;
      try {
        parsed = JSON.parse(cached);
      } catch (e) {
        parsed = null;
      }
      if (parsed && parsed.prices && parsed.fetched_at) {
        const fresh = Date.now() - parsed.fetched_at < PRICE_CACHE_TTL_MS;
        if (fresh) {
          return json(
            { code: 'OK', data: { prices: parsed.prices, stale: false } },
            200,
            env
          );
        }
        // 缓存过期:先返回旧值,后台刷新
        ctx.waitUntil(
          (async () => {
            try {
              const r = await fetchAllPrices(POOL_VARIETIES);
              await env.SIRIUS_CACHE.put(
                'prices_cache',
                JSON.stringify({ prices: r.prices, fetched_at: Date.now() }),
                { expirationTtl: 120 }
              );
            } catch (e) {
              console.error('[prices] 后台刷新失败:', e);
            }
          })()
        );
        return json(
          { code: 'OK', data: { prices: parsed.prices, stale: true } },
          200,
          env
        );
      }
    }
    // 冷启动:同步抓取
    try {
      const r = await fetchAllPrices(POOL_VARIETIES);
      await env.SIRIUS_CACHE.put(
        'prices_cache',
        JSON.stringify({ prices: r.prices, fetched_at: Date.now() }),
        { expirationTtl: 120 }
      );
      return json(
        { code: 'OK', data: { prices: r.prices, stale: false } },
        200,
        env
      );
    } catch (e) {
      return error(
        'PRICE_FETCH_ERROR',
        `行情抓取失败: ${e.message || e}`,
        502,
        null,
        env
      );
    }
  }

  // POST /api/prices/refresh - 强制刷新行情
  // 同步抓取 + 写 KV(30s TTL),后台写飞书 pool_snapshot(Task 4)
  if (path === '/api/prices/refresh' && method === 'POST') {
    let r;
    try {
      r = await fetchAllPrices(POOL_VARIETIES);
    } catch (e) {
      return error(
        'PRICE_FETCH_ERROR',
        `行情抓取失败: ${e.message || e}`,
        502,
        null,
        env
      );
    }
    // 写 KV 缓存,TTL 120s(KV 最小 60s,留足 stale 窗口)
    try {
      await env.SIRIUS_CACHE.put(
        'prices_cache',
        JSON.stringify({ prices: r.prices, fetched_at: Date.now() }),
        { expirationTtl: 120 }
      );
    } catch (e) {
      console.error('[prices] KV 写入失败:', e);
    }
    // 后台写飞书 pool_snapshot:不阻塞响应,失败仅记录日志
    ctx.waitUntil(
      (async () => {
        const tableId = env.FEISHU_TABLE_POOL_SNAPSHOT;
        if (!tableId) {
          console.error(
            '[pool_snapshot] 缺少 FEISHU_TABLE_POOL_SNAPSHOT 环境变量'
          );
          return;
        }
        const today = new Date().toISOString().slice(0, 10);
        const nowMs = Date.now();
        for (const v of POOL_VARIETIES) {
          const p = r.prices[v.symbol];
          if (!p) continue;
          try {
            const clientId = `pool_${v.symbol}_${today}`;
            const fields = {
              symbol: v.symbol,
              symbol_code: v.contractCode,
              price: p.price,
              // 飞书日期字段需毫秒时间戳;convertDatetimeFields 对 number 跳过,
              // 直接传 number 即可被飞书正确识别
              snapshot_time: nowMs,
              account: 'sim',
              client_id: clientId,
            };
            await upsertRecord(env, tableId, { fields });
          } catch (e) {
            console.error(
              `[pool_snapshot] upsert 失败 ${v.symbol}:`,
              e && (e.message || e)
            );
          }
        }
      })()
    );
    return json(
      {
        code: 'OK',
        data: { ok: r.ok, fail: r.fail, total: r.total, prices: r.prices },
      },
      200,
      env
    );
  }

  // GET /api/klines - 读取 K 线缓存
  // 可选 ?symbol=铜 单品种;无 symbol 时读 kline_index 后逐个读 kline_{symbol}
  if (path === '/api/klines' && method === 'GET') {
    const symbol = url.searchParams.get('symbol');
    if (symbol) {
      const cached = await env.SIRIUS_CACHE.get(`kline_${symbol}`);
      let parsed = null;
      if (cached) {
        try {
          parsed = JSON.parse(cached);
        } catch (e) {
          parsed = null;
        }
      }
      if (parsed) {
        return json(
          { code: 'OK', data: { klines: { [symbol]: parsed } } },
          200,
          env
        );
      }
      return json({ code: 'OK', data: { klines: {} } }, 200, env);
    }
    // 无 symbol:读 kline_index,逐个读 kline_{symbol}
    const indexStr = await env.SIRIUS_CACHE.get('kline_index');
    let symbols = [];
    if (indexStr) {
      try {
        symbols = JSON.parse(indexStr) || [];
      } catch (e) {
        symbols = [];
      }
    }
    const klines = {};
    if (symbols.length > 0) {
      const entries = await Promise.all(
        symbols.map(async (s) => {
          const v = await env.SIRIUS_CACHE.get(`kline_${s}`);
          let parsed = null;
          if (v) {
            try {
              parsed = JSON.parse(v);
            } catch (e) {
              parsed = null;
            }
          }
          return [s, parsed];
        })
      );
      for (const [s, val] of entries) {
        if (val) klines[s] = val;
      }
    }
    return json({ code: 'OK', data: { klines } }, 200, env);
  }

  // POST /api/klines/refresh - 强制刷新 K 线
  // 每个 symbol 独立 KV kline_{symbol}(TTL 86400),并更新 kline_index
  if (path === '/api/klines/refresh' && method === 'POST') {
    let r;
    try {
      r = await fetchKlines(POOL_VARIETIES);
    } catch (e) {
      return error(
        'KLINE_FETCH_ERROR',
        `K 线抓取失败: ${e.message || e}`,
        502,
        null,
        env
      );
    }
    const symbols = Object.keys(r.klines);
    await Promise.all(
      symbols.map((s) =>
        env.SIRIUS_CACHE.put(`kline_${s}`, JSON.stringify(r.klines[s]), {
          expirationTtl: 86400,
        })
      )
    );
    // 更新 kline_index(无 TTL,长期保留;下次 refresh 时覆盖)
    try {
      await env.SIRIUS_CACHE.put('kline_index', JSON.stringify(symbols));
    } catch (e) {
      console.error('[klines] kline_index 写入失败:', e);
    }
    return json(
      { code: 'OK', data: { ok: r.ok, fail: r.fail, total: r.total } },
      200,
      env
    );
  }

  // 未匹配任何路由
  return error('NOT_FOUND', `路径未找到: ${method} ${path}`, 404, null, env);
}
