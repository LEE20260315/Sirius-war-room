// ============ FUTURES TRACKER - CHART ENGINE ============
// Canvas chart drawing: equity curve chart.
// Depends on: FTApp (state)

(function() {
  'use strict';

  /**
   * Draw the equity chart on the #equityChart canvas.
   * Renders a line chart with gradient fill, Y-axis labels, and X-axis date labels.
   */
  function drawEquityChart() {
    const app = window.FTApp;
    if (!app) return;

    const canvas = document.getElementById('equityChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.parentElement.clientWidth - 32;
    const h = 280;
    canvas.width = w * 2;
    canvas.height = h * 2;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(2, 2);
    ctx.clearRect(0, 0, w, h);

    const data = app.state.equityHistory;
    if (data.length < 2) {
      ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text2');
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('需要至少2个数据点才能绘制资金曲线', w/2, h/2);
      return;
    }

    const pad = {top:20, right:20, bottom:30, left:60};
    const cw = w - pad.left - pad.right;
    const ch = h - pad.top - pad.bottom;

    const vals = data.map(d=>d.equity);
    const minV = Math.min(...vals) * 0.95;
    const maxV = Math.max(...vals) * 1.05;
    const range = maxV - minV || 1;

    const textColor = getComputedStyle(document.body).getPropertyValue('--text2');
    const accentColor = getComputedStyle(document.body).getPropertyValue('--accent');
    const gridColor = getComputedStyle(document.body).getPropertyValue('--border');

    // Y grid + labels
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + ch * (1 - i/4);
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left+cw, y); ctx.stroke();
      ctx.fillStyle = textColor; ctx.font = '11px sans-serif'; ctx.textAlign = 'right';
      ctx.fillText('¥'+(minV + range*i/4).toFixed(0), pad.left-5, y+4);
    }

    // X labels
    const step = Math.max(1, Math.floor(data.length / 6));
    ctx.textAlign = 'center';
    data.forEach((d, i) => {
      if (i % step === 0 || i === data.length-1) {
        const x = pad.left + (i/(data.length-1)) * cw;
        ctx.fillStyle = textColor; ctx.font = '10px sans-serif';
        ctx.fillText(d.date.slice(5), x, h - 5);
      }
    });

    // Line
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = pad.left + (i/(data.length-1)) * cw;
      const y = pad.top + ch * (1 - (d.equity - minV)/range);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Gradient fill
    const lastX = pad.left + cw;
    const lastY = pad.top + ch * (1 - (data[data.length-1].equity - minV)/range);
    ctx.lineTo(lastX, pad.top + ch);
    ctx.lineTo(pad.left, pad.top + ch);
    ctx.closePath();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = accentColor;
    ctx.fill();
    ctx.globalAlpha = 1.0;
  }

  // ============ EXPORTS ============
  window.FTChart = {
    drawEquityChart
  };
})();
