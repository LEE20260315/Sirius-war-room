// ============ FUTURES TRACKER - APP CORE ============
// Data store, state management, localStorage CRUD, price fetching,
// auto-refresh, theme toggle, backup/import/export, and init function.

// ============ VERSION ============
const APP_VERSION = '2026.07.09-v7';

// ============ DATA STORE ============
// 交易所分类品种主数据：覆盖国内五大期货交易所
// exchange: SHFE(上海期货) / DCE(大连商品) / CZCE(郑州商品) / GFEX(广州期货) / CFFEX(中金所)
// category: 农产品 / 黑色系 / 有色金属 / 贵金属 / 能源化工 / 新能源 / 股指
const EXCHANGE_VARIETIES = [
  // 上海期货交易所 (SHFE) — defaultContract 为当前主力月份（2026-07，动态维护）
  {exchange:'SHFE',exchangeName:'上海期货交易所',category:'有色金属',symbol:'铜',code:'CU',multiplier:5,marginRate:0.09,defaultContract:'CU2609'},
  {exchange:'SHFE',exchangeName:'上海期货交易所',category:'有色金属',symbol:'铝',code:'AL',multiplier:5,marginRate:0.08,defaultContract:'AL2610'},
  {exchange:'SHFE',exchangeName:'上海期货交易所',category:'有色金属',symbol:'锌',code:'ZN',multiplier:5,marginRate:0.08,defaultContract:'ZN2610'},
  {exchange:'SHFE',exchangeName:'上海期货交易所',category:'有色金属',symbol:'镍',code:'NI',multiplier:1,marginRate:0.12,defaultContract:'NI2609'},
  {exchange:'SHFE',exchangeName:'上海期货交易所',category:'贵金属',symbol:'黄金',code:'AU',multiplier:1000,marginRate:0.08,defaultContract:'AU2608'},
  {exchange:'SHFE',exchangeName:'上海期货交易所',category:'贵金属',symbol:'白银',code:'AG',multiplier:15,marginRate:0.10,defaultContract:'AG2608'},
  {exchange:'SHFE',exchangeName:'上海期货交易所',category:'黑色系',symbol:'螺纹钢',code:'RB',multiplier:10,marginRate:0.10,defaultContract:'RB2610'},
  {exchange:'SHFE',exchangeName:'上海期货交易所',category:'黑色系',symbol:'热卷',code:'HC',multiplier:10,marginRate:0.10,defaultContract:'HC2610'},
  {exchange:'SHFE',exchangeName:'上海期货交易所',category:'黑色系',symbol:'铁矿石',code:'I',multiplier:100,marginRate:0.12,defaultContract:'I2609'},
  {exchange:'SHFE',exchangeName:'上海期货交易所',category:'能源化工',symbol:'天然橡胶',code:'RU',multiplier:10,marginRate:0.12,defaultContract:'RU2609'},
  {exchange:'SHFE',exchangeName:'上海期货交易所',category:'能源化工',symbol:'沥青',code:'BU',multiplier:10,marginRate:0.08,defaultContract:'BU2609'},
  {exchange:'SHFE',exchangeName:'上海期货交易所',category:'能源化工',symbol:'纸浆',code:'SP',multiplier:10,marginRate:0.08,defaultContract:'SP2609'},
  // 大连商品交易所 (DCE)
  {exchange:'DCE',exchangeName:'大连商品交易所',category:'农产品',symbol:'棕榈油',code:'P',multiplier:10,marginRate:0.08,defaultContract:'P2609'},
  {exchange:'DCE',exchangeName:'大连商品交易所',category:'农产品',symbol:'玉米',code:'C',multiplier:10,marginRate:0.08,defaultContract:'C2609'},
  {exchange:'DCE',exchangeName:'大连商品交易所',category:'农产品',symbol:'豆粕',code:'M',multiplier:10,marginRate:0.08,defaultContract:'M2609'},
  {exchange:'DCE',exchangeName:'大连商品交易所',category:'农产品',symbol:'豆油',code:'Y',multiplier:10,marginRate:0.08,defaultContract:'Y2609'},
  {exchange:'DCE',exchangeName:'大连商品交易所',category:'农产品',symbol:'生猪',code:'LH',multiplier:16,marginRate:0.12,defaultContract:'LH2609'},
  {exchange:'DCE',exchangeName:'大连商品交易所',category:'能源化工',symbol:'PVC',code:'V',multiplier:5,marginRate:0.08,defaultContract:'V2609'},
  {exchange:'DCE',exchangeName:'大连商品交易所',category:'能源化工',symbol:'聚丙烯PP',code:'PP',multiplier:5,marginRate:0.08,defaultContract:'PP2609'},
  {exchange:'DCE',exchangeName:'大连商品交易所',category:'能源化工',symbol:'塑料LLDPE',code:'L',multiplier:5,marginRate:0.08,defaultContract:'L2609'},
  {exchange:'DCE',exchangeName:'大连商品交易所',category:'能源化工',symbol:'乙二醇',code:'EG',multiplier:10,marginRate:0.08,defaultContract:'EG2609'},
  // 郑州商品交易所 (CZCE) — 新浪连续代码 XX0 用于手动价格查询
  {exchange:'CZCE',exchangeName:'郑州商品交易所',category:'农产品',symbol:'白糖',code:'SR',multiplier:10,marginRate:0.08,defaultContract:'SR509'},
  {exchange:'CZCE',exchangeName:'郑州商品交易所',category:'农产品',symbol:'棉花',code:'CF',multiplier:5,marginRate:0.08,defaultContract:'CF509'},
  {exchange:'CZCE',exchangeName:'郑州商品交易所',category:'农产品',symbol:'苹果',code:'AP',multiplier:10,marginRate:0.10,defaultContract:'AP510'},
  {exchange:'CZCE',exchangeName:'郑州商品交易所',category:'能源化工',symbol:'甲醇',code:'MA',multiplier:10,marginRate:0.08,defaultContract:'MA509'},
  {exchange:'CZCE',exchangeName:'郑州商品交易所',category:'能源化工',symbol:'玻璃',code:'FG',multiplier:20,marginRate:0.08,defaultContract:'FG509'},
  {exchange:'CZCE',exchangeName:'郑州商品交易所',category:'能源化工',symbol:'纯碱',code:'SA',multiplier:20,marginRate:0.08,defaultContract:'SA509'},
  {exchange:'CZCE',exchangeName:'郑州商品交易所',category:'能源化工',symbol:'尿素',code:'UR',multiplier:20,marginRate:0.08,defaultContract:'UR509'},
  {exchange:'CZCE',exchangeName:'郑州商品交易所',category:'能源化工',symbol:'烧碱',code:'SH',multiplier:30,marginRate:0.08,defaultContract:'SH509'},
  {exchange:'CZCE',exchangeName:'郑州商品交易所',category:'能源化工',symbol:'PTA',code:'TA',multiplier:5,marginRate:0.08,defaultContract:'TA509'},
  // 广州期货交易所 (GFEX)
  {exchange:'GFEX',exchangeName:'广州期货交易所',category:'新能源',symbol:'多晶硅',code:'PS',multiplier:3,marginRate:0.12,defaultContract:'PS2509'},
  {exchange:'GFEX',exchangeName:'广州期货交易所',category:'新能源',symbol:'工业硅',code:'SI',multiplier:5,marginRate:0.12,defaultContract:'SI2509'},
  {exchange:'GFEX',exchangeName:'广州期货交易所',category:'新能源',symbol:'碳酸锂',code:'LC',multiplier:1,marginRate:0.15,defaultContract:'LC2511'},
  // 中国金融期货交易所 (CFFEX)
  {exchange:'CFFEX',exchangeName:'中国金融期货交易所',category:'股指',symbol:'沪深300',code:'IF',multiplier:300,marginRate:0.12,defaultContract:'IF2608'},
  {exchange:'CFFEX',exchangeName:'中国金融期货交易所',category:'股指',symbol:'上证50',code:'IH',multiplier:300,marginRate:0.12,defaultContract:'IH2608'},
  {exchange:'CFFEX',exchangeName:'中国金融期货交易所',category:'股指',symbol:'中证500',code:'IC',multiplier:200,marginRate:0.14,defaultContract:'IC2608'}
];

// 板块分类显示顺序
const CATEGORY_ORDER = ['农产品','黑色系','有色金属','贵金属','能源化工','新能源','股指'];

// 飞书日报品种名 → 项目品种符号归一化（双向）
// 飞书表用"橡胶"/"黄金"/"白银"，项目用"天然橡胶"/"黄金"/"白银"
const FEISHU_VARIETY_MAP = {
  '橡胶':'天然橡胶','黄金':'黄金','白银':'白银',
  '螺纹钢':'螺纹钢','碳酸锂':'碳酸锂','多晶硅':'多晶硅',
  '白糖':'白糖','玻璃':'玻璃','铜':'铜','棕榈油':'棕榈油'
};
// 反向映射：项目符号 → 飞书品种名
const PROJECT_TO_FEISHU_MAP = {};
Object.keys(FEISHU_VARIETY_MAP).forEach(k => {
  PROJECT_TO_FEISHU_MAP[FEISHU_VARIETY_MAP[k]] = k;
});

// 按品种名查找 EXCHANGE_VARIETIES 元数据
function findVarietyMeta(symbol) {
  return EXCHANGE_VARIETIES.find(v => v.symbol === symbol);
}

// 合约代码纠错：检查格式、前缀匹配、是否过期或即将到期
// 返回 { valid: bool, warning: string|null, level: 'ok'|'warn'|'error' }
function validateContract(contractCode, varietySymbol) {
  if (!contractCode) return { valid: false, warning: '合约代码不能为空', level: 'error' };
  const code = contractCode.trim().toUpperCase();
  // 主力连续合约（如 P0, RB0, CU0）— 数据源虚拟代码，允许但提示
  if (/^[A-Z]+0$/.test(code)) return { valid: true, warning: '⚠ ' + code + ' 是主力连续（虚拟代码），建议使用真实月份合约如 ' + code.replace('0','2609'), level: 'warn' };
  // CZCE 3位数字格式（如 SR509 = 2025年9月）
  const m3 = code.match(/^([A-Z]+)(\d)(\d{2})$/);
  // 4位数字格式（如 RB2609）
  const m4 = code.match(/^([A-Z]+)(\d{4})$/);
  let prefix, yearPart, monthPart;
  if (m4) { prefix = m4[1]; yearPart = m4[2].substring(0,2); monthPart = m4[2].substring(2,4); }
  else if (m3) { prefix = m3[1]; yearPart = m3[2]; monthPart = m3[3]; }
  else return { valid: false, warning: '合约格式不正确，应为字母+月份（如 RB2609）或主力连续（如 RB0）', level: 'error' };
  // 检查品种前缀是否匹配
  const meta = findVarietyMeta(varietySymbol);
  if (meta && prefix !== meta.code.toUpperCase()) {
    return { valid: false, warning: '合约前缀 ' + prefix + ' 与品种 ' + varietySymbol + ' 不匹配（应为 ' + meta.code.toUpperCase() + '）', level: 'error' };
  }
  // 检查月份 01-12
  const mm = parseInt(monthPart);
  if (mm < 1 || mm > 12) return { valid: false, warning: '合约月份不正确（应为01-12）', level: 'error' };
  // 检查是否过期
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;
  const contractYear = 2000 + parseInt(yearPart);
  // 合约月份已过 = 过期
  if (contractYear < curYear || (contractYear === curYear && mm < curMonth)) {
    return { valid: false, warning: '✗ 合约 ' + code + ' 已过期（' + contractYear + '年' + mm + '月），请换为当月或远月合约', level: 'error' };
  }
  // 交割月当月或下月 = 即将到期警告（期货交割一般在当月15日左右）
  if (contractYear === curYear && mm === curMonth) {
    return { valid: true, warning: '⚠ 合约 ' + code + ' 为当月合约，可能即将交割，注意换月', level: 'warn' };
  }
  if (contractYear === curYear && mm === curMonth + 1) {
    return { valid: true, warning: '⚠ 合约 ' + code + ' 为下月合约，临近交割期', level: 'warn' };
  }
  return { valid: true, warning: null, level: 'ok' };
}

// 预置观察池：8 个品种，合约为当前主力月份（2026-07，动态维护）
const DEFAULT_COMMODITIES = [
  {symbol:'棕榈油',contractCode:'P2609',multiplier:10,marginRate:0.08,price:0,percentile:0,costLine:0,status:'bottom',category:'农产品',exchange:'DCE'},
  {symbol:'白糖',contractCode:'SR509',multiplier:10,marginRate:0.08,price:0,percentile:0,costLine:0,status:'bottom',category:'农产品',exchange:'CZCE'},
  {symbol:'棉花',contractCode:'CF509',multiplier:5,marginRate:0.08,price:0,percentile:0,costLine:0,status:'bottom',category:'农产品',exchange:'CZCE'},
  {symbol:'天然橡胶',contractCode:'RU2609',multiplier:10,marginRate:0.12,price:0,percentile:0,costLine:0,status:'bottom',category:'能源化工',exchange:'SHFE'},
  {symbol:'铜',contractCode:'CU2609',multiplier:5,marginRate:0.09,price:0,percentile:0,costLine:0,status:'bottom',category:'有色金属',exchange:'SHFE'},
  {symbol:'黄金',contractCode:'AU2608',multiplier:1000,marginRate:0.08,price:0,percentile:0,costLine:0,status:'bottom',category:'贵金属',exchange:'SHFE'},
  {symbol:'白银',contractCode:'AG2608',multiplier:15,marginRate:0.10,price:0,percentile:0,costLine:0,status:'bottom',category:'贵金属',exchange:'SHFE'},
  {symbol:'多晶硅',contractCode:'PS2509',multiplier:3,marginRate:0.12,price:0,percentile:0,costLine:0,status:'bottom',category:'新能源',exchange:'GFEX'}
];

const FUND_DIMENSIONS = [
  {key:'valuation',label:'估值位置'},
  {key:'supply',label:'供给(产能/库存/开工)'},
  {key:'demand',label:'需求(订单/政策/季节性)'},
  {key:'catalyst',label:'催化剂(冻灾/事故/减产)'},
  {key:'positionPlan',label:'仓位计划'}
];

let state = {
  version: APP_VERSION,
  settings: {initEquity:15000,target:1000000,maxRisk:2,maxRiskSweet:8,drawdownWarn:20,commission:1,slippage:1,dataSource:'manual',apiUrl:''},
  pool: [],
  fundamentals: {},
  trades: [],
  closedTrades: [],
  journal: [],
  equityHistory: [],
  rolloverHistory: [],
  lastBackup: null
};

function loadState() {
  try {
    const s = localStorage.getItem('futures_tracker_state');
    if (s) {
      const saved = JSON.parse(s);
      state = {...state, ...saved};
      // 版本迁移：旧版本（XX0虚拟合约或品种数不匹配）重置为最新真实主力合约
      if (!state.version || state.version !== APP_VERSION) {
        console.log('[FT] 版本迁移:', state.version, '→', APP_VERSION);
        // 保留用户自定义品种（非预置品种），重置预置品种为最新合约
        const userCustom = (state.pool || []).filter(c => !DEFAULT_COMMODITIES.find(d => d.symbol === c.symbol));
        state.pool = [...JSON.parse(JSON.stringify(DEFAULT_COMMODITIES)), ...userCustom];
        state.version = APP_VERSION;
        saveState();
      }
      if (!state.lastBackup) state.lastBackup = null;
    } else {
      state.pool = JSON.parse(JSON.stringify(DEFAULT_COMMODITIES));
      state.equityHistory = [{date: new Date().toISOString().slice(0,10), equity: state.settings.initEquity}];
    }
  } catch(e) {
    state.pool = JSON.parse(JSON.stringify(DEFAULT_COMMODITIES));
    state.equityHistory = [{date: new Date().toISOString().slice(0,10), equity: state.settings.initEquity}];
  }
}

function saveState() {
  try {
    localStorage.setItem('futures_tracker_state', JSON.stringify(state));
  } catch (e) {
    console.warn('保存到 localStorage 失败:', e);
    showToast('本地保存失败：浏览器可能处于隐私模式或空间不足');
  }
  updateHeaderStats();
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ============ PERSISTENCE BACKUP ============
function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'futures_tracker_backup_' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  state.lastBackup = new Date().toISOString();
  saveState();
  updateBackupDisplay();
  showToast('数据已导出');
}

function importData() { document.getElementById('importFile').click(); }
function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    try {
      const data = JSON.parse(ev.target.result);
      if (!validateImportData(data)) {
        showToast('导入失败：数据格式不正确');
        return;
      }
      state = {...state, ...data};
      saveState();
      showToast('数据已导入，刷新页面');
      setTimeout(()=>location.reload(), 1000);
    } catch(err) { showToast('导入失败：文件格式错误'); }
  };
  reader.readAsText(file);
}

function validateImportData(data) {
  if (!data || typeof data !== 'object') return false;
  if (data.pool && !Array.isArray(data.pool)) return false;
  if (data.trades && !Array.isArray(data.trades)) return false;
  if (data.closedTrades && !Array.isArray(data.closedTrades)) return false;
  if (data.journal && !Array.isArray(data.journal)) return false;
  if (data.equityHistory && !Array.isArray(data.equityHistory)) return false;
  if (data.rolloverHistory && !Array.isArray(data.rolloverHistory)) return false;
  if (data.settings && typeof data.settings !== 'object') return false;
  if (data.fundamentals && typeof data.fundamentals !== 'object') return false;
  return true;
}

function updateBackupDisplay() {
  const el = document.getElementById('lastBackupTime');
  if (!el) return;
  el.textContent = state.lastBackup ? new Date(state.lastBackup).toLocaleString('zh-CN') : '--';
}

function toggleAutoBackup() {
  const on = document.getElementById('autoBackupToggle').checked;
  localStorage.setItem('futures_auto_backup', on ? '1' : '0');
  if (on) {
    showToast('已开启自动备份提醒');
    checkAutoBackup();
  }
}

function initAutoBackup() {
  const on = localStorage.getItem('futures_auto_backup') === '1';
  const el = document.getElementById('autoBackupToggle');
  if (el) el.checked = on;
  updateBackupDisplay();
  if (on) checkAutoBackup();
}

function checkAutoBackup() {
  if (localStorage.getItem('futures_auto_backup') !== '1') return;
  const now = Date.now();
  const last = state.lastBackup ? new Date(state.lastBackup).getTime() : 0;
  // remind every 7 days or if never backed up
  if (!last || (now - last > 7 * 24 * 60 * 60 * 1000)) {
    if (confirm('⚠ 数据备份提醒\n\n您已开启自动备份提醒，但超过7天未导出数据。\n数据仅保存在浏览器本地，建议立即导出备份。\n\n是否立即导出？')) {
      exportData();
    }
  }
}

// ============ AUTO FETCH PRICES ============
// === futsseapi EastMoney 期货列表 API（CORS 直连，主力数据源）===
// 支持 CORS（Access-Control-Allow-Origin: *），浏览器可直接 fetch
// 市场码: 113=SHFE, 114=DCE；CZCE/GFEX 不支持此 API
const FUTSSE_MARKET_MAP = { 'SHFE': 113, 'DCE': 114 };

// 将合约代码转换为 futsseapi 的 dm 格式
// 主力连续(XX0) → code.toLowerCase()+'m'；具体月份 → code.toLowerCase()+月份
function contractToFutsseDm(contractCode, varietyMeta) {
  if (!contractCode || !varietyMeta) return null;
  const code = varietyMeta.code.toLowerCase();
  const cc = contractCode.trim().toUpperCase();
  if (/^[A-Z]+0$/.test(cc)) return code + 'm'; // 主力连续
  // 4位数字格式 (RB2609 → rb2609)
  const m4 = cc.match(/^[A-Z]+(\d{4})$/);
  if (m4) return code + m4[1];
  // CZCE 3位数字格式 (SR509 → sr509)
  const m3 = cc.match(/^[A-Z]+(\d{3})$/);
  if (m3) return code + m3[1];
  return null;
}

// East Money HTTPS single-stock API (备用)
// secid 格式: {市场码}{品种代码小写}m，市场码: 113=SHFE, 114=DCE, 115=CZCE, 8=GFEX
const EASTMONEY_SYMBOL_MAP = {
  // SHFE
  '螺纹钢':'113.rbm', '热卷':'113.hcm', '铁矿石':'114.im', '天然橡胶':'113.rum',
  '铜':'113.cum', '铝':'113.alm', '锌':'113.znm', '镍':'113.nim',
  '黄金':'113.aum', '白银':'113.agm', '沥青':'113.bum', '纸浆':'113.spm',
  // DCE
  '玉米':'114.cm', '生猪':'114.lhm', '棕榈油':'114.pm', '豆粕':'114.mm', '豆油':'114.ym',
  'PVC':'114.vm', '聚丙烯PP':'114.ppm', 'PP':'114.ppm', '塑料LLDPE':'114.lm', '乙二醇':'114.egm',
  // CZCE
  '甲醇':'115.mam', '玻璃':'115.fgm', '白糖':'115.srm', '纯碱':'115.sam',
  '烧碱':'115.shm', '尿素':'115.urm', '棉花':'115.cfm', '苹果':'115.apm', 'PTA':'115.tam',
  // GFEX
  '多晶硅':'8.psm', '工业硅':'8.sim', '碳酸锂':'8.lcm'
};

// Sina Finance continuous contract mapping (备用 — 浏览器需 CORS 代理)
const SINA_SYMBOL_MAP = {
  // SHFE
  '螺纹钢':'RB0', '热卷':'HC0', '铁矿石':'I0', '天然橡胶':'RU0',
  '铜':'CU0', '铝':'AL0', '锌':'ZN0', '镍':'NI0',
  '黄金':'AU0', '白银':'AG0', '沥青':'BU0', '纸浆':'SP0',
  // DCE
  '玉米':'C0', '生猪':'LH0', '棕榈油':'P0', '豆粕':'M0', '豆油':'Y0',
  'PVC':'V0', '聚丙烯PP':'PP0', 'PP':'PP0', '塑料LLDPE':'L0', '乙二醇':'EG0',
  // CZCE
  '甲醇':'MA0', '玻璃':'FG0', '白糖':'SR0', '纯碱':'SA0',
  '烧碱':'SH0', '尿素':'UR0', '棉花':'CF0', '苹果':'AP0', 'PTA':'TA0',
  // GFEX
  '多晶硅':'PS0', '工业硅':'SI0', '碳酸锂':'LC0'
};

let autoRefreshTimer = null;
let fetchStatusMap = {};

function setDataSourceStatus(type, msg) {
  const el = document.getElementById('dataSourceStatus');
  if (!el) return;
  const dotClass = type==='online'?'online':type==='loading'?'loading':'offline';
  el.innerHTML = `<span class="status-dot ${dotClass}"></span>${msg}`;
}

function setLastUpdateTime(ts) {
  const el = document.getElementById('lastUpdateTime');
  if (el) el.textContent = '最近更新: ' + (ts || '--');
}

// === East Money JSONP single query ===
function fetchPriceFromEastMoney(secid) {
  return new Promise((resolve) => {
    const cbName = '_em_cb_' + Date.now().toString(36) + Math.random().toString(36).slice(2,5);
    const timeout = setTimeout(() => { cleanup(); resolve(null); }, 7000);

    function cleanup() {
      clearTimeout(timeout);
      delete window[cbName];
      const s = document.getElementById('emScript_' + cbName);
      if (s) s.remove();
    }

    window[cbName] = function(data) {
      cleanup();
      if (!data) { resolve(null); return; }
      const raw = data.data ? data.data.f43 : data.f43;
      if (raw != null && String(raw) !== '-') {
        const p = parseFloat(raw);
        if (!isNaN(p) && p > 0) { resolve(p); return; }
      }
      resolve(null);
    };

    const script = document.createElement('script');
    script.id = 'emScript_' + cbName;
    script.src = `https://push2.eastmoney.com/api/qt/stock/get?ut=bd1d9ddb04089700cf9c27f6f7426281&invt=2&fltt=2&fields=f43&secid=${secid}&cb=${cbName}`;
    script.onerror = () => { cleanup(); resolve(null); };
    document.head.appendChild(script);
  });
}

// === Sina Finance script-tag batch query ===
function fetchPricesFromSina(symbols, symbolToPool) {
  return new Promise((resolve) => {
    if (!symbols.length) { resolve({ok:0,fail:0,total:0}); return; }
    const codes = symbols.map(s => 'nf_' + s.toUpperCase());
    const cbName = '_sina_cb_' + Date.now();
    const timeout = setTimeout(() => { cleanup(); resolve({ok:0,fail:symbols.length,total:symbols.length}); }, 10000);

    function cleanup() {
      clearTimeout(timeout);
      delete window[cbName];
      const s = document.getElementById('sinaScript');
      if (s) s.remove();
    }

    window[cbName] = function() {}; // placeholder
    const script = document.createElement('script');
    script.id = 'sinaScript';
    script.src = `https://hq.sinajs.cn/rn=${Date.now()}&list=${codes.join(',')}`;
    script.onload = () => {
      cleanup();
      let okCount = 0;
      codes.forEach((code, idx) => {
        try {
          const raw = window['hq_str_' + code];
          if (raw) {
            const parts = raw.split(',');
            // Sina futures format: [8]=latest, [7]=ask, [6]=bid, [3]=high, [4]=low, [2]=open, [5]=prev close
            const tries = [8,7,6,3,4,2,5];
            for (let j = 0; j < tries.length; j++) {
              const p = parseFloat(parts[tries[j]]);
              if (!isNaN(p) && p > 0) {
                const c = symbolToPool[symbols[idx]];
                if (c) { c.price = p; fetchStatusMap[c.symbol] = 'ok'; okCount++; }
                break;
              }
            }
          }
        } catch(e) {}
      });
      resolve({ok:okCount, fail:symbols.length - okCount, total:symbols.length});
    };
    script.onerror = () => { cleanup(); resolve({ok:0, fail:symbols.length, total:symbols.length}); };
    document.head.appendChild(script);
  });
}

// === futsseapi 批量获取（CORS 直连，主力数据源）===
async function fetchPricesFromFutsseApi(poolItems) {
  if (!poolItems || !poolItems.length) return {ok:0, fail:0, total:0};
  const byMarket = {}; // marketCode → [{item, dm}]
  poolItems.forEach(c => {
    const meta = findVarietyMeta(c.symbol);
    if (!meta || !meta.exchange) return;
    const mc = FUTSSE_MARKET_MAP[meta.exchange];
    if (!mc) return; // CZCE/GFEX 不支持
    const dm = contractToFutsseDm(c.contractCode, meta);
    if (!dm) return;
    if (!byMarket[mc]) byMarket[mc] = [];
    byMarket[mc].push({item: c, dm: dm});
  });
  let okCount = 0;
  const markets = Object.keys(byMarket);
  if (!markets.length) return {ok:0, fail:poolItems.length, total:poolItems.length};
  const promises = markets.map(async (mc) => {
    try {
      const url = 'https://futsseapi.eastmoney.com/list/' + mc +
        '?orderBy=zdf&sort=desc&pageSize=300&pageIndex=0&token=58b2fa8f54668b7c01b3dde8e7a4ad4c&field=dm,sc,p,zsjd';
      const resp = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!resp.ok) { console.log('[FT] futsseapi 市场', mc, 'HTTP', resp.status); return; }
      const data = await resp.json();
      if (!data || !data.list) return;
      const priceMap = {};
      data.list.forEach(x => { if (x.dm && x.p && x.p !== '-' && x.p > 0) priceMap[x.dm] = x.p; });
      byMarket[mc].forEach(entry => {
        const p = priceMap[entry.dm];
        if (p && p > 0) { entry.item.price = p; fetchStatusMap[entry.item.symbol] = 'ok'; okCount++; }
      });
    } catch(e) { console.log('[FT] futsseapi 市场', mc, '失败:', e.message); }
  });
  await Promise.all(promises);
  console.log('[FT] futsseapi 完成: 成功', okCount, '/', poolItems.length);
  return {ok:okCount, fail:poolItems.length - okCount, total:poolItems.length};
}

// === Combined fetch: futsseapi(CORS) → EastMoney JSONP → Sina → Manual ===
async function fetchPricesNow() {
  const t0 = Date.now();
  if (!state.pool || state.pool.length === 0) {
    setDataSourceStatus('offline', '数据源: 手动模式 · 观察池为空');
    setLastUpdateTime(new Date().toLocaleTimeString('zh-CN'));
    showToast('观察池为空，请先添加品种');
    return {ok:0, fail:0, total:0};
  }
  console.log('[FT] 开始刷新行情, 池中品种:', state.pool.map(c => c.symbol + '/' + c.contractCode).join(', '));
  setDataSourceStatus('loading', '数据源: 正在获取行情...');
  fetchStatusMap = {};
  state.pool.forEach(c => { fetchStatusMap[c.symbol] = 'manual'; });

  // Step 0: futsseapi（CORS 直连）— SHFE/DCE 品种
  const futsseResult = await fetchPricesFromFutsseApi(state.pool);
  let futsseOk = futsseResult.ok;
  console.log('[FT] futsseapi: 成功', futsseOk);

  // Step 1: EastMoney JSONP — CZCE/GFEX 及 futsseapi 未覆盖品种
  let emOk = 0, emFail = [];
  const emPending = [];
  state.pool.forEach(c => {
    if (fetchStatusMap[c.symbol] === 'ok') return; // futsseapi 已成功
    const secid = EASTMONEY_SYMBOL_MAP[c.symbol];
    if (secid) {
      emPending.push((async () => {
        const p = await fetchPriceFromEastMoney(secid);
        if (p) { c.price = p; fetchStatusMap[c.symbol] = 'ok'; emOk++; }
        else { emFail.push(c.symbol); }
      })());
    } else { emFail.push(c.symbol); }
  });
  await Promise.all(emPending);
  console.log('[FT] 东财JSONP: 成功', emOk, '失败', emFail.length);

  // Step 2: Sina — 最后备用（浏览器需 CORS 代理，可能失败）
  let sinaOk = 0;
  if (emFail.length) {
    setDataSourceStatus('loading', '数据源: 尝试新浪备用...');
    const sinaSymbols = [], symbolToPool = {};
    emFail.forEach(sym => {
      const s = SINA_SYMBOL_MAP[sym];
      if (s) { sinaSymbols.push(s); symbolToPool[s] = state.pool.find(x => x.symbol === sym); }
    });
    if (sinaSymbols.length) {
      const sina = await fetchPricesFromSina(sinaSymbols, symbolToPool);
      sinaOk = sina.ok;
    }
  }
  console.log('[FT] 新浪: 成功', sinaOk);

  const totalOk = futsseOk + emOk + sinaOk;
  const elapsed = Date.now() - t0;
  const poolLen = state.pool.length;
  const stillManual = poolLen - totalOk;

  if (totalOk > 0) {
    saveState();
    if (window.FTRender && window.FTRender.renderPool) window.FTRender.renderPool();
    onPriceUpdate();
    let src;
    if (futsseOk > 0) src = '东财futsseapi';
    else if (emOk > 0) src = '东财JSONP';
    else src = '新浪';
    const msg = '数据源: ' + src + ' (' + totalOk + '/' + poolLen + ' 成功)' +
                (stillManual > 0 ? ' · ' + stillManual + '个需手动' : '') + ' · ' + elapsed + 'ms';
    setDataSourceStatus('online', msg);
    setLastUpdateTime(new Date().toLocaleTimeString('zh-CN'));
    showToast('已更新 ' + totalOk + ' 个品种价格' + (stillManual > 0 ? '，' + stillManual + '个需手动输入' : ''));
  } else {
    setDataSourceStatus('offline', '数据源: 获取失败 · 手动模式');
    setLastUpdateTime(new Date().toLocaleTimeString('zh-CN') + ' (失败)');
    showToast('行情自动获取失败，请手动输入价格（CZCE/GFEX品种需手动）');
    console.warn('[FT] 所有自动数据源均失败。SHFE/DCE应可用futsseapi，CZCE/GFEX需手动。');
  }
  return {ok:totalOk, fail:poolLen - totalOk, total:poolLen};
}

async function fetchPricesFromCustomApi() {
  if (state.settings.dataSource !== 'api' || !state.settings.apiUrl) return {ok:0,total:0};
  try {
    const resp = await fetch(state.settings.apiUrl);
    if (!resp.ok) throw new Error('API error');
    const data = await resp.json();
    let ok = 0;
    if (Array.isArray(data)) {
      data.forEach(item => {
        const c = state.pool.find(x => x.symbol === item.symbol);
        if (c && item.price) { c.price = item.price; ok++; }
      });
    }
    if (ok > 0) { saveState(); if (window.FTRender && window.FTRender.renderPool) window.FTRender.renderPool(); onPriceUpdate(); }
    return {ok, total: state.pool.length};
  } catch(e) {
    return {ok:0, total: state.pool.length};
  }
}

function toggleAutoRefresh() {
  const on = document.getElementById('autoRefreshToggle').checked;
  localStorage.setItem('futures_auto_refresh', on ? '1' : '0');
  if (on) { startAutoRefresh(); fetchPricesNow(); }
  else { stopAutoRefresh(); setDataSourceStatus('offline', '数据源: 手动模式'); }
}

function updateRefreshInterval() {
  localStorage.setItem('futures_refresh_interval', document.getElementById('refreshInterval').value);
  if (autoRefreshTimer) { stopAutoRefresh(); startAutoRefresh(); }
}

function startAutoRefresh() {
  stopAutoRefresh();
  if (document.hidden) return; // 后台标签页不启动
  const sec = parseInt(document.getElementById('refreshInterval').value) || 60;
  autoRefreshTimer = setInterval(fetchPricesNow, sec * 1000);
}

function stopAutoRefresh() {
  if (autoRefreshTimer) { clearInterval(autoRefreshTimer); autoRefreshTimer = null; }
}

function handleVisibilityChange() {
  const on = localStorage.getItem('futures_auto_refresh') === '1';
  if (document.hidden) {
    stopAutoRefresh();
  } else if (on) {
    startAutoRefresh();
    fetchPricesNow();
  }
}

function initAutoRefresh() {
  const on = localStorage.getItem('futures_auto_refresh') === '1';
  const interval = localStorage.getItem('futures_refresh_interval') || '60';
  document.getElementById('autoRefreshToggle').checked = on;
  document.getElementById('refreshInterval').value = interval;
  if (on) { startAutoRefresh(); fetchPricesNow(); }
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2500);
}

function toggleTheme() {
  const d = document.documentElement;
  const isDark = d.classList.contains('dark');
  d.classList.toggle('dark', !isDark);
  d.classList.toggle('light', isDark);
  d.setAttribute('data-theme', isDark ? 'light' : 'dark');
  const icon = document.getElementById('themeIcon');
  const label = document.getElementById('themeLabel');
  if (icon) { icon.style.transform = 'rotate(360deg)'; setTimeout(() => { icon.innerHTML = isDark ? '&#9728;' : '&#9790;'; icon.style.transform = 'rotate(0deg)'; }, 150); }
  if (label) label.textContent = isDark ? '浅色' : '深色';
  localStorage.setItem('futures_theme', isDark ? 'light' : 'dark');
}

function initTheme() {
  const saved = localStorage.getItem('futures_theme') || 'dark';
  const d = document.documentElement;
  d.classList.toggle('dark', saved === 'dark');
  d.classList.toggle('light', saved === 'light');
  d.setAttribute('data-theme', saved);
  const icon = document.getElementById('themeIcon');
  const label = document.getElementById('themeLabel');
  if (icon) icon.innerHTML = saved === 'dark' ? '&#9790;' : '&#9728;';
  if (label) label.textContent = saved === 'dark' ? '深色' : '浅色';
}

function closeModal(id) { document.getElementById(id).classList.remove('show'); }
function openModal(id) { document.getElementById(id).classList.add('show'); }

// ============ EQUITY ============
function getCurrentEquity() {
  let eq = state.settings.initEquity;
  state.closedTrades.forEach(t => eq += t.pnl);
  state.trades.forEach(t => {
    const c = state.pool.find(x=>x.symbol===t.symbol);
    const curPrice = c ? c.price : t.price;
    const grossPnl = t.dir==='long' ? (curPrice - t.price) * t.multiplier * t.lots : (t.price - curPrice) * t.multiplier * t.lots;
    eq += grossPnl - (t.openCommission || 0);
  });
  return eq;
}

function getRealizedEquity() {
  let eq = state.settings.initEquity;
  state.closedTrades.forEach(t => eq += t.pnl);
  return eq;
}

function onPriceUpdate() {
  saveState();
  // 多页 HTML 架构下，tab-trade / tab-dashboard 元素并不总是存在，需判空
  const tabTrade = document.getElementById('tab-trade');
  if (tabTrade && tabTrade.classList.contains('active')) {
    if (window.FTRender && window.FTRender.renderTrades) window.FTRender.renderTrades();
  }
  const tabDashboard = document.getElementById('tab-dashboard');
  if (tabDashboard && tabDashboard.classList.contains('active')) {
    if (window.FTRender && window.FTRender.renderDashboard) window.FTRender.renderDashboard();
  }
}

function updateEquityHistory() {
  const today = new Date().toISOString().slice(0,10);
  const eq = getCurrentEquity();
  const last = state.equityHistory[state.equityHistory.length-1];
  if (!last || last.date !== today) {
    state.equityHistory.push({date: today, equity: eq});
  } else {
    last.equity = eq;
  }
  saveState();
}

function updateHeaderStats() {
  const el1 = document.getElementById('headerInitEquity');
  if (el1) el1.textContent = state.settings.initEquity.toLocaleString('zh-CN');
  const el2 = document.getElementById('headerTarget');
  if (el2) el2.textContent = state.settings.target.toLocaleString('zh-CN');
}

function populateSymbolSelect(sel) {
  sel.innerHTML = state.pool.map(c=>`<option value="${escapeHtml(c.symbol)}">${escapeHtml(c.symbol)}</option>`).join('');
}

function populateFundSelect() {
  // 兼容旧 ID fundSelect 与新 ID fundSpeciesSelect
  const sel = document.getElementById('fundSelect') || document.getElementById('fundSpeciesSelect');
  if (!sel) return;
  // 按交易所分组渲染 optgroup，数据源为 EXCHANGE_VARIETIES
  const exchangeOrder = ['SHFE','DCE','CZCE','GFEX','CFFEX'];
  const exchangeNameMap = {
    'SHFE':'上海期货交易所','DCE':'大连商品交易所','CZCE':'郑州商品交易所',
    'GFEX':'广州期货交易所','CFFEX':'中国金融期货交易所'
  };
  let html = '<option value="">-- 请选择 --</option>';
  exchangeOrder.forEach(ex => {
    const items = EXCHANGE_VARIETIES.filter(v => v.exchange === ex);
    if (!items.length) return;
    html += `<optgroup label="${exchangeNameMap[ex]}">`;
    items.forEach(v => {
      html += `<option value="${escapeHtml(v.symbol)}">${escapeHtml(v.symbol)}（${v.category}）</option>`;
    });
    html += '</optgroup>';
  });
  sel.innerHTML = html;
}

function isSweetSignal(symbol) {
  const c = state.pool.find(x => x.symbol === symbol);
  if (!c) return false;
  const fund = state.fundamentals[c.symbol] || {};
  const valScore = c.percentile <= 25 ? 5 : c.percentile <= 40 ? 3 : 1;
  const supplyScore = (fund.supply && fund.supply.score) || 3;
  const catalystScore = (fund.catalyst && fund.catalyst.score) || 3;
  return valScore >= 4 && supplyScore >= 4 && catalystScore >= 4;
}

// ============ SETTINGS (form load/save) ============
function loadSettings() {
  const s = state.settings;
  const el = (id) => document.getElementById(id);
  // 非设置页面不存在这些表单元素，必须判空，否则抛 TypeError 中断后续初始化
  const setVal = (id, val) => { const e = el(id); if (e) e.value = val; };
  setVal('setInitEquity', s.initEquity);
  setVal('setTarget', s.target);
  setVal('setMaxRisk', s.maxRisk);
  setVal('setMaxRiskSweet', s.maxRiskSweet);
  setVal('setDrawdownWarn', s.drawdownWarn);
  setVal('setCommission', s.commission);
  setVal('setSlippage', s.slippage);
  setVal('setDataSource', s.dataSource);
  setVal('setApiUrl', s.apiUrl || '');
  updateHeaderStats();
}

function saveSettings() {
  const oldInit = state.settings.initEquity;
  state.settings = {
    initEquity: +document.getElementById('setInitEquity').value || 15000,
    target: +document.getElementById('setTarget').value || 1000000,
    maxRisk: +document.getElementById('setMaxRisk').value || 2,
    maxRiskSweet: +document.getElementById('setMaxRiskSweet').value || 8,
    drawdownWarn: +document.getElementById('setDrawdownWarn').value || 20,
    commission: +document.getElementById('setCommission').value || 1,
    slippage: +document.getElementById('setSlippage').value || 1,
    dataSource: document.getElementById('setDataSource').value,
    apiUrl: document.getElementById('setApiUrl').value
  };
  // If initial equity changed, adjust equityHistory baseline proportionally
  if (oldInit !== state.settings.initEquity && state.equityHistory.length > 0) {
    const ratio = state.settings.initEquity / oldInit;
    state.equityHistory = state.equityHistory.map(h => ({date: h.date, equity: h.equity * ratio}));
  }
  saveState();
  showToast('设置已保存');
}

// ============ TABS ============
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-'+tab.dataset.tab).classList.add('active');
    if (tab.dataset.tab==='dashboard' && window.FTRender && window.FTRender.renderDashboard) window.FTRender.renderDashboard();
    if (tab.dataset.tab==='signal' && window.FTRender && window.FTRender.refreshSignals) window.FTRender.refreshSignals();
    if (tab.dataset.tab==='trade' && window.FTRender && window.FTRender.renderTrades) window.FTRender.renderTrades();
    if (tab.dataset.tab==='journal' && window.FTRender && window.FTRender.renderJournal) window.FTRender.renderJournal();
    if (tab.dataset.tab==='fundamental') { populateFundSelect(); if (window.FTRender && window.FTRender.loadFundamental) window.FTRender.loadFundamental(); }
    if (tab.dataset.tab==='settings') { initAutoBackup(); }
  });
});

// ============ INIT ============
function init() {
  const theme = localStorage.getItem('futures_theme');
  if (theme) document.documentElement.setAttribute('data-theme', theme);
  loadState();
  if (window.FTRender && window.FTRender.renderPool) window.FTRender.renderPool();
  loadSettings();
  populateFundSelect();
  if (window.FTRender && window.FTRender.loadFundamental) window.FTRender.loadFundamental();
  if (window.FTRender && window.FTRender.renderTrades) window.FTRender.renderTrades();
  if (window.FTRender && window.FTRender.renderJournal) window.FTRender.renderJournal();
  if (state.equityHistory.length === 0) {
    state.equityHistory = [{date: new Date().toISOString().slice(0,10), equity: state.settings.initEquity}];
    saveState();
  }
  initAutoRefresh();
  initAutoBackup();
  updateBackupDisplay();

  // listen for storage changes from other tabs
  window.addEventListener('storage', (e) => {
    if (e.key === 'futures_tracker_state') {
      loadState();
      if (window.FTRender && window.FTRender.renderPool) window.FTRender.renderPool();
      if (window.FTRender && window.FTRender.renderTrades) window.FTRender.renderTrades();
      if (window.FTRender && window.FTRender.renderJournal) window.FTRender.renderJournal();
    }
  });
}

// ============ EXPORTS ============
window.FTApp = {
  // init / state
  init, loadState, saveState, state, getCurrentEquity, getRealizedEquity,
  // 行情拉取
  fetchPricesNow, fetchPricesFromCustomApi, onPriceUpdate,
  // 自动刷新
  toggleAutoRefresh, updateRefreshInterval, startAutoRefresh, stopAutoRefresh,
  initAutoRefresh,
  // 备份/导入导出
  initAutoBackup, updateBackupDisplay, toggleAutoBackup,
  exportData, importData, handleImport,
  // 选择器填充
  populateSymbolSelect, populateFundSelect,
  // 主题/通用 UI
  toggleTheme, initTheme, showToast, openModal, closeModal,
  setDataSourceStatus, setLastUpdateTime, updateHeaderStats,
  // 设置
  loadSettings, saveSettings,
  // 工具
  escapeHtml, isSweetSignal, validateContract,
  // 常量
  FUND_DIMENSIONS, DEFAULT_COMMODITIES,
  EXCHANGE_VARIETIES, CATEGORY_ORDER,
  FEISHU_VARIETY_MAP, PROJECT_TO_FEISHU_MAP,
  findVarietyMeta
};
