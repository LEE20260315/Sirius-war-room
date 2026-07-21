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

  // 未匹配任何路由
  return error('NOT_FOUND', `路径未找到: ${method} ${path}`, 404, null, env);
}
