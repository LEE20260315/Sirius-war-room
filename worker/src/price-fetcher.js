/**
 * 东方财富行情抓取
 * 在 Worker 端拉取期货最新价与日 K 线,绕过浏览器 CORS 限制
 * 不依赖任何第三方库,全部使用原生 fetch
 */

/**
 * 品种名 -> 东方财富 secid 映射
 * 与前端 shared/app-core.js 的 EASTMONEY_SYMBOL_MAP 保持一致
 */
export const EASTMONEY_SYMBOL_MAP = {
  // SHFE
  '螺纹钢': '113.rbm', '热卷': '113.hcm', '铁矿石': '114.im', '天然橡胶': '113.rum',
  '铜': '113.cum', '铝': '113.alm', '锌': '113.znm', '镍': '113.nim',
  '黄金': '113.aum', '白银': '113.agm', '沥青': '113.bum', '纸浆': '113.spm',
  // DCE
  '玉米': '114.cm', '生猪': '114.lhm', '棕榈油': '114.pm', '豆粕': '114.mm', '豆油': '114.ym',
  'PVC': '114.vm', '聚丙烯PP': '114.ppm', 'PP': '114.ppm', '塑料LLDPE': '114.lm', '乙二醇': '114.egm',
  // CZCE
  '甲醇': '115.mam', '玻璃': '115.fgm', '白糖': '115.srm', '纯碱': '115.sam',
  '烧碱': '115.shm', '尿素': '115.urm', '棉花': '115.cfm', '苹果': '115.apm', 'PTA': '115.tam', '菜油': '115.oim',
  // GFEX
  '多晶硅': '8.psm', '工业硅': '8.sim', '碳酸锂': '8.lcm',
};

/**
 * 单品种抓取超时(毫秒)
 */
const PER_VARIETY_TIMEOUT_MS = 6000;

/**
 * 带 AbortController 超时的 fetch
 * @param {string} url - 请求 URL
 * @param {number} timeoutMs - 超时毫秒
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 抓取全部品种的最新价
 * 使用 Promise.allSettled 并发,单品种 6s 超时,失败品种收集到 failedSymbols
 *
 * @param {Array<{symbol:string, contractCode:string}>} varieties - 品种列表
 * @returns {Promise<{ok:number, fail:number, total:number, prices:Object, failedSymbols:string[]}>}
 *   prices 形如 { '铜': { price, contract, updated_at }, ... }
 */
export async function fetchAllPrices(varieties) {
  const results = await Promise.allSettled(
    varieties.map(async (v) => {
      const secid = EASTMONEY_SYMBOL_MAP[v.symbol];
      if (!secid) {
        throw new Error(`无 secid 映射: ${v.symbol}`);
      }
      const url =
        `https://push2.eastmoney.com/api/qt/stock/get` +
        `?ut=bd1d9ddb04089700cf9c27f6f7426281&invt=2&fltt=2&fields=f43&secid=${secid}`;
      const resp = await fetchWithTimeout(url, PER_VARIETY_TIMEOUT_MS);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${v.symbol}`);
      }
      const body = await resp.json();
      const raw = body && body.data && body.data.f43;
      // f43 可能为 "-" / null / undefined 表示无行情
      if (raw == null || raw === '-' || raw === '') {
        throw new Error(`无行情数据: ${v.symbol}`);
      }
      const price = Number(raw);
      if (!isFinite(price)) {
        throw new Error(`价格非法: ${v.symbol}=${raw}`);
      }
      return { symbol: v.symbol, contract: v.contractCode, price };
    })
  );

  const prices = {};
  const failedSymbols = [];
  let ok = 0;
  let fail = 0;
  const now = Date.now();

  results.forEach((r, i) => {
    const v = varieties[i];
    if (r.status === 'fulfilled') {
      prices[v.symbol] = {
        price: r.value.price,
        contract: r.value.contract,
        updated_at: now,
      };
      ok++;
    } else {
      failedSymbols.push(v.symbol);
      fail++;
    }
  });

  return { ok, fail, total: varieties.length, prices, failedSymbols };
}

/**
 * 抓取全部品种的日 K 线(klt=101, lmt=750 ≈ 3 年交易日)
 * 单品种 6s 超时;K 线数 < 500 标记 insufficient(新合约上市不足 2 年)
 *
 * @param {Array<{symbol:string, contractCode:string}>} varieties - 品种列表
 * @returns {Promise<{ok:number, fail:number, total:number, klines:Object}>}
 *   klines 形如 { '铜': { klines: [{date, price}], insufficient: boolean }, ... }
 */
export async function fetchKlines(varieties) {
  const results = await Promise.allSettled(
    varieties.map(async (v) => {
      const secid = EASTMONEY_SYMBOL_MAP[v.symbol];
      if (!secid) {
        throw new Error(`无 secid 映射: ${v.symbol}`);
      }
      const url =
        `https://push2his.eastmoney.com/api/qt/stock/kline/get` +
        `?ut=bd1d9ddb04089700cf9c27f6f7426281` +
        `&fields1=f1,f2,f3,f4,f5,f6` +
        `&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61` +
        `&klt=101&fqt=0&end=20500101&lmt=750&secid=${secid}`;
      const resp = await fetchWithTimeout(url, PER_VARIETY_TIMEOUT_MS);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${v.symbol}`);
      }
      const body = await resp.json();
      const klinesArr = body && body.data && body.data.klines;
      if (!Array.isArray(klinesArr)) {
        throw new Error(`无 klines 数据: ${v.symbol}`);
      }
      // klines 字符串格式: "日期,开盘,收盘,最高,最低,成交量,成交额,振幅,涨跌幅,涨跌额,换手率"
      // [0]=日期, [2]=收盘价
      const parsed = klinesArr.map((line) => {
        const parts = String(line).split(',');
        return { date: parts[0], price: Number(parts[2]) };
      });
      return { symbol: v.symbol, klines: parsed, insufficient: parsed.length < 500 };
    })
  );

  const klines = {};
  let ok = 0;
  let fail = 0;

  results.forEach((r, i) => {
    const v = varieties[i];
    if (r.status === 'fulfilled') {
      klines[v.symbol] = {
        klines: r.value.klines,
        insufficient: r.value.insufficient,
      };
      ok++;
    } else {
      fail++;
    }
  });

  return { ok, fail, total: varieties.length, klines };
}
