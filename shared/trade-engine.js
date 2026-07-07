// ============ FUTURES TRACKER - TRADE ENGINE ============
// Trade calculation logic: equity, margin, PnL, risk.
// Depends on: FTApp (state)

(function() {
  'use strict';

  /**
   * Get current total equity (initial + realized PnL + unrealized PnL).
   */
  function getCurrentEquity() {
    const app = window.FTApp;
    if (!app) return 0;
    let eq = app.state.settings.initEquity;
    app.state.closedTrades.forEach(t => eq += t.pnl);
    app.state.trades.forEach(t => {
      const c = app.state.pool.find(x=>x.symbol===t.symbol);
      const curPrice = c ? c.price : t.price;
      const grossPnl = t.dir==='long' ? (curPrice - t.price) * t.multiplier * t.lots : (t.price - curPrice) * t.multiplier * t.lots;
      eq += grossPnl - (t.openCommission || 0);
    });
    return eq;
  }

  /**
   * Get realized equity (initial + closed trade PnL only).
   */
  function getRealizedEquity() {
    const app = window.FTApp;
    if (!app) return 0;
    let eq = app.state.settings.initEquity;
    app.state.closedTrades.forEach(t => eq += t.pnl);
    return eq;
  }

  /**
   * Calculate margin required for a position.
   * @param {number} price - Entry price
   * @param {number} multiplier - Contract multiplier (tons per lot)
   * @param {number} marginRate - Margin rate (e.g. 0.08 for 8%)
   * @param {number} lots - Number of lots
   * @returns {number} Required margin
   */
  function calculateMargin(price, multiplier, marginRate, lots) {
    return price * multiplier * marginRate * lots;
  }

  /**
   * Calculate PnL for a trade at current price.
   * @param {Object} trade - Trade object { dir, price, multiplier, lots, openCommission }
   * @param {number} currentPrice - Current market price
   * @returns {number} Net PnL (gross minus open commission)
   */
  function calculatePnL(trade, currentPrice) {
    const grossPnl = trade.dir==='long'
      ? (currentPrice - trade.price) * trade.multiplier * trade.lots
      : (trade.price - currentPrice) * trade.multiplier * trade.lots;
    return grossPnl - (trade.openCommission || 0);
  }

  /**
   * Calculate risk metrics for a trade.
   * @param {Object} trade - Trade object { price, stopLoss, multiplier, lots, margin }
   * @param {number} equity - Current total equity
   * @returns {Object} { coreRisk, riskPercent, marginPercent }
   */
  function calculateRisk(trade, equity) {
    const eq = Math.max(1, equity);
    const coreRisk = Math.abs(trade.price - trade.stopLoss) * trade.multiplier * trade.lots;
    const riskPercent = coreRisk / eq * 100;
    const marginPercent = trade.margin / eq * 100;
    return { coreRisk, riskPercent, marginPercent };
  }

  /**
   * Update equity history with today's current equity.
   * Appends a new entry if today doesn't exist yet, otherwise updates the last entry.
   */
  function updateEquityHistory() {
    const app = window.FTApp;
    if (!app) return;
    const today = new Date().toISOString().slice(0,10);
    const eq = getCurrentEquity();
    const last = app.state.equityHistory[app.state.equityHistory.length-1];
    if (!last || last.date !== today) {
      app.state.equityHistory.push({date: today, equity: eq});
    } else {
      last.equity = eq;
    }
    app.saveState();
  }

  // ============ EXPORTS ============
  window.FTTrade = {
    getCurrentEquity,
    getRealizedEquity,
    calculateMargin,
    calculatePnL,
    calculateRisk,
    updateEquityHistory
  };
})();
