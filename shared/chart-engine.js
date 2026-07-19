// ============ SIRIUS CHART ENGINE ============
// 原生 Canvas 2D 图表引擎,无第三方依赖。
// 提供 drawEquityCurve(资金曲线) / drawDrawdownCurve(回撤曲线) / drawAttributionBar(归因柱状图)
// 颜色全部从 CSS 变量读取,自动适配深色/浅色主题。

window.FTChart = (function() {
  // ============ 共享工具 ============
  function getThemeColors() {
    const cs = getComputedStyle(document.documentElement);
    const get = function(name, fallback) {
      const v = cs.getPropertyValue(name).trim();
      return v || fallback;
    };
    return {
      ink: get('--color-ink', '#faf9f5'),
      inkMuted: get('--color-ink-muted', '#b7b5a9'),
      inkDim: get('--color-ink-dim', '#908e84'),
      inkFaint: get('--color-ink-faint', '#6e6d68'),
      edge: get('--color-edge-faint', '#343430'),
      surface: get('--color-surface-base', '#1b1b19'),
      brand: get('--color-brand-500', '#d97757'),
      success: get('--color-success', '#8ca06f'),
      error: get('--color-error', '#ef4444'),
      warning: get('--color-warning', '#fdd835'),
      chart1: get('--color-chart-1', '#b05730'),
      chart2: get('--color-chart-2', '#9c87f5')
    };
  }

  // HiDPI 适配:将 canvas 像素与 CSS 像素对齐,返回逻辑尺寸
  function setupCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(rect.width, 100);
    const cssH = Math.max(rect.height, 60);
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssW, cssH);
    return { ctx: ctx, w: cssW, h: cssH };
  }

  // ============ 资金曲线 ============
  // data: [{date:'YYYY-MM-DD', equity:number}, ...]
  // options: { baseline?:number, color?:string }
  function drawEquityCurve(canvas, data, options) {
    if (!canvas || !data || data.length === 0) return;
    options = options || {};
    const colors = getThemeColors();
    const setup = setupCanvas(canvas);
    const ctx = setup.ctx, w = setup.w, h = setup.h;
    const padding = { top: 16, right: 16, bottom: 24, left: 56 };
    const cw = Math.max(w - padding.left - padding.right, 10);
    const ch = Math.max(h - padding.top - padding.bottom, 10);

    const equities = data.map(function(d) { return d.equity; });
    const minE = Math.min.apply(null, equities);
    const maxE = Math.max.apply(null, equities);
    const range = Math.max(maxE - minE, 1);
    const padRange = range * 0.1;
    const yMin = minE - padRange;
    const yMax = maxE + padRange;
    const yRange = Math.max(yMax - yMin, 1);

    // 网格 + Y 轴标签
    ctx.strokeStyle = colors.edge;
    ctx.lineWidth = 0.5;
    ctx.fillStyle = colors.inkDim;
    ctx.font = '11px Geist Mono, ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (ch / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + cw, y);
      ctx.stroke();
      const val = yMax - (yRange / 4) * i;
      ctx.fillText(Math.round(val).toLocaleString(), padding.left - 6, y);
    }

    // X 轴标签(首/中/末)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const indices = data.length === 1 ? [0] : [0, Math.floor((data.length - 1) / 2), data.length - 1];
    indices.forEach(function(i) {
      const x = padding.left + (cw / (data.length - 1 || 1)) * i;
      const label = (data[i].date || '').slice(5);
      ctx.fillText(label, x, padding.top + ch + 6);
    });

    // 基准线(初始资金)
    if (options.baseline != null) {
      const baseY = padding.top + ch - ((options.baseline - yMin) / yRange) * ch;
      if (baseY >= padding.top && baseY <= padding.top + ch) {
        ctx.strokeStyle = colors.inkFaint;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(padding.left, baseY);
        ctx.lineTo(padding.left + cw, baseY);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // 主曲线
    const lineColor = options.color || colors.brand;
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    data.forEach(function(d, i) {
      const x = padding.left + (cw / (data.length - 1 || 1)) * i;
      const y = padding.top + ch - ((d.equity - yMin) / yRange) * ch;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 渐变填充(从曲线到底部)
    const grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + ch);
    grad.addColorStop(0, hexWithAlpha(lineColor, 0.25));
    grad.addColorStop(1, hexWithAlpha(lineColor, 0));
    ctx.fillStyle = grad;
    ctx.lineTo(padding.left + cw, padding.top + ch);
    ctx.lineTo(padding.left, padding.top + ch);
    ctx.closePath();
    ctx.fill();
  }

  // ============ 回撤曲线 ============
  // data: [{date, equity}, ...] — 内部自动计算回撤百分比
  function drawDrawdownCurve(canvas, data, options) {
    if (!canvas || !data || data.length === 0) return;
    options = options || {};
    const colors = getThemeColors();
    const setup = setupCanvas(canvas);
    const ctx = setup.ctx, w = setup.w, h = setup.h;
    const padding = { top: 16, right: 16, bottom: 24, left: 56 };
    const cw = Math.max(w - padding.left - padding.right, 10);
    const ch = Math.max(h - padding.top - padding.bottom, 10);

    // 计算回撤(负数百分比)
    const drawdowns = [];
    let peak = data[0].equity;
    data.forEach(function(d) {
      if (d.equity > peak) peak = d.equity;
      const dd = peak > 0 ? (d.equity - peak) / peak * 100 : 0;
      drawdowns.push({ date: d.date, dd: dd });
    });

    const minDd = Math.min.apply(null, drawdowns.map(function(d) { return d.dd; }).concat([0]));
    const yMax = 0;
    const yMin = Math.min(minDd, -1);
    const yRange = Math.max(yMax - yMin, 1);

    // 网格
    ctx.strokeStyle = colors.edge;
    ctx.lineWidth = 0.5;
    ctx.fillStyle = colors.inkDim;
    ctx.font = '11px Geist Mono, ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (ch / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + cw, y);
      ctx.stroke();
      const val = yMax - (yRange / 4) * i;
      ctx.fillText(val.toFixed(1) + '%', padding.left - 6, y);
    }

    // X 轴
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const indices = drawdowns.length === 1 ? [0] : [0, Math.floor((drawdowns.length - 1) / 2), drawdowns.length - 1];
    indices.forEach(function(i) {
      const x = padding.left + (cw / (drawdowns.length - 1 || 1)) * i;
      const label = (drawdowns[i].date || '').slice(5);
      ctx.fillText(label, x, padding.top + ch + 6);
    });

    // 0 线(顶部)
    ctx.strokeStyle = colors.inkFaint;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left + cw, padding.top);
    ctx.stroke();

    // 填充区(从 0 到回撤值,红色渐变)
    const grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + ch);
    grad.addColorStop(0, hexWithAlpha(colors.error, 0.15));
    grad.addColorStop(1, hexWithAlpha(colors.error, 0.55));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    drawdowns.forEach(function(d, i) {
      const x = padding.left + (cw / (drawdowns.length - 1 || 1)) * i;
      const y = padding.top + ((yMax - d.dd) / yRange) * ch;
      ctx.lineTo(x, y);
    });
    ctx.lineTo(padding.left + cw, padding.top);
    ctx.closePath();
    ctx.fill();

    // 边线
    ctx.strokeStyle = colors.error;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    drawdowns.forEach(function(d, i) {
      const x = padding.left + (cw / (drawdowns.length - 1 || 1)) * i;
      const y = padding.top + ((yMax - d.dd) / yRange) * ch;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  // ============ 归因柱状图 ============
  // data: [{label:string, value:number}, ...] — value 可正可负
  function drawAttributionBar(canvas, data, options) {
    if (!canvas || !data || data.length === 0) return;
    options = options || {};
    const colors = getThemeColors();
    const setup = setupCanvas(canvas);
    const ctx = setup.ctx, w = setup.w, h = setup.h;
    const padding = { top: 12, right: 8, bottom: 32, left: 56 };
    const cw = Math.max(w - padding.left - padding.right, 10);
    const ch = Math.max(h - padding.top - padding.bottom, 10);

    const values = data.map(function(d) { return d.value; });
    const maxAbs = Math.max.apply(null, values.map(Math.abs).concat([1]));

    // 中线(0)
    const zeroY = padding.top + ch / 2;
    ctx.strokeStyle = colors.edge;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(padding.left, zeroY);
    ctx.lineTo(padding.left + cw, zeroY);
    ctx.stroke();

    // Y 轴标签
    ctx.fillStyle = colors.inkDim;
    ctx.font = '11px Geist Mono, ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('+' + maxAbs.toFixed(0), padding.left - 6, padding.top);
    ctx.fillText('0', padding.left - 6, zeroY);
    ctx.fillText('-' + maxAbs.toFixed(0), padding.left - 6, padding.top + ch);

    // 柱
    const slotW = cw / data.length;
    const barW = slotW * 0.7;
    const gap = slotW * 0.3;
    data.forEach(function(d, i) {
      const x = padding.left + slotW * i + gap / 2;
      const barH = (Math.abs(d.value) / maxAbs) * (ch / 2);
      const y = d.value >= 0 ? zeroY - barH : zeroY;
      ctx.fillStyle = d.value >= 0 ? colors.success : colors.error;
      ctx.fillRect(x, y, barW, barH);
      // 标签
      ctx.fillStyle = colors.inkFaint;
      ctx.font = '10px Poppins, ui-sans-serif, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const rawLabel = d.label || '';
      const label = rawLabel.length > 6 ? rawLabel.slice(0, 5) + '…' : rawLabel;
      ctx.fillText(label, x + barW / 2, padding.top + ch + 6);
    });
  }

  // ============ 工具:hex 颜色加 alpha ============
  function hexWithAlpha(color, alpha) {
    if (!color) return 'rgba(217,119,87,' + alpha + ')';
    if (color.startsWith('rgb')) return color;
    const hex = color.replace('#', '');
    if (hex.length !== 6) return 'rgba(217,119,87,' + alpha + ')';
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  return {
    drawEquityCurve: drawEquityCurve,
    drawDrawdownCurve: drawDrawdownCurve,
    drawAttributionBar: drawAttributionBar,
    getThemeColors: getThemeColors,
    _hexWithAlpha: hexWithAlpha
  };
})();
