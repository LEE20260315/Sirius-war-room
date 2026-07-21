/**
 * 统一响应工具
 * 提供 JSON 成功响应与错误响应的构造函数,统一附加 CORS 头
 */

/**
 * 解析 CORS 允许的来源
 * 支持以下 env.CORS_ORIGIN 配置形式:
 *   - 未配置(空):返回 '*' (向后兼容;生产环境应显式配置)
 *   - 单域名:"https://example.com"
 *   - 多域名(逗号分隔):"https://a.com,https://b.com"
 *   - 通配符:"https://*.example.com,http://localhost:*"
 *
 * @param {string} corsOrigin - env.CORS_ORIGIN 原始值
 * @param {string|null} [requestOrigin] - 请求 Origin 头(无 Origin 时传 null/undefined)
 * @returns {string|null} 用于 Access-Control-Allow-Origin 的值;
 *                        不匹配时返回 null(调用方应省略该头让浏览器拒绝)
 */
export function resolveCorsOrigin(corsOrigin, requestOrigin) {
  if (!corsOrigin) return '*';
  const allowed = corsOrigin
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowed.length === 0) return '*';

  // 请求未带 Origin(非浏览器调用,如 curl/Postman):返回第一个配置项
  // 浏览器跨域请求一定会带 Origin,此分支只服务于调试场景
  if (!requestOrigin) return allowed[0];

  // 1. 精确匹配
  if (allowed.includes(requestOrigin)) return requestOrigin;

  // 2. 通配符匹配(如 https://*.example.com 或 http://localhost:*)
  for (const pattern of allowed) {
    if (!pattern.includes('*')) continue;
    const re = new RegExp(
      '^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'
    );
    if (re.test(requestOrigin)) return requestOrigin;
  }

  // 3. 不匹配:返回 null,调用方应省略 Access-Control-Allow-Origin 头
  return null;
}

/**
 * 构造统一响应头(含 CORS + 安全防御头)
 * @param {Object} [env] - Worker 环境变量,用于读取 CORS_ORIGIN 与 __requestOrigin
 * @returns {Object} headers 对象
 */
function buildCorsHeaders(env) {
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Sirius-Token',
    'Access-Control-Max-Age': '86400',
    // 防御纵深:Worker 只返回 JSON,这些头把"被当成 HTML 渲染/被嗅探/被 iframe 嵌套"
    // 这几条攻击路径全部封死。前端真正的 XSS 防护需要前端 CSP,但 GitHub Pages
    // 不支持自定义响应头,故前端 XSS 防护只能依赖代码侧(转义/沙箱)。
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'Referrer-Policy': 'no-referrer',
  };
  const allowedOrigin = resolveCorsOrigin(env?.CORS_ORIGIN, env?.__requestOrigin);
  if (allowedOrigin) {
    headers['Access-Control-Allow-Origin'] = allowedOrigin;
  }
  return headers;
}

/**
 * 构造 JSON 响应,统一附加 CORS 头
 * @param {any} data - 响应体数据,会被 JSON.stringify
 * @param {number} [status=200] - HTTP 状态码
 * @param {Object} [env] - Worker 环境变量,用于读取 CORS_ORIGIN 与 __requestOrigin
 * @returns {Response}
 */
export function json(data, status = 200, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...buildCorsHeaders(env),
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
