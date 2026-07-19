/**
 * 统一响应工具
 * 提供 JSON 成功响应与错误响应的构造函数,统一附加 CORS 头
 */

/**
 * 构造 JSON 响应,统一附加 CORS 头
 * @param {any} data - 响应体数据,会被 JSON.stringify
 * @param {number} [status=200] - HTTP 状态码
 * @param {Object} [env] - Worker 环境变量,用于读取 CORS_ORIGIN
 * @returns {Response}
 */
export function json(data, status = 200, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': env?.CORS_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Sirius-Token',
      'Access-Control-Max-Age': '86400',
    },
  });
}

/**
 * 构造统一错误响应
 * @param {string} code - 错误码,如 UNAUTHORIZED / INVALID_TABLE / FEISHU_API_ERROR / INTERNAL_ERROR
 * @param {string} message - 错误信息
 * @param {number} [status=400] - HTTP 状态码
 * @param {any} [detail=null] - 错误详情,用于排查
 * @param {Object} [env] - Worker 环境变量
 * @returns {Response}
 */
export function error(code, message, status = 400, detail = null, env) {
  return json({ code, message, detail }, status, env);
}
