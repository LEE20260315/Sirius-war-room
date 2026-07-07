// ============ FUTURES TRACKER - UI CORE ============
// Rendering functions for pool, fundamentals, trades, journal, dashboard, settings tabs.
// Depends on: FTApp (state, saveState, escapeHtml, getCurrentEquity, etc.)
//             FTSignal (isSweetSignal)
//             FTTrade (getCurrentEquity, getRealizedEquity, updateEquityHistory)

(function() {
  'use strict';

  const FT = () => window.FTApp;
  const signal = () => window.FTSignal;
  const trade = () => window.FTTrade;

  // ============ POOL ============
  function renderPool() {
    const app = FT();
    const tbody = document.getElementById('poolBody');
    tbody.innerHTML = '';
    app.state.pool.forEach((c, i) => {
      const statusMap = {bottom:['磨底','tag-bottom'],reversal:['反转信号','tag-reversal'],watch:['观望','tag-watch']};
      const [label, cls] = statusMap[c.status] || ['观望','tag-watch'];
      tbody.innerHTML += `<tr>
        <td><input value="${app.escapeHtml(c.symbol)}" onchange="window.FTApp.state.pool[${i}].symbol=this.value;window.FTApp.saveState()"></td>
        <td><input value="${app.escapeHtml(c.contractCode||'')}" onchange="window.FTApp.state.pool[${i}].contractCode=this.value;window.FTApp.saveState()" style="width:80px" placeholder="如RB2609"></td>
        <td><input type="number" value="${c.multiplier}" onchange="window.FTApp.state.pool[${i}].multiplier=+this.value;window.FTApp.saveState()" style="width:70px"></td>
        <td><input type="number" value="${c.marginRate}" step="0.01" onchange="window.FTApp.state.pool[${i}].marginRate=+this.value;window.FTApp.saveState()" style="width:70px"></td>
        <td><input type="number" value="${c.price}" step="0.01" onchange="window.FTApp.state.pool[${i}].price=+this.value;window.FTApp.onPriceUpdate()" style="width:90px"></td>
        <td><input type="number" value="${c.percentile}" min="0" max="100" onchange="window.FTApp.state.pool[${i}].percentile=+this.value;window.FTApp.saveState()" style="width:60px">%</td>
        <td><input type="number" value="${c.costLine}" step="0.01" onchange="window.FTApp.state.pool[${i}].costLine=+this.value;window.FTApp.saveState()" style="width:90px"></td>
        <td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c.status==='bottom'?'var(--green)':c.status==='reversal'?'var(--yellow)':'var(--red)'};vertical-align:middle;margin-right:4px"></span><select onchange="window.FTApp.state.pool[${i}].status=this.value;window.FTApp.saveState()">
          <option value="bottom" ${c.status==='bottom'?'selected':''}>磨底</option>
          <option value="reversal" ${c.status==='reversal'?'selected':''}>反转信号</option>
          <option value="watch" ${c.status==='watch'?'selected':''}>观望</option>
        </select></td>
        <td><button class="btn btn-danger btn-sm" onclick="window.FTApp.state.pool.splice(${i},1);window.FTRender.renderPool();window.FTRender.savePool()">删</button></td>
      </tr>`;
    });
  }

  function addPoolRow() {
    const app = FT();
    app.state.pool.push({symbol:'新品种',contractCode:'',multiplier:10,marginRate:0.08,price:0,percentile:50,costLine:0,status:'watch'});
    renderPool();
    app.saveState();
  }

  function savePool() { FT().saveState(); FT().showToast('观察池已保存'); }

  // ============ FUNDAMENTAL ============
  const FUNDAMENTAL_KB = {
    '生猪': {
      supply: '供给关注：能繁母猪存栏量（农业农村部月度数据）、生猪出栏体重、二次育肥情绪、进口猪肉量。当前处于产能去化周期后半段，关注产能恢复节奏。',
      demand: '需求关注：季节性消费（中秋国庆、春节前为旺季，节后为淡季）、餐饮复苏、替代品价格（鸡肉、牛羊肉）、屠宰企业开工率。',
      positionPlan: '生猪波动大（16吨/手），小资金建议轻仓试探1手，止损设关键支撑/压力位。'
    },
    '白糖': {
      supply: '供给关注：巴西中南部压榨进度（UNICA双周报）、印度产量与出口政策、泰国产量、国内甘蔗种植面积与糖分、进口利润窗口。',
      demand: '需求关注：夏季饮料消费旺季（6-8月）、中秋国庆备货、工业用糖量、替代品（淀粉糖）价格。',
      positionPlan: '白糖10吨/手，保证金适中。建议趋势确认后介入，止损3-5%。'
    },
    'PVC': {
      supply: '供给关注：电石法PVC开工率（卓创周度数据）、西北电石价格、检修计划、新增产能投放进度。',
      demand: '需求关注：房地产竣工面积（管材/型材）、基建投资（管道）、出口订单、季节性（冬季北方停工）。',
      positionPlan: 'PVC 5吨/手，保证金低。适合小资金练手，轻仓1-2手试探。'
    },
    '聚丙烯PP': {
      supply: '供给关注：油制/煤制/PDH开工率、检修损失量、新增产能（浙石化、中景等）、进口量。',
      demand: '需求关注：塑料制品产量（编织袋、注塑）、汽车/家电、出口订单、BOPP膜需求。',
      positionPlan: 'PP 5吨/手，保证金低。适合小资金轻仓操作，1-2手。'
    },
    '玻璃': {
      supply: '供给关注：浮法玻璃在产产线、冷修/复产计划、日熔量（隆众/卓创周度数据）、沙河库存。',
      demand: '需求关注：房地产竣工（玻璃处于竣工前端）、汽车玻璃、深加工订单、季节性（金九银十）。',
      positionPlan: '玻璃20吨/手，波动大。小资金极轻仓，1手即可，严守止损。'
    },
    '纯碱': {
      supply: '供给关注：检修季（5-6月、9-10月）、新增产能（远兴、金山等）、氨碱/联碱开工率、库存（隆众周度）。',
      demand: '需求关注：浮法玻璃日熔量、光伏玻璃投产进度、碳酸锂（轻碱）、出口。',
      positionPlan: '纯碱20吨/手，波动剧烈。必须轻仓1手，严格止损，不扛单。'
    },
    '螺纹钢': {
      supply: '供给关注：高炉开工率（Mysteel周度）、电炉开工率、限产政策（秋冬环保限产）、粗钢产量压减。',
      demand: '需求关注：房地产新开工面积、基建投资（专项债发行）、水泥出货量（先行指标）、季节性（春节、雨季）。',
      positionPlan: '螺纹钢10吨/手，流动性好。适合波段操作，轻仓2-3手。'
    },
    '热卷': {
      supply: '供给关注：热卷轧线开工率、检修计划、出口退税政策、钢厂利润（决定产量）。',
      demand: '需求关注：汽车产量、家电排产、机械制造、造船、出口（东南亚/中东）。',
      positionPlan: '热卷10吨/手，与螺纹钢联动。轻仓2-3手，注意卷螺差价。'
    },
    '铁矿石': {
      supply: '供给关注：四大矿山发货量（力拓、必和必拓、FMG、淡水河谷）、中国港口库存、非主流矿到港。',
      demand: '需求关注：高炉铁水产量（Mysteel日度）、钢厂补库节奏、钢厂利润（决定采购意愿）。',
      positionPlan: '铁矿石100吨/手，保证金高。小资金不建议操作，或极轻仓1手。'
    },
    '玉米': {
      supply: '供给关注：种植面积（USDA/农业农村部）、天气（东北春玉米关键期）、进口配额与到港、临储拍卖。',
      demand: '需求关注：饲料需求（生猪存栏）、深加工（淀粉/酒精）、替代品（小麦、进口高粱）。',
      positionPlan: '玉米10吨/手，波动相对温和。适合稳健操作，轻仓2-3手。'
    },
    '甲醇': {
      supply: '供给关注：煤制甲醇开工率（西北）、天然气制甲醇（冬季限气）、进口量（伊朗）、港口库存。',
      demand: '需求关注：MTO/MTP装置开工（烯烃）、甲醛、醋酸、MTBE、季节性（冬季取暖）。',
      positionPlan: '甲醇10吨/手，波动适中。轻仓2-3手，关注MTO利润。'
    },
    '烧碱': {
      supply: '供给关注：氯碱企业开工率、检修计划（春秋检修季）、液氯价格（联产影响）、新增产能。',
      demand: '需求关注：氧化铝产量（最大下游）、印染/化纤、造纸、水处理。',
      positionPlan: '烧碱30吨/手，波动大。小资金极轻仓1手，严格止损。'
    },
    '尿素': {
      supply: '供给关注：气头/煤头开工率、检修季、出口政策（法检）、新增产能、企业库存。',
      demand: '需求关注：农业施肥（春耕、夏播、秋播为旺季）、工业需求（三聚氰胺、车用尿素）、出口。',
      positionPlan: '尿素20吨/手，季节性明显。淡季低吸旺季高抛，轻仓1-2手。'
    }
  };

  function loadFundamental() {
    const app = FT();
    const sym = document.getElementById('fundSelect').value;
    const data = app.state.fundamentals[sym] || {};
    const tbody = document.getElementById('fundBody');
    tbody.innerHTML = '';
    app.FUND_DIMENSIONS.forEach(d => {
      const v = data[d.key] || {content:'',score:3};
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="text-align:left;font-weight:500;min-width:120px">${d.label}</td>
        <td><textarea class="fund-content" data-key="${d.key}">${v.content||''}</textarea></td>
        <td><input type="number" class="fund-score" data-key="${d.key}" min="1" max="5" value="${v.score||3}" style="width:60px"></td>
      `;
      tr.querySelector('.fund-content').addEventListener('change', e => updateFund(sym, d.key, 'content', e.target.value));
      tr.querySelector('.fund-score').addEventListener('change', e => updateFund(sym, d.key, 'score', +e.target.value));
      tbody.appendChild(tr);
    });
  }

  function updateFund(sym, key, field, val) {
    const app = FT();
    if (!app.state.fundamentals[sym]) app.state.fundamentals[sym] = {};
    if (!app.state.fundamentals[sym][key]) app.state.fundamentals[sym][key] = {};
    app.state.fundamentals[sym][key][field] = val;
    app.saveState();
  }

  function saveFundamental() { FT().saveState(); FT().showToast('基本面数据已保存'); }

  function autoFillFundamental() {
    const app = FT();
    let filled = 0, skipped = 0;
    app.state.pool.forEach(c => {
      const kb = FUNDAMENTAL_KB[c.symbol] || {};
      if (!app.state.fundamentals[c.symbol]) app.state.fundamentals[c.symbol] = {};

      // 估值位置：自动从pool数据计算，仅填空白
      if (!app.state.fundamentals[c.symbol].valuation || !app.state.fundamentals[c.symbol].valuation.content) {
        const pct = c.percentile;
        let valAnalysis = '';
        if (pct <= 15) valAnalysis = '处于历史极低分位，深度低估，安全边际极高。';
        else if (pct <= 25) valAnalysis = '处于历史低位区间，估值偏低，有较好的安全边际。';
        else if (pct <= 40) valAnalysis = '处于历史中等偏低分位，估值合理偏低。';
        else if (pct <= 60) valAnalysis = '处于历史中位，估值合理，无显著低估。';
        else valAnalysis = '处于历史较高分位，估值偏高，安全边际不足。';
        const valScore = pct <= 15 ? 5 : pct <= 25 ? 4 : pct <= 40 ? 3 : pct <= 60 ? 2 : 1;
        app.state.fundamentals[c.symbol].valuation = {
          content: `当前价格¥${c.price}，历史分位${pct}%，成本线¥${c.costLine}。${valAnalysis}`,
          score: valScore
        };
        filled++;
      } else { skipped++; }

      // 供给：从知识库预填，仅填空白
      if (kb.supply && (!app.state.fundamentals[c.symbol].supply || !app.state.fundamentals[c.symbol].supply.content)) {
        if (!app.state.fundamentals[c.symbol].supply) app.state.fundamentals[c.symbol].supply = {};
        app.state.fundamentals[c.symbol].supply.content = kb.supply;
        if (!app.state.fundamentals[c.symbol].supply.score) app.state.fundamentals[c.symbol].supply.score = 3;
        filled++;
      } else { skipped++; }

      // 需求
      if (kb.demand && (!app.state.fundamentals[c.symbol].demand || !app.state.fundamentals[c.symbol].demand.content)) {
        if (!app.state.fundamentals[c.symbol].demand) app.state.fundamentals[c.symbol].demand = {};
        app.state.fundamentals[c.symbol].demand.content = kb.demand;
        if (!app.state.fundamentals[c.symbol].demand.score) app.state.fundamentals[c.symbol].demand.score = 3;
        filled++;
      } else { skipped++; }

      // 催化剂：通用模板
      if (!app.state.fundamentals[c.symbol].catalyst || !app.state.fundamentals[c.symbol].catalyst.content) {
        if (!app.state.fundamentals[c.symbol].catalyst) app.state.fundamentals[c.symbol].catalyst = {};
        app.state.fundamentals[c.symbol].catalyst.content = '待追踪：关注政策变化、天气异常、突发事件、行业新闻等。建议每日浏览期货资讯（东方财富、文华财经、新浪期货）。';
        if (!app.state.fundamentals[c.symbol].catalyst.score) app.state.fundamentals[c.symbol].catalyst.score = 3;
        filled++;
      } else { skipped++; }

      // 仓位计划
      if (kb.positionPlan && (!app.state.fundamentals[c.symbol].positionPlan || !app.state.fundamentals[c.symbol].positionPlan.content)) {
        if (!app.state.fundamentals[c.symbol].positionPlan) app.state.fundamentals[c.symbol].positionPlan = {};
        app.state.fundamentals[c.symbol].positionPlan.content = kb.positionPlan;
        if (!app.state.fundamentals[c.symbol].positionPlan.score) app.state.fundamentals[c.symbol].positionPlan.score = 3;
        filled++;
      } else { skipped++; }
    });
    app.saveState();
    app.showToast(`基本面已自动填充：${filled}项新填，${skipped}项保留已有数据`);
    // 刷新当前显示
    loadFundamental();
  }

  // ============ SIGNAL ENGINE (UI) ============
  function refreshSignals() {
    const app = FT();
    app.saveState();
    const tbody = document.getElementById('signalBody');
    tbody.innerHTML = '';
    app.state.pool.forEach(c => {
      const fund = app.state.fundamentals[c.symbol] || {};
      const valScore = c.percentile <= 25 ? 5 : c.percentile <= 40 ? 3 : 1;
      const supplyScore = (fund.supply && fund.supply.score) || 3;
      const catalystScore = (fund.catalyst && fund.catalyst.score) || 3;
      const total = valScore + supplyScore + catalystScore;
      const maxTotal = 15;
      const ratio = total / maxTotal;

      let light, advice, isSweet;
      if (valScore >= 4 && supplyScore >= 4 && catalystScore >= 4) {
        light = '<span class="signal-light signal-green"></span><span class="signal-light signal-green"></span><span class="signal-light signal-green"></span>';
        advice = '甜点级重仓';
        isSweet = true;
      } else if (ratio >= 0.5) {
        light = '<span class="signal-light signal-yellow"></span><span class="signal-light signal-yellow"></span><span class="signal-light signal-red"></span>';
        advice = '轻仓试探';
        isSweet = false;
      } else {
        light = '<span class="signal-light signal-red"></span><span class="signal-light signal-red"></span><span class="signal-light signal-red"></span>';
        advice = '观望等待';
        isSweet = false;
      }

      tbody.innerHTML += `<tr>
        <td>${app.escapeHtml(c.symbol)}</td>
        <td>${valScore}/5</td>
        <td>${supplyScore}/5</td>
        <td>${catalystScore}/5</td>
        <td>${total}/${maxTotal}</td>
        <td>${light}</td>
        <td style="font-weight:600;color:${advice.includes('甜点')?'var(--green)':advice.includes('轻仓')?'var(--yellow)':'var(--red)'}">${app.escapeHtml(advice)}</td>
      </tr>`;
    });
  }

  // ============ TRADING ENGINE (UI) ============
  let closeTradeIdx = -1;
  let rolloverTradeIdx = -1;

  function openTradeModal() {
    const app = FT();
    app.populateSymbolSelect(document.getElementById('tmSymbol'));
    document.getElementById('tmLots').value = 1;
    document.getElementById('tmRiskInfo').textContent = '';
    const firstSym = document.getElementById('tmSymbol').value;
    const firstC = app.state.pool.find(x=>x.symbol===firstSym);
    document.getElementById('tmPrice').value = firstC ? firstC.price : '';
    document.getElementById('tmStopLoss').value = '';
    app.openModal('tradeModal');
    document.getElementById('tmLots').onchange = calcTradeRisk;
    document.getElementById('tmPrice').onchange = calcTradeRisk;
    document.getElementById('tmStopLoss').onchange = calcTradeRisk;
    document.getElementById('tmSymbol').onchange = function() {
      const c = app.state.pool.find(x=>x.symbol===this.value);
      if (c) { document.getElementById('tmPrice').value = c.price; document.getElementById('tmStopLoss').value = ''; }
      calcTradeRisk();
    };
  }

  function calcTradeRisk() {
    const app = FT();
    const sym = document.getElementById('tmSymbol').value;
    const c = app.state.pool.find(x=>x.symbol===sym);
    if (!c) return;
    const lots = +document.getElementById('tmLots').value || 1;
    const price = +document.getElementById('tmPrice').value || 0;
    const sl = +document.getElementById('tmStopLoss').value || 0;
    if (!price || !sl) { document.getElementById('tmRiskInfo').textContent=''; return; }

    // Core risk = stop-loss distance x multiplier x lots
    const coreRisk = Math.abs(price - sl) * c.multiplier * lots;
    const margin = price * c.multiplier * c.marginRate * lots;
    const equity = Math.max(1, app.getCurrentEquity());
    const riskPct = (coreRisk / equity * 100).toFixed(2);

    const maxPct = app.isSweetSignal(sym) ? app.state.settings.maxRiskSweet : app.state.settings.maxRisk;
    const info = `止损风险: ¥${coreRisk.toFixed(0)} | 保证金: ¥${margin.toFixed(0)} | 风险占比: ${riskPct}%`;
    document.getElementById('tmRiskInfo').innerHTML = `<span style="color:${riskPct>maxPct?'var(--red)':'var(--green)'}">${info}</span>` +
      (riskPct > maxPct ? `<br><span style="color:var(--red);font-weight:600">⚠ 风险超限！单笔风险${riskPct}%超过${maxPct}%上限，建议减少手数或收紧止损</span>` : '') +
      (app.isSweetSignal(sym) ? `<br><span style="color:var(--green);font-size:12px">✓ 甜点级信号，风控上限放宽至 ${app.state.settings.maxRiskSweet}%</span>` : '');
  }

  function submitTrade() {
    const app = FT();
    const sym = document.getElementById('tmSymbol').value;
    const c = app.state.pool.find(x=>x.symbol===sym);
    if (!c) { app.showToast('请选择品种'); return; }
    const lots = +document.getElementById('tmLots').value || 1;
    const price = +document.getElementById('tmPrice').value;
    const sl = +document.getElementById('tmStopLoss').value;
    const dir = document.getElementById('tmDir').value;
    if (!price || !sl) { app.showToast('请填写开仓价和止损价'); return; }

    // Validate stop loss direction
    if (dir === 'long' && sl >= price) { app.showToast('做多止损价应低于开仓价'); return; }
    if (dir === 'short' && sl <= price) { app.showToast('做空止损价应高于开仓价'); return; }

    const coreRisk = Math.abs(price - sl) * c.multiplier * lots;
    const equity = Math.max(1, app.getCurrentEquity());
    const riskPct = coreRisk / equity * 100;
    const maxPct = app.isSweetSignal(sym) ? app.state.settings.maxRiskSweet : app.state.settings.maxRisk;

    if (riskPct > maxPct) {
      if (!confirm(`⚠ 风险警告！\n\n单笔风险占比: ${riskPct.toFixed(2)}%\n允许上限: ${maxPct}%\n\n强制开仓将违反风控规则，确认继续？`)) return;
    }

    const margin = price * c.multiplier * c.marginRate * lots;
    const openCommission = price * c.multiplier * lots * (app.state.settings.commission / 10000);
    const openSlipCost = app.state.settings.slippage * c.multiplier * lots;
    app.state.trades.push({
      symbol: sym, contractCode: c.contractCode || '', dir, lots, price, stopLoss: sl, margin,
      multiplier: c.multiplier, marginRate: c.marginRate,
      openDate: new Date().toISOString().slice(0,10),
      openCommission, openSlipCost
    });
    // 自动记录交易日志
    app.state.journal.unshift({
      id: Date.now(),
      date: new Date().toISOString().slice(0,10),
      symbol: sym,
      dir: dir,
      logic: `[自动记录] 开仓${dir==='long'?'做多':'做空'} ${lots}手 @ ${price}，止损 ${sl}，保证金 ¥${margin.toFixed(0)}`,
      discipline: 'yes',
      review: ''
    });
    app.saveState();
    updateEquityHistory();
    app.closeModal('tradeModal');
    renderTrades();
    renderJournal();
    app.showToast(`已开仓 ${sym} ${dir==='long'?'做多':'做空'} ${lots}手`);
  }

  function renderTrades() {
    const app = FT();
    const tbody = document.getElementById('tradeBody');
    tbody.innerHTML = '';
    let totalMargin = 0, totalPnl = 0;
    app.state.trades.forEach((t, i) => {
      const c = app.state.pool.find(x=>x.symbol===t.symbol);
      const curPrice = c ? c.price : t.price;
      const grossPnl = t.dir==='long' ? (curPrice - t.price) * t.multiplier * t.lots : (t.price - curPrice) * t.multiplier * t.lots;
      const netPnl = grossPnl - (t.openCommission || 0);
      const pnlColor = netPnl >= 0 ? 'var(--green)' : 'var(--red)';
      totalMargin += t.margin;
      totalPnl += netPnl;
      const riskBase = Math.abs(t.price - t.stopLoss) * t.multiplier * t.lots;
      const eq = Math.max(1, app.getCurrentEquity());
      const riskPct = (riskBase / eq * 100).toFixed(2);
      tbody.innerHTML += `<tr>
        <td>${app.escapeHtml(t.symbol)}</td>
        <td>${app.escapeHtml(t.contractCode||'-')}</td>
        <td style="color:${t.dir==='long'?'var(--green)':'var(--red)'}">${t.dir==='long'?'做多':'做空'}</td>
        <td>${t.lots}</td>
        <td>${t.price}</td>
        <td>${t.stopLoss}</td>
        <td>${curPrice}</td>
        <td style="color:${pnlColor};font-weight:600">${netPnl.toFixed(2)}</td>
        <td>${t.margin?.toFixed(0)||'0'}</td>
        <td style="color:${riskPct>app.state.settings.maxRisk?'var(--red)':'var(--green)'}">${riskPct}%</td>
        <td><button class="btn btn-danger btn-sm" onclick="window.FTRender._openCloseModal(${i})">平仓</button> <button class="btn btn-sm" style="background:var(--yellow);color:#000" onclick="window.FTRender._openRolloverModal(${i})">移仓</button></td>
      </tr>`;
    });
    if (app.state.trades.length === 0) {
      tbody.innerHTML = '<tr><td colspan="11" style="color:var(--text2)">暂无持仓</td></tr>';
    }

    // render closed
    const ctbody = document.getElementById('closedTradeBody');
    ctbody.innerHTML = '';
    app.state.closedTrades.forEach(t => {
      const pnlColor = t.pnl >= 0 ? 'var(--green)' : 'var(--red)';
      ctbody.innerHTML += `<tr>
        <td>${app.escapeHtml(t.symbol)}</td>
        <td>${app.escapeHtml(t.contractCode||'-')}${t.isRollover?' <span style="font-size:10px;color:var(--yellow)">移仓</span>':''}</td>
        <td>${t.dir==='long'?'做多':'做空'}</td>
        <td>${t.lots}</td>
        <td>${t.openPrice}</td>
        <td>${t.closePrice}</td>
        <td style="color:${pnlColor};font-weight:600">${t.pnl?.toFixed(2)||'0.00'}</td>
        <td>${t.closeDate}</td>
      </tr>`;
    });
    if (app.state.closedTrades.length === 0) {
      ctbody.innerHTML = '<tr><td colspan="7" style="color:var(--text2)">暂无记录</td></tr>';
    }

    // trade-level risk alert
    const alertDiv = document.getElementById('tradeAlert');
    const totalRiskPct = totalMargin > 0 ? (totalMargin / Math.max(1, app.getCurrentEquity()) * 100) : 0;
    if (totalRiskPct > 80) {
      alertDiv.innerHTML = `<div class="alert-box">⚠ 保证金占用已达 ${totalRiskPct.toFixed(1)}%，接近满仓，请控制仓位！</div>`;
    } else {
      alertDiv.innerHTML = '';
    }
  }

  function _openCloseModal(idx) {
    closeTradeIdx = idx;
    const app = FT();
    const t = app.state.trades[idx];
    const c = app.state.pool.find(x=>x.symbol===t.symbol);
    document.getElementById('cmPrice').value = c ? c.price : t.price;
    app.openModal('closeModal');
  }

  function openCloseModal(idx) { _openCloseModal(idx); }

  function submitClose() {
    const app = FT();
    if (closeTradeIdx < 0) return;
    const t = app.state.trades[closeTradeIdx];
    const closePrice = +document.getElementById('cmPrice').value;
    if (!closePrice) { app.showToast('请填写平仓价'); return; }

    const grossPnl = t.dir==='long' ? (closePrice - t.price) * t.multiplier * t.lots : (t.price - closePrice) * t.multiplier * t.lots;
    const openComm = t.openCommission || (t.price * t.multiplier * t.lots * (app.state.settings.commission / 10000));
    const closeComm = closePrice * t.multiplier * t.lots * (app.state.settings.commission / 10000);
    const openSlip = t.openSlipCost || 0;
    const closeSlip = app.state.settings.slippage * t.multiplier * t.lots;
    const netPnl = grossPnl - openComm - closeComm - openSlip - closeSlip;

    app.state.closedTrades.push({
      symbol: t.symbol, contractCode: t.contractCode || '', dir: t.dir, lots: t.lots, openPrice: t.price, closePrice,
      pnl: netPnl, closeDate: new Date().toISOString().slice(0,10), isRollover: false
    });
    // 自动记录交易日志
    const pnlStr = netPnl >= 0 ? `盈利 ¥${netPnl.toFixed(2)}` : `亏损 ¥${Math.abs(netPnl).toFixed(2)}`;
    app.state.journal.unshift({
      id: Date.now(),
      date: new Date().toISOString().slice(0,10),
      symbol: t.symbol,
      dir: t.dir,
      logic: `[自动记录] 平仓${t.dir==='long'?'做多':'做空'} ${t.lots}手，开仓 ¥${t.price} → 平仓 ¥${closePrice}，${pnlStr}（手续费+滑点已扣）`,
      discipline: 'yes',
      review: ''
    });
    app.state.trades.splice(closeTradeIdx, 1);
    closeTradeIdx = -1;
    app.saveState();
    updateEquityHistory();
    app.closeModal('closeModal');
    renderTrades();
    renderJournal();
    app.showToast(`已平仓，${pnlStr}`);
  }

  function _openRolloverModal(idx) {
    const app = FT();
    rolloverTradeIdx = idx;
    const t = app.state.trades[idx];
    const c = app.state.pool.find(x=>x.symbol===t.symbol);
    document.getElementById('rmOldContract').value = t.contractCode || '';
    document.getElementById('rmNewContract').value = '';
    document.getElementById('rmOldPrice').value = c ? c.price : t.price;
    document.getElementById('rmNewPrice').value = '';
    document.getElementById('rmNewStopLoss').value = '';
    document.getElementById('rmCostInfo').textContent = '';
    app.openModal('rolloverModal');
    document.getElementById('rmOldPrice').onchange = calcRolloverCost;
    document.getElementById('rmNewPrice').onchange = calcRolloverCost;
  }

  function openRolloverModal(idx) { _openRolloverModal(idx); }

  function calcRolloverCost() {
    const app = FT();
    const t = app.state.trades[rolloverTradeIdx];
    if (!t) return;
    const oldPrice = +document.getElementById('rmOldPrice').value || 0;
    const newPrice = +document.getElementById('rmNewPrice').value || 0;
    if (!oldPrice || !newPrice) { document.getElementById('rmCostInfo').textContent = ''; return; }
    const commRate = app.state.settings.commission / 10000;
    const closeComm = oldPrice * t.multiplier * t.lots * commRate;
    const openComm = newPrice * t.multiplier * t.lots * commRate;
    const slipCost = app.state.settings.slippage * t.multiplier * t.lots * 2; // 移仓双向滑点
    const totalCost = closeComm + openComm + slipCost;
    document.getElementById('rmCostInfo').innerHTML = `移仓预估成本: 平仓手续费 ¥${closeComm.toFixed(2)} + 开仓手续费 ¥${openComm.toFixed(2)} + 滑点 ¥${slipCost.toFixed(2)} = <strong>¥${totalCost.toFixed(2)}</strong>`;
  }

  function submitRollover() {
    const app = FT();
    if (rolloverTradeIdx < 0) return;
    const t = app.state.trades[rolloverTradeIdx];
    const newContract = document.getElementById('rmNewContract').value.trim();
    const oldPrice = +document.getElementById('rmOldPrice').value;
    const newPrice = +document.getElementById('rmNewPrice').value;
    const newStopLoss = +document.getElementById('rmNewStopLoss').value;
    if (!newContract) { app.showToast('请输入新合约代码'); return; }
    if (!oldPrice || !newPrice || !newStopLoss) { app.showToast('请填写价格和止损价'); return; }
    // Validate stop loss direction
    if (t.dir === 'long' && newStopLoss >= newPrice) { app.showToast('做多止损价应低于开仓价'); return; }
    if (t.dir === 'short' && newStopLoss <= newPrice) { app.showToast('做空止损价应高于开仓价'); return; }

    const commRate = app.state.settings.commission / 10000;
    const closeComm = oldPrice * t.multiplier * t.lots * commRate;
    const openComm = newPrice * t.multiplier * t.lots * commRate;
    const slipCost = app.state.settings.slippage * t.multiplier * t.lots * 2;
    const totalRolloverCost = closeComm + openComm + slipCost;

    // Calculate PnL from old position
    const grossPnl = t.dir === 'long' ? (oldPrice - t.price) * t.multiplier * t.lots : (t.price - oldPrice) * t.multiplier * t.lots;
    const netPnl = grossPnl - (t.openCommission || 0) - closeComm - app.state.settings.slippage * t.multiplier * t.lots;

    // Record old position as closed
    app.state.closedTrades.push({
      symbol: t.symbol, contractCode: t.contractCode || '', dir: t.dir, lots: t.lots,
      openPrice: t.price, closePrice: oldPrice, pnl: netPnl,
      closeDate: new Date().toISOString().slice(0,10), isRollover: true
    });

    // Record rollover event
    app.state.rolloverHistory.push({
      date: new Date().toISOString().slice(0,10),
      symbol: t.symbol,
      oldContract: t.contractCode || '',
      newContract: newContract,
      lots: t.lots,
      dir: t.dir,
      oldClosePrice: oldPrice,
      newOpenPrice: newPrice,
      rolloverCost: totalRolloverCost
    });

    // Open new position on new contract
    const newMargin = newPrice * t.multiplier * t.marginRate * t.lots;
    app.state.trades[rolloverTradeIdx] = {
      symbol: t.symbol, contractCode: newContract, dir: t.dir, lots: t.lots,
      price: newPrice, stopLoss: newStopLoss, margin: newMargin,
      multiplier: t.multiplier, marginRate: t.marginRate,
      openDate: new Date().toISOString().slice(0,10),
      openCommission: openComm
    };

    // Also update pool contract code
    const poolItem = app.state.pool.find(x => x.symbol === t.symbol);
    if (poolItem) poolItem.contractCode = newContract;

    rolloverTradeIdx = -1;
    // 自动记录交易日志
    const pnlStr2 = netPnl >= 0 ? `盈利 ¥${netPnl.toFixed(2)}` : `亏损 ¥${Math.abs(netPnl).toFixed(2)}`;
    app.state.journal.unshift({
      id: Date.now(),
      date: new Date().toISOString().slice(0,10),
      symbol: t.symbol,
      dir: t.dir,
      logic: `[自动记录] 移仓 ${t.contractCode||''} → ${newContract}，${t.dir==='long'?'做多':'做空'} ${t.lots}手，旧合约平仓 ${pnlStr2}，移仓成本 ¥${totalRolloverCost.toFixed(2)}`,
      discipline: 'yes',
      review: ''
    });
    app.saveState();
    updateEquityHistory();
    renderPool();
    app.closeModal('rolloverModal');
    renderTrades();
    renderJournal();
    app.showToast(`已移仓至 ${newContract}，移仓成本 ¥${totalRolloverCost.toFixed(2)}`);
  }

  // ============ JOURNAL ============
  function openJournalModal() {
    const app = FT();
    app.populateSymbolSelect(document.getElementById('jmSymbol'));
    document.getElementById('jmLogic').value = '';
    document.getElementById('jmReview').value = '';
    document.getElementById('jmDiscipline').value = 'yes';
    app.openModal('journalModal');
  }

  function submitJournal() {
    const app = FT();
    const entry = {
      id: Date.now(),
      date: new Date().toISOString().slice(0,10),
      symbol: document.getElementById('jmSymbol').value,
      dir: document.getElementById('jmDir').value,
      logic: document.getElementById('jmLogic').value,
      discipline: document.getElementById('jmDiscipline').value,
      review: document.getElementById('jmReview').value
    };
    app.state.journal.unshift(entry);
    app.saveState();
    app.closeModal('journalModal');
    renderJournal();
    app.showToast('日志已保存');
  }

  function renderJournal() {
    const app = FT();
    const list = document.getElementById('journalList');
    if (app.state.journal.length === 0) {
      list.innerHTML = '<div class="empty-state">暂无交易日志</div>';
      return;
    }
    list.innerHTML = app.state.journal.map((j, i) => {
      const isAuto = j.logic && j.logic.startsWith('[自动记录]');
      const discMap = {yes:['✅ 严格执行','var(--green)'],partial:['⚠ 部分执行','var(--yellow)'],no:['❌ 违反纪律','var(--red)']};
      const [dLabel, dColor] = discMap[j.discipline] || discMap.yes;
      return `<div class="card" style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div><strong>${app.escapeHtml(j.symbol)}</strong> · ${j.dir==='long'?'做多':'做空'} · ${app.escapeHtml(j.date)}${isAuto?' <span style="font-size:10px;background:var(--accent);color:#fff;padding:1px 6px;border-radius:8px">自动</span>':''}</div>
          <div style="color:${dColor};font-weight:600">${dLabel}</div>
        </div>
        <div style="margin-top:8px;font-size:13px"><strong>${isAuto?'摘要':'开仓逻辑'}:</strong> ${app.escapeHtml(j.logic||'未填写')}</div>
        <div style="margin-top:4px;font-size:13px"><strong>复盘:</strong> ${app.escapeHtml(j.review||'未填写')}</div>
        <button class="btn btn-danger btn-sm" style="margin-top:8px" onclick="window.FTApp.state.journal.splice(${i},1);window.FTApp.saveState();window.FTRender.renderJournal()">删除</button>
      </div>`;
    }).join('');
  }

  // ============ DASHBOARD ============
  function updateEquityHistory() {
    const app = FT();
    const today = new Date().toISOString().slice(0,10);
    const eq = app.getCurrentEquity();
    const last = app.state.equityHistory[app.state.equityHistory.length-1];
    if (!last || last.date !== today) {
      app.state.equityHistory.push({date: today, equity: eq});
    } else {
      last.equity = eq;
    }
    app.saveState();
  }

  function renderDashboard() {
    const app = FT();
    updateEquityHistory();
    const equity = app.getCurrentEquity();
    const initEq = app.state.settings.initEquity;
    const target = app.state.settings.target;
    const totalReturn = ((equity - initEq) / initEq * 100).toFixed(2);

    // max drawdown
    let peak = 0, maxDD = 0;
    app.state.equityHistory.forEach(h => {
      if (h.equity > peak) peak = h.equity;
      const dd = (peak - h.equity) / peak * 100;
      if (dd > maxDD) maxDD = dd;
    });

    // win rate & profit factor
    let wins = 0, losses = 0, totalWin = 0, totalLoss = 0;
    app.state.closedTrades.forEach(t => {
      if (t.pnl >= 0) { wins++; totalWin += t.pnl; }
      else { losses++; totalLoss += Math.abs(t.pnl); }
    });
    const totalTrades = wins + losses;
    const winRate = totalTrades ? (wins/totalTrades*100).toFixed(1) : '0.0';
    const pf = totalLoss > 0 ? (totalWin/totalLoss).toFixed(2) : totalWin > 0 ? '∞' : '-';

    // discipline rate
    let discYes = 0, discTotal = 0;
    app.state.journal.forEach(j => {
      discTotal++;
      if (j.discipline === 'yes') discYes++;
    });
    const discRate = discTotal ? (discYes/discTotal*100).toFixed(0) : '-';

    // progress
    const progress = Math.min(100, Math.max(0, ((equity - initEq) / (target - initEq) * 100))).toFixed(1);

    document.getElementById('statsGrid').innerHTML = `
      <div class="stat-card"><div class="value">¥${equity.toFixed(0)}</div><div class="label">当前权益</div></div>
      <div class="stat-card"><div class="value" style="color:${totalReturn>=0?'var(--green)':'var(--red)'}">${totalReturn}%</div><div class="label">累计收益率</div></div>
      <div class="stat-card"><div class="value" style="color:var(--red)">${maxDD.toFixed(1)}%</div><div class="label">最大回撤</div></div>
      <div class="stat-card"><div class="value">${totalTrades}</div><div class="label">总交易笔数</div></div>
      <div class="stat-card"><div class="value">${winRate}%</div><div class="label">胜率</div></div>
      <div class="stat-card"><div class="value">${pf}</div><div class="label">盈亏比</div></div>
      <div class="stat-card"><div class="value" style="color:var(--accent)">${discRate}%</div><div class="label">纪律执行率</div></div>
      <div class="stat-card"><div class="value">${progress}%</div><div class="label">距100万进度</div></div>
    `;

    // progress bar
    const pf2 = document.getElementById('progressFill');
    pf2.style.width = Math.max(0, Math.min(100, progress)) + '%';
    pf2.textContent = progress + '%';

    // risk alert
    const alertDiv = document.getElementById('riskAlert');
    let alertHtml = '';
    if (maxDD >= app.state.settings.drawdownWarn) {
      alertHtml += `<div class="alert-box">⚠ 风险预警：最大回撤 ${maxDD.toFixed(1)}% 已超过 ${app.state.settings.drawdownWarn}% 阈值，请检查持仓风险！</div>`;
    }
    const marginUsed = app.state.trades.reduce((sum, t) => sum + t.margin, 0);
    const marginPct = marginUsed / Math.max(1, equity) * 100;
    if (marginPct > 80) {
      alertHtml += `<div class="alert-box">⚠ 仓位预警：保证金占用 ${marginPct.toFixed(1)}%，接近满仓！</div>`;
    }
    alertDiv.innerHTML = alertHtml;

    // draw chart
    if (window.FTChart && window.FTChart.drawEquityChart) window.FTChart.drawEquityChart();
    renderRolloverHistory();
  }

  function renderRolloverHistory() {
    const app = FT();
    const el = document.getElementById('rolloverHistoryTable');
    if (!el) return;
    if (app.state.rolloverHistory.length === 0) {
      el.innerHTML = '<div class="empty-state">暂无移仓记录</div>';
      return;
    }
    el.innerHTML = `<table style="font-size:12px"><thead><tr>
      <th>日期</th><th>品种</th><th>旧合约</th><th>新合约</th><th>方向</th><th>手数</th><th>移仓成本</th>
    </tr></thead><tbody>` + app.state.rolloverHistory.map((r, i) => `
      <tr>
        <td>${app.escapeHtml(r.date)}</td>
        <td>${app.escapeHtml(r.symbol)}</td>
        <td>${app.escapeHtml(r.oldContract)}</td>
        <td>${app.escapeHtml(r.newContract)}</td>
        <td style="color:${r.dir==='long'?'var(--green)':'var(--red)'}">${r.dir==='long'?'做多':'做空'}</td>
        <td>${r.lots}</td>
        <td style="color:var(--yellow)">¥${r.rolloverCost.toFixed(2)}</td>
      </tr>`).join('') + '</tbody></table>';
  }

  // ============ SETTINGS (UI) ============
  function loadSettings() {
    if (window.FTApp && window.FTApp.loadSettings) window.FTApp.loadSettings();
  }

  function saveSettings() {
    if (window.FTApp && window.FTApp.saveSettings) window.FTApp.saveSettings();
  }

  // ============ EXPORTS ============
  window.FTRender = {
    renderPool, addPoolRow, savePool,
    loadFundamental, saveFundamental, autoFillFundamental,
    refreshSignals, renderTrades, openTradeModal, calcTradeRisk, submitTrade,
    openCloseModal, submitClose, openRolloverModal, calcRolloverCost, submitRollover,
    _openCloseModal, _openRolloverModal,
    openJournalModal, submitJournal, renderJournal,
    renderDashboard, renderRolloverHistory,
    loadSettings, saveSettings,
    updateEquityHistory
  };
})();
