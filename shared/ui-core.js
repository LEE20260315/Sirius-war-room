// ============ FUTURES TRACKER - UI CORE (FTRender) ============
// 全局渲染层：负责观察池 / 基本面 / 信号 / 交易 / 日志 / 仪表盘的 DOM 渲染。
// 依赖 FTApp（app-core.js，已在前置加载），所有方法挂载到 window.FTRender。
// 因 trade-engine.js / signal-engine.js / chart-engine.js 均为占位 stub，
// 交易引擎的提交逻辑（FTTrade.*）也在此处补齐，确保现有 HTML 按钮可用。

(function () {
  'use strict';

  // 简捷取元素
  function el(id) { return document.getElementById(id); }

  // 状态 → 徽章 HTML（仅使用设计系统既有颜色）
  function statusBadge(status) {
    var map = {
      bottom:  { c: '#8ca06f', t: '低位' },
      sweet:   { c: '#d97757', t: '甜点' },
      top:     { c: '#ef4444', t: '高位' },
      watch:   { c: '#e08d6f', t: '观望' }
    };
    var m = map[status] || { c: '#908e84', t: status || '--' };
    return '<span class="px-2 py-0.5 rounded text-xs font-medium" style="background:' +
      m.c + '22;color:' + m.c + ';border:1px solid ' + m.c + '">' + FTApp.escapeHtml(m.t) + '</span>';
  }

  // 表格内行内输入框统一样式（沿用既有设计令牌）
  var CELL_INPUT = 'bg-surface-base border border-edge-faint rounded px-2 py-1 text-xs text-ink font-mono';

  // 追加 / 刷新合约 datalist（renderPool 每次渲染后调用一次）
  function ensureContractList() {
    var dl = el('contractList');
    if (!dl) {
      dl = document.createElement('datalist');
      dl.id = 'contractList';
      document.body.appendChild(dl);
    }
    var opts = '';
    FTApp.EXCHANGE_VARIETIES.forEach(function (v) {
      opts += '<option value="' + FTApp.escapeHtml(v.defaultContract) + '">' + FTApp.escapeHtml(v.symbol) + ' 主力</option>';
      opts += '<option value="' + FTApp.escapeHtml(v.code + '2509') + '">' + FTApp.escapeHtml(v.symbol) + ' 2509</option>';
      opts += '<option value="' + FTApp.escapeHtml(v.code + '2601') + '">' + FTApp.escapeHtml(v.symbol) + ' 2601</option>';
    });
    dl.innerHTML = opts;
  }

  var FTRender = {
    // ============ 1. 观察池渲染 ============
    renderPool: function () {
      var body = el('poolBody');
      if (!body) return;
      var pool = FTApp.state.pool || [];
      if (!pool.length) {
        body.innerHTML = '<tr><td colspan="9" class="empty-state">观察池为空，点击"添加品种"开始</td></tr>';
        ensureContractList();
        return;
      }
      // 按板块分类顺序排序
      var order = FTApp.CATEGORY_ORDER || [];
      var sorted = pool.slice().sort(function (a, b) {
        var ia = order.indexOf(a.category), ib = order.indexOf(b.category);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
      var html = '';
      var lastCat = null;
      sorted.forEach(function (c) {
        if (c.category !== lastCat) {
          html += '<tr class="bg-surface-dim"><td colspan="9" class="py-2 px-3 font-serif text-xs text-ink-muted uppercase tracking-wider">' +
            FTApp.escapeHtml(c.category || '其他') + '</td></tr>';
          lastCat = c.category;
        }
        var priceTxt = (c.price && c.price > 0) ? c.price.toFixed(2) : '--';
        html += '<tr>' +
          '<td class="py-2 px-3 text-ink">' + FTApp.escapeHtml(c.symbol) + '</td>' +
          '<td class="py-2 px-3"><input list="contractList" value="' + FTApp.escapeHtml(c.contractCode || '') + '" data-symbol="' + FTApp.escapeHtml(c.symbol) + '" class="contract-input ' + CELL_INPUT + '" style="width:96px"></td>' +
          '<td class="py-2 px-3"><input type="number" value="' + (c.multiplier || 0) + '" data-symbol="' + FTApp.escapeHtml(c.symbol) + '" class="mult-input ' + CELL_INPUT + '" style="width:72px"></td>' +
          '<td class="py-2 px-3"><input type="number" step="0.01" value="' + (c.marginRate || 0) + '" data-symbol="' + FTApp.escapeHtml(c.symbol) + '" class="margin-input ' + CELL_INPUT + '" style="width:72px"></td>' +
          '<td class="py-2 px-3 font-mono text-ink-secondary">' + priceTxt + '</td>' +
          '<td class="py-2 px-3 font-mono text-ink-secondary">' + (c.percentile != null ? c.percentile : '--') + '</td>' +
          '<td class="py-2 px-3"><input type="number" value="' + (c.costLine || 0) + '" data-symbol="' + FTApp.escapeHtml(c.symbol) + '" class="cost-input ' + CELL_INPUT + '" style="width:84px"></td>' +
          '<td class="py-2 px-3">' + statusBadge(c.status) + '</td>' +
          '<td class="py-2 px-3"><button onclick="FTRender.removePoolRow(\'' + FTApp.escapeHtml(c.symbol) + '\')" class="text-error text-xs hover:underline">删除</button></td>' +
          '</tr>';
      });
      body.innerHTML = html;
      ensureContractList();
    },

    // ============ 2. addPoolRow：历史按钮别名，转发到品种选择器 ============
    addPoolRow: function () { return this.openVarietyPicker(); },

    // ============ 3. 品种选择器（动态构建模态框） ============
    openVarietyPicker: function () {
      var existing = el('varietyPickerModal');
      if (existing) existing.remove();
      var exchangeOrder = ['SHFE', 'DCE', 'CZCE', 'GFEX', 'CFFEX'];
      var exchangeNameMap = {
        'SHFE': '上海期货交易所', 'DCE': '大连商品交易所', 'CZCE': '郑州商品交易所',
        'GFEX': '广州期货交易所', 'CFFEX': '中国金融期货交易所'
      };
      var opts = '<option value="">-- 选择品种 --</option>';
      exchangeOrder.forEach(function (ex) {
        var items = FTApp.EXCHANGE_VARIETIES.filter(function (v) { return v.exchange === ex; });
        if (!items.length) return;
        opts += '<optgroup label="' + exchangeNameMap[ex] + '">';
        items.forEach(function (v) {
          opts += '<option value="' + FTApp.escapeHtml(v.symbol) + '">' + FTApp.escapeHtml(v.symbol) + '（' + v.category + '）</option>';
        });
        opts += '</optgroup>';
      });
      var modal = document.createElement('div');
      modal.id = 'varietyPickerModal';
      modal.className = 'modal-overlay show';
      modal.innerHTML =
        '<div class="modal">' +
          '<h3>添加品种</h3>' +
          '<div class="form-group"><label>选择品种</label><select id="vpSelect">' + opts + '</select></div>' +
          '<div class="form-group"><label>自定义品种名（兜底）</label><input type="text" id="vpCustomName" placeholder="列表中找不到时填写"></div>' +
          '<div class="form-group"><label>自定义合约代码（可选，默认主力）</label><input type="text" id="vpCustomContract" placeholder="如 RB2509"></div>' +
          '<div class="form-actions">' +
            '<button class="bg-surface-elevated text-ink-secondary px-4 py-2 rounded-sm text-sm font-medium border border-edge-subtle hover:bg-surface-hover transition-colors" onclick="FTRender.closeVarietyPicker()">取消</button>' +
            '<button class="bg-brand-500 text-brand-50 px-4 py-2 rounded-sm text-sm font-medium hover:bg-brand-600 transition-colors" onclick="FTRender.confirmAddVariety()">添加</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(modal);
    },

    // 关闭品种选择器
    closeVarietyPicker: function () {
      var m = el('varietyPickerModal');
      if (m) m.remove();
    },

    // 确认添加品种
    confirmAddVariety: function () {
      var sel = el('vpSelect');
      var customName = (el('vpCustomName') || {}).value || '';
      customName = customName.trim();
      var customContract = (el('vpCustomContract') || {}).value || '';
      customContract = customContract.trim();
      var entry = null;
      if (sel && sel.value) {
        var meta = FTApp.findVarietyMeta(sel.value);
        if (meta) {
          // 如果用户填了自定义合约，验证格式
          if (customContract) {
            var v = FTApp.validateContract(customContract, meta.symbol);
            if (!v.valid) { FTApp.showToast(v.warning); return; }
            if (v.warning) { FTApp.showToast(v.warning); } // 过期警告但允许添加
          }
          entry = {
            symbol: meta.symbol, contractCode: customContract || meta.defaultContract, multiplier: meta.multiplier,
            marginRate: meta.marginRate, price: 0, percentile: 0, costLine: 0, status: 'bottom',
            category: meta.category, exchange: meta.exchange
          };
        }
      } else if (customName) {
        // 自定义品种：验证合约（如果有）
        if (customContract) {
          var v2 = FTApp.validateContract(customContract, customName);
          if (!v2.valid) { FTApp.showToast(v2.warning); return; }
          if (v2.warning) { FTApp.showToast(v2.warning); }
        }
        entry = {
          symbol: customName, contractCode: customContract || '0', multiplier: 10, marginRate: 0.08,
          price: 0, percentile: 0, costLine: 0, status: 'bottom', category: '能源化工', exchange: ''
        };
      } else {
        FTApp.showToast('请选择或输入品种');
        return;
      }
      if (FTApp.state.pool.some(function (c) { return c.symbol === entry.symbol; })) {
        FTApp.showToast('该品种已在观察池中');
        return;
      }
      FTApp.state.pool.push(entry);
      FTApp.saveState();
      this.renderPool();
      this.closeVarietyPicker();
      FTApp.showToast('已添加 ' + entry.symbol);
    },

    // ============ 4. 删除观察池行 ============
    removePoolRow: function (symbol) {
      FTApp.state.pool = FTApp.state.pool.filter(function (c) { return c.symbol !== symbol; });
      FTApp.saveState();
      this.renderPool();
      FTApp.showToast('已删除 ' + symbol);
    },

    // ============ 5. 保存观察池（回写表格内输入 + 合约验证） ============
    savePool: function () {
      var body = el('poolBody');
      if (!body) return;
      var findBySym = function (sym) { return FTApp.state.pool.find(function (x) { return x.symbol === sym; }); };
      var warnings = [];
      body.querySelectorAll('.contract-input').forEach(function (inp) {
        var c = findBySym(inp.dataset.symbol);
        if (c) {
          var newCode = inp.value.trim();
          // 合约纠错
          if (newCode) {
            var v = FTApp.validateContract(newCode, c.symbol);
            if (!v.valid) {
              FTApp.showToast(c.symbol + ': ' + v.warning);
              inp.style.borderColor = '#ef4444';
              return;
            }
            if (v.warning) {
              warnings.push(c.symbol + ': ' + v.warning);
              inp.style.borderColor = '#fdd835';
            } else {
              inp.style.borderColor = '';
            }
          }
          c.contractCode = newCode;
        }
      });
      body.querySelectorAll('.mult-input').forEach(function (inp) {
        var c = findBySym(inp.dataset.symbol); if (c) c.multiplier = +inp.value || c.multiplier;
      });
      body.querySelectorAll('.margin-input').forEach(function (inp) {
        var c = findBySym(inp.dataset.symbol); if (c) c.marginRate = +inp.value || c.marginRate;
      });
      body.querySelectorAll('.cost-input').forEach(function (inp) {
        var c = findBySym(inp.dataset.symbol); if (c) c.costLine = +inp.value || 0;
      });
      FTApp.saveState();
      if (warnings.length) {
        FTApp.showToast('已保存，' + warnings.length + ' 个合约有警告（见输入框边框）');
        console.log('[FT] 合约警告:', warnings);
      } else {
        FTApp.showToast('观察池已保存');
      }
    },

    // ============ 6. 加载基本面评分表 ============
    loadFundamental: function () {
      var sel = el('fundSpeciesSelect');
      var sym = sel ? sel.value : '';
      var dims = [
        ['fundSupply', 'fundSupplyNote', 'supply'],
        ['fundInventory', 'fundInventoryNote', 'inventory'],
        ['fundBasis', 'fundBasisNote', 'basis'],
        ['fundMacro', 'fundMacroNote', 'macro'],
        ['fundTechnical', 'fundTechnicalNote', 'technical']
      ];
      var fund = sym ? (FTApp.state.fundamentals[sym] || {}) : {};
      dims.forEach(function (d) {
        var sInp = el(d[0]), nInp = el(d[1]);
        if (!sInp) return;
        var data = fund[d[2]] || {};
        var score = (data.score != null) ? data.score : 5;
        sInp.value = score;
        if (sInp.nextElementSibling) sInp.nextElementSibling.textContent = score;
        if (nInp) nInp.value = data.note || '';
      });
      this.updateFundTotal();
      this.renderExternalFundSignal();
    },

    // 计算并更新综合评分
    updateFundTotal: function () {
      var ids = ['fundSupply', 'fundInventory', 'fundBasis', 'fundMacro', 'fundTechnical'];
      var sum = 0;
      ids.forEach(function (id) { var i = el(id); if (i) sum += (+i.value || 0); });
      var tot = el('fundTotalScore');
      if (tot) tot.textContent = sum + ' / 50';
      var bar = el('fundScoreBar');
      if (bar) bar.style.width = (sum / 50 * 100) + '%';
    },

    // ============ 7. 保存基本面评分 ============
    saveFundamental: function () {
      var sel = el('fundSpeciesSelect');
      if (!sel || !sel.value) { FTApp.showToast('请先选择品种'); return; }
      var sym = sel.value;
      var get = function (id) { var i = el(id); return i ? (+i.value || 0) : 0; };
      var getn = function (id) { var i = el(id); return i ? i.value : ''; };
      FTApp.state.fundamentals[sym] = {
        supply:    { score: get('fundSupply'),    note: getn('fundSupplyNote') },
        inventory: { score: get('fundInventory'), note: getn('fundInventoryNote') },
        basis:     { score: get('fundBasis'),     note: getn('fundBasisNote') },
        macro:     { score: get('fundMacro'),     note: getn('fundMacroNote') },
        technical: { score: get('fundTechnical'), note: getn('fundTechnicalNote') }
      };
      FTApp.saveState();
      FTApp.showToast('评分已保存');
    },

    // ============ 8. 三因子信号矩阵 ============
    refreshSignals: function () {
      var body = el('signalBody');
      if (!body) return;
      var pool = FTApp.state.pool || [];
      if (!pool.length) {
        body.innerHTML = '<tr><td colspan="6" class="empty-state">观察池为空，请先在观察池添加品种</td></tr>';
        return;
      }
      var html = '';
      pool.forEach(function (c) {
        var p = c.percentile || 0;
        var valLight = p <= 25 ? 'green' : (p <= 50 ? 'yellow' : 'red');
        var fundLight = FTApp.isSweetSignal(c.symbol) ? 'green' : 'yellow';
        var rate, rateLight;
        if (valLight === 'green' && fundLight === 'green') { rate = '买入'; rateLight = 'green'; }
        else if (valLight === 'red') { rate = '回避'; rateLight = 'red'; }
        else { rate = '观望'; rateLight = 'yellow'; }
        var rateCls = rateLight === 'green' ? 'text-success' : (rateLight === 'red' ? 'text-error' : 'text-ink-muted');
        var detail = '估值分位 ' + p + '%，基本面' + (fundLight === 'green' ? '甜点' : '一般');
        html += '<tr>' +
          '<td class="py-2 px-4 text-ink">' + FTApp.escapeHtml(c.symbol) + '</td>' +
          '<td class="py-2 px-4"><span class="signal-light signal-' + valLight + '"></span></td>' +
          '<td class="py-2 px-4"><span class="signal-light signal-yellow"></span></td>' +
          '<td class="py-2 px-4"><span class="signal-light signal-' + fundLight + '"></span></td>' +
          '<td class="py-2 px-4"><span class="px-2 py-0.5 rounded text-xs font-medium ' + rateCls + '">' + rate + '</span></td>' +
          '<td class="py-2 px-4 text-xs text-ink-dim">' + FTApp.escapeHtml(detail) + '</td>' +
          '</tr>';
      });
      body.innerHTML = html;
    },

    // ============ 9. 持仓 / 已平仓渲染 ============
    renderTrades: function () {
      var pBody = el('positionBody');
      var cBody = el('closedBody');
      var trades = FTApp.state.trades || [];
      var closed = FTApp.state.closedTrades || [];

      if (pBody) {
        if (!trades.length) {
          pBody.innerHTML = '';
        } else {
          var h = '';
          trades.forEach(function (t, idx) {
            var c = FTApp.state.pool.find(function (x) { return x.symbol === t.symbol; });
            var cur = c && c.price ? c.price : t.price;
            var pnl = (t.dir === 'long' ? (cur - t.price) : (t.price - cur)) * t.multiplier * t.lots;
            var margin = t.price * t.multiplier * t.lots * (c ? (c.marginRate || 0.1) : 0.1);
            var pnlCls = pnl >= 0 ? 'text-success' : 'text-error';
            h += '<tr>' +
              '<td class="py-2 px-3 text-ink">' + FTApp.escapeHtml(t.symbol) + '</td>' +
              '<td class="py-2 px-3 ' + (t.dir === 'long' ? 'text-success' : 'text-error') + '">' + (t.dir === 'long' ? '多' : '空') + '</td>' +
              '<td class="py-2 px-3 font-mono">' + t.lots + '</td>' +
              '<td class="py-2 px-3 font-mono">' + (+t.price).toFixed(2) + '</td>' +
              '<td class="py-2 px-3 font-mono">' + (cur ? cur.toFixed(2) : '--') + '</td>' +
              '<td class="py-2 px-3 font-mono ' + pnlCls + '">' + (pnl >= 0 ? '+' : '') + pnl.toFixed(0) + '</td>' +
              '<td class="py-2 px-3 font-mono text-ink-muted">' + margin.toFixed(0) + '</td>' +
              '<td class="py-2 px-3"><button onclick="FTRender.closeTrade(' + idx + ')" class="text-brand-500 text-xs hover:underline">平仓</button></td>' +
              '</tr>';
          });
          pBody.innerHTML = h;
        }
        var pe = el('positionEmpty'); if (pe) pe.style.display = trades.length ? 'none' : '';
      }

      if (cBody) {
        if (!closed.length) {
          cBody.innerHTML = '';
        } else {
          var ch = '';
          closed.forEach(function (t) {
            var pnl = t.pnl || 0;
            var pnlCls = pnl >= 0 ? 'text-success' : 'text-error';
            ch += '<tr>' +
              '<td class="py-2 px-3 text-ink">' + FTApp.escapeHtml(t.symbol) + '</td>' +
              '<td class="py-2 px-3 ' + (t.dir === 'long' ? 'text-success' : 'text-error') + '">' + (t.dir === 'long' ? '多' : '空') + '</td>' +
              '<td class="py-2 px-3 font-mono">' + t.lots + '</td>' +
              '<td class="py-2 px-3 font-mono">' + (+t.price).toFixed(2) + '</td>' +
              '<td class="py-2 px-3 font-mono">' + (+t.closePrice).toFixed(2) + '</td>' +
              '<td class="py-2 px-3 font-mono ' + pnlCls + '">' + (pnl >= 0 ? '+' : '') + pnl.toFixed(0) + '</td>' +
              '<td class="py-2 px-3 text-xs text-ink-dim">' + FTApp.escapeHtml(t.closeTime || '') + '</td>' +
              '<td class="py-2 px-3 text-xs text-ink-muted">' + FTApp.escapeHtml(t.closeReason || '手动平仓') + '</td>' +
              '</tr>';
          });
          cBody.innerHTML = ch;
        }
        var ce = el('closedEmpty'); if (ce) ce.style.display = closed.length ? 'none' : '';
      }

      this.updateTradeSummary();
    },

    // 同步交易页账户汇总卡片
    updateTradeSummary: function () {
      var eq = FTApp.getCurrentEquity();
      var margin = 0, unrealized = 0;
      (FTApp.state.trades || []).forEach(function (t) {
        var c = FTApp.state.pool.find(function (x) { return x.symbol === t.symbol; });
        var cur = c && c.price ? c.price : t.price;
        margin += t.price * t.multiplier * t.lots * (c ? (c.marginRate || 0.1) : 0.1);
        var p = (t.dir === 'long' ? (cur - t.price) : (t.price - cur));
        unrealized += p * t.multiplier * t.lots - (t.openCommission || 0);
      });
      var set = function (id, v) { var e = el(id); if (e) e.textContent = v; };
      set('tradeEquity', eq.toLocaleString('zh-CN', { maximumFractionDigits: 0 }));
      set('tradeMargin', margin.toLocaleString('zh-CN', { maximumFractionDigits: 0 }));
      set('tradeAvailable', (eq - margin).toLocaleString('zh-CN', { maximumFractionDigits: 0 }));
      var pnlEl = el('tradePnl');
      if (pnlEl) {
        pnlEl.textContent = (unrealized >= 0 ? '+' : '') + unrealized.toFixed(0);
        pnlEl.className = 'font-mono text-lg font-medium ' + (unrealized >= 0 ? 'text-success' : 'text-error');
      }
    },

    // ============ 平仓（行内按钮，按现价直接平仓） ============
    closeTrade: function (index) {
      var trades = FTApp.state.trades || [];
      var t = trades[index];
      if (!t) return;
      var c = FTApp.state.pool.find(function (x) { return x.symbol === t.symbol; });
      var cur = c && c.price ? c.price : t.price;
      var pnl = (t.dir === 'long' ? (cur - t.price) : (t.price - cur)) * t.multiplier * t.lots - (t.openCommission || 0);
      var closedRec = Object.assign({}, t, {
        closeTime: new Date().toISOString().slice(0, 10),
        closePrice: cur,
        pnl: pnl,
        closeReason: '手动平仓'
      });
      FTApp.state.closedTrades.push(closedRec);
      FTApp.state.trades.splice(index, 1);
      FTApp.saveState();
      this.renderTrades();
      FTApp.showToast('已平仓 ' + t.symbol + '，盈亏 ' + (pnl >= 0 ? '+' : '') + pnl.toFixed(0));
    },

    // ============ 10. 打开开仓模态框 ============
    openTradeModal: function () {
      var modal = el('tradeModal');
      if (!modal) return;
      var sel = el('tradeSpecies');
      if (sel) {
        var opts = '<option value="">-- 选择品种 --</option>';
        (FTApp.state.pool || []).forEach(function (c) {
          opts += '<option value="' + FTApp.escapeHtml(c.symbol) + '">' + FTApp.escapeHtml(c.symbol) + '</option>';
        });
        sel.innerHTML = opts;
        if (FTApp.state.pool && FTApp.state.pool.length) sel.value = FTApp.state.pool[0].symbol;
      }
      var dir = el('tradeDirection'); if (dir) dir.value = 'long';
      var lots = el('tradeLots'); if (lots) lots.value = 1;
      var price = el('tradePrice');
      if (price) {
        var first = FTApp.state.pool && FTApp.state.pool[0];
        price.value = first && first.price ? first.price : '';
      }
      ['tradeStopLoss', 'tradeTakeProfit'].forEach(function (id) { var e = el(id); if (e) e.value = ''; });
      var reason = el('tradeReason'); if (reason) reason.value = '';
      FTApp.openModal('tradeModal');
    },

    // 开仓 / 平仓 / 换月模态框关闭（HTML 取消按钮回调）
    closeTradeModal: function () { FTApp.closeModal('tradeModal'); },
    closeCloseModal: function () { FTApp.closeModal('closeModal'); },
    closeRolloverModal: function () { FTApp.closeModal('rolloverModal'); },

    // ============ 11. 交易日志渲染 ============
    renderJournal: function () {
      var tl = el('journalTimeline');
      var empty = el('journalEmpty');
      var items = FTApp.state.journal || [];
      if (empty) empty.style.display = items.length ? 'none' : '';
      if (!tl) return;
      if (!items.length) { tl.innerHTML = ''; return; }
      var moodMap = { positive: '积极', neutral: '中性', cautious: '谨慎', negative: '消极' };
      var typeMap = { trade: '交易记录', signal: '信号触发', note: '市场观察', risk: '风控事件' };
      var html = '';
      items.forEach(function (j) {
        var type = j.type || 'note';
        var typeLabel = typeMap[type] || '日志';
        var mood = moodMap[j.mood] || j.mood || '';
        html += '<div class="timeline-item">' +
          '<div class="timeline-date">' + FTApp.escapeHtml(j.date || '') + ' · ' + FTApp.escapeHtml(j.symbol || '') + ' · ' + FTApp.escapeHtml(mood) + '</div>' +
          '<div class="timeline-content">' +
            '<span class="timeline-tag ' + FTApp.escapeHtml(type) + '">' + FTApp.escapeHtml(typeLabel) + '</span> ' +
            '<strong>' + FTApp.escapeHtml(j.title || '') + '</strong>' +
            '<div style="margin-top:6px;white-space:pre-wrap">' + FTApp.escapeHtml(j.content || '') + '</div>' +
            (j.lesson ? '<div style="margin-top:6px;font-size:12px;color:#908e84">💡 ' + FTApp.escapeHtml(j.lesson) + '</div>' : '') +
          '</div>' +
        '</div>';
      });
      tl.innerHTML = html;
    },

    // ============ 12. 打开日志模态框 / 保存日志 ============
    openJournalModal: function () {
      var modal = el('journalModal');
      if (!modal) return;
      var sel = el('journalSpecies');
      if (sel) {
        var opts = '<option value="">-- 无 --</option>';
        (FTApp.state.pool || []).forEach(function (c) {
          opts += '<option value="' + FTApp.escapeHtml(c.symbol) + '">' + FTApp.escapeHtml(c.symbol) + '</option>';
        });
        sel.innerHTML = opts;
      }
      var t = el('journalType'); if (t) t.value = 'trade';
      var m = el('journalMood'); if (m) m.value = 'neutral';
      ['journalTitle', 'journalContent', 'journalLesson'].forEach(function (id) { var e = el(id); if (e) e.value = ''; });
      // 注：HTML 无 journalDate 字段；保存时取当天日期写入条目。
      FTApp.openModal('journalModal');
    },

    saveJournal: function () {
      var type = (el('journalType') || {}).value || 'note';
      var symbol = (el('journalSpecies') || {}).value || '';
      var title = (el('journalTitle') || {}).value || '';
      var content = (el('journalContent') || {}).value || '';
      var mood = (el('journalMood') || {}).value || 'neutral';
      var lesson = (el('journalLesson') || {}).value || '';
      if (!title && !content) { FTApp.showToast('请填写标题或内容'); return; }
      var entry = {
        date: new Date().toISOString().slice(0, 10),
        symbol: symbol, title: title, content: content, mood: mood,
        type: type, lesson: lesson
      };
      FTApp.state.journal.unshift(entry); // 最新在前
      FTApp.saveState();
      FTApp.closeModal('journalModal');
      this.renderJournal();
      FTApp.showToast('日志已保存');
    },

    closeJournalModal: function () { FTApp.closeModal('journalModal'); },

    // ============ 13. 仪表盘渲染 ============
    renderDashboard: function () {
      var eq = FTApp.getCurrentEquity();
      var realized = FTApp.getRealizedEquity();
      var initEq = FTApp.state.settings.initEquity;
      var target = FTApp.state.settings.target;
      var closed = FTApp.state.closedTrades || [];

      // 浮动盈亏
      var unrealized = 0;
      (FTApp.state.trades || []).forEach(function (t) {
        var c = FTApp.state.pool.find(function (x) { return x.symbol === t.symbol; });
        var cur = c && c.price ? c.price : t.price;
        unrealized += (t.dir === 'long' ? (cur - t.price) : (t.price - cur)) * t.multiplier * t.lots - (t.openCommission || 0);
      });

      var set = function (id, v) { var e = el(id); if (e) e.textContent = v; };
      set('dashEquity', eq.toLocaleString('zh-CN', { maximumFractionDigits: 0 }));
      var ret = initEq ? ((eq - initEq) / initEq * 100) : 0;
      var retEl = el('dashReturn');
      if (retEl) {
        retEl.textContent = (ret >= 0 ? '+' : '') + ret.toFixed(1) + '%';
        retEl.className = 'font-mono text-lg font-medium ' + (ret >= 0 ? 'text-success' : 'text-error');
      }
      set('dashRealizedPnl', (realized - initEq).toLocaleString('zh-CN', { maximumFractionDigits: 0 }));
      var unEl = el('dashUnrealizedPnl');
      if (unEl) {
        unEl.textContent = (unrealized >= 0 ? '+' : '') + unrealized.toFixed(0);
        unEl.className = 'font-mono text-lg font-medium ' + (unrealized >= 0 ? 'text-success' : 'text-error');
      }
      var wins = closed.filter(function (t) { return (t.pnl || 0) > 0; }).length;
      var winRate = closed.length ? (wins / closed.length * 100) : 0;
      set('dashWinRate', closed.length ? winRate.toFixed(0) + '%' : '--');
      var grossWin = closed.filter(function (t) { return (t.pnl || 0) > 0; }).reduce(function (s, t) { return s + t.pnl; }, 0);
      var grossLoss = Math.abs(closed.filter(function (t) { return (t.pnl || 0) < 0; }).reduce(function (s, t) { return s + t.pnl; }, 0));
      set('dashProfitFactor', grossLoss ? (grossWin / grossLoss).toFixed(2) : (grossWin ? '∞' : '--'));

      // 目标进度
      set('dashCurrentEq', eq.toLocaleString('zh-CN', { maximumFractionDigits: 0 }));
      set('dashTargetEq', target.toLocaleString('zh-CN'));
      var pct = target ? Math.min(100, eq / target * 100) : 0;
      var bar = el('dashProgressBar');
      if (bar) { bar.style.width = pct.toFixed(1) + '%'; bar.textContent = pct.toFixed(1) + '%'; }
      set('dashRemaining', Math.max(0, target - eq).toLocaleString('zh-CN', { maximumFractionDigits: 0 }));

      this.renderEquityChart();
      this.renderRolloverHistory();
    },

    // 资金曲线（原生 canvas 2D，无第三方库）
    renderEquityChart: function () {
      var cv = el('equityChart');
      if (!cv) return;
      var ctx = cv.getContext && cv.getContext('2d');
      if (!ctx) return;
      var W = cv.offsetWidth || 600;
      var H = cv.offsetHeight || 250;
      cv.width = W; cv.height = H;
      ctx.clearRect(0, 0, W, H);
      var hist = FTApp.state.equityHistory || [];
      if (hist.length < 2) {
        ctx.fillStyle = '#908e84';
        ctx.font = '13px Poppins, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('资金曲线数据不足', W / 2, H / 2);
        return;
      }
      var vals = hist.map(function (h) { return h.equity; });
      var min = Math.min.apply(null, vals);
      var max = Math.max.apply(null, vals);
      if (min === max) { min -= 1; max += 1; }
      var pad = 36;
      var xStep = (W - pad * 2) / (hist.length - 1);
      // 基线
      ctx.strokeStyle = '#3e3e38'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad, H - pad); ctx.lineTo(W - pad, H - pad); ctx.stroke();
      // 折线
      ctx.strokeStyle = '#d97757'; ctx.lineWidth = 2; ctx.beginPath();
      hist.forEach(function (h, i) {
        var x = pad + i * xStep;
        var y = (H - pad) - ((h.equity - min) / (max - min)) * (H - pad * 2);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      // 渐变填充
      ctx.lineTo(pad + (hist.length - 1) * xStep, H - pad);
      ctx.lineTo(pad, H - pad);
      ctx.closePath();
      ctx.fillStyle = 'rgba(217,119,87,0.12)';
      ctx.fill();
      // 极值标签
      ctx.fillStyle = '#908e84';
      ctx.font = '11px "Geist Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(max.toFixed(0), 2, 12);
      ctx.fillText(min.toFixed(0), 2, H - pad + 14);
    },

    // 移仓换月记录表
    renderRolloverHistory: function () {
      var body = el('rolloverBody');
      if (!body) return;
      var empty = el('rolloverEmpty');
      var rows = FTApp.state.rolloverHistory || [];
      if (empty) empty.style.display = rows.length ? 'none' : '';
      if (!rows.length) { body.innerHTML = ''; return; }
      var h = '';
      rows.forEach(function (r) {
        h += '<tr>' +
          '<td class="py-2 px-3 text-xs text-ink-dim">' + FTApp.escapeHtml(r.date || '') + '</td>' +
          '<td class="py-2 px-3 text-ink">' + FTApp.escapeHtml(r.symbol || '') + '</td>' +
          '<td class="py-2 px-3 font-mono text-xs">' + FTApp.escapeHtml(r.oldContract || '') + '</td>' +
          '<td class="py-2 px-3 font-mono text-xs">' + FTApp.escapeHtml(r.newContract || '') + '</td>' +
          '<td class="py-2 px-3 font-mono text-xs">' + (r.spread || 0).toFixed(0) + '</td>' +
          '<td class="py-2 px-3 text-xs text-ink-muted">' + FTApp.escapeHtml(r.note || '') + '</td>' +
          '</tr>';
      });
      body.innerHTML = h;
    },

    // ============ 14. 加载外部基本面日报 JSON ============
    loadFundamentalFeed: async function () {
      try {
        var resp = await fetch('../shared/fundamental-feed.json');
        if (!resp.ok) throw new Error('http ' + resp.status);
        var data = await resp.json();
        window.__fundFeed = data;
        return data;
      } catch (e) {
        window.__fundFeed = null;
        FTApp.showToast('外部数据加载失败');
        return null;
      }
    },

    // ============ 15. 渲染外部基本面信号面板 ============
    renderExternalFundSignal: function () {
      var panel = el('externalFundPanel');
      var sel = el('fundSpeciesSelect');
      // 无容器或无选择则跳过
      if (!panel) return;
      var sym = sel ? sel.value : '';
      if (!sym) { panel.innerHTML = ''; return; }
      var feed = window.__fundFeed;
      if (!feed || !feed.records || !feed.records.length) {
        panel.innerHTML = '<div class="info-box">外部数据加载中或不可用</div>';
        return;
      }
      var record = feed.records[0];
      var feishuName = (FTApp.PROJECT_TO_FEISHU_MAP && FTApp.PROJECT_TO_FEISHU_MAP[sym]) || sym;
      var v = record.varieties && record.varieties[feishuName];
      if (!v) {
        panel.innerHTML = '<div class="info-box">该品种暂无外部日报数据</div>';
        return;
      }
      // 档位徽章颜色映射
      var levelColors = { '加仓': '#8ca06f', '底仓': '#d97757', '不动': '#908e84', '警惕拥挤': '#ef4444' };
      var lvlColor = levelColors[v.level] || '#908e84';
      // 变化箭头
      var ch = v.change;
      var changeHtml;
      if (ch == null || ch === 0) {
        changeHtml = '<span style="color:#908e84">→0.0</span>';
      } else if (ch > 0) {
        changeHtml = '<span style="color:#8ca06f">↑' + ch.toFixed(1) + '</span>';
      } else {
        changeHtml = '<span style="color:#ef4444">↓' + Math.abs(ch).toFixed(1) + '</span>';
      }
      // 从 fullReport 提取该品种段落
      var excerpt = '';
      try {
        var re = new RegExp('【' + feishuName + '】([\\s\\S]*?)(?=\\n【|\\n━━|$)');
        var m = record.fullReport ? record.fullReport.match(re) : null;
        if (m) excerpt = m[1].trim();
      } catch (e) { excerpt = ''; }

      var html = '<div style="font-family:Lora,Georgia,serif;color:#d8d6cd;font-size:14px;margin-bottom:8px">外部基本面信号（每日日报 · ' +
        FTApp.escapeHtml(record.date || '') + ' ' + FTApp.escapeHtml(record.weekday || '') + '）</div>';
      html += '<div style="margin-bottom:6px">' +
        '<span class="level-badge" style="display:inline-block;padding:2px 10px;border-radius:4px;font-size:12px;font-weight:600;background:' + lvlColor + '22;color:' + lvlColor + ';border:1px solid ' + lvlColor + '">' + FTApp.escapeHtml(v.level || '') + '</span> ' +
        '<span style="margin-left:10px;font-family:\'Geist Mono\',monospace;color:#faf9f5">分数 ' + (v.score != null ? v.score.toFixed(1) : '--') + '</span> ' +
        '<span style="margin-left:10px;font-family:\'Geist Mono\',monospace">' + changeHtml + '</span>' +
        '</div>';
      if (record.summary) {
        html += '<div style="font-size:12px;color:#b7b5a9;margin-bottom:6px">今日概况：' + FTApp.escapeHtml(record.summary) + '</div>';
      }
      if (record.anomalyAlert && record.anomalyAlert !== '无') {
        html += '<div class="alert-box" style="font-size:12px">⚠ ' + FTApp.escapeHtml(record.anomalyAlert) + '</div>';
      }
      if (excerpt) {
        html += '<pre style="white-space:pre-wrap;background:#262624;border:1px solid #3e3e38;border-radius:8px;padding:10px;font-size:11px;color:#b7b5a9;font-family:\'Geist Mono\',monospace;max-height:260px;overflow:auto;margin-top:6px">' + FTApp.escapeHtml(excerpt) + '</pre>';
      }
      panel.innerHTML = html;
    }
  };

  // 暴露到全局
  window.FTRender = FTRender;

  // ============ 补齐 FTTrade（trade-engine.js 为 stub，确保 HTML 按钮可用） ============
  window.FTTrade = window.FTTrade || {};

  // 确认开仓（#tradeModal 提交按钮调用）
  window.FTTrade.openPosition = function () {
    var sel = el('tradeSpecies');
    var sym = sel ? sel.value : '';
    if (!sym) { FTApp.showToast('请选择品种'); return; }
    var dir = ((el('tradeDirection') || {}).value) || 'long';
    var lots = +((el('tradeLots') || {}).value) || 1;
    var meta = FTApp.findVarietyMeta(sym) || {};
    var c = FTApp.state.pool.find(function (x) { return x.symbol === sym; });
    var price = +((el('tradePrice') || {}).value);
    if (!price || isNaN(price)) price = c && c.price ? c.price : 0;
    var multiplier = meta.multiplier || (c ? c.multiplier : 10) || 10;
    var trade = {
      symbol: sym, dir: dir, lots: lots, price: price, multiplier: multiplier,
      openTime: new Date().toISOString().slice(0, 10), openCommission: 0
    };
    FTApp.state.trades.push(trade);
    FTApp.saveState();
    FTApp.closeModal('tradeModal');
    if (window.FTRender && FTRender.renderTrades) FTRender.renderTrades();
    FTApp.showToast('已开仓 ' + sym);
  };

  // 确认平仓（#closeModal 提交按钮调用）
  window.FTTrade.closePosition = function () {
    var sym = ((el('closeSpecies') || {}).value) || '';
    if (!sym) { FTApp.showToast('未选择品种'); return; }
    var c = FTApp.state.pool.find(function (x) { return x.symbol === sym; });
    var price = +((el('closePrice') || {}).value);
    if (!price || isNaN(price)) price = c && c.price ? c.price : 0;
    var lots = +((el('closeLots') || {}).value) || 1;
    var reason = ((el('closeReason') || {}).value) || '手动平仓';
    var idx = FTApp.state.trades.findIndex(function (t) { return t.symbol === sym; });
    if (idx < 0) { FTApp.showToast('未找到该品种持仓'); return; }
    var t = FTApp.state.trades[idx];
    var closeLots = Math.min(lots, t.lots);
    var pnl = (t.dir === 'long' ? (price - t.price) : (t.price - price)) * t.multiplier * closeLots - (t.openCommission || 0);
    var closedRec = Object.assign({}, t, {
      lots: closeLots,
      closeTime: new Date().toISOString().slice(0, 10),
      closePrice: price, pnl: pnl, closeReason: reason
    });
    FTApp.state.closedTrades.push(closedRec);
    if (t.lots - closeLots > 0) { t.lots = t.lots - closeLots; }
    else { FTApp.state.trades.splice(idx, 1); }
    FTApp.saveState();
    FTApp.closeModal('closeModal');
    if (window.FTRender && FTRender.renderTrades) FTRender.renderTrades();
    FTApp.showToast('已平仓 ' + sym);
  };

  // 确认移仓换月（#rolloverModal 提交按钮调用）
  window.FTTrade.executeRollover = function () {
    var oldC = ((el('rolloverOldContract') || {}).value) || '';
    var newC = ((el('rolloverNewContract') || {}).value) || '';
    var newP = +((el('rolloverNewPrice') || {}).value) || 0;
    var note = ((el('rolloverNote') || {}).value) || '';
    if (!newC) { FTApp.showToast('请输入新合约'); return; }
    var c = FTApp.state.pool.find(function (x) { return x.contractCode === oldC; }) || (FTApp.state.pool[0] || { symbol: '' });
    var spread = newP && c.price ? (newP - c.price) : 0;
    FTApp.state.rolloverHistory.push({
      date: new Date().toISOString().slice(0, 10),
      symbol: c.symbol || '', oldContract: oldC, newContract: newC, spread: spread, note: note
    });
    FTApp.saveState();
    FTApp.closeModal('rolloverModal');
    if (window.FTRender && FTRender.renderDashboard) FTRender.renderDashboard();
    FTApp.showToast('已记录移仓换月');
  };
})();
