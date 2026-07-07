// ============ FUTURES TRACKER - APP CORE ============
// Data store, state management, localStorage CRUD, price fetching,
// auto-refresh, theme toggle, backup/import/export, and init function.

// ============ VERSION ============
const APP_VERSION = '2026.06.22-v6';

// ============ DATA STORE ============
const DEFAULT_COMMODITIES = [
  {symbol:'生猪',contractCode:'LH2609',multiplier:16,marginRate:0.12,price:13500,percentile:15,costLine:14000,status:'bottom'},
  {symbol:'白糖',contractCode:'SR2609',multiplier:10,marginRate:0.08,price:5800,percentile:20,costLine:5600,status:'bottom'},
  {symbol:'PVC',contractCode:'V2609',multiplier:5,marginRate:0.08,price:5200,percentile:18,costLine:5400,status:'bottom'},
  {symbol:'聚丙烯PP',contractCode:'PP2609',multiplier:5,marginRate:0.08,price:7100,percentile:22,costLine:7300,status:'bottom'},
  {symbol:'玻璃',contractCode:'FG2609',multiplier:20,marginRate:0.08,price:1250,percentile:12,costLine:1300,status:'bottom'},
  {symbol:'纯碱',contractCode:'SA2609',multiplier:20,marginRate:0.08,price:1650,percentile:16,costLine:1700,status:'bottom'},
  {symbol:'螺纹钢',contractCode:'RB2610',multiplier:10,marginRate:0.10,price:3050,percentile:25,costLine:3200,status:'bottom'},
  {symbol:'热卷',contractCode:'HC2610',multiplier:10,marginRate:0.10,price:3150,percentile:23,costLine:3300,status:'bottom'},
  {symbol:'铁矿石',contractCode:'I2609',multiplier:100,marginRate:0.12,price:680,percentile:28,costLine:720,status:'watch'},
  {symbol:'玉米',contractCode:'C2609',multiplier:10,marginRate:0.08,price:2400,percentile:20,costLine:2500,status:'bottom'},
  {symbol:'甲醇',contractCode:'MA2609',multiplier:10,marginRate:0.08,price:2250,percentile:18,costLine:2400,status:'bottom'},
  {symbol:'烧碱',contractCode:'SH2609',multiplier:30,marginRate:0.08,price:2600,percentile:15,costLine:2750,status:'bottom'},
  {symbol:'尿素',contractCode:'UR2609',multiplier:20,marginRate:0.08,price:1800,percentile:17,costLine:1900,status:'bottom'}
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
      // version migration
      if (!state.version) state.version = APP_VERSION;
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
// East Money HTTPS single-stock API (primary)
const EASTMONEY_SYMBOL_MAP = {
  '螺纹钢':'113.rbm', '热卷':'113.hcm', '铁矿石':'114.im', '玉米':'114.cm',
  '生猪':'114.lhm', 'PVC':'114.vm', '聚丙烯PP':'114.ppm', 'PP':'114.ppm',
  '甲醇':'115.mam', '玻璃':'115.fgm', '白糖':'115.srm', '纯碱':'115.sam',
  '烧碱':'115.shm', '尿素':'115.urm'
};

// Sina Finance continuous contract mapping (backup)
const SINA_SYMBOL_MAP = {
  '螺纹钢':'RB0', '热卷':'HC0', '铁矿石':'I0', '玉米':'C0',
  '生猪':'LH0', 'PVC':'V0', '聚丙烯PP':'PP0', 'PP':'PP0',
  '甲醇':'MA0', '玻璃':'FG0', '白糖':'SR0', '纯碱':'SA0',
  '烧碱':'SH0', '尿素':'UR0'
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

// === Combined fetch: East Money -> Sina -> Manual ===
async function fetchPricesNow() {
  const t0 = Date.now();
  setDataSourceStatus('loading', '数据源: 正在获取行情...');

  // Reset status
  fetchStatusMap = {};
  state.pool.forEach(c => { fetchStatusMap[c.symbol] = 'manual'; });

  // Step 1: East Money (primary) per symbol
  let emOk = 0, emFail = [];
  const emPending = [];
  state.pool.forEach(c => {
    const secid = EASTMONEY_SYMBOL_MAP[c.symbol];
    if (secid) {
      emPending.push((async () => {
        const p = await fetchPriceFromEastMoney(secid);
        if (p) { c.price = p; fetchStatusMap[c.symbol] = 'ok'; emOk++; }
        else { emFail.push(c.symbol); }
      })());
    } else {
      emFail.push(c.symbol);
    }
  });
  await Promise.all(emPending);

  // Step 2: Sina (backup for failed items)
  let sinaOk = 0;
  if (emOk < state.pool.length && emFail.length) {
    setDataSourceStatus('loading', `数据源: 东财${emOk}个成功, 尝试新浪备用...`);
    const sinaSymbols = [];
    const symbolToPool = {};
    emFail.forEach(sym => {
      const sinaSym = SINA_SYMBOL_MAP[sym];
      if (sinaSym) { sinaSymbols.push(sinaSym); symbolToPool[sinaSym] = state.pool.find(x => x.symbol === sym); }
    });
    if (sinaSymbols.length) {
      const sina = await fetchPricesFromSina(sinaSymbols, symbolToPool);
      sinaOk = sina.ok;
    }
  }

  const totalOk = emOk + sinaOk;
  const elapsed = Date.now() - t0;

  if (totalOk > 0) {
    saveState();
    if (window.FTRender && window.FTRender.renderPool) window.FTRender.renderPool();
    onPriceUpdate();
    const src = emOk > 0 ? '东财' : '新浪';
    setDataSourceStatus('online', `数据源: ${src}行情 (${totalOk}/${state.pool.length} 成功) · ${elapsed}ms`);
    setLastUpdateTime(new Date().toLocaleTimeString('zh-CN'));
    showToast(`已更新 ${totalOk} 个品种价格`);
  } else {
    setDataSourceStatus('offline', '数据源: 获取失败 · 已回退手动模式');
    setLastUpdateTime(new Date().toLocaleTimeString('zh-CN') + ' (失败)');
    showToast('行情获取失败，使用手动数据');
  }

  return {ok:totalOk, fail:state.pool.length - totalOk, total:state.pool.length};
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
  if (isDark) {
    d.classList.remove('dark');
    d.classList.add('light');
  } else {
    d.classList.remove('light');
    d.classList.add('dark');
  }
  localStorage.setItem('futures_theme', isDark ? 'light' : 'dark');
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
  if (document.getElementById('tab-trade').classList.contains('active')) {
    if (window.FTRender && window.FTRender.renderTrades) window.FTRender.renderTrades();
  }
  if (document.getElementById('tab-dashboard').classList.contains('active')) {
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
  const sel = document.getElementById('fundSelect');
  if (sel) sel.innerHTML = state.pool.map(c=>`<option value="${escapeHtml(c.symbol)}">${escapeHtml(c.symbol)}</option>`).join('');
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
  el('setInitEquity').value = s.initEquity;
  el('setTarget').value = s.target;
  el('setMaxRisk').value = s.maxRisk;
  el('setMaxRiskSweet').value = s.maxRiskSweet;
  el('setDrawdownWarn').value = s.drawdownWarn;
  el('setCommission').value = s.commission;
  el('setSlippage').value = s.slippage;
  el('setDataSource').value = s.dataSource;
  el('setApiUrl').value = s.apiUrl || '';
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
  init, loadState, saveState, state, getCurrentEquity, getRealizedEquity,
  fetchPricesNow, onPriceUpdate, populateSymbolSelect, populateFundSelect,
  FUND_DIMENSIONS, DEFAULT_COMMODITIES, escapeHtml, showToast, openModal, closeModal,
  toggleTheme, isSweetSignal, setDataSourceStatus, setLastUpdateTime,
  initAutoRefresh, initAutoBackup, updateBackupDisplay, updateHeaderStats,
  loadSettings, saveSettings
};
