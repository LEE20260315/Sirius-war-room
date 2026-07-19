// ============ SIRIUS REAL TRADE ============
// 实盘成交录入模块:合约搜索/参数自动带出/交易类型按钮化/
// 止损止盈方向校验/理由动态切换/提交写入飞书 real_trades 表。
//
// 依赖:EXCHANGE_VARIETIES / findVarietyMeta / getCurrentAccount / saveState
//      (来自 app-core.js),CloudSync(来自 cloud-sync.js)

window.FTRealTrade = (function() {
  // ============ 常量 ============
  const OPEN_REASONS = [
    '位置到位', '突破确认', '资金面确认', '催化剂触发',
    '分批建仓第一笔', '分批建仓第二笔', '其他'
  ];
  const CLOSE_REASONS = [
    '止盈到达', '止损到达', '信号反转', '品种切换',
    '仓位调整', '临近交割', '其他'
  ];
  const TYPE_LABEL = {
    long_open: '多开', long_add: '多加', long_close: '多平',
    short_open: '空开', short_add: '空加', short_close: '空平'
  };
  const TYPE_HINT = {
    long_open: '多头开仓 — 止损应低于现价,止盈应高于现价',
    long_add: '多头加仓 — 顺势追加多单',
    long_close: '多头平仓 — 关闭多单持仓',
    short_open: '空头开仓 — 止损应高于现价,止盈应低于现价',
    short_add: '空头加仓 — 顺势追加空单',
    short_close: '空头平仓 — 关闭空单持仓'
  };

  // ============ 内部状态 ============
  let selectedTradeType = null;
  let accountSwitchListenerBound = false;

  // ============ 初始化 ============
  function init() {
    renderContractOptions('');
    bindTradeTypeButtons();
    setTradeTimeNow();
    renderRecentList();
    // 监听账户切换,实盘页强制锁定 real
    if (!accountSwitchListenerBound) {
      accountSwitchListenerBound = true;
      document.addEventListener('ft:account-switched', function(e) {
        const newAcc = e && e.detail && e.detail.account;
        if (newAcc && newAcc !== 'real') {
          // 实盘页不允许切到模拟盘,强制切回
          setTimeout(function() { FTApp.switchAccount('real'); }, 0);
          return;
        }
        renderRecentList();
      });
    }
  }

  // ============ 合约选项渲染(按交易所分组) ============
  function renderContractOptions(filter) {
    const select = document.getElementById('rtContract');
    if (!select) return;
    const filterLower = (filter || '').toLowerCase().trim();
    const grouped = {};
    // 按交易所+品种代码排序
    const sorted = EXCHANGE_VARIETIES.slice().sort(function(a, b) {
      if (a.exchange !== b.exchange) return a.exchange < b.exchange ? -1 : 1;
      return a.code < b.code ? -1 : 1;
    });
    sorted.forEach(function(v) {
      if (filterLower) {
        const symbolMatch = v.symbol.toLowerCase().includes(filterLower);
        const codeMatch = v.code.toLowerCase().includes(filterLower);
        const contractMatch = v.defaultContract.toLowerCase().includes(filterLower);
        if (!symbolMatch && !codeMatch && !contractMatch) return;
      }
      if (!grouped[v.exchange]) {
        grouped[v.exchange] = { name: v.exchangeName, items: [] };
      }
      grouped[v.exchange].items.push(v);
    });
    let html = '<option value="">请选择合约</option>';
    Object.keys(grouped).forEach(function(ex) {
      html += '<optgroup label="' + grouped[ex].name + '">';
      grouped[ex].items.forEach(function(v) {
        html += '<option value="' + v.symbol + '" data-code="' + v.code +
                '" data-multiplier="' + v.multiplier +
                '" data-margin="' + v.marginRate +
                '" data-contract="' + v.defaultContract + '">' +
                v.defaultContract + ' - ' + v.symbol + ' (' + v.code + ')</option>';
      });
      html += '</optgroup>';
    });
    select.innerHTML = html;
  }

  function filterContracts() {
    const searchEl = document.getElementById('rtContractSearch');
    if (!searchEl) return;
    renderContractOptions(searchEl.value);
  }

  // ============ 合约选择变更:自动带出参数 ============
  function onContractChange() {
    const select = document.getElementById('rtContract');
    if (!select) return;
    const opt = select.options[select.selectedIndex];
    const metaEl = document.getElementById('rtContractMeta');
    if (!opt || !opt.value) {
      if (metaEl) metaEl.textContent = '乘数:- / 保证金率:- / 合约:-';
      return;
    }
    const meta = findVarietyMeta(opt.value);
    if (meta && metaEl) {
      metaEl.textContent = '乘数:' + meta.multiplier +
                           ' / 保证金率:' + (meta.marginRate * 100).toFixed(0) + '%' +
                           ' / 合约:' + meta.defaultContract;
    }
  }

  // ============ 交易类型按钮绑定 ============
  function bindTradeTypeButtons() {
    const btns = document.querySelectorAll('#rtTradeTypeBtns .trade-type-btn');
    btns.forEach(function(btn) {
      btn.onclick = function() { onTradeTypeChange(btn.dataset.type); };
    });
  }

  function onTradeTypeChange(type) {
    selectedTradeType = type;
    document.querySelectorAll('#rtTradeTypeBtns .trade-type-btn').forEach(function(b) {
      b.classList.toggle('active', b.dataset.type === type);
    });
    // 止损止盈仅开仓显示
    const isOpen = type && type.endsWith('_open');
    const slGroup = document.getElementById('rtStopLossGroup');
    const tpGroup = document.getElementById('rtTakeProfitGroup');
    if (slGroup) slGroup.style.display = isOpen ? '' : 'none';
    if (tpGroup) tpGroup.style.display = isOpen ? '' : 'none';
    // 理由 label + options 动态切换
    const labelEl = document.getElementById('rtReasonLabel');
    const reasonSelect = document.getElementById('rtReason');
    if (labelEl) labelEl.textContent = isOpen ? '开仓理由' : '平仓原因';
    if (reasonSelect) {
      const reasons = isOpen ? OPEN_REASONS : CLOSE_REASONS;
      reasonSelect.innerHTML = reasons.map(function(r) {
        return '<option value="' + r + '">' + r + '</option>';
      }).join('');
    }
    // hint
    const hintEl = document.getElementById('rtTradeTypeHint');
    if (hintEl) hintEl.textContent = TYPE_HINT[type] || '';
    // 止损方向提示
    const slHintEl = document.getElementById('rtStopLossHint');
    if (slHintEl && isOpen) {
      if (type === 'long_open') {
        slHintEl.textContent = '止损价应 < 成交价,止盈价应 > 成交价';
      } else {
        slHintEl.textContent = '止损价应 > 成交价,止盈价应 < 成交价';
      }
    }
  }

  // ============ 止损止盈方向校验 ============
  function validateStopLoss() {
    if (!selectedTradeType || !selectedTradeType.endsWith('_open')) return true;
    const price = parseFloat(document.getElementById('rtPrice').value);
    const sl = parseFloat(document.getElementById('rtStopLoss').value);
    const tp = parseFloat(document.getElementById('rtTakeProfit').value);
    if (isNaN(price) || isNaN(sl) || isNaN(tp)) return false;
    if (selectedTradeType === 'long_open') {
      return sl < price && tp > price;
    } else {
      return sl > price && tp < price;
    }
  }

  // ============ 成交时间:默认当前 ============
  function setTradeTimeNow() {
    const el = document.getElementById('rtTradeTime');
    if (!el) return;
    const now = new Date();
    const pad = function(n) { return String(n).padStart(2, '0'); };
    el.value = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) +
               'T' + pad(now.getHours()) + ':' + pad(now.getMinutes());
  }

  // ============ 提交 ============
  function submit() {
    const select = document.getElementById('rtContract');
    if (!select) return;
    const opt = select.options[select.selectedIndex];
    if (!opt || !opt.value) { showToast('请选择合约'); return; }
    if (!selectedTradeType) { showToast('请选择交易类型'); return; }
    const price = parseFloat(document.getElementById('rtPrice').value);
    const volume = parseInt(document.getElementById('rtVolume').value, 10);
    if (isNaN(price) || price <= 0) { showToast('请输入有效价格'); return; }
    if (isNaN(volume) || volume < 1) { showToast('请输入有效手数'); return; }
    if (!validateStopLoss()) { showToast('止损止盈方向不正确'); return; }

    const reason = document.getElementById('rtReason').value;
    const tradeTime = document.getElementById('rtTradeTime').value;
    const meta = findVarietyMeta(opt.value);
    if (!meta) { showToast('合约元数据缺失'); return; }

    const isOpen = selectedTradeType.endsWith('_open');
    const record = {
      client_id: 'rt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      account: 'real',
      symbol: opt.value,
      contract: meta.defaultContract,
      trade_type: selectedTradeType,
      direction: selectedTradeType.startsWith('long') ? '多' : '空',
      action: selectedTradeType.split('_')[1],  // open / add / close
      price: price,
      volume: volume,
      multiplier: meta.multiplier,
      margin_rate: meta.marginRate,
      stop_loss: isOpen ? parseFloat(document.getElementById('rtStopLoss').value) : null,
      take_profit: isOpen ? parseFloat(document.getElementById('rtTakeProfit').value) : null,
      reason: reason,
      trade_time: tradeTime,
      created_at: new Date().toISOString()
    };

    // 本地优先:推入 state.accounts.real.realTrades
    const acc = getCurrentAccount();
    if (!acc.realTrades) acc.realTrades = [];
    acc.realTrades.unshift(record);
    if (acc.realTrades.length > 100) acc.realTrades = acc.realTrades.slice(0, 100);
    saveState();

    // 异步同步飞书 real_trades 表(失败入队自动补传)
    if (window.CloudSync && CloudSync.config && CloudSync.config.enabled) {
      CloudSync.upsertRecord('real_trades', record).then(function() {
        showToast('实盘成交已提交并同步飞书');
      }).catch(function(err) {
        showToast('已保存本地,飞书同步稍后重试');
        console.error('[RealTrade] sync failed:', err);
      });
    } else {
      showToast('已保存本地(云同步未启用)');
    }

    resetForm();
    renderRecentList();
  }

  // ============ 重置表单 ============
  function resetForm() {
    const set = function(id, val) { const el = document.getElementById(id); if (el) el.value = val; };
    set('rtContract', '');
    set('rtContractSearch', '');
    set('rtPrice', '');
    set('rtVolume', '1');
    set('rtStopLoss', '');
    set('rtTakeProfit', '');
    selectedTradeType = null;
    document.querySelectorAll('#rtTradeTypeBtns .trade-type-btn').forEach(function(b) {
      b.classList.remove('active');
    });
    const slGroup = document.getElementById('rtStopLossGroup');
    const tpGroup = document.getElementById('rtTakeProfitGroup');
    if (slGroup) slGroup.style.display = 'none';
    if (tpGroup) tpGroup.style.display = 'none';
    const metaEl = document.getElementById('rtContractMeta');
    if (metaEl) metaEl.textContent = '乘数:- / 保证金率:- / 合约:-';
    const hintEl = document.getElementById('rtTradeTypeHint');
    if (hintEl) hintEl.textContent = '请选择交易类型';
    setTradeTimeNow();
    renderContractOptions('');
  }

  // ============ 渲染最近 10 笔成交 ============
  function renderRecentList() {
    const tbody = document.getElementById('rtRecentBody');
    const empty = document.getElementById('rtEmpty');
    if (!tbody) return;
    const acc = getCurrentAccount();
    const list = (acc.realTrades || []).slice(0, 10);
    if (list.length === 0) {
      tbody.innerHTML = '';
      if (empty) empty.style.display = '';
      return;
    }
    if (empty) empty.style.display = 'none';
    tbody.innerHTML = list.map(function(r) {
      const typeLabel = TYPE_LABEL[r.trade_type] || r.trade_type || '-';
      const time = (r.trade_time || '').replace('T', ' ');
      const contract = r.contract || r.symbol || '-';
      const reason = r.reason || '-';
      const esc = function(s) {
        return String(s).replace(/[<>&"]/g, function(c) {
          return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c];
        });
      };
      return '<tr>' +
        '<td class="py-2 px-3 text-ink-muted">' + esc(time) + '</td>' +
        '<td class="py-2 px-3 text-ink">' + esc(contract) + '</td>' +
        '<td class="py-2 px-3 text-brand-500">' + esc(typeLabel) + '</td>' +
        '<td class="py-2 px-3 font-mono text-ink">' + r.price + '</td>' +
        '<td class="py-2 px-3 font-mono text-ink">' + r.volume + '</td>' +
        '<td class="py-2 px-3 text-ink-muted">' + esc(reason) + '</td>' +
        '</tr>';
    }).join('');
  }

  return {
    init: init,
    renderContractOptions: renderContractOptions,
    filterContracts: filterContracts,
    onContractChange: onContractChange,
    bindTradeTypeButtons: bindTradeTypeButtons,
    onTradeTypeChange: onTradeTypeChange,
    validateStopLoss: validateStopLoss,
    setTradeTimeNow: setTradeTimeNow,
    submit: submit,
    resetForm: resetForm,
    renderRecentList: renderRecentList
  };
})();
