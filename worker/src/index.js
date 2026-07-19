/**
 * Cloudflare Workers 入口
 * 处理 CORS 预检 + 全局错误捕获 + 路由分发
 */

import { router } from './router.js';
import { json, error } from './response.js';

export default {
  /**
   * 主入口
   * @param {Request} request
   * @param {Object} env - Worker 环境变量(含 secrets 与 vars)
   * @param {Object} ctx - Worker 执行上下文
   * @returns {Promise<Response>}
   */
  async fetch(request, env, ctx) {
    // OPTIONS 预检直接返 204
    if (request.method.toUpperCase() === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': env?.CORS_ORIGIN || '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-Sirius-Token',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    try {
      return await router(request, env, ctx);
    } catch (e) {
      // 统一错误返回,避免暴露内部堆栈
      const code = (e && e.code) || 'INTERNAL_ERROR';
      const message = (e && e.message) || '服务器内部错误';
      const detail =
        (e && e.detail) ||
        (e && e.stack ? { stack: e.stack } : null);
      // 飞书 API 错误返回 502,其余 500
      const status = code === 'FEISHU_API_ERROR' ? 502 : 500;
      return error(code, message, status, detail, env);
    }
  },
};
