// ============ FUTURES TRACKER - APP CORE ============
// Data store, state management, localStorage CRUD, price fetching,
// auto-refresh, theme toggle, backup/import/export, and init function.

// ============ VERSION ============
const APP_VERSION = '2026.07.19-v1';  // Sirius 期货作战室:state 账户隔离 + 云同步

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
  // 郑州商品交易所 (CZCE) — 3位数字格式：年份末位+月份（SR609=2026年9月）
  {exchange:'CZCE',exchangeName:'郑州商品交易所',category:'农产品',symbol:'白糖',code:'SR',multiplier:10,marginRate:0.08,defaultContract:'SR609'},
  {exchange:'CZCE',exchangeName:'郑州商品交易所',category:'农产品',symbol:'棉花',code:'CF',multiplier:5,marginRate:0.08,defaultContract:'CF609'},
  {exchange:'CZCE',exchangeName:'郑州商品交易所',category:'农产品',symbol:'菜油',code:'OI',multiplier:10,marginRate:0.08,defaultContract:'OI609'},
  {exchange:'CZCE',exchangeName:'郑州商品交易所',category:'农产品',symbol:'苹果',code:'AP',multiplier:10,marginRate:0.10,defaultContract:'AP610'},
  {exchange:'CZCE',exchangeName:'郑州商品交易所',category:'能源化工',symbol:'甲醇',code:'MA',multiplier:10,marginRate:0.08,defaultContract:'MA609'},
  {exchange:'CZCE',exchangeName:'郑州商品交易所',category:'能源化工',symbol:'玻璃',code:'FG',multiplier:20,marginRate:0.08,defaultContract:'FG609'},
  {exchange:'CZCE',exchangeName:'郑州商品交易所',category:'能源化工',symbol:'纯碱',code:'SA',multiplier:20,marginRate:0.08,defaultContract:'SA609'},
  {exchange:'CZCE',exchangeName:'郑州商品交易所',category:'能源化工',symbol:'尿素',code:'UR',multiplier:20,marginRate:0.08,defaultContract:'UR609'},
  {exchange:'CZCE',exchangeName:'郑州商品交易所',category:'能源化工',symbol:'烧碱',code:'SH',multiplier:30,marginRate:0.08,defaultContract:'SH609'},
  {exchange:'CZCE',exchangeName:'郑州商品交易所',category:'能源化工',symbol:'PTA',code:'TA',multiplier:5,marginRate:0.08,defaultContract:'TA609'},
  // 广州期货交易所 (GFEX) — 4位数字格式
  {exchange:'GFEX',exchangeName:'广州期货交易所',category:'新能源',symbol:'多晶硅',code:'PS',multiplier:3,marginRate:0.12,defaultContract:'PS2609'},
  {exchange:'GFEX',exchangeName:'广州期货交易所',category:'新能源',symbol:'工业硅',code:'SI',multiplier:5,marginRate:0.12,defaultContract:'SI2609'},
  {exchange:'GFEX',exchangeName:'广州期货交易所',category:'新能源',symbol:'碳酸锂',code:'LC',multiplier:1,marginRate:0.15,defaultContract:'LC2611'},
  // 中国金融期货交易所 (CFFEX)
  {exchange:'CFFEX',exchangeName:'中国金融期货交易所',category:'股指',symbol:'沪深300',code:'IF',multiplier:300,marginRate:0.12,defaultContract:'IF2608'},
  {exchange:'CFFEX',exchangeName:'中国金融期货交易所',category:'股指',symbol:'上证50',code:'IH',multiplier:300,marginRate:0.12,defaultContract:'IH2608'},
  {exchange:'CFFEX',exchangeName:'中国金融期货交易所',category:'股指',symbol:'中证500',code:'IC',multiplier:200,marginRate:0.14,defaultContract:'IC2608'}
];

// 板块分类显示顺序
const CATEGORY_ORDER = ['农产品','黑色系','有色金属','贵金属','能源化工','新能源','股指'];

// 核心层品种清单（走完整五维打分）；其余品种为观察层（仅行情+分位%）
const CORE_VARIETIES = ['棕榈油','白糖','棉花','铜','黄金','白银','天然橡胶','多晶硅','碳酸锂'];
function getVarietyTier(symbol) {
  return CORE_VARIETIES.indexOf(symbol) >= 0 ? '核心' : '观察';
}

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
  // CZCE 3位数字格式（如 SR609 = 2026年9月，年份用末位）
  const m3 = code.match(/^([A-Z]+)(\d)(\d{2})$/);
  // 4位数字格式（如 RB2609）
  const m4 = code.match(/^([A-Z]+)(\d{4})$/);
  let prefix, yearPart, monthPart, contractYear;
  if (m4) {
    prefix = m4[1]; yearPart = m4[2].substring(0,2); monthPart = m4[2].substring(2,4);
    contractYear = 2000 + parseInt(yearPart);  // '26'→2026
  } else if (m3) {
    prefix = m3[1]; yearPart = m3[2]; monthPart = m3[3];
    contractYear = 2020 + parseInt(yearPart);  // CZCE 末位年份：'6'→2026, '5'→2025
  } else {
    return { valid: false, warning: '合约格式不正确，应为字母+月份（如 RB2609）或主力连续（如 RB0）', level: 'error' };
  }
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
  {symbol:'棕榈油',contractCode:'P2609',multiplier:10,marginRate:0.08,price:0,percentile:0,costLine:0,status:'bottom',category:'农产品',exchange:'DCE',tier:'核心'},
  {symbol:'白糖',contractCode:'SR609',multiplier:10,marginRate:0.08,price:0,percentile:0,costLine:0,status:'bottom',category:'农产品',exchange:'CZCE',tier:'核心'},
  {symbol:'棉花',contractCode:'CF609',multiplier:5,marginRate:0.08,price:0,percentile:0,costLine:0,status:'bottom',category:'农产品',exchange:'CZCE',tier:'核心'},
  {symbol:'天然橡胶',contractCode:'RU2609',multiplier:10,marginRate:0.12,price:0,percentile:0,costLine:0,status:'bottom',category:'能源化工',exchange:'SHFE',tier:'核心'},
  {symbol:'铜',contractCode:'CU2609',multiplier:5,marginRate:0.09,price:0,percentile:0,costLine:0,status:'bottom',category:'有色金属',exchange:'SHFE',tier:'核心'},
  {symbol:'黄金',contractCode:'AU2608',multiplier:1000,marginRate:0.08,price:0,percentile:0,costLine:0,status:'bottom',category:'贵金属',exchange:'SHFE',tier:'核心'},
  {symbol:'白银',contractCode:'AG2608',multiplier:15,marginRate:0.10,price:0,percentile:0,costLine:0,status:'bottom',category:'贵金属',exchange:'SHFE',tier:'核心'},
  {symbol:'多晶硅',contractCode:'PS2609',multiplier:3,marginRate:0.12,price:0,percentile:0,costLine:0,status:'bottom',category:'新能源',exchange:'GFEX',tier:'核心'},
  {symbol:'碳酸锂',contractCode:'LC2611',multiplier:1,marginRate:0.15,price:0,percentile:0,costLine:0,status:'bottom',category:'新能源',exchange:'GFEX',tier:'核心'},
  {symbol:'豆油',contractCode:'Y2609',multiplier:10,marginRate:0.08,price:0,percentile:0,costLine:0,status:'bottom',category:'农产品',exchange:'DCE',tier:'观察'},
  {symbol:'菜油',contractCode:'OI609',multiplier:10,marginRate:0.08,price:0,percentile:0,costLine:0,status:'bottom',category:'农产品',exchange:'CZCE',tier:'观察'}
];

const FUND_DIMENSIONS = [
  {key:'valuation',label:'估值位置'},
  {key:'supply',label:'供给(产能/库存/开工)'},
  {key:'demand',label:'需求(订单/政策/季节性)'},
  {key:'catalyst',label:'催化剂(冻灾/事故/减产)'},
  {key:'positionPlan',label:'仓位计划'}
];

// ============ STATE(账户隔离结构)============
// Sirius 期货作战室:state.accounts.sim / state.accounts.real 双账户隔离
// 切换账户时只读 state.accounts[state.currentAccount],互不污染
function _emptyAccount() {
  return {
    pool: [],
    fundamentals: {},
    trades: [],           // 模拟持仓(开仓中)
    closedTrades: [],     // 模拟已平仓
    journal: [],
    equityHistory: [],
    rolloverHistory: [],
    priceSnapshots: {},   // { [symbol]: [{date:'YYYY-MM-DD', price}, ...] } 动量因子数据源
    realTrades: [],       // 实盘成交流水(由 CloudSync 从飞书 real_trades 表拉取)
    ledger: []            // 资金账户流水(出入金+每日权益快照)
  };
}

function _buildVarietyDict() {
  // 从 EXCHANGE_VARIETIES 派生品种参数字典,可被飞书 variety_dict 表覆盖
  var dict = {};
  EXCHANGE_VARIETIES.forEach(function(v) {
    dict[v.symbol] = {
      exchange: v.exchange,
      exchangeName: v.exchangeName,
      category: v.category,
      code: v.code,
      multiplier: v.multiplier,
      marginRate: v.marginRate,
      defaultContract: v.defaultContract
    };
  });
  return dict;
}

let state = {
  version: APP_VERSION,
  currentAccount: 'sim',   // 'sim' | 'real'
  settings: {initEquity:15000,target:1000000,maxRisk:2,maxRiskSweet:8,drawdownWarn:20,commission:1,slippage:1,dataSource:'auto',apiUrl:'',maxSinglePosition:0.3,maxTotalPosition:0.8},
  accounts: {
    sim: _emptyAccount(),
    real: _emptyAccount()
  },
  varietyDict: {},         // 由 _buildVarietyDict() 初始化,可被飞书表覆盖
  syncQueue: [],           // CloudSync 失败补传队列
  lastBackup: null
};

// 读取当前账户对象(所有页面读写数据的统一入口)
function getCurrentAccount() {
  return state.accounts[state.currentAccount] || state.accounts.sim;
}

// 切换账户:写入 state + 触发 ft:account-switched 事件让 UI 刷新
function switchAccount(type) {
  if (type !== 'sim' && type !== 'real') return;
  if (state.currentAccount === type) return;
  state.currentAccount = type;
  saveState();
  // 更新顶部切换按钮高亮
  var btnSim = document.getElementById('acctBtnSim');
  var btnReal = document.getElementById('acctBtnReal');
  if (btnSim && btnReal) {
    if (type === 'sim') {
      btnSim.classList.add('active');
      btnSim.className = btnSim.className.replace('bg-surface-base text-ink-muted', 'bg-brand-500 text-brand-50');
      btnReal.classList.remove('active');
      btnReal.className = btnReal.className.replace('bg-brand-500 text-brand-50', 'bg-surface-base text-ink-muted');
    } else {
      btnReal.classList.add('active');
      btnReal.className = btnReal.className.replace('bg-surface-base text-ink-muted', 'bg-brand-500 text-brand-50');
      btnSim.classList.remove('active');
      btnSim.className = btnSim.className.replace('bg-brand-500 text-brand-50', 'bg-surface-base text-ink-muted');
    }
  }
  // 更新账户徽章
  var badge = document.getElementById('accountBadge');
  if (badge) badge.textContent = (type === 'sim' ? '模拟盘' : '实盘');
  // 触发全局账户切换事件,ui-core.js 监听后重渲染当前页可见容器
  document.dispatchEvent(new CustomEvent('ft:account-switched', {detail: {account: type}}));
}

// 云同步状态条(复用 status-dot 三态,与 setDataSourceStatus 同模式)
function setSyncStatus(type, msg) {
  var el = document.getElementById('syncStatus');
  if (!el) return;
  var dotClass = type==='online'?'online':type==='loading'?'loading':'offline';
  el.innerHTML = '<span class="status-dot ' + dotClass + '"></span>' + (msg || '');
}

// 兼容旧字段:把 accounts[currentAccount].xxx 暴露为 state.xxx 透明转发,
// 让未迁移的旧代码(如 trade-engine stub)继续工作。新代码应直接用 getCurrentAccount()。
// 注意:JavaScript 对象 getter 不能被 JSON.stringify 序列化,saveState 时这些 getter 会被跳过,
// 这正是我们想要的——只持久化真正的数据(accounts 嵌套对象),不存转发别名。
function _migrateLegacyState(saved) {
  // 老结构检测:saved 直接有 pool/trades 等扁平字段,无 accounts 嵌套
  if (saved && !saved.accounts && (saved.pool || saved.trades || saved.closedTrades)) {
    console.log('[FT] 迁移:扁平 state → 账户隔离结构');
    // 备份老 state 以便回滚
    try {
      localStorage.setItem('futures_tracker_state_backup_' + Date.now(), JSON.stringify(saved));
    } catch(e) {}

    var sim = _emptyAccount();
    // 把老字段迁移到 sim 账户
    sim.pool = saved.pool || [];
    sim.fundamentals = saved.fundamentals || {};
    sim.trades = saved.trades || [];
    sim.closedTrades = saved.closedTrades || [];
    sim.journal = saved.journal || [];
    sim.equityHistory = saved.equityHistory || [];
    sim.rolloverHistory = saved.rolloverHistory || [];
    sim.priceSnapshots = saved.priceSnapshots || {};

    // 清掉 saved 上的老扁平字段,改为 accounts 嵌套
    delete saved.pool;
    delete saved.fundamentals;
    delete saved.trades;
    delete saved.closedTrades;
    delete saved.journal;
    delete saved.equityHistory;
    delete saved.rolloverHistory;
    delete saved.priceSnapshots;
    delete saved.realTrades;
    delete saved.realLedger;
    delete saved.simTrades;
    delete saved.simLedger;

    saved.accounts = {sim: sim, real: _emptyAccount()};
    saved.currentAccount = saved.currentAccount || 'sim';
    saved.syncQueue = saved.syncQueue || [];
    saved.varietyDict = saved.varietyDict || _buildVarietyDict();
    // settings 保留(老结构也有 settings)
    if (!saved.settings) {
      saved.settings = state.settings;
    }
    // 触发版本迁移:exchange 回填等
    _migratePoolExchange(sim.pool);
  } else if (saved && saved.accounts) {
    // 新结构但可能缺字段(如 syncQueue/varietyDict)
    if (!saved.syncQueue) saved.syncQueue = [];
    if (!saved.varietyDict) saved.varietyDict = _buildVarietyDict();
    if (!saved.currentAccount) saved.currentAccount = 'sim';
    if (!saved.accounts.sim) saved.accounts.sim = _emptyAccount();
    if (!saved.accounts.real) saved.accounts.real = _emptyAccount();
    // 补齐 sim/real 内可能缺失的 realTrades/ledger 字段(老版 accounts 结构可能没这俩)
    ['sim','real'].forEach(function(k) {
      if (!saved.accounts[k].realTrades) saved.accounts[k].realTrades = [];
      if (!saved.accounts[k].ledger) saved.accounts[k].ledger = [];
    });
    // exchange 回填
    _migratePoolExchange(saved.accounts.sim.pool);
    _migratePoolExchange(saved.accounts.real.pool);
  }
  return saved;
}

// v11 exchange 回填逻辑(从老 loadState 抽出,迁移后调用)
function _migratePoolExchange(pool) {
  if (!Array.isArray(pool)) return;
  pool.forEach(function(c) {
    if (!c.exchange) {
      var m = findVarietyMeta(c.symbol);
      if (m && m.exchange) c.exchange = m.exchange;
    }
  });
}

function loadState() {
  try {
    const s = localStorage.getItem('futures_tracker_state');
    // 初始化 varietyDict(无论是否有 saved state)
    state.varietyDict = _buildVarietyDict();
    state.accounts.sim = _emptyAccount();
    state.accounts.real = _emptyAccount();

    if (s) {
      let saved = JSON.parse(s);
      // 必须用 Object.assign 修改原 state 对象,不能用 state = {...} 重新赋值
      // 因为 window.FTApp.state 在导出时已绑定原对象引用,重新赋值会导致 FTApp.state 指向旧空对象
      // (这是跨页面 signal/trade 等页面读不到 pool 的根因)
      // 迁移老扁平结构 → accounts 嵌套结构
      saved = _migrateLegacyState(saved);
      Object.assign(state, saved);
      // 确保 settings 完整(老版本可能缺字段)
      if (!state.settings) state.settings = {initEquity:15000,target:1000000,maxRisk:2,maxRiskSweet:8,drawdownWarn:20,commission:1,slippage:1,dataSource:'auto',apiUrl:'',maxSinglePosition:0.3,maxTotalPosition:0.8};
      if (!state.settings.dataSource) state.settings.dataSource = 'auto';
      // 版本迁移:重置预置品种为最新合约(仅当版本不同)
      if (!state.version || state.version !== APP_VERSION) {
        console.log('[FT] 版本迁移:', state.version, '→', APP_VERSION);
        // 保留用户自定义品种(非预置),重置预置品种为最新合约
        var simPool = state.accounts.sim.pool || [];
        var userCustom = simPool.filter(function(c) { return !DEFAULT_COMMODITIES.find(function(d){ return d.symbol === c.symbol; }); });
        state.accounts.sim.pool = [...JSON.parse(JSON.stringify(DEFAULT_COMMODITIES)), ...userCustom];
        _migratePoolExchange(state.accounts.sim.pool);
        state.version = APP_VERSION;
        saveState();
      }
      if (!state.lastBackup) state.lastBackup = null;
      if (!state.syncQueue) state.syncQueue = [];
    } else {
      // 首次使用:初始化 sim 账户的 pool 和 equityHistory
      state.accounts.sim.pool = JSON.parse(JSON.stringify(DEFAULT_COMMODITIES));
      state.accounts.sim.equityHistory = [{date: new Date().toISOString().slice(0,10), equity: state.settings.initEquity}];
    }
  } catch(e) {
    console.warn('[FT] loadState 异常,重置:', e);
    state.accounts.sim.pool = JSON.parse(JSON.stringify(DEFAULT_COMMODITIES));
    state.accounts.sim.equityHistory = [{date: new Date().toISOString().slice(0,10), equity: state.settings.initEquity}];
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

// ============ SECURE STORAGE (sessionStorage) ============
// 敏感信息（GitHub Token、API Key）存 sessionStorage，关闭标签即清除，不进入 localStorage
function saveSecure(key, value) {
  try { sessionStorage.setItem('ft_' + key, value); } catch(e) { console.warn('saveSecure 失败:', e); }
}
function loadSecure(key) {
  try { return sessionStorage.getItem('ft_' + key); } catch(e) { return null; }
}
function removeSecure(key) {
  try { sessionStorage.removeItem('ft_' + key); } catch(e) {}
}

// ============ GITHUB GIST SYNC ============
async function syncToGist() {
  var token = loadSecure('githubToken');
  if (!token) { showToast('请先在设置页配置 GitHub Token'); return false; }
  var gistId = loadSecure('gistId');
  var payload = JSON.stringify(state, null, 2);
  var url = gistId ? 'https://api.github.com/gists/' + gistId : 'https://api.github.com/gists';
  var method = gistId ? 'PATCH' : 'POST';
  try {
    var res = await fetch(url, {
      method: method,
      headers: { 'Authorization': 'token ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: '期货模拟盘跟踪系统 - 自动备份',
        public: false,
        files: { 'futures-tracker-data.json': { content: payload } }
      })
    });
    if (res.status === 401) { showToast('Token 已失效，请重新设置'); return false; }
    if (!res.ok) { showToast('同步失败: HTTP ' + res.status); return false; }
    var data = await res.json();
    if (!gistId && data.id) { saveSecure('gistId', data.id); }
    showToast('数据已同步到 GitHub Gist');
    return true;
  } catch(e) {
    console.error('syncToGist 失败:', e);
    showToast('同步失败: ' + e.message);
    return false;
  }
}

async function restoreFromGist() {
  var token = loadSecure('githubToken');
  var gistId = loadSecure('gistId');
  if (!token || !gistId) { showToast('请先配置 Token 并同步过一次'); return false; }
  try {
    var res = await fetch('https://api.github.com/gists/' + gistId, {
      headers: { 'Authorization': 'token ' + token }
    });
    if (res.status === 401) { showToast('Token 已失效，请重新设置'); return false; }
    if (!res.ok) { showToast('恢复失败: HTTP ' + res.status); return false; }
    var data = await res.json();
    var file = data.files['futures-tracker-data.json'];
    if (!file || !file.content) { showToast('Gist 中无数据文件'); return false; }
    var restored = JSON.parse(file.content);
    // 冲突确认：本地数据更新时弹窗确认是否用 Gist 覆盖
    var localTs = state.lastBackup || null;
    var gistTs = restored.lastBackup || null;
    if (localTs && gistTs && localTs > gistTs) {
      var ok = confirm('Gist 版本时间戳：' + gistTs + '\n本地版本时间戳：' + localTs + '\n本地数据更新，确认用 Gist 版本覆盖吗？');
      if (!ok) { showToast('已取消恢复'); return false; }
    }
    Object.assign(state, restored);
    if (!getCurrentAccount().priceSnapshots) getCurrentAccount().priceSnapshots = {};
    saveState();
    showToast('已从 GitHub Gist 恢复数据');
    if (window.FTRender) {
      if (FTRender.renderPool) FTRender.renderPool();
      if (FTRender.renderTrades) FTRender.renderTrades();
      if (FTRender.renderJournal) FTRender.renderJournal();
      if (FTRender.renderDashboard) FTRender.renderDashboard();
    }
    return true;
  } catch(e) {
    console.error('restoreFromGist 失败:', e);
    showToast('恢复失败: ' + e.message);
    return false;
  }
}

// 清除 Token：一键移除 sessionStorage 中的 Token 和 Gist ID
function clearToken() {
  removeSecure('githubToken');
  removeSecure('gistId');
  var tokenInput = document.getElementById('setGithubToken');
  if (tokenInput) tokenInput.value = '';
  var gistDisp = document.getElementById('gistIdDisplay');
  if (gistDisp) gistDisp.textContent = '未同步';
  showToast('Token 已从本地清除');
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
  // 若有 GitHub Token，自动同步到 Gist
  if (loadSecure('githubToken')) syncToGist();
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
  '烧碱':'115.shm', '尿素':'115.urm', '棉花':'115.cfm', '苹果':'115.apm', 'PTA':'115.tam', '菜油':'115.oim',
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
  '烧碱':'SH0', '尿素':'UR0', '棉花':'CF0', '苹果':'AP0', 'PTA':'TA0', '菜油':'OI0',
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
  const acc = getCurrentAccount();
  if (!acc.pool || acc.pool.length === 0) {
    setDataSourceStatus('offline', '数据源: 手动模式 · 观察池为空');
    setLastUpdateTime(new Date().toLocaleTimeString('zh-CN'));
    showToast('观察池为空，请先添加品种');
    return {ok:0, fail:0, total:0};
  }
  console.log('[FT] 开始刷新行情, 池中品种:', acc.pool.map(c => c.symbol + '/' + c.contractCode).join(', '));
  setDataSourceStatus('loading', '数据源: 正在获取行情...');
  fetchStatusMap = {};
  acc.pool.forEach(c => { fetchStatusMap[c.symbol] = 'manual'; });

  // Step 0: futsseapi（CORS 直连）— SHFE/DCE 品种
  const futsseResult = await fetchPricesFromFutsseApi(acc.pool);
  let futsseOk = futsseResult.ok;
  console.log('[FT] futsseapi: 成功', futsseOk);
  var fetchFailReasons = [];

  // Step 1: EastMoney JSONP — CZCE/GFEX 及 futsseapi 未覆盖品种
  let emOk = 0, emFail = [];
  const emPending = [];
  acc.pool.forEach(c => {
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
  let sinaOk = 0, sinaAttempted = 0;
  if (emFail.length) {
    setDataSourceStatus('loading', '数据源: 尝试新浪备用...');
    const sinaSymbols = [], symbolToPool = {};
    emFail.forEach(sym => {
      const s = SINA_SYMBOL_MAP[sym];
      if (s) { sinaSymbols.push(s); symbolToPool[s] = acc.pool.find(x => x.symbol === sym); }
    });
    if (sinaSymbols.length) {
      sinaAttempted = sinaSymbols.length;
      const sina = await fetchPricesFromSina(sinaSymbols, symbolToPool);
      sinaOk = sina.ok;
    }
  }
  console.log('[FT] 新浪: 成功', sinaOk);

  // 追踪每路失败原因（用于全失败时展示）
  if (futsseResult.total > 0 && futsseOk === 0) fetchFailReasons.push('futsseapi 无响应');
  if (emFail.length > 0 && emOk === 0) fetchFailReasons.push('东财JSONP 无响应');
  if (sinaAttempted > 0 && sinaOk === 0) fetchFailReasons.push('新浪超时');

  const totalOk = futsseOk + emOk + sinaOk;
  const elapsed = Date.now() - t0;
  const poolLen = acc.pool.length;
  const stillManual = poolLen - totalOk;

  if (totalOk > 0) {
    // 百分位自动计算：对每个有价格的品种更新 percentile
    acc.pool.forEach(c => {
      if (c.price && c.price > 0) {
        const pct = computePercentile(c.symbol, c.price);
        if (pct !== null) c.percentile = pct;
        // 动量因子：记录当日价格快照
        recordPriceSnapshot(c.symbol, c.price);
      }
    });
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
    var reasonStr = fetchFailReasons.length ? fetchFailReasons.join(' / ') : '所有数据源无响应';
    showToast('⚠ 行情获取失败：' + reasonStr + '，已切换手动模式');
    console.warn('[FT] 所有自动数据源均失败。SHFE/DCE应可用futsseapi，CZCE/GFEX需手动。失败原因:', fetchFailReasons);
  }
  return {ok:totalOk, fail:poolLen - totalOk, total:poolLen};
}

async function fetchPricesFromCustomApi() {
  if (state.settings.dataSource !== 'api' || !state.settings.apiUrl) return {ok:0,total:0};
  const acc = getCurrentAccount();
  try {
    const resp = await fetch(state.settings.apiUrl);
    if (!resp.ok) throw new Error('API error');
    const data = await resp.json();
    let ok = 0;
    if (Array.isArray(data)) {
      data.forEach(item => {
        const c = acc.pool.find(x => x.symbol === item.symbol);
        if (c && item.price) { c.price = item.price; ok++; }
      });
    }
    if (ok > 0) { saveState(); if (window.FTRender && window.FTRender.renderPool) window.FTRender.renderPool(); onPriceUpdate(); }
    return {ok, total: acc.pool.length};
  } catch(e) {
    return {ok:0, total: acc.pool.length};
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
  // 优先读 state.settings.dataSource（默认 auto），兼容旧版 localStorage 标记
  const dsMode = state.settings.dataSource || 'auto';
  const on = (dsMode === 'auto') || (localStorage.getItem('futures_auto_refresh') === '1');
  const interval = localStorage.getItem('futures_refresh_interval') || '60';
  var toggle = document.getElementById('autoRefreshToggle');
  if (toggle) toggle.checked = on;
  var intervalEl = document.getElementById('refreshInterval');
  if (intervalEl) intervalEl.value = interval;
  if (on) {
    startAutoRefresh();
    fetchPricesNow().then(function(r) {
      console.log('[FT] 初始行情刷新完成:', r.ok + '成功/' + r.fail + '失败/' + r.total + '总计');
    });
  } else {
    setDataSourceStatus('offline', '数据源: 手动模式');
  }
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
  const acc = getCurrentAccount();
  let eq = state.settings.initEquity;
  acc.closedTrades.forEach(t => eq += t.pnl);
  acc.trades.forEach(t => {
    const c = acc.pool.find(x=>x.symbol===t.symbol);
    const curPrice = c ? c.price : t.price;
    const grossPnl = t.dir==='long' ? (curPrice - t.price) * t.multiplier * t.lots : (t.price - curPrice) * t.multiplier * t.lots;
    eq += grossPnl - (t.openCommission || 0);
  });
  return eq;
}

function getRealizedEquity() {
  let eq = state.settings.initEquity;
  getCurrentAccount().closedTrades.forEach(t => eq += t.pnl);
  return eq;
}

function onPriceUpdate() {
  saveState();
  // 多页 HTML 架构：根据当前页面 URL 判断需要重渲染的模块
  var path = (location.pathname || '').toLowerCase();
  // 交易页：刷新持仓表
  if (path.indexOf('trade.html') >= 0 || document.getElementById('tab-trade')) {
    var tabTrade = document.getElementById('tab-trade');
    if (!tabTrade || tabTrade.classList.contains('active')) {
      if (window.FTRender && window.FTRender.renderTrades) window.FTRender.renderTrades();
    }
  }
  // 仪表盘页：刷新资金曲线（含实时点）
  if (path.indexOf('dashboard.html') >= 0 || document.getElementById('equityChart')) {
    if (window.FTRender && window.FTRender.renderDashboard) window.FTRender.renderDashboard();
  }
  // 观察池页：刷新分位/价差
  if (path.indexOf('pool.html') >= 0 || document.getElementById('poolBody')) {
    if (window.FTRender && window.FTRender.renderPool) window.FTRender.renderPool();
  }
  // 信号页：刷新信号矩阵（价格变化可能影响估值灯）
  if (path.indexOf('signal.html') >= 0 || document.getElementById('signalBody')) {
    if (window.FTRender && window.FTRender.refreshSignals) window.FTRender.refreshSignals();
  }
}

function updateEquityHistory() {
  const today = new Date().toISOString().slice(0,10);
  const eq = getCurrentEquity();
  const acc = getCurrentAccount();
  const last = acc.equityHistory[acc.equityHistory.length-1];
  if (!last || last.date !== today) {
    acc.equityHistory.push({date: today, equity: eq});
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
  sel.innerHTML = getCurrentAccount().pool.map(c=>`<option value="${escapeHtml(c.symbol)}">${escapeHtml(c.symbol)}</option>`).join('');
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

// 静态数据缓存（init 时异步加载，不阻塞渲染）
let priceHistory = null;  // {records: [...], updated, source}
let costReference = null; // {records: [...], updated, source}

async function loadPriceHistory() {
  try {
    const resp = await fetch('../shared/price-history.json');
    if (!resp.ok) throw new Error('http ' + resp.status);
    priceHistory = await resp.json();
    console.log('[FT] 历史价格区间加载成功:', priceHistory.records.length, '个品种');
  } catch(e) {
    console.warn('[FT] 历史价格区间加载失败:', e.message);
    priceHistory = null;
  }
}

async function loadCostReference() {
  try {
    const resp = await fetch('../shared/cost-reference.json');
    if (!resp.ok) throw new Error('http ' + resp.status);
    costReference = await resp.json();
    console.log('[FT] 成本参考加载成功:', costReference.records.length, '个品种');
  } catch(e) {
    console.warn('[FT] 成本参考加载失败:', e.message);
    costReference = null;
  }
}

// 百分位计算：基于近3年价格区间，(price-low)/(high-low)*100，钳制[0,100]
// 无历史数据返回 null（UI 显示 -- 而非 0）
function computePercentile(symbol, price) {
  if (!priceHistory || !priceHistory.records || !price || price <= 0) return null;
  const rec = priceHistory.records.find(r => r.symbol === symbol);
  if (!rec || !rec.low || !rec.high || rec.high <= rec.low) return null;
  let pct = (price - rec.low) / (rec.high - rec.low) * 100;
  pct = Math.max(0, Math.min(100, Math.round(pct)));
  return pct;
}

// ============ MOMENTUM FACTOR (动量因子) ============
// 价格快照积累 + MA20/MA60 + 近20日涨跌速率，作为三因子信号矩阵的动量维度数据源
//
// 采样逻辑说明：
// - 每个交易日只记一笔（按日期去重），避免分钟级刷新噪音污染日线动量
// - 同日多次刷新：仅当价格变化>0.5%时才覆盖（允许显著变化更新，过滤盘中微小波动）
// - 每品种最多保留 60 条（约 3 个月交易日）
// - 手动模式点"立即刷新"也会触发记录（fetchPricesNow 三路降级失败时不记）
// - 冷启动时 backfillPriceSnapshots() 从东财日线接口回补近 30 日历史收盘价

function recordPriceSnapshot(symbol, price) {
  if (!symbol || !price || price <= 0) return;
  const acc = getCurrentAccount();
  if (!acc.priceSnapshots) acc.priceSnapshots = {};
  var today = new Date().toISOString().slice(0, 10);
  var arr = acc.priceSnapshots[symbol] || [];
  // 同日去重：仅当价格变化>0.5%时才覆盖（过滤盘中微小波动，保留显著变化）
  if (arr.length && arr[arr.length - 1].date === today) {
    var prev = arr[arr.length - 1].price;
    var changePct = Math.abs(price - prev) / prev;
    if (changePct < 0.005) return;  // 变化<0.5% 不覆盖
    arr[arr.length - 1].price = price;
  } else {
    arr.push({ date: today, price: price });
  }
  // 保留最近 60 条
  if (arr.length > 60) arr = arr.slice(arr.length - 60);
  acc.priceSnapshots[symbol] = arr;
}

// 冷启动回补：从东财日线 K 线接口拉取近 30 日历史收盘价，填充 priceSnapshots
// 仅对快照不足 20 条的品种执行，避免重复拉取
async function backfillPriceSnapshots() {
  const acc = getCurrentAccount();
  if (!acc.pool || !acc.pool.length) return;
  if (!acc.priceSnapshots) acc.priceSnapshots = {};
  var needBackfill = [];
  acc.pool.forEach(function (c) {
    var arr = acc.priceSnapshots[c.symbol] || [];
    if (arr.length < 20 && EASTMONEY_SYMBOL_MAP[c.symbol]) {
      needBackfill.push(c.symbol);
    }
  });
  if (!needBackfill.length) return;
  console.log('[FT] 冷启动回补动量快照:', needBackfill.join(', '));
  var backfilled = 0;
  // 并发拉取（每品种独立 JSONP）
  await Promise.all(needBackfill.map(function (sym) {
    return fetchDailyKlineFromEastMoney(sym).then(function (klines) {
      if (klines && klines.length) {
        // 合并：保留已有快照 + 补充历史（按日期去重，已有的不覆盖）
        var existing = acc.priceSnapshots[sym] || [];
        var existingDates = {};
        existing.forEach(function (s) { existingDates[s.date] = true; });
        klines.forEach(function (k) {
          if (!existingDates[k.date]) existing.push(k);
        });
        // 按日期排序后保留最近 60 条
        existing.sort(function (a, b) { return a.date.localeCompare(b.date); });
        if (existing.length > 60) existing = existing.slice(existing.length - 60);
        acc.priceSnapshots[sym] = existing;
        backfilled++;
      }
    });
  }));
  if (backfilled > 0) {
    saveState();
    console.log('[FT] 冷启动回补完成:', backfilled, '个品种');
    // 回补后刷新信号矩阵
    if (window.FTRender && window.FTRender.refreshSignals) window.FTRender.refreshSignals();
  } else if (needBackfill.length > 0) {
    console.warn('[FT] 冷启动回补全部失败:', needBackfill.join(', '));
    showToast('⚠ 历史数据回补失败，动量因子暂不可用（' + needBackfill.length + '个品种）');
  }
}

// 东财日线 K 线拉取：返回 [{date, price}, ...]（price=收盘价）
// 优先 fetch + CORS，失败回退 JSONP（双保险）
function fetchDailyKlineFromEastMoney(symbol) {
  var secid = EASTMONEY_SYMBOL_MAP[symbol];
  if (!secid) return Promise.resolve([]);
  var baseUrl = 'https://push2his.eastmoney.com/api/qt/stock/kline/get?ut=bd1d9ddb04089700cf9c27f6f7426281&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=101&fqt=0&end=20500101&lmt=30&secid=' + secid;

  // 解析东财 klines 格式: ["日期,开盘,收盘,最高,最低,成交量,成交额,振幅,涨跌幅,涨跌额,换手率", ...]
  function parseKlines(data) {
    if (!data || !data.data || !data.data.klines) return [];
    var result = [];
    data.data.klines.forEach(function (line) {
      var parts = line.split(',');
      if (parts.length >= 3) {
        var date = parts[0];
        var close = parseFloat(parts[2]);
        if (date && !isNaN(close) && close > 0) {
          result.push({ date: date, price: close });
        }
      }
    });
    return result;
  }

  // 方式1: fetch + CORS（东财 push2his 支持 CORS）
  return fetch(baseUrl, { method: 'GET' })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (data) {
      var result = parseKlines(data);
      console.log('[FT] K线fetch成功:', symbol, result.length, '条');
      return result;
    })
    .catch(function (e) {
      console.warn('[FT] K线fetch失败:', symbol, e.message, '→ 回退JSONP');
      // 方式2: JSONP 回退
      return fetchDailyKlineJSONP(baseUrl);
    });
}

// JSONP 回退：用于 fetch CORS 失败时
function fetchDailyKlineJSONP(baseUrl) {
  return new Promise(function (resolve) {
    var cbName = '_em_kline_cb_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    var timeout = setTimeout(function () { cleanup(); resolve([]); }, 8000);
    function cleanup() {
      clearTimeout(timeout);
      delete window[cbName];
      var s = document.getElementById('emKlineScript_' + cbName);
      if (s) s.remove();
    }
    window[cbName] = function (data) {
      cleanup();
      if (!data || !data.data || !data.data.klines) { resolve([]); return; }
      var result = [];
      data.data.klines.forEach(function (line) {
        var parts = line.split(',');
        if (parts.length >= 3) {
          var date = parts[0];
          var close = parseFloat(parts[2]);
          if (date && !isNaN(close) && close > 0) {
            result.push({ date: date, price: close });
          }
        }
      });
      resolve(result);
    };
    var script = document.createElement('script');
    script.id = 'emKlineScript_' + cbName;
    script.src = baseUrl + '&cb=' + cbName;
    script.onerror = function () { cleanup(); resolve([]); };
    document.head.appendChild(script);
  });
}

// 计算动量指标：MA20/MA60、近20日涨跌速率、status、score
// 返回 { ma20, ma60, roc20, score, status, samples }
// status: 'up' | 'down' | 'flat' | 'unknown'（样本<20 时 unknown）
function computeMomentum(symbol) {
  const acc = getCurrentAccount();
  var arr = (acc.priceSnapshots && acc.priceSnapshots[symbol]) || [];
  var samples = arr.length;
  if (samples < 20) {
    return { ma20: null, ma60: null, roc20: null, score: null, status: 'unknown', samples: samples };
  }
  // 取最近的价格序列（按日期升序）
  var prices = arr.map(function (s) { return s.price; });
  var last = prices[prices.length - 1];
  // MA20：最近 20 条均价
  var ma20 = prices.slice(-20).reduce(function (a, b) { return a + b; }, 0) / 20;
  // MA60：全部（最多60条）均价
  var ma60 = prices.reduce(function (a, b) { return a + b; }, 0) / prices.length;
  // roc20：近20日涨跌速率 = (last - 20日前) / 20日前 * 100
  var ref = prices[prices.length - 20];
  var roc20 = ref > 0 ? (last - ref) / ref * 100 : 0;
  // status 判定
  var status;
  if (ma20 > ma60 && roc20 > 0) status = 'up';
  else if (ma20 < ma60 && roc20 < 0) status = 'down';
  else status = 'flat';
  // score 归一化到 0-100（up 高分 / flat 中分 / down 低分）
  var score;
  if (status === 'up') {
    // roc20 越大涨得越多越高，0~10% 映射到 70~100
    score = Math.min(100, 70 + Math.min(Math.abs(roc20), 10) * 3);
  } else if (status === 'down') {
    // 跌得越多越低，0~10% 映射到 40~10
    score = Math.max(0, 40 - Math.min(Math.abs(roc20), 10) * 3);
  } else {
    score = 55; // flat 中性偏上
  }
  return { ma20: ma20, ma60: ma60, roc20: roc20, score: score, status: status, samples: samples };
}

// 预计算百分位：在 renderPool/refreshSignals 之前调用，用存储价格更新所有品种的 percentile
// 解决"不点刷新行情百分位就为0"的问题
function ensurePercentileComputed() {
  if (!priceHistory || !priceHistory.records) return;
  const acc = getCurrentAccount();
  if (!acc.pool || !acc.pool.length) return;
  acc.pool.forEach(function(c) {
    if (c.price && c.price > 0) {
      var pct = computePercentile(c.symbol, c.price);
      if (pct !== null) c.percentile = pct;
    }
  });
}

// 获取品种成本参考（用于观察池自动回填）
function getCostReference(symbol) {
  if (!costReference || !costReference.records) return null;
  return costReference.records.find(r => r.symbol === symbol) || null;
}

// 获取外部日报基本面综合分（0-100），无数据返回 null
// 数据源：window.__fundFeed（由 fundamental-feed.json 加载）
function getFundamentalComposite(symbol) {
  var feed = window.__fundFeed;
  if (!feed || !feed.records || !feed.records.length) return null;
  var feishuName = (PROJECT_TO_FEISHU_MAP && PROJECT_TO_FEISHU_MAP[symbol]) || symbol;
  var v = feed.records[0].varieties && feed.records[0].varieties[feishuName];
  if (v && v.score != null && v.score > 0) return v.score;
  return null;
}

// 获取有效基本面分数：手动分>0取手动分，否则用外部日报综合分映射
// dimKey: 'supply' | 'inventory' | 'basis'
// 注意：不再基于百分位推算（消除低百分位→高分→甜点→买入的循环论证）
function getEffectiveFundScore(symbol, dimKey) {
  const acc = getCurrentAccount();
  var fund = acc.fundamentals[symbol] || {};
  var dim = fund[dimKey] || {};
  var manualScore = (dim.score != null) ? dim.score : 0;
  if (manualScore > 0) return manualScore;  // 用户已手动评分，优先使用

  // 用外部日报综合分映射到各维度分
  var extScore = getFundamentalComposite(symbol);
  if (extScore == null) return 0;  // 无外部数据，返回 0（不再百分位推算）

  // 综合分≥60→7, ≥45→5, ≥30→3, <30→2（basis用8/6/4/2）
  if (dimKey === 'basis') {
    return extScore >= 60 ? 8 : (extScore >= 45 ? 6 : (extScore >= 30 ? 4 : 2));
  }
  return extScore >= 60 ? 7 : (extScore >= 45 ? 5 : (extScore >= 30 ? 3 : 2));
}

function isSweetSignal(symbol) {
  const acc = getCurrentAccount();
  var c = acc.pool.find(function(x) { return x.symbol === symbol; });
  if (!c) return false;
  // percentile 为 null/undefined/0(未计算) 时返回 false，不误判甜点
  if (c.percentile == null || c.percentile === 0) return false;
  // 估值分：基于真实 percentile
  var valScore = c.percentile <= 20 ? 5 : c.percentile <= 35 ? 4 : c.percentile <= 50 ? 2 : 1;
  // 外部综合分：无外部数据直接返回 false（不再百分位推算）
  var extScore = getFundamentalComposite(symbol);
  if (extScore == null || extScore < 50) return false;
  // 使用有效基本面分数（手动分>0取手动分，否则取外部日报映射分）
  var supplyScore = getEffectiveFundScore(symbol, 'supply');
  var inventoryScore = getEffectiveFundScore(symbol, 'inventory');
  // 基本面甜点：估值分≥4 AND 外部综合分≥50 AND 有效供给分≥5 AND 有效库存分≥5
  return valScore >= 4 && supplyScore >= 5 && inventoryScore >= 5;
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
  // Token 从 sessionStorage 读取回填（不来自 localStorage）
  var tokenInput = document.getElementById('setGithubToken');
  if (tokenInput) tokenInput.value = loadSecure('githubToken') || '';
  var gistIdDisplay = document.getElementById('gistIdDisplay');
  if (gistIdDisplay) gistIdDisplay.textContent = loadSecure('gistId') ? 'Gist ID: ' + loadSecure('gistId').substring(0,8) + '...' : '未同步';
  // Sirius 云同步配置回填(只回填代理地址,不回填口令)
  loadCloudSyncConfig();
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
  // GitHub Token 存 sessionStorage（不进入 localStorage 序列化）
  var tokenInput = document.getElementById('setGithubToken');
  if (tokenInput) {
    if (tokenInput.value) saveSecure('githubToken', tokenInput.value);
    else removeSecure('githubToken');
  }
  // If initial equity changed, adjust equityHistory baseline proportionally (遍历两个账户)
  if (oldInit !== state.settings.initEquity) {
    const ratio = state.settings.initEquity / oldInit;
    ['sim', 'real'].forEach(k => {
      if (state.accounts[k] && state.accounts[k].equityHistory.length > 0) {
        state.accounts[k].equityHistory = state.accounts[k].equityHistory.map(h => ({date: h.date, equity: h.equity * ratio}));
      }
    });
  }
  saveState();
  showToast('设置已保存');
}

// ============ Sirius 云同步配置(设置页调用) ============
function saveCloudSyncConfig() {
  var proxyInput = document.getElementById('cloudProxyUrl');
  var tokenInput = document.getElementById('cloudAccessToken');
  if (!proxyInput || !tokenInput) { showToast('表单未找到'); return; }
  var proxyUrl = (proxyInput.value || '').trim();
  var accessToken = (tokenInput.value || '').trim();
  // ① 非空校验:任一字段为空则阻止保存
  if (!proxyUrl || !accessToken) { showToast('请填写代理地址和访问口令'); return; }
  // 持久化到 localStorage / sessionStorage,cloud-sync.js configure 内部会读
  localStorage.setItem('ft_proxy_base', proxyUrl);
  sessionStorage.setItem('ft_access_token', accessToken);
  showToast('配置已保存,正在重新初始化云同步...');
  // ② 保存成功后立即调用 CloudSync.reinit() 重新初始化连接(无需手动刷新页面)
  if (window.CloudSync && CloudSync.reinit) {
    CloudSync.reinit({ proxyBaseUrl: proxyUrl, accessToken: accessToken })
      .then(function (ok) {
        if (ok) showToast('✓ 云同步已启用,飞书数据已加载');
        else showToast('✗ 连接失败,请检查代理地址和口令');
      })
      .catch(function (err) {
        showToast('✗ 连接失败: ' + (err.message || err));
      });
  } else if (window.CloudSync && CloudSync.configure) {
    // 兼容回退:旧版 CloudSync 无 reinit 方法时,直接 configure
    CloudSync.configure({ proxyBaseUrl: proxyUrl, accessToken: accessToken })
      .then(function (ok) {
        if (ok) showToast('✓ 云同步已启用,飞书数据已加载');
        else showToast('✗ 连接失败,请检查代理地址和口令');
      })
      .catch(function (err) {
        showToast('✗ 连接失败: ' + (err.message || err));
      });
  }
}

function testCloudSync() {
  var proxyInput = document.getElementById('cloudProxyUrl');
  var tokenInput = document.getElementById('cloudAccessToken');
  var resultEl = document.getElementById('cloudSyncTestResult');
  if (!proxyInput || !tokenInput) return;
  var proxyUrl = (proxyInput.value || '').trim();
  var accessToken = (tokenInput.value || '').trim();
  if (!proxyUrl || !accessToken) {
    if (resultEl) resultEl.innerHTML = '<span class="text-error">请填写代理地址和访问口令</span>';
    return;
  }
  if (resultEl) resultEl.innerHTML = '<span class="text-ink-muted"><span class="status-dot loading"></span>正在测试...</span>';
  // 测试连接:用 reinit(testOnly=true),不触发 loadAll
  if (window.CloudSync && CloudSync.reinit) {
    CloudSync.reinit({ proxyBaseUrl: proxyUrl, accessToken: accessToken, testOnly: true })
      .then(function (ok) {
        if (ok) {
          if (resultEl) resultEl.innerHTML = '<span class="text-success"><span class="status-dot online"></span>✓ 连接成功</span>';
        } else {
          if (resultEl) resultEl.innerHTML = '<span class="text-error"><span class="status-dot offline"></span>✗ 口令或代理无效</span>';
        }
      })
      .catch(function (err) {
        if (resultEl) resultEl.innerHTML = '<span class="text-error"><span class="status-dot offline"></span>✗ ' + (err.message || err) + '</span>';
      });
  } else if (window.CloudSync && CloudSync.configure) {
    CloudSync.configure({ proxyBaseUrl: proxyUrl, accessToken: accessToken, testOnly: true })
      .then(function (ok) {
        if (ok) {
          if (resultEl) resultEl.innerHTML = '<span class="text-success"><span class="status-dot online"></span>✓ 连接成功</span>';
        } else {
          if (resultEl) resultEl.innerHTML = '<span class="text-error"><span class="status-dot offline"></span>✗ 口令或代理无效</span>';
        }
      })
      .catch(function (err) {
        if (resultEl) resultEl.innerHTML = '<span class="text-error"><span class="status-dot offline"></span>✗ ' + (err.message || err) + '</span>';
      });
  }
}

// 设置页加载时回填已保存的代理地址
function loadCloudSyncConfig() {
  var base = localStorage.getItem('ft_proxy_base') || '';
  var proxyInput = document.getElementById('cloudProxyUrl');
  if (proxyInput && base) proxyInput.value = base;
  // 口令走 sessionStorage,不回填到 input(安全考虑)
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
  // 异步加载历史价格区间和成本参考（不阻塞渲染）
  loadPriceHistory();
  loadCostReference();
  if (window.FTRender && window.FTRender.renderPool) window.FTRender.renderPool();
  loadSettings();
  populateFundSelect();
  if (window.FTRender && window.FTRender.loadFundamental) window.FTRender.loadFundamental();
  if (window.FTRender && window.FTRender.renderTrades) window.FTRender.renderTrades();
  if (window.FTRender && window.FTRender.renderJournal) window.FTRender.renderJournal();
  // 初始化两个账户的 equityHistory(若为空)
  ['sim', 'real'].forEach(k => {
    if (state.accounts[k] && state.accounts[k].equityHistory.length === 0) {
      state.accounts[k].equityHistory = [{date: new Date().toISOString().slice(0,10), equity: state.settings.initEquity}];
    }
  });
  saveState();
  initAutoRefresh();
  initAutoBackup();
  updateBackupDisplay();
  // 冷启动回补：若品种快照不足 20 条，从东财日线接口拉取近 30 日历史收盘价
  // 异步执行不阻塞 init，回补完成后自动刷新信号矩阵
  backfillPriceSnapshots();

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
function requestNotificationPermission() {
  if (!('Notification' in window)) { showToast('浏览器不支持通知'); return; }
  Notification.requestPermission().then(function(perm) {
    if (perm === 'granted') {
      showToast('通知已开启');
      var btn = document.getElementById('notifyBtn');
      if (btn) { btn.textContent = '已开启通知'; btn.disabled = true; }
    } else {
      showToast('通知未授权');
    }
  });
}

window.FTApp = {
  // init / state(Sirius 账户隔离)
  init, loadState, saveState, state,
  getCurrentAccount, switchAccount, setSyncStatus,
  getCurrentEquity, getRealizedEquity,
  APP_VERSION,
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
  saveCloudSyncConfig, testCloudSync, loadCloudSyncConfig,
  // 安全存储 / Gist 同步 / 通知
  saveSecure, loadSecure, removeSecure, syncToGist, restoreFromGist, clearToken,
  requestNotificationPermission,
  // 工具
  escapeHtml, isSweetSignal, validateContract,
  // 常量
  FUND_DIMENSIONS, DEFAULT_COMMODITIES,
  EXCHANGE_VARIETIES, CATEGORY_ORDER,
  CORE_VARIETIES,
  FEISHU_VARIETY_MAP, PROJECT_TO_FEISHU_MAP,
  findVarietyMeta, getVarietyTier,
  // 百分位/成本参考
  computePercentile, getCostReference, loadPriceHistory, loadCostReference,
  ensurePercentileComputed, getEffectiveFundScore, getFundamentalComposite,
  // 动量因子
  recordPriceSnapshot, computeMomentum, backfillPriceSnapshots,
  // 资金曲线
  updateEquityHistory,
  priceHistory: () => priceHistory,  // 用函数返回避免导出时为null
  costReference: () => costReference
};
