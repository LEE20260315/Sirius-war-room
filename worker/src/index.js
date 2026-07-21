/**
 * Cloudflare Workers 入口
 * 处理 CORS 预检 + 全局错误捕获 + 路由分发
 */

import { router } from './router.js';
import { json, error, resolveCorsOrigin } from './response.js';

/**
 * 构造 OPTIONS 预检响应头(与 response.js 的 buildCorsHeaders 保持一致)
 * @param {string} corsOrigin - env.CORS_ORIGIN
 * @param {string|null} requestOrigin - 请求 Origin
 * @returns {Object} headers 对象
 */
function buildOptionsHeaders(corsOrigin, requestOrigin) {
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Sirius-Token',
    'Access-Control-Max-Age': '86400',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'Referrer-Policy': 'no-referrer',
  };
  const allowedOrigin = resolveCorsOrigin(corsOrigin, requestOrigin);
  if (allowedOrigin) {
    headers['Access-Control-Allow-Origin'] = allowedOrigin;
  }
  return headers;
}

export default {
  /**
   * 主入口
   * @param {Request} request
   * @param {Object} env - Worker 环境变量(含 secrets 与 vars)
   * @param {Object} ctx - Worker 执行上下文
   * @returns {Promise<Response>}
   */
  async fetch(request, env, ctx) {
    // 提取请求 Origin,附加到 env 副本上,供 response.js 按来源动态返回 CORS 头
    // (支持 CORS_ORIGIN 配置多域名/通配符,无 Origin 时降级到原行为)
    const requestOrigin = request.headers.get('Origin');
    const envWithCors = { ...env, __requestOrigin: requestOrigin };

    // OPTIONS 预检:按 Origin 动态匹配,不匹配时不返回 Allow-Origin 头(浏览器会拒绝)
    if (request.method.toUpperCase() === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: buildOptionsHeaders(env?.CORS_ORIGIN, requestOrigin),
      });
    }

    try {
      return await router(request, envWithCors, ctx);
    } catch (e) {
      // 统一错误返回,避免暴露内部堆栈
      const code = (e && e.code) || 'INTERNAL_ERROR';
      const message = (e && e.message) || '服务器内部错误';
      const detail =
        (e && e.detail) ||
        (e && e.stack ? { stack: e.stack } : null);
      // 飞书 API 错误返回 502,其余 500
      const status = code === 'FEISHU_API_ERROR' ? 502 : 500;
      return error(code, message, status, detail, envWithCors);
    }
  },
};
