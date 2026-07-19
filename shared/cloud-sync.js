// ============ SIRIUS CLOUD SYNC ============
// 本地优先 + 异步同步飞书 Bitable + 失败补传队列
//
// 设计原则:
// 1. 本地操作立即响应(写 localStorage + 刷新 UI),不阻塞用户
// 2. 异步推送到 Cloudflare Worker 代理,由代理转发到飞书 Bitable
// 3. 失败入队 syncQueue,监听 online 事件自动补传
// 4. 启动时从飞书拉全量,以云端为准(本地冲突时云端覆盖)
// 5. 未配置代理时降级为纯本地模式(不影响现有功能)
//
// 安全:App Secret 在 Worker 端,前端只持有访问口令(X-Sirius-Token),
//       存 sessionStorage,关闭标签即清除。

const CloudSync = {
  // ============ 配置 ============
  config: {
    proxyBaseUrl: '',        // Worker 部署后的 URL,如 https://sirius-proxy.xxx.workers.dev
    accessToken: '',         // 自定义访问口令,与 Worker 端 SIRIUS_ACCESS_TOKEN 一致
    enabled: false,          // 是否启用云同步(未配置则降级为纯本地)
    timeout: 15000,          // 请求超时 15s
  },

  // ============ 内部状态 ============
  _state: {
    initialized: false,
    listenerBound: false,
    syncing: false,
    lastSyncAt: null,
    lastError: null,
    queueProcessing: false,
  },

  // ============ 初始化(幂等,可重复调用) ============
  init() {
    // 从 localStorage 读代理地址(允许用户在设置页配置)
    const base = localStorage.getItem('ft_proxy_base');
    if (base) this.config.proxyBaseUrl = base.replace(/\/$/, '');
    // 从 sessionStorage 读访问口令
    const token = FTApp.loadSecure('sirius_token');
    if (token) this.config.accessToken = token;
    this.config.enabled = !!(this.config.proxyBaseUrl && this.config.accessToken);
    // 监听网络恢复,自动补传(只绑一次,允许 init 重复调用)
    if (!this._state.listenerBound) {
      this._state.listenerBound = true;
      window.addEventListener('online', () => {
        this.setStatus('loading', '网络恢复,补传中...');
        this.flushQueue();
      });
    }
    // 初始状态指示
    if (!this.config.enabled) {
      this.setStatus('offline', '云同步: 未配置');
    } else if (!navigator.onLine) {
      this.setStatus('offline', '云同步: 离线待补传 ' + this.queueSize() + ' 条');
    } else {
      this.setStatus('loading', '云同步: 连接中...');
    }
    this._state.initialized = true;
    console.log('[CloudSync] 初始化完成,enabled=', this.config.enabled);
  },

  // ============ 重新初始化(设置页保存后调用) ============
  // 重置内部状态 + 重新读取配置 + 绑定监听 + 测试连接 + 拉取全量
  // 这是对外暴露的"保存后即时生效"入口,内部委托给 configure()
  reinit(opts) {
    opts = opts || {};
    // 强制重新读取存储(无视缓存)
    this._state.initialized = false;
    this.init();
    return this.configure({
      proxyBaseUrl: opts.proxyBaseUrl,
      accessToken: opts.accessToken,
      testOnly: opts.testOnly
    });
  },

  // ============ 配置更新(设置页调用) ============
  // testOnly=true 时只测试连接,不触发 loadAll;返回 Promise<boolean>
  configure({ proxyBaseUrl, accessToken, testOnly }) {
    if (proxyBaseUrl !== undefined) {
      this.config.proxyBaseUrl = (proxyBaseUrl || '').replace(/\/$/, '');
      if (this.config.proxyBaseUrl) {
        localStorage.setItem('ft_proxy_base', this.config.proxyBaseUrl);
      } else {
        localStorage.removeItem('ft_proxy_base');
      }
    }
    if (accessToken !== undefined) {
      this.config.accessToken = accessToken;
      if (accessToken) {
        FTApp.saveSecure('sirius_token', accessToken);
      } else {
        FTApp.removeSecure('sirius_token');
      }
    }
    this.config.enabled = !!(this.config.proxyBaseUrl && this.config.accessToken);
    if (!this.config.enabled) {
      this.setStatus('offline', '云同步: 未配置');
      return Promise.resolve(false);
    }
    this.setStatus('loading', '云同步: 连接中...');
    return this.testConnection().then(ok => {
      if (ok) {
        if (testOnly) {
          this.setStatus('online', '云同步: 连接成功');
        } else {
          this.setStatus('online', '云同步: 已就绪');
          this.loadAll();
        }
        return true;
      } else {
        this.setStatus('offline', '云同步: 口令或代理无效');
        return false;
      }
    }).catch(err => {
      this.setStatus('offline', '云同步: ' + (err.message || '连接失败'));
      return false;
    });
  },

  // ============ 状态条(复用 status-dot 三态) ============
  setStatus(type, msg) {
    const el = document.getElementById('syncStatus');
    if (!el) return;
    const dotClass = type === 'online' ? 'online' : type === 'loading' ? 'loading' : 'offline';
    el.innerHTML = '<span class="status-dot ' + dotClass + '"></span>' + msg;
  },

  // ============ 测试连接 ============
  async testConnection() {
    if (!this.config.enabled) return false;
    try {
      const resp = await this._fetch('/api/health', { method: 'GET' }, true);
      return resp && resp.status === 'ok';
    } catch (e) {
      console.warn('[CloudSync] testConnection 失败:', e);
      return false;
    }
  },

  // ============ 启动时拉全量 ============
  async loadAll() {
    if (!this.config.enabled) return;
    if (!navigator.onLine) {
      this.setStatus('offline', '云同步: 离线待补传 ' + this.queueSize() + ' 条');
      return;
    }
    this.setStatus('loading', '云同步: 拉取数据...');
    try {
      // 确保账户结构存在
      if (!FTApp.state.accounts) {
        FTApp.state.accounts = {sim: {trades:[],closedTrades:[],ledger:[],realTrades:[]}, real: {trades:[],closedTrades:[],ledger:[],realTrades:[]}};
      }
      // 拉实盘成交流水 → state.accounts.real.trades
      const realTrades = await this._listRecords('real_trades');
      if (realTrades && realTrades.length) {
        FTApp.state.accounts.real.trades = realTrades.map(this._normalizeTradeRecord);
        FTApp.saveState();
      }
      // 拉模拟成交流水 → 与本地 state.accounts.sim.trades 合并(以飞书 client_id 去重,飞书为准)
      const simTrades = await this._listRecords('sim_trades');
      if (simTrades && simTrades.length) {
        this._mergeSimTrades(simTrades.map(this._normalizeTradeRecord));
        FTApp.saveState();
      }
      // 拉资金账户流水 → state.accounts.sim.ledger / accounts.real.ledger
      const ledger = await this._listRecords('account_ledger');
      if (ledger && ledger.length) {
        const real = [], sim = [];
        ledger.forEach(r => {
          const normalized = this._normalizeLedgerRecord(r);
          const acc = normalized.account || (r.fields && r.fields.account) || r.account || 'sim';
          if (acc === 'real' || acc === '实盘') real.push(normalized);
          else sim.push(normalized);
        });
        FTApp.state.accounts.real.ledger = real;
        FTApp.state.accounts.sim.ledger = sim;
        FTApp.saveState();
      }
      this._state.lastSyncAt = Date.now();
      this._state.lastError = null;
      this.setStatus('online', '云同步: 已同步');
      // 触发 UI 刷新
      if (window.FTRender) {
        if (FTRender.renderTrades) FTRender.renderTrades();
        if (FTRender.renderRealTrades) FTRender.renderRealTrades();
        if (FTRender.renderDashboard) FTRender.renderDashboard();
      }
    } catch (e) {
      console.error('[CloudSync] loadAll 失败:', e);
      this._state.lastError = e.message;
      this.setStatus('offline', '云同步: 拉取失败');
    }
  },

  // ============ 记录写入(本地优先 + 异步同步) ============
  async upsertRecord(table, record) {
    // 自动注入 account 字段(从当前账户取,确保飞书表能区分 sim/real)
    if (!record.account && FTApp.state && FTApp.state.currentAccount) {
      record.account = FTApp.state.currentAccount;
    }
    // 自动注入 client_id(若未提供)
    if (!record.client_id) {
      var prefix = table === 'real_trades' ? 'real' : (table === 'sim_trades' ? 'sim' : (table === 'account_ledger' ? 'led' : 'rec'));
      record.client_id = this.generateClientId(prefix);
    }
    // 自动注入 created_at(若未提供)
    if (!record.created_at) {
      record.created_at = new Date().toISOString();
    }
    // 1. 入队(立即)
    this._enqueue(table, 'upsert', record);
    // 2. 若在线且启用,立即尝试同步
    if (this.config.enabled && navigator.onLine) {
      this.setStatus('loading', '云同步: 同步中...');
      try {
        await this._processQueueItem(table, 'upsert', record);
        this.setStatus('online', '云同步: 已同步');
      } catch (e) {
        console.warn('[CloudSync] upsert 失败,留队补传:', e);
        this.setStatus('offline', '云同步: 离线待补传 ' + this.queueSize() + ' 条');
      }
    } else if (!this.config.enabled) {
      // 未配置代理,不显示离线待补传(避免误导),只静默入队
      // 状态保持原状
    } else {
      this.setStatus('offline', '云同步: 离线待补传 ' + this.queueSize() + ' 条');
    }
  },

  // ============ 队列管理 ============
  queueSize() {
    return (FTApp.state.syncQueue || []).length;
  },

  _enqueue(table, action, record) {
    if (!FTApp.state.syncQueue) FTApp.state.syncQueue = [];
    FTApp.state.syncQueue.push({
      id: 'sq_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      table, action, record,
      enqueuedAt: Date.now(),
      attempts: 0,
    });
    FTApp.saveState();
  },

  async flushQueue() {
    if (this._state.queueProcessing) return;
    if (!this.config.enabled || !navigator.onLine) return;
    const queue = FTApp.state.syncQueue || [];
    if (!queue.length) {
      if (this._state.lastError) {
        this.setStatus('offline', '云同步: ' + this._state.lastError);
      } else {
        this.setStatus('online', '云同步: 已同步');
      }
      return;
    }
    this._state.queueProcessing = true;
    this.setStatus('loading', '云同步: 补传 ' + queue.length + ' 条...');
    const failed = [];
    for (const item of queue) {
      try {
        await this._processQueueItem(item.table, item.action, item.record);
      } catch (e) {
        item.attempts = (item.attempts || 0) + 1;
        item.lastError = e.message;
        // 重试超过 5 次的丢弃,避免无限堆积
        if (item.attempts < 5) failed.push(item);
        else console.error('[CloudSync] 丢弃超限补传项:', item);
      }
    }
    FTApp.state.syncQueue = failed;
    FTApp.saveState();
    this._state.queueProcessing = false;
    if (failed.length) {
      this.setStatus('offline', '云同步: ' + failed.length + ' 条待补传');
    } else {
      this._state.lastSyncAt = Date.now();
      this._state.lastError = null;
      this.setStatus('online', '云同步: 已同步');
    }
  },

  // ============ 单条处理 ============
  async _processQueueItem(table, action, record) {
    if (action === 'upsert') {
      await this._upsertRemote(table, record);
    } else if (action === 'delete') {
      await this._deleteRemote(table, record.record_id || record.client_id);
    }
  },

  // ============ 飞书记录读写(通过 Worker 代理) ============
  async _upsertRemote(table, record) {
    const resp = await this._fetch('/api/records/upsert?table=' + table, {
      method: 'POST',
      body: JSON.stringify(record),
    });
    return resp;
  },

  async _deleteRemote(table, recordId) {
    return await this._fetch('/api/records/' + encodeURIComponent(recordId) + '?table=' + table, {
      method: 'DELETE',
    });
  },

  async _listRecords(table, opts) {
    opts = opts || {};
    const params = new URLSearchParams();
    if (opts.pageSize) params.set('pageSize', String(opts.pageSize));
    if (opts.pageToken) params.set('pageToken', opts.pageToken);
    const qs = params.toString();
    const url = '/api/records?table=' + table + (qs ? '&' + qs : '');
    const resp = await this._fetch(url, { method: 'GET' });
    // Worker 返回 {data: {items, pageToken}} 或 {data: [...]}
    if (Array.isArray(resp)) return resp;
    if (resp && resp.data) {
      if (Array.isArray(resp.data)) return resp.data;
      if (resp.data.items) return resp.data.items;
    }
    return [];
  },

  // ============ fetch 封装 ============
  async _fetch(path, options, skipAuth) {
    if (!this.config.proxyBaseUrl) throw new Error('未配置代理地址');
    const url = this.config.proxyBaseUrl + path;
    const headers = { 'Content-Type': 'application/json' };
    if (!skipAuth && this.config.accessToken) {
      headers['X-Sirius-Token'] = this.config.accessToken;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeout);
    try {
      const resp = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body || null,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({}));
        const err = new Error(errBody.message || ('HTTP ' + resp.status));
        err.code = errBody.code;
        err.status = resp.status;
        throw err;
      }
      const ct = resp.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        return await resp.json();
      }
      return await resp.text();
    } catch (e) {
      clearTimeout(timer);
      if (e.name === 'AbortError') {
        const err = new Error('请求超时');
        err.code = 'TIMEOUT';
        throw err;
      }
      throw e;
    }
  },

  // ============ 数据规范化 ============
  // 飞书返回的记录结构:{record_id, fields: {...}}
  // 前端使用的结构:扁平对象
  _normalizeTradeRecord(r) {
    const f = r.fields || r;
    return {
      record_id: r.record_id || f.record_id || '',
      client_id: f.client_id || '',
      trade_time: f.trade_time || '',
      symbol: f.symbol || '',
      symbol_code: f.symbol_code || f.symbolCode || '',
      exchange: f.exchange || '',
      direction: f.direction === '多' || f.direction === 'long' ? 'long' : 'short',
      action: f.action || '开',
      price: Number(f.price) || 0,
      volume: Number(f.volume) || 0,
      multiplier: Number(f.multiplier) || 0,
      margin_rate: Number(f.margin_rate) || 0,
      stop_loss: Number(f.stop_loss) || 0,
      take_profit: Number(f.take_profit) || 0,
      reason: f.reason || '',
      account: f.account || 'real',
      note: f.note || '',
      created_at: f.created_at || '',
    };
  },

  _normalizeLedgerRecord(r) {
    const f = r.fields || r;
    return {
      record_id: r.record_id || f.record_id || '',
      client_id: f.client_id || '',
      account: f.account || 'sim',
      flow_type: f.flow_type || '',
      amount: Number(f.amount) || 0,
      balance: Number(f.balance) || 0,
      occupied_margin: Number(f.occupied_margin) || 0,
      floating_pnl: Number(f.floating_pnl) || 0,
      realized_pnl: Number(f.realized_pnl) || 0,
      note: f.note || '',
      flow_time: f.flow_time || '',
    };
  },

  // 模拟成交流水合并(以飞书 client_id 为准,写入 accounts.sim)
  _mergeSimTrades(remoteTrades) {
    if (!remoteTrades || !remoteTrades.length) return;
    if (!FTApp.state.accounts || !FTApp.state.accounts.sim) return;
    const local = FTApp.state.accounts.sim.trades || [];
    const byClientId = {};
    remoteTrades.forEach(t => {
      if (t.client_id) byClientId[t.client_id] = t;
    });
    // 本地有但飞书没有的,可能是新录入还未同步,保留
    const merged = local.filter(t => !t.client_id || !byClientId[t.client_id]);
    // 飞书有的,以飞书为准
    remoteTrades.forEach(t => {
      if (t.action === '平' || t.action === '减') {
        // 平仓记录归入 closedTrades(避免重复进 trades)
        // 注意:这里只做基础合并,实际平仓逻辑由 FTTrade.closePosition 处理
      } else {
        merged.push(t);
      }
    });
    FTApp.state.accounts.sim.trades = merged;
  },

  // ============ 工具:生成 client_id(防重复提交) ============
  generateClientId(prefix) {
    prefix = prefix || 'rec';
    return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  },

  // ============ 工具:生成 record_id ============
  generateRecordId() {
    // 简化版 ULID:时间戳 + 随机
    return 'rid_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  },

  // ============ 手动触发同步(设置页用) ============
  async syncNow() {
    if (!this.config.enabled) {
      FTApp.showToast('请先配置代理地址与访问口令');
      return;
    }
    FTApp.showToast('开始同步...');
    await this.loadAll();
    await this.flushQueue();
    FTApp.showToast('同步完成');
  },
};

// ============ 全局导出 ============
window.CloudSync = CloudSync;

// ============ 自动初始化 ============
// 在 DOMContentLoaded 后初始化(确保 FTApp 已就绪)
document.addEventListener('DOMContentLoaded', function() {
  try {
    CloudSync.init();
  } catch (e) {
    console.error('[CloudSync] init 失败:', e);
  }
});
