// ============ FUTURES TRACKER - SIGNAL ENGINE ============
// Pure signal calculation logic.
// Depends on: FTApp (state)

(function() {
  'use strict';

  /**
   * Check if a symbol qualifies as a "sweet signal" (甜点级).
   * A sweet signal requires: valScore >= 4, supplyScore >= 4, catalystScore >= 4
   * Valuation score is derived from percentile:
   *   percentile <= 25 -> score 5
   *   percentile <= 40 -> score 3
   *   otherwise         -> score 1
   */
  function isSweetSignal(symbol) {
    const app = window.FTApp;
    if (!app) return false;
    const c = app.state.pool.find(x => x.symbol === symbol);
    if (!c) return false;
    const fund = app.state.fundamentals[c.symbol] || {};
    const valScore = c.percentile <= 25 ? 5 : c.percentile <= 40 ? 3 : 1;
    const supplyScore = (fund.supply && fund.supply.score) || 3;
    const catalystScore = (fund.catalyst && fund.catalyst.score) || 3;
    return valScore >= 4 && supplyScore >= 4 && catalystScore >= 4;
  }

  /**
   * Calculate valuation score from percentile.
   * Returns a score 1-5:
   *   <= 15 -> 5 (deep value)
   *   <= 25 -> 4 (low value)
   *   <= 40 -> 3 (moderate)
   *   <= 60 -> 2 (slightly high)
   *   >  60 -> 1 (expensive)
   */
  function calculateValuationScore(percentile) {
    if (percentile <= 15) return 5;
    if (percentile <= 25) return 4;
    if (percentile <= 40) return 3;
    if (percentile <= 60) return 2;
    return 1;
  }

  /**
   * Calculate full signal data for a single commodity.
   * Returns object:
   *   { symbol, valScore, supplyScore, catalystScore, total, maxTotal, ratio, level, isSweet }
   * level is one of: 'sweet', 'light', 'watch'
   */
  function calculateSignal(commodity, fundamentals) {
    const fund = fundamentals || {};
    const valScore = calculateValuationScore(commodity.percentile);
    const supplyScore = (fund.supply && fund.supply.score) || 3;
    const catalystScore = (fund.catalyst && fund.catalyst.score) || 3;
    const total = valScore + supplyScore + catalystScore;
    const maxTotal = 15;
    const ratio = total / maxTotal;

    let level, isSweet;
    if (valScore >= 4 && supplyScore >= 4 && catalystScore >= 4) {
      level = 'sweet';
      isSweet = true;
    } else if (ratio >= 0.5) {
      level = 'light';
      isSweet = false;
    } else {
      level = 'watch';
      isSweet = false;
    }

    return { symbol: commodity.symbol, valScore, supplyScore, catalystScore, total, maxTotal, ratio, level, isSweet };
  }

  /**
   * Calculate signals for the entire pool.
   * Returns array of signal objects sorted by total score descending.
   */
  function calculateSignals() {
    const app = window.FTApp;
    if (!app) return [];
    return app.state.pool
      .map(c => calculateSignal(c, app.state.fundamentals[c.symbol] || {}))
      .sort((a, b) => b.total - a.total);
  }

  // ============ EXPORTS ============
  window.FTSignal = {
    isSweetSignal,
    calculateValuationScore,
    calculateSignal,
    calculateSignals
  };
})();
