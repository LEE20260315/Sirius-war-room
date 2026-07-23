/**
 * 飞书 API 封装
 * 提供 tenant_access_token 续期(KV 缓存)+ Bitable 记录增删改查
 * 不依赖任何第三方库,全部使用原生 fetch
 */

const FEISHU_BASE = 'https://open.feishu.cn/open-apis';
const TOKEN_CACHE_KEY = 'tenant_access_token';
// 提前 5 分钟续期,避免边界时刻 token 已过期
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

/**
 * 获取飞书 tenant_access_token,带 KV 缓存
 * 缓存 value 形如 { token, expireAt },剩余有效期 < 5 分钟时重新获取
 * @param {Object} env - Worker 环境变量,需包含 FEISHU_APP_ID / FEISHU_APP_SECRET / SIRIUS_CACHE
 * @returns {Promise<string>} tenant_access_token
 */
export async function getTenantAccessToken(env) {
  // 先读 KV 缓存
  try {
    const cached = await env.SIRIUS_CACHE.get(TOKEN_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (
        parsed &&
        parsed.token &&
        parsed.expireAt &&
        Date.now() < parsed.expireAt - TOKEN_REFRESH_BUFFER_MS
      ) {
        return parsed.token;
      }
    }
  } catch (e) {
    // 缓存读取失败不阻塞主流程,继续走重新获取流程
  }

  // 调用飞书接口获取新 token
  let resp;
  try {
    resp = await fetch(`${FEISHU_BASE}/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        app_id: env.FEISHU_APP_ID,
        app_secret: env.FEISHU_APP_SECRET,
      }),
    });
  } catch (e) {
    throw {
      code: 'FEISHU_API_ERROR',
      message: `获取 tenant_access_token 网络错误: ${e.message || e}`,
      detail: { stage: 'fetch_token' },
    };
  }

  if (!resp.ok) {
    throw {
      code: 'FEISHU_API_ERROR',
      message: `获取 tenant_access_token 失败,HTTP ${resp.status}`,
      detail: { httpStatus: resp.status, stage: 'fetch_token' },
    };
  }

  const body = await resp.json();
  if (body.code !== 0) {
    throw {
      code: 'FEISHU_API_ERROR',
      message: body.msg || '获取 tenant_access_token 失败',
      detail: { feishuCode: body.code, feishuMsg: body.msg, stage: 'fetch_token' },
    };
  }

  const token = body.tenant_access_token;
  // expire 单位为秒,转毫秒
  const expireAt = Date.now() + body.expire * 1000;

  // 写入 KV 缓存,TTL 设为 expire - 5 分钟,避免使用即将过期的 token
  try {
    const ttl = Math.max(60, body.expire - 300);
    await env.SIRIUS_CACHE.put(
      TOKEN_CACHE_KEY,
      JSON.stringify({ token, expireAt }),
      { expirationTtl: ttl }
    );
  } catch (e) {
    // KV 写入失败不影响主流程,下次会重新获取
  }

  return token;
}

/**
 * 调用飞书 Bitable 接口的统一封装
 * @param {Object} env - Worker 环境变量
 * @param {string} method - HTTP 方法(GET/POST/PUT/DELETE)
 * @param {string} path - 接口路径(不含 base,以 / 开头)
 * @param {Object} [options] - 选项 { query, body }
 * @param {Object} [options.query] - URL 查询参数,值为空字符串/null/undefined 时跳过
 * @param {Object} [options.body] - 请求体,会被 JSON.stringify
 * @returns {Promise<any>} 飞书返回的 data 字段
 */
async function callFeishuBitable(env, method, path, options = {}) {
  const token = await getTenantAccessToken(env);
  const url = new URL(`${FEISHU_BASE}${path}`);

  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, String(v));
      }
    }
  }

  const fetchOptions = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
  };

  if (options.body !== undefined) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  let resp;
  try {
    resp = await fetch(url.toString(), fetchOptions);
  } catch (e) {
    throw {
      code: 'FEISHU_API_ERROR',
      message: `请求飞书接口网络错误: ${e.message || e}`,
      detail: { path, method, stage: 'fetch' },
    };
  }

  if (!resp.ok) {
    const detail = { httpStatus: resp.status, path, method, stage: 'http_status' };
    try {
      const errBody = await resp.json();
      detail.feishuCode = errBody.code;
      detail.feishuMsg = errBody.msg;
    } catch (e) {
      // 响应体非 JSON,忽略
    }
    throw {
      code: 'FEISHU_API_ERROR',
      message: `飞书接口 HTTP ${resp.status}`,
      detail,
    };
  }

  const jsonBody = await resp.json();
  if (jsonBody.code !== 0) {
    throw {
      code: 'FEISHU_API_ERROR',
      message: jsonBody.msg || '飞书接口返回错误',
      detail: { feishuCode: jsonBody.code, feishuMsg: jsonBody.msg, path, method },
    };
  }

  return jsonBody.data;
}

/**
 * 查询记录列表
 * @param {Object} env
 * @param {string} tableId
 * @param {Object} [opts] - { filter, pageSize, pageToken }
 * @param {string} [opts.filter] - 飞书 filter 表达式
 * @param {number} [opts.pageSize] - 每页数量,默认 100
 * @param {string} [opts.pageToken] - 分页 token
 * @returns {Promise<Object>} - { items, page_token, has_more, total }
 */
export function listRecords(env, tableId, opts = {}) {
  return callFeishuBitable(
    env,
    'GET',
    `/bitable/v1/apps/${env.FEISHU_APP_TOKEN}/tables/${tableId}/records`,
    {
      query: {
        filter: opts.filter,
        page_size: opts.pageSize,
        page_token: opts.pageToken,
      },
    }
  );
}

/**
 * 新增单条记录
 * @param {Object} env
 * @param {string} tableId
 * @param {Object} fields - 字段对象
 * @returns {Promise<Object>} - { record }
 */
export function createRecord(env, tableId, fields) {
  return callFeishuBitable(
    env,
    'POST',
    `/bitable/v1/apps/${env.FEISHU_APP_TOKEN}/tables/${tableId}/records`,
    { body: { fields } }
  );
}

/**
 * 批量新增记录
 * @param {Object} env
 * @param {string} tableId
 * @param {Array<{fields: Object}>} records - 记录数组,每项形如 { fields: {...} }
 * @returns {Promise<Object>} - { records }
 */
export function batchCreateRecords(env, tableId, records) {
  return callFeishuBitable(
    env,
    'POST',
    `/bitable/v1/apps/${env.FEISHU_APP_TOKEN}/tables/${tableId}/records/batch_create`,
    { body: { records } }
  );
}

/**
 * 更新单条记录
 * @param {Object} env
 * @param {string} tableId
 * @param {string} recordId - 飞书记录 ID
 * @param {Object} fields - 新的字段对象
 * @returns {Promise<Object>} - { record }
 */
export function updateRecord(env, tableId, recordId, fields) {
  return callFeishuBitable(
    env,
    'PUT',
    `/bitable/v1/apps/${env.FEISHU_APP_TOKEN}/tables/${tableId}/records/${recordId}`,
    { body: { fields } }
  );
}

/**
 * 删除单条记录
 * @param {Object} env
 * @param {string} tableId
 * @param {string} recordId - 飞书记录 ID
 * @returns {Promise<Object>} - 飞书返回的 data
 */
export function deleteRecord(env, tableId, recordId) {
  return callFeishuBitable(
    env,
    'DELETE',
    `/bitable/v1/apps/${env.FEISHU_APP_TOKEN}/tables/${tableId}/records/${recordId}`
  );
}

/**
 * 按 client_id 字段查找记录
 *
 * 简化方案:拉前 100 条记录,本地按 client_id 字段比对查找
 * 优化建议:可改用飞书 filter 参数 ?filter=AND(CurrentValue.[client_id]="xxx") 让飞书服务端精确过滤,
 *           从而支持超过 100 条记录的场景。当前简化方案适合 client_id 唯一性强的场景。
 *
 * @param {Object} env
 * @param {string} tableId
 * @param {string} clientId - 业务侧 client_id
 * @returns {Promise<Object|null>} 找到的记录对象,或 null
 */
export async function findRecordByClientId(env, tableId, clientId) {
  // 服务端 filter 精确匹配:突破旧方案"拉前 100 条本地比对"的上限,
  // 直接按 client_id 过滤,适合记录数增长后仍能稳定 upsert。
  // client_id 是 Text 字段,filter 表达式: CurrentValue.[client_id]="xxx"
  const escaped = String(clientId)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');
  const filter = `CurrentValue.[client_id]="${escaped}"`;

  const data = await listRecords(env, tableId, { filter, pageSize: 10 });
  const items = (data && data.items) || [];
  // 服务端 filter 后再本地确认一次(防止字段类型差异导致模糊匹配)
  for (const item of items) {
    const cid = item.fields && item.fields.client_id;
    // 兼容字符串、富文本数组等形式
    const cidValue = Array.isArray(cid)
      ? cid[0]?.text || cid[0]?.value || cid[0]
      : cid;
    if (String(cidValue) === String(clientId)) {
      return item;
    }
  }
  return null;
}

/**
 * upsert:按 client_id 查找,有则更新无则新增
 * @param {Object} env
 * @param {string} tableId
 * @param {Object} record - { fields: {...} } 字段对象需包含 client_id
 * @returns {Promise<Object>} - { record, action: 'created' | 'updated' }
 */
export async function upsertRecord(env, tableId, record) {
  const clientId = record.fields && record.fields.client_id;
  if (!clientId) {
    throw {
      code: 'FEISHU_API_ERROR',
      message: 'upsert 缺少 client_id 字段',
      detail: { stage: 'upsert_validate' },
    };
  }

  // 把 clientId 转成字符串再比对
  const cidStr = Array.isArray(clientId)
    ? clientId[0]?.text || clientId[0]?.value || clientId[0]
    : clientId;

  const existing = await findRecordByClientId(env, tableId, String(cidStr));
  if (existing) {
    const updated = await updateRecord(env, tableId, existing.record_id, record.fields);
    return { record: updated.record, action: 'updated' };
  }
  const created = await createRecord(env, tableId, record.fields);
  return { record: created.record, action: 'created' };
}

/**
 * 查询外部多维表格记录（支持非本应用 app_token）
 * @param {string} token - 已获取的 tenant_access_token
 * @param {string} appToken - 外部多维表格 app_token
 * @param {string} tableId - 表格 ID
 * @param {Object} [opts] - { filter, pageSize, pageToken }
 * @returns {Promise<Object>} - { items, page_token, has_more, total }
 */
export async function listExternalRecords(token, appToken, tableId, opts = {}) {
  const url = new URL(`${FEISHU_BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/records`);
  if (opts.filter) url.searchParams.set("filter", opts.filter);
  if (opts.pageSize) url.searchParams.set("page_size", String(opts.pageSize));
  if (opts.pageToken) url.searchParams.set("page_token", opts.pageToken);
  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8" },
  });
  if (!resp.ok) throw { code: "FEISHU_API_ERROR", message: `HTTP ${resp.status}` };
  const body = await resp.json();
  if (body.code !== 0) throw { code: "FEISHU_API_ERROR", message: body.msg || "飞书错误" };
  return body.data;
}
