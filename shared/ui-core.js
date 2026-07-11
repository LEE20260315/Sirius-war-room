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
  // 动态生成当前及未来远月候选，避免出现过期合约
  function ensureContractList() {
    var dl = el('contractList');
    if (!dl) {
      dl = document.createElement('datalist');
      dl.id = 'contractList';
      document.body.appendChild(dl);
    }
    var now = new Date();
    var curY = now.getFullYear();
    var curM = now.getMonth() + 1;
    var opts = '';
    FTApp.EXCHANGE_VARIETIES.forEach(function (v) {
      // 主力合约（EXCHANGE_VARIETIES 配置的真实月份）
      opts += '<option value="' + FTApp.escapeHtml(v.defaultContract) + '">' + FTApp.escapeHtml(v.symbol) + ' 主力</option>';
      // 动态生成未来 6 个常见交割月候选（1/5/9 月为主，CZCE 用3位格式，其他用4位）
      var isCZCE = v.exchange === 'CZCE';
      var months = [9, 10, 11, 12, 1, 3, 5];
      var y = curY, m = curM;
      var count = 0;
      for (var i = 0; i < 24 && count < 5; i++) {
        m++;
        if (m > 12) { m = 1; y++; }
        if ([1,5,9,10].indexOf(m) >= 0) {
          var yPart4 = String(y).slice(2);          // 4位格式 '26'
          var yPart3 = String(y).slice(3);           // CZCE 3位格式 '6'
          var mPart = (m < 10 ? '0' : '') + m;
          var cc = isCZCE ? (v.code + yPart3 + mPart) : (v.code + yPart4 + mPart);
          if (cc !== v.defaultContract) {
            opts += '<option value="' + FTApp.escapeHtml(cc) + '">' + FTApp.escapeHtml(v.symbol) + ' ' + (isCZCE ? yPart3 + mPart : yPart4 + mPart) + '</option>';
          }
          count++;
        }
      }
    });
    dl.innerHTML = opts;
  }

  // 分位%单元格：数值 + mini-bar（颜色：≤25绿/≤50黄/≤75橙/>75红）
  function renderPercentileCell(pct) {
    if (pct == null || pct === 0) return '<span class="text-ink-muted">--</span>';
    var color = pct <= 25 ? '#8ca06f' : (pct <= 50 ? '#d4b656' : (pct <= 75 ? '#e08d6f' : '#ef4444'));
    return '<div style="display:flex;align-items:center;gap:4px">' +
      '<span class="font-mono text-xs" style="color:' + color + ';min-width:24px">' + pct + '</span>' +
      '<div style="width:40px;height:6px;background:#2a2823;border-radius:3px;overflow:hidden">' +
        '<div style="width:' + pct + '%;height:100%;background:' + color + '"></div>' +
      '</div>' +
    '</div>';
  }

  // 价差单元格：price-costLine，正绿负红
  function renderDiffCell(price, costLine) {
    if (!price || price <= 0 || !costLine || costLine <= 0) return '<span class="text-ink-muted">--</span>';
    var diff = price - costLine;
    var color = diff >= 0 ? '#8ca06f' : '#ef4444';
    var sign = diff >= 0 ? '+' : '';
    return '<span class="font-mono text-xs" style="color:' + color + '">' + sign + diff.toFixed(0) + '</span>';
  }

  // 价差%单元格：(price-costLine)/price*100
  function renderDiffPctCell(price, costLine) {
    if (!price || price <= 0 || !costLine || costLine <= 0) return '<span class="text-ink-muted">--</span>';
    var pct = (price - costLine) / price * 100;
    var color = pct >= 0 ? '#8ca06f' : '#ef4444';
    var sign = pct >= 0 ? '+' : '';
    return '<span class="font-mono text-xs" style="color:' + color + '">' + sign + pct.toFixed(2) + '%</span>';
  }

  // 成本线输入框：costLine=0 时自动回填参考值，灰色标注"参考"
  function renderCostInput(c) {
    var val = c.costLine || 0;
    var isRef = false;
    if (val === 0) {
      var ref = FTApp.getCostReference ? FTApp.getCostReference(c.symbol) : null;
      if (ref && ref.costDomestic > 0) { val = ref.costDomestic; isRef = true; }
      else if (ref && ref.costImport > 0) { val = ref.costImport; isRef = true; }
    }
    var style = isRef ? 'width:84px;color:#908e84' : 'width:84px';
    var badge = isRef ? ' <span class="text-xs" style="color:#908e84" title="参考值">参</span>' : '';
    return '<input type="number" value="' + val + '" data-symbol="' + FTApp.escapeHtml(c.symbol) + '" class="cost-input ' + CELL_INPUT + '" style="' + style + '">' + badge;
  }

  // 获取有效成本（含自动回填的参考值）
  function getEffectiveCost(c) {
    if (c.costLine && c.costLine > 0) return c.costLine;
    var ref = FTApp.getCostReference ? FTApp.getCostReference(c.symbol) : null;
    if (ref && ref.costDomestic > 0) return ref.costDomestic;
    if (ref && ref.costImport > 0) return ref.costImport;
    return 0;
  }

  // 信号通知：记录上次信号状态，检测从非买入变为买入
  var lastSignalMap = {};

  var FTRender = {
    // ============ 1. 观察池渲染 ============
    renderPool: function () {
      var body = el('poolBody');
      if (!body) return;
      var pool = FTApp.state.pool || [];
      if (!pool.length) {
        body.innerHTML = '<tr><td colspan="11" class="empty-state">观察池为空，点击"添加品种"开始</td></tr>';
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
          html += '<tr class="bg-surface-dim"><td colspan="11" class="py-2 px-3 font-serif text-xs text-ink-muted uppercase tracking-wider">' +
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
          '<td class="py-2 px-3">' + renderPercentileCell(c.percentile) + '</td>' +
          '<td class="py-2 px-3">' + renderCostInput(c) + '</td>' +
          '<td class="py-2 px-3">' + renderDiffCell(c.price, getEffectiveCost(c)) + '</td>' +
          '<td class="py-2 px-3">' + renderDiffPctCell(c.price, getEffectiveCost(c)) + '</td>' +
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
          // 第一步只选品种，合约在下方输入框单独选择（选择品种后自动回填主力合约）
          opts += '<option value="' + FTApp.escapeHtml(v.symbol) + '" data-contract="' + FTApp.escapeHtml(v.defaultContract) + '">' +
            FTApp.escapeHtml(v.symbol) + '（' + v.category + '）</option>';
        });
        opts += '</optgroup>';
      });
      // 合约候选 datalist：每个品种的主力 + 常见月份
      var dlOpts = '';
      FTApp.EXCHANGE_VARIETIES.forEach(function (v) {
        dlOpts += '<option value="' + FTApp.escapeHtml(v.defaultContract) + '">';
        // 追加近月/远月候选（基于品种 code）
        var cd = v.code;
        dlOpts += '<option value="' + cd + '2609"><option value="' + cd + '2610"><option value="' + cd + '2611"><option value="' + cd + '2612"><option value="' + cd + '2601">';
      });
      var modal = document.createElement('div');
      modal.id = 'varietyPickerModal';
      modal.className = 'modal-overlay show';
      modal.innerHTML =
        '<div class="modal">' +
          '<h3>添加品种</h3>' +
          '<div class="form-group"><label>选择品种</label><select id="vpSelect" onchange="FTRender.onVarietyPickChange()">' + opts + '</select></div>' +
          '<div class="form-group"><label>自定义品种名（兜底，列表找不到时填写）</label><input type="text" id="vpCustomName" placeholder="列表中找不到时填写"></div>' +
          '<div class="form-group"><label>合约代码（默认当前主力，可修改）</label>' +
            '<input type="text" id="vpCustomContract" list="vpContractList" placeholder="如 RB2609 / SR509" oninput="FTRender.onContractInput()">' +
            '<datalist id="vpContractList">' + dlOpts + '</datalist>' +
          '</div>' +
          '<div id="vpContractHint" class="text-xs" style="min-height:18px;margin-top:4px;color:#908e84"></div>' +
          '<div class="form-actions">' +
            '<button class="bg-surface-elevated text-ink-secondary px-4 py-2 rounded-sm text-sm font-medium border border-edge-subtle hover:bg-surface-hover transition-colors" onclick="FTRender.closeVarietyPicker()">取消</button>' +
            '<button class="bg-brand-500 text-brand-50 px-4 py-2 rounded-sm text-sm font-medium hover:bg-brand-600 transition-colors" onclick="FTRender.confirmAddVariety()">添加</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(modal);
    },

    // 品种选择变化：自动回填当前主力合约 + 实时校验
    onVarietyPickChange: function () {
      var sel = el('vpSelect');
      var inp = el('vpCustomContract');
      if (!sel || !inp) return;
      if (sel.value) {
        var meta = FTApp.findVarietyMeta(sel.value);
        if (meta) inp.value = meta.defaultContract;
      }
      this.onContractInput();
    },

    // 合约输入实时校验提示（红/黄/绿三色反馈）
    onContractInput: function () {
      var sel = el('vpSelect');
      var inp = el('vpCustomContract');
      var hint = el('vpContractHint');
      if (!inp || !hint) return;
      var sym = (sel && sel.value) ? sel.value : ((el('vpCustomName') || {}).value || '').trim();
      var code = inp.value.trim();
      if (!code) {
        hint.innerHTML = '<span style="color:#908e84">留空将使用品种默认主力合约</span>';
        return;
      }
      var r = FTApp.validateContract(code, sym);
      if (r.level === 'error') {
        hint.innerHTML = '<span style="color:#ef4444">' + FTApp.escapeHtml(r.warning) + '</span>';
      } else if (r.level === 'warn') {
        hint.innerHTML = '<span style="color:#e08d6f">' + FTApp.escapeHtml(r.warning) + '</span>';
      } else {
        hint.innerHTML = '<span style="color:#8ca06f">✓ 合约格式正确</span>';
      }
    },

    // 关闭品种选择器
    closeVarietyPicker: function () {
      var m = el('varietyPickerModal');
      if (m) m.remove();
    },

    // 确认添加品种（集成合约纠错：无效阻止添加，警告允许但提示）
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
          // 用户填写的合约优先，留空则用品种默认主力合约
          var cc = customContract || meta.defaultContract;
          var vr = FTApp.validateContract(cc, meta.symbol);
          if (!vr.valid) { FTApp.showToast(vr.warning); return; }
          entry = {
            symbol: meta.symbol, contractCode: cc.toUpperCase(), multiplier: meta.multiplier,
            marginRate: meta.marginRate, price: 0, percentile: 0, costLine: 0, status: 'bottom',
            category: meta.category, exchange: meta.exchange
          };
          if (vr.level === 'warn') FTApp.showToast(vr.warning);
        }
      } else if (customName) {
        // 自定义品种必须填写合约代码，不再硬编码 '0'
        if (!customContract) { FTApp.showToast('请填写合约代码（如 RB2609）'); return; }
        var vr2 = FTApp.validateContract(customContract, customName);
        if (!vr2.valid) { FTApp.showToast(vr2.warning); return; }
        entry = {
          symbol: customName, contractCode: customContract.toUpperCase(), multiplier: 10, marginRate: 0.08,
          price: 0, percentile: 0, costLine: 0, status: 'bottom', category: '能源化工', exchange: ''
        };
        if (vr2.level === 'warn') FTApp.showToast(vr2.warning);
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
      FTApp.showToast('已添加 ' + entry.symbol + ' (' + entry.contractCode + ')');
    },

    // ============ 4. 删除观察池行 ============
    removePoolRow: function (symbol) {
      FTApp.state.pool = FTApp.state.pool.filter(function (c) { return c.symbol !== symbol; });
      FTApp.saveState();
      this.renderPool();
      FTApp.showToast('已删除 ' + symbol);
    },

    // ============ 5. 保存观察池（回写表格内输入 + 合约纠错视觉反馈） ============
    savePool: function () {
      var body = el('poolBody');
      if (!body) return;
      var findBySym = function (sym) { return FTApp.state.pool.find(function (x) { return x.symbol === sym; }); };
      var errorCount = 0, warnCount = 0;
      body.querySelectorAll('.contract-input').forEach(function (inp) {
        var c = findBySym(inp.dataset.symbol);
        if (!c) return;
        var newCode = inp.value.trim();
        inp.style.borderColor = '';
        inp.style.borderWidth = '';
        var vr = FTApp.validateContract(newCode, c.symbol);
        if (!vr.valid) {
          // 无效合约：保留旧值，红色边框标识
          inp.style.borderColor = '#ef4444';
          inp.style.borderWidth = '2px';
          errorCount++;
        } else {
          c.contractCode = newCode.toUpperCase();
          if (vr.level === 'warn') {
            inp.style.borderColor = '#e08d6f';
            inp.style.borderWidth = '2px';
            warnCount++;
          }
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
      if (errorCount > 0) {
        FTApp.showToast('✗ ' + errorCount + ' 个合约无效已保留旧值（红框）' + (warnCount > 0 ? '，' + warnCount + ' 个警告（黄框）' : ''));
      } else if (warnCount > 0) {
        FTApp.showToast('⚠ ' + warnCount + ' 个合约有警告（黄框），已保存');
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
      // 判断该品种是否有外部日报数据
      var feed = window.__fundFeed;
      var hasExternal = false;
      var extScore = null;
      if (feed && feed.records && feed.records.length) {
        var feishuName = (FTApp.PROJECT_TO_FEISHU_MAP && FTApp.PROJECT_TO_FEISHU_MAP[sym]) || sym;
        var v = feed.records[0].varieties && feed.records[0].varieties[feishuName];
        if (v && v.score != null) { hasExternal = true; extScore = v.score; }
      }
      // 多维度自动填充：basis/supply/inventory 三个维度
      var autoScores = {basis: 0, supply: 0, inventory: 0};
      var autoSource = '';
      if (hasExternal && extScore != null) {
        // 有外部日报：basis ≥60→8/≥45→6/≥30→4/<30→2；supply/inventory ≥60→7/≥45→5/≥30→3/<30→2
        autoScores.basis = extScore >= 60 ? 8 : (extScore >= 45 ? 6 : (extScore >= 30 ? 4 : 2));
        autoScores.supply = extScore >= 60 ? 7 : (extScore >= 45 ? 5 : (extScore >= 30 ? 3 : 2));
        autoScores.inventory = extScore >= 60 ? 7 : (extScore >= 45 ? 5 : (extScore >= 30 ? 3 : 2));
        autoSource = '外部日报(' + extScore.toFixed(1) + '分)';
      } else {
        // 无外部数据：基于百分位
        var poolItem = FTApp.state.pool.find(function(x){return x.symbol === sym;});
        var pct = poolItem ? poolItem.percentile : 0;
        if (pct && pct > 0) {
          autoScores.basis = pct <= 20 ? 8 : (pct <= 35 ? 6 : (pct <= 50 ? 4 : 2));
          autoScores.supply = pct <= 20 ? 7 : (pct <= 35 ? 5 : (pct <= 50 ? 3 : 2));
          autoScores.inventory = pct <= 20 ? 7 : (pct <= 35 ? 5 : (pct <= 50 ? 3 : 2));
          autoSource = '百分位(' + pct + '%)';
        }
      }
      dims.forEach(function (d) {
        var sInp = el(d[0]), nInp = el(d[1]);
        if (!sInp) return;
        var data = fund[d[2]] || {};
        var score;
        // basis/supply/inventory 三维度自动填充（仅在用户未手动评分时）
        if (autoScores.hasOwnProperty(d[2]) && (!data.score || data.score === 0)) {
          score = autoScores[d[2]];
        } else {
          score = (data.score != null) ? data.score : 0;
        }
        sInp.value = score;
        if (sInp.nextElementSibling) sInp.nextElementSibling.textContent = score;
        if (nInp) nInp.value = data.note || '';
      });
      // 有外部数据时显示提示，引导用户参考
      var hint = el('fundHint');
      if (hint) {
        if (hasExternal) {
          hint.innerHTML = '<span style="color:#8ca06f">📊 外部日报：' + FTApp.escapeHtml(sym) + ' 综合分 ' + extScore.toFixed(1) +
            (autoSource ? ' · 估值/供给/库存维度已根据' + autoSource + '自动填充' : '') + '</span>';
        } else if (autoSource) {
          hint.innerHTML = '<span style="color:#8ca06f">📈 ' + FTApp.escapeHtml(sym) + ' 估值/供给/库存维度已根据' + autoSource + '自动推算，其他维度请手动评分</span>';
        } else {
          hint.innerHTML = '<span style="color:#e08d6f">⚠ ' + FTApp.escapeHtml(sym) + ' 无外部日报数据且无百分位，请手动填写各维度评分</span>';
        }
      }
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
        // 估值灯：基于真实 percentile
        var valLight = p === 0 ? 'yellow' : (p <= 25 ? 'green' : (p <= 50 ? 'yellow' : 'red'));
        // 基本面灯：综合 isSweetSignal 和外部日报综合分
        var fundLight;
        var extFundScore = null;
        var feed = window.__fundFeed;
        if (feed && feed.records && feed.records.length) {
          var feishuName = (FTApp.PROJECT_TO_FEISHU_MAP && FTApp.PROJECT_TO_FEISHU_MAP[c.symbol]) || c.symbol;
          var fv = feed.records[0].varieties && feed.records[0].varieties[feishuName];
          if (fv && fv.score != null) extFundScore = fv.score;
        }
        if (FTApp.isSweetSignal(c.symbol)) {
          fundLight = 'green';
        } else if (extFundScore != null) {
          fundLight = extFundScore >= 60 ? 'green' : (extFundScore >= 40 ? 'yellow' : 'red');
        } else {
          fundLight = 'yellow';
        }
        // 资金/趋势灯：百分位+成本价差联合判断
        // 获取有效成本
        var effCost = c.costLine || 0;
        if (effCost === 0 && FTApp.getCostReference) {
          var ref = FTApp.getCostReference(c.symbol);
          if (ref && ref.costDomestic > 0) effCost = ref.costDomestic;
          else if (ref && ref.costImport > 0) effCost = ref.costImport;
        }
        var costDiff = (c.price && effCost > 0) ? (c.price - effCost) : 0;
        var rateLight, rate;
        if (p > 75) { rate = '回避'; rateLight = 'red'; }
        else if (p <= 25 && costDiff < 0 && fundLight === 'green') { rate = '买入'; rateLight = 'green'; }
        else if (p <= 25 && costDiff < 0) { rate = '加仓'; rateLight = 'green'; }
        else { rate = '观望'; rateLight = 'yellow'; }
        var rateCls = rateLight === 'green' ? 'text-success' : (rateLight === 'red' ? 'text-error' : 'text-ink-muted');
        // 详情列
        var costStr = costDiff !== 0 ? (costDiff > 0 ? '成本上+' : '成本下') + Math.abs(costDiff).toFixed(0) : '无成本数据';
        var fundStr = fundLight === 'green' ? '甜点' : '一般';
        var extStr = extFundScore != null ? '外部' + extFundScore.toFixed(0) + '分' : '手动评分';
        // 信号通知：检测从非买入变为买入
        var isBuySignal = (valLight === 'green' && FTApp.isSweetSignal(c.symbol));
        var prevSignal = lastSignalMap[c.symbol];
        if (isBuySignal && prevSignal !== 'buy' && 'Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification('📈 ' + c.symbol + ' 触发做多信号', {
              body: '估值' + (p > 0 ? p + '%' : '无数据') + ' · ' + costStr + ' · ' + (extFundScore != null ? '外部' + extFundScore.toFixed(0) + '分' : '手动评分')
            });
          } catch(e) {}
        }
        lastSignalMap[c.symbol] = isBuySignal ? 'buy' : 'other';
        var detail = '估值' + (p > 0 ? p + '%' : '无数据') + '，' + costStr + '，基本面' + fundStr + '，' + extStr;
        html += '<tr>' +
          '<td class="py-2 px-4 text-ink">' + FTApp.escapeHtml(c.symbol) + '</td>' +
          '<td class="py-2 px-4"><span class="signal-light signal-' + valLight + '"></span></td>' +
          '<td class="py-2 px-4"><span class="signal-light signal-' + rateLight + '"></span></td>' +
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
        // 品种切换时自动更新开仓价
        sel.onchange = function() {
          var sym = sel.value;
          var c = FTApp.state.pool.find(function(x) { return x.symbol === sym; });
          var priceInput = el('tradePrice');
          if (priceInput && c && c.price && c.price > 0) {
            priceInput.value = c.price;
          } else if (priceInput) {
            priceInput.value = '';
          }
        };
      }
      var dir = el('tradeDirection'); if (dir) dir.value = 'long';
      var lots = el('tradeLots'); if (lots) lots.value = 1;
      var price = el('tradePrice');
      if (price) {
        var first = FTApp.state.pool && FTApp.state.pool[0];
        price.value = (first && first.price && first.price > 0) ? first.price : '';
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
